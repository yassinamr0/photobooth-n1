"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebase, missingFirebaseEnv } from "@/lib/firebase/client";
import { isSigningOut, listen, unsubscribeAll } from "@/lib/firebase/listeners";
import {
  clearMissingProfileTimer,
  startMissingProfileTimer,
} from "@/lib/auth/missingProfileTimer";
import { authErrorMessage } from "@/lib/auth/errors";
import { parseUserDoc, userDocRef, type UserProfile } from "@/lib/users";

export type AuthStatus =
  | "unconfigured" // Firebase env vars missing
  | "loading" // waiting for Firebase Auth to resolve
  | "signedOut"
  | "settingUp" // signed in, profile doc not there yet — within the grace period
  | "missingProfile" // grace period elapsed, still no doc → "Finish setting up"
  | "pending" // profile exists, not approved
  | "approved"
  | "error";

type AuthState = {
  status: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
  error: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

const initial: AuthState = {
  status: missingFirebaseEnv.length ? "unconfigured" : "loading",
  user: null,
  profile: null,
  error: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initial);

  useEffect(() => {
    if (missingFirebaseEnv.length) return;
    const { auth } = firebase();
    let unsubProfile: (() => void) | null = null;

    const stopProfile = () => {
      clearMissingProfileTimer();
      unsubProfile?.();
      unsubProfile = null;
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      stopProfile();

      if (!user) {
        // Safety net for sign-outs that didn't go through logout() (token revoked, etc.).
        unsubscribeAll();
        setState({ status: "signedOut", user: null, profile: null, error: null });
        return;
      }

      setState({ status: "loading", user, profile: null, error: null });

      unsubProfile = listen(
        userDocRef(user.uid),
        (snap) => {
          if (snap.exists()) {
            clearMissingProfileTimer();
            const profile = parseUserDoc(user.uid, snap.data());
            setState({
              status: profile.approved ? "approved" : "pending",
              user,
              profile,
              error: null,
            });
            return;
          }

          // No profile doc. Their own signup write may still be in flight, so wait before
          // offering the recovery screen. Only start the clock once the SERVER has confirmed
          // the doc is missing — a cache-only miss (e.g. offline) must never send an existing
          // user to "Finish setting up".
          setState((s) =>
            s.status === "missingProfile" ? s : { status: "settingUp", user, profile: null, error: null },
          );
          if (!snap.metadata.fromCache) {
            startMissingProfileTimer(() => {
              if (isSigningOut()) return;
              setState((s) =>
                s.user?.uid === user.uid && s.status === "settingUp"
                  ? { ...s, status: "missingProfile" }
                  : s,
              );
            });
          }
        },
        (err) => {
          setState({ status: "error", user, profile: null, error: authErrorMessage(err) });
        },
        // Needed so we're told when a cache-only "missing" is confirmed by the server.
        { includeMetadataChanges: true },
      );
    });

    return () => {
      unsubAuth();
      stopProfile();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
