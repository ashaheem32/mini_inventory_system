import { PAGE_SIZE } from "../../config";
import { ApiError, apiRequest } from "../../lib/api";
import type { Category, Paginated, Product, ProductListParams, ProductPayload } from "./types";

/**
 * The list endpoint answers 404 {"detail": "Invalid page."} for a page past the end.
 * This is distinct from a missing product (detail 404). `lastValidPage` tells the
 * UI where to go instead.
 */
export class InvalidPageError extends ApiError {
  readonly page: number;
  readonly lastValidPage: number;
  constructor(page: number, lastValidPage: number) {
    super(404, { detail: "Invalid page." }, `Page ${page} does not exist`);
    this.name = "InvalidPageError";
    this.page = page;
    this.lastValidPage = lastValidPage;
  }
}

export function productListQueryString({ page, category, search }: ProductListParams): string {
  const qs = new URLSearchParams();
  if (page > 1) qs.set("page", String(page));
  if (category !== null) qs.set("category", String(category));
  if (search) qs.set("search", search);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function fetchProducts(params: ProductListParams, signal?: AbortSignal) {
  try {
    return await apiRequest<Paginated<Product>>(`/api/products/${productListQueryString(params)}`, { signal });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404 || params.page <= 1) throw error;
  }
  // Page is past the end (e.g. rows were deleted): find the last page that exists.
  const first = await apiRequest<Paginated<Product>>(
    `/api/products/${productListQueryString({ ...params, page: 1 })}`,
    { signal },
  );
  throw new InvalidPageError(params.page, Math.max(1, Math.ceil(first.count / PAGE_SIZE)));
}

export function fetchProduct(id: number, signal?: AbortSignal) {
  return apiRequest<Product>(`/api/products/${id}/`, { signal });
}

export function fetchCategories(signal?: AbortSignal) {
  return apiRequest<Category[]>("/api/categories/", { signal });
}

export function createProduct(payload: ProductPayload) {
  return apiRequest<Product>("/api/products/", { method: "POST", body: payload });
}

export function updateProduct(id: number, payload: ProductPayload) {
  return apiRequest<Product>(`/api/products/${id}/`, { method: "PUT", body: payload });
}

export function deleteProduct(id: number) {
  return apiRequest<void>(`/api/products/${id}/`, { method: "DELETE" });
}
