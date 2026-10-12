import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  createProduct,
  deleteProduct,
  fetchCategories,
  fetchProduct,
  fetchProducts,
  updateProduct,
} from "./api";
import type { Paginated, Product, ProductListParams, ProductPayload } from "./types";

export const productKeys = {
  lists: ["products"] as const,
  list: (params: ProductListParams) => ["products", params] as const,
  detail: (id: number) => ["product", id] as const,
};
export const categoriesKey = ["categories"] as const;

/**
 * After a server-confirmed create/update: drop list pages nobody is looking at
 * (so returning to the list never shows a pre-save snapshot) and refetch visible ones.
 */
async function refreshProductLists(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: productKeys.lists, type: "inactive" });
  await queryClient.invalidateQueries({ queryKey: productKeys.lists });
}

export function useProductsQuery(params: ProductListParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    // Passing the signal lets TanStack Query abort requests for keys nobody observes any more.
    queryFn: ({ signal }) => fetchProducts(params, signal),
    // Keep showing the previous rows (flagged as placeholder) while the next page/filter loads.
    placeholderData: keepPreviousData,
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: categoriesKey,
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: 5 * 60_000,
  });
}

export function useProductQuery(id: number | null) {
  return useQuery({
    queryKey: productKeys.detail(id ?? -1),
    queryFn: ({ signal }) => fetchProduct(id as number, signal),
    enabled: id !== null,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductPayload) => createProduct(payload),
    onSuccess: async (product) => {
      queryClient.setQueryData(productKeys.detail(product.id), product);
      await refreshProductLists(queryClient);
    },
  });
}

export function useUpdateProduct(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductPayload) => updateProduct(id, payload),
    onSuccess: async (product) => {
      queryClient.setQueryData(productKeys.detail(id), product);
      await refreshProductLists(queryClient);
    },
  });
}

/**
 * Server-confirmed delete. The caller decides which list page to show next;
 * cache cleanup happens here after the server returns 204.
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Product) => deleteProduct(product.id),
    onSuccess: (_data, product) => {
      queryClient.removeQueries({ queryKey: productKeys.detail(product.id), exact: true });
      // Drop the row from cached pages so placeholders never show it again.
      queryClient.setQueriesData<Paginated<Product>>({ queryKey: productKeys.lists }, (old) =>
        old && old.results.some((p) => p.id === product.id)
          ? { ...old, count: Math.max(0, old.count - 1), results: old.results.filter((p) => p.id !== product.id) }
          : old,
      );
    },
  });
}
