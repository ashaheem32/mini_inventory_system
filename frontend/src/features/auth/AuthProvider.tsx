import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, isAbortError, setUnauthorizedHandler } from "../../lib/api";
import { tokenStore } from "../../lib/tokenStore";
import { fetchCurrentUser, loginRequest, logoutRequest } from "./api";
import {
  AuthContext,
  LOGOUT_NOT_REVOKED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  type AuthContextValue,
  type AuthStatus,
} from "./useAuth";
import type { User } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(() => (tokenStore.get() ? "checking" : "anonymous"));
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifyAttempt, setVerifyAttempt] = useState(0);

  const resetLocal = useCallback(() => {
    tokenStore.clear();
    queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
    setStatus("anonymous");
  }, [queryClient]);

  // Verify a stored token on startup before rendering protected content.
  useEffect(() => {
    if (status !== "checking") return;
    const token = tokenStore.get();
    if (!token) {
      setStatus("anonymous");
      return;
    }
    const controller = new AbortController();
    fetchCurrentUser(token, controller.signal)
      .then((me) => {
        setUser(me);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        if (error instanceof ApiError && error.status === 401) {
          tokenStore.clear();
          setStatus("anonymous");
        } else {
          setStatus("unverified");
        }
      });
    return () => controller.abort();
  }, [status, verifyAttempt]);

  // Any protected request that gets 401 ends the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!tokenStore.get()) return; // already signed out
      resetLocal();
      setNotice(SESSION_EXPIRED_MESSAGE);
    });
    return () => setUnauthorizedHandler(null);
  }, [resetLocal]);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginRequest(username, password);
      queryClient.clear();
      tokenStore.set(result.token);
      setUser(result.user);
      setNotice(null);
      setStatus("authenticated");
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    let revoked = true;
    try {
      await logoutRequest();
    } catch (error) {
      // 401 means the token is already invalid on the server.
      revoked = error instanceof ApiError && error.status === 401;
    }
    resetLocal();
    setNotice(revoked ? null : LOGOUT_NOT_REVOKED_MESSAGE);
  }, [resetLocal]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      notice,
      clearNotice: () => setNotice(null),
      login,
      logout,
      retryVerification: () => {
        setStatus("checking");
        setVerifyAttempt((n) => n + 1);
      },
      signOutLocally: resetLocal,
    }),
    [status, user, notice, login, logout, resetLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
