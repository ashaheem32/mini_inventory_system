/**
 * In-memory implementation of docs/API_CONTRACT.md used as a fetch mock.
 * Behaviour mirrors the Django backend: page size 10, newest first,
 * name-only case-insensitive search, DRF-shaped errors.
 */
import { vi } from "vitest";

import type { Category, Product } from "../features/products/types";

export const API = "http://127.0.0.1:8000";
export const VALID_TOKEN = "valid-token-123";
const PAGE_SIZE = 10;

export interface RecordedRequest {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
  auth: string | null;
}

type Handler = (req: RecordedRequest) => Response | undefined | Promise<Response | undefined>;

export function json(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const defaultCategories: Category[] = [
  { id: 4, name: "Accessories" },
  { id: 1, name: "Electronics" },
  { id: 3, name: "Kitchen" },
];

export function makeProduct(id: number, overrides: Partial<Product> = {}): Product {
  const category = overrides.category ?? 1;
  return {
    id,
    name: `Product ${id}`,
    price: "10.00",
    stock: 5,
    category,
    category_name: defaultCategories.find((c) => c.id === category)?.name ?? "Electronics",
    is_active: true,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, id)).toISOString(),
    ...overrides,
  };
}

export function makeProducts(count: number): Product[] {
  return Array.from({ length: count }, (_, i) => makeProduct(i + 1));
}

interface Options {
  products?: Product[];
  categories?: Category[];
}

export function createMockApi({ products = makeProducts(3), categories = defaultCategories }: Options = {}) {
  const db = { products: [...products], categories: [...categories], tokens: new Set([VALID_TOKEN]) };
  const requests: RecordedRequest[] = [];
  const overrides: { method: string; pattern: RegExp; handler: Handler; once: boolean }[] = [];
  let nextId = Math.max(0, ...db.products.map((p) => p.id)) + 1;

  const authed = (req: RecordedRequest) => {
    const token = req.auth?.replace(/^Token /, "");
    return !!token && db.tokens.has(token);
  };
  const unauthorized = (req: RecordedRequest) =>
    json({ detail: req.auth ? "Invalid token." : "Authentication credentials were not provided." }, 401);

  function validate(body: Record<string, unknown>, partial: boolean) {
    const errors: Record<string, string[]> = {};
    const has = (k: string) => k in body;
    if (!partial || has("name")) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!has("name")) errors.name = ["This field is required."];
      else if (!name) errors.name = ["This field may not be blank."];
      else if (name.length > 200) errors.name = ["Ensure this field has no more than 200 characters."];
    }
    if (!partial || has("price")) {
      if (!has("price")) errors.price = ["This field is required."];
      else if (Number(body.price) <= 0) errors.price = ["Price must be greater than zero."];
    }
    if (!partial || has("stock")) {
      if (!has("stock")) errors.stock = ["This field is required."];
      else if (!Number.isInteger(body.stock)) errors.stock = ["A valid integer is required."];
      else if ((body.stock as number) < 0) errors.stock = ["Stock cannot be negative."];
    }
    if (!partial || has("category")) {
      if (!has("category")) errors.category = ["This field is required."];
      else if (!db.categories.some((c) => c.id === body.category))
        errors.category = [`Invalid pk "${String(body.category)}" - object does not exist.`];
    }
    return errors;
  }

  function toProduct(id: number, body: Record<string, unknown>, existing?: Product): Product {
    const category = (body.category as number | undefined) ?? existing!.category;
    return {
      id,
      name: typeof body.name === "string" ? body.name.trim() : existing!.name,
      price: body.price !== undefined ? Number(body.price).toFixed(2) : existing!.price,
      stock: (body.stock as number | undefined) ?? existing!.stock,
      category,
      category_name: db.categories.find((c) => c.id === category)!.name,
      is_active: (body.is_active as boolean | undefined) ?? existing?.is_active ?? true,
      created_at: existing?.created_at ?? new Date(Date.UTC(2026, 5, 1, 0, 0, id)).toISOString(),
    };
  }

  function route(req: RecordedRequest): Response {
    const { method, path, search } = req;
    if (method === "POST" && path === "/api/auth/login/") {
      const { username, password } = (req.body ?? {}) as Record<string, string>;
      if (!username || !password) {
        const e: Record<string, string[]> = {};
        if (!username) e.username = ["This field is required."];
        if (!password) e.password = ["This field is required."];
        return json(e, 400);
      }
      if (username === "demo" && password === "demo-pass-2026") {
        return json({ token: VALID_TOKEN, user: { id: 1, username: "demo" } });
      }
      return json({ non_field_errors: ["Unable to log in with the provided credentials."] }, 400);
    }
    if (!authed(req)) return unauthorized(req);

    if (method === "GET" && path === "/api/auth/me/") return json({ id: 1, username: "demo" });
    if (method === "POST" && path === "/api/auth/logout/") {
      db.tokens.delete(req.auth!.replace(/^Token /, ""));
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && path === "/api/categories/") {
      return json([...db.categories].sort((a, b) => a.name.localeCompare(b.name)));
    }
    if (path === "/api/products/") {
      if (method === "GET") {
        const category = search.get("category");
        if (category !== null && !/^\d+$/.test(category)) return json({ category: ["Enter a number."] }, 400);
        const terms = (search.get("search") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        const rows = db.products
          .filter((p) => category === null || p.category === Number(category))
          .filter((p) => terms.every((t) => p.name.toLowerCase().includes(t)))
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
        const page = Number(search.get("page") ?? "1");
        const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        if (!Number.isInteger(page) || page < 1 || page > pages) return json({ detail: "Invalid page." }, 404);
        const link = (n: number) => {
          const qs = new URLSearchParams(search);
          if (n === 1) qs.delete("page");
          else qs.set("page", String(n));
          const s = qs.toString();
          return `${API}/api/products/${s ? `?${s}` : ""}`;
        };
        return json({
          count: rows.length,
          next: page < pages ? link(page + 1) : null,
          previous: page > 1 ? link(page - 1) : null,
          results: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        });
      }
      if (method === "POST") {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const errors = validate(body, false);
        if (Object.keys(errors).length) return json(errors, 400);
        const product = toProduct(nextId++, body);
        db.products.push(product);
        return json(product, 201);
      }
    }
    const detail = path.match(/^\/api\/products\/(\d+)\/$/);
    if (detail) {
      const id = Number(detail[1]);
      const index = db.products.findIndex((p) => p.id === id);
      if (index === -1) return json({ detail: "No Product matches the given query." }, 404);
      if (method === "GET") return json(db.products[index]);
      if (method === "DELETE") {
        db.products.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      if (method === "PUT" || method === "PATCH") {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const errors = validate(body, method === "PATCH");
        if (Object.keys(errors).length) return json(errors, 400);
        db.products[index] = toProduct(id, body, db.products[index]);
        return json(db.products[index]);
      }
    }
    return json({ detail: "Not found." }, 404);
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    const req: RecordedRequest = {
      method: (init.method ?? "GET").toUpperCase(),
      path: url.pathname,
      search: url.searchParams,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      auth: headers.get("Authorization"),
    };
    requests.push(req);
    const signal = init.signal;
    const abortError = () => new DOMException("The operation was aborted.", "AbortError");
    if (signal?.aborted) throw abortError();

    const override = overrides.find((o) => o.method === req.method && o.pattern.test(`${req.path}${url.search}`));
    if (override?.once) overrides.splice(overrides.indexOf(override), 1);
    const result = override ? await override.handler(req) : undefined;
    if (signal?.aborted) throw abortError();
    return result ?? route(req);
  });

  return {
    db,
    requests,
    fetch: fetchMock,
    /** Intercept matching requests (path + query). Return undefined to fall through. */
    on(method: string, pattern: RegExp, handler: Handler, { once = false } = {}) {
      overrides.push({ method, pattern, handler, once });
    },
    install() {
      vi.stubGlobal("fetch", fetchMock);
      return this;
    },
    listRequests() {
      return requests.filter((r) => r.method === "GET" && r.path === "/api/products/");
    },
  };
}

export type MockApi = ReturnType<typeof createMockApi>;

/** A promise you can resolve later, for holding a request open. */
export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
