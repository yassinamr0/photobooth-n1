/*
 * The self-healing signup timer lives at module level so logout() can clear it before
 * detaching listeners — otherwise it could fire after logout and flash "Finish setting up".
 */

/** How long to wait for an in-flight signup profile write before offering "Finish setting up". */
export const MISSING_PROFILE_GRACE_MS = 4000;

let timer: ReturnType<typeof setTimeout> | null = null;

export function startMissingProfileTimer(onElapsed: () => void) {
  if (timer) return; // already waiting — never restart the clock
  timer = setTimeout(() => {
    timer = null;
    onElapsed();
  }, MISSING_PROFILE_GRACE_MS);
}

export function clearMissingProfileTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}
