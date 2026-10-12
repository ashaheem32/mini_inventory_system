export const config = {
  // Unset: local Django dev server. Empty string: same origin (Docker/nginx proxies /api/).
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, ""),
  currency: import.meta.env.VITE_CURRENCY || "USD",
  locale: import.meta.env.VITE_LOCALE || "en-US",
};

/** Must match the backend PageNumberPagination page size. */
export const PAGE_SIZE = 10;
