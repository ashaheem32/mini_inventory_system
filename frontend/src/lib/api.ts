import { config } from "../config";
import { tokenStore } from "./tokenStore";

/** DRF error body: field errors, non_field_errors, or {detail}. */
export type ApiErrorBody = Record<string, unknown> | null;

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody, message?: string) {
    super(message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get detail(): string | undefined {
    const detail = this.body?.detail;
    return typeof detail === "string" ? detail : undefined;
  }
}

/** Network failure (server unreachable, CORS, offline). */
export class NetworkError extends Error {
  constructor() {
    super("Network request failed");
    this.name = "NetworkError";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** Called when an authenticated request receives 401 (token expired or revoked). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Send without the Authorization header (login). */
  anonymous?: boolean;
  /** Use this token instead of the stored one (startup verification). */
  token?: string;
  /** Do not trigger the global 401 handler. */
  skipUnauthorizedHandler?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, anonymous = false, skipUnauthorizedHandler = false } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = anonymous ? null : (options.token ?? tokenStore.get());
  if (token) headers.Authorization = `Token ${token}`;

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new NetworkError();
  }

  if (response.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token && !skipUnauthorizedHandler) onUnauthorized?.();
    const errorBody = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
    throw new ApiError(response.status, errorBody);
  }
  return data as T;
}

/** Field-level messages from a DRF 400 response, joined per field. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 400 || !error.body) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(error.body)) {
    if (Array.isArray(value)) result[key] = value.map(String).join(" ");
    else if (typeof value === "string") result[key] = value;
  }
  return result;
}
