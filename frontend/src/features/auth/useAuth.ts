import { createContext, useContext } from "react";

import type { User } from "./types";

/**
 * checking: a stored token is being verified (render nothing protected yet)
 * unverified: verification failed for a non-auth reason (server unreachable)
 */
export type AuthStatus = "checking" | "authenticated" | "anonymous" | "unverified";

export const SESSION_EXPIRED_MESSAGE = "Your session has ended. Please sign in again.";
export const LOGOUT_NOT_REVOKED_MESSAGE =
  "You are signed out on this device, but the server could not be reached to end your session. " +
  "If this is a shared computer, close this browser tab.";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** One-off message for the login screen (session expiry, logout problems). */
  notice: string | null;
  clearNotice: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retryVerification: () => void;
  signOutLocally: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
