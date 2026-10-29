// Codes come from signIn() (app/actions/auth.ts) and requireApprovedSession() (lib/auth/guards.ts).
const loginErrors: Record<string, string> = {
  AUTH_FAILED: "Email or password is incorrect. Check them and try again.",
  INVALID_INPUT: "Enter a valid email and a password of at least 6 characters.",
  pending: "Your account is waiting for owner approval. You can sign in once the owner approves it.",
  rejected: "Your registration was not approved. Contact the fleet owner.",
  deactivated: "Your account has been deactivated. Contact the fleet owner.",
  SESSION_EXPIRED: "Your session ended. Sign in again to continue.",
};

export function loginErrorMessage(code: string | undefined) {
  if (!code) return undefined;
  return loginErrors[code] ?? "We could not sign you in. Try again.";
}
