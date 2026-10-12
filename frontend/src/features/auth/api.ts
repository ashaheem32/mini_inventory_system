import { apiRequest } from "../../lib/api";
import type { LoginResponse, User } from "./types";

export function loginRequest(username: string, password: string) {
  return apiRequest<LoginResponse>("/api/auth/login/", {
    method: "POST",
    body: { username, password },
    anonymous: true,
  });
}

export function fetchCurrentUser(token: string, signal?: AbortSignal) {
  return apiRequest<User>("/api/auth/me/", { token, signal, skipUnauthorizedHandler: true });
}

export function logoutRequest() {
  return apiRequest<void>("/api/auth/logout/", { method: "POST", skipUnauthorizedHandler: true });
}
