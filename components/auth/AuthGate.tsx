"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { FinishSetup } from "./FinishSetup";
import {
  ApprovedHome,
  AuthErrorScreen,
  FirebaseNotConfigured,
  LoadingScreen,
  PendingApproval,
  SettingUpScreen,
} from "./StatusScreens";

/** Picks the screen for the current auth state. */
export function AuthGate() {
  const { status } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [prevStatus, setPrevStatus] = useState(status);

  // Whenever we arrive at signedOut from another state (i.e. after a logout), start at Login.
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === "signedOut" && mode !== "login") setMode("login");
  }

  switch (status) {
    case "unconfigured":
      return <FirebaseNotConfigured />;
    case "loading":
      return <LoadingScreen />;
    case "signedOut":
      return mode === "login" ? (
        <LoginForm onSwitchToSignup={() => setMode("signup")} />
      ) : (
        <SignupForm onSwitchToLogin={() => setMode("login")} />
      );
    case "settingUp":
      return <SettingUpScreen />;
    case "missingProfile":
      return <FinishSetup />;
    case "pending":
      return <PendingApproval />;
    case "approved":
      return <ApprovedHome />;
    case "error":
      return <AuthErrorScreen />;
  }
}
