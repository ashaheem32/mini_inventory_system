import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { Button, ButtonLink } from "../../components/Button";
import { Alert, StatePanel, Toast } from "../../components/Feedback";
import fieldStyles from "../../components/Field.module.css";
import { PAGE_SIZE } from "../../config";
import { ApiError, NetworkError } from "../../lib/api";
import { formatCount } from "../../lib/format";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { InvalidPageError } from "./api";
import { DeleteProductDialog } from "./DeleteProductDialog";
import styles from "./ProductsPage.module.css";
import { ProductTable, ProductTableSkeleton } from "./ProductTable";
import { productKeys, useCategoriesQuery, useDeleteProduct, useProductsQuery } from "./queries";
import type { Product } from "./types";
import { useProductListParams } from "./useProductListParams";
import { useQueryClient } from "@tanstack/react-query";

export const SEARCH_DEBOUNCE_MS = 300;

function deleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "This product no longer exists. It may have been deleted by someone else.";
  }
  if (error instanceof NetworkError) return "Couldn't reach the server. Check your connection and try again.";
  return "The product couldn't be deleted. Please try again.";
}

export function ProductsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { params, update, queryString } = useProductListParams();
  const listUrl = `/products${queryString ? `?${queryString}` : ""}`;

  // --- success notification handed over from the form pages via router state
  const [notice, setNotice] = useState<string | null>(
    () => (location.state as { notice?: string } | null)?.notice ?? null,
  );
  useEffect(() => {
    if ((location.state as { notice?: string } | null)?.notice) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    }
  }, [location, navigate]);
  const dismissNotice = useCallback(() => setNotice(null), []);

  // --- search box: local state, debounced into the URL
  const [searchInput, setSearchInput] = useState(params.search);
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const urlSearchRef = useRef(params.search);
  urlSearchRef.current = params.search;

  // Only a *new* debounced value may write to the URL. Other re-runs (e.g. after
  // back/forward or Clear filters) would otherwise push a stale search back.
  const lastDebouncedRef = useRef(debouncedSearch);
  useEffect(() => {
    if (lastDebouncedRef.current === debouncedSearch) return;
    lastDebouncedRef.current = debouncedSearch;
    if (debouncedSearch.trim() !== urlSearchRef.current) {
      update({ search: debouncedSearch }, { replace: true });
    }
  }, [debouncedSearch, update]);

  // Back/forward (or Clear filters) changed the URL: reflect it in the input.
  useEffect(() => {
    setSearchInput((current) => (current.trim() === params.search ? current : params.search));
  }, [params.search]);

  // --- data
  const products = useProductsQuery(params);
  const categories = useCategoriesQuery();
  const data = products.data;
  const stale = products.isPlaceholderData;
  const searchPending = searchInput.trim() !== params.search;

  // A page that no longer exists (e.g. after deletions elsewhere): step back.
  const lastValidPage = products.error instanceof InvalidPageError ? products.error.lastValidPage : null;
  const invalidPage = lastValidPage !== null && lastValidPage < params.page;
  useEffect(() => {
    if (invalidPage && lastValidPage !== null) update({ page: lastValidPage }, { replace: true });
  }, [invalidPage, lastValidPage, update]);

  // --- delete flow
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMutation = useDeleteProduct();
  const deletedRef = useRef(false);

  const openDelete = (product: Product, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    deletedRef.current = false;
    setDeleteError(null);
    deleteMutation.reset();
    setToDelete(product);
  };

  const cancelDelete = () => {
    if (deleteMutation.isPending) return;
    setToDelete(null);
    setDeleteError(null);
  };

  const confirmDelete = () => {
    if (!toDelete || deleteMutation.isPending) return;
    const product = toDelete;
    const pageWillBeEmpty = (data?.results.length ?? 0) <= 1 && params.page > 1;
    setDeleteError(null);
    deleteMutation.mutate(product, {
      onSuccess: () => {
        deletedRef.current = true;
        setToDelete(null);
        setNotice(`"${product.name}" was deleted.`);
        if (pageWillBeEmpty) {
          // Move to the previous valid page; its cached data is stale so it refetches.
          void queryClient.invalidateQueries({ queryKey: productKeys.lists, refetchType: "none" });
          update({ page: params.page - 1 });
        } else {
          void queryClient.invalidateQueries({ queryKey: productKeys.lists });
        }
      },
      onError: (error) => {
        setDeleteError(deleteErrorMessage(error));
        if (error instanceof ApiError && error.status === 404) {
          void queryClient.invalidateQueries({ queryKey: productKeys.lists });
        }
      },
    });
  };

  const filtersActive = params.search !== "" || params.category !== null;
  const clearFilters = () => {
    setSearchInput("");
    update({ search: "", category: null });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  let content: ReactNode;
  // Placeholder rows can be empty (last row on a page just deleted): show the skeleton, not an empty table.
  if (products.isPending || invalidPage || (stale && data?.results.length === 0)) {
    content = <ProductTableSkeleton />;
  } else if (products.isError && !data) {
    content = (
      <StatePanel
        role="alert"
        title="Couldn't load products"
        message={
          products.error instanceof NetworkError
            ? "The server couldn't be reached. Check your connection and try again."
            : "Something went wrong while loading the inventory."
        }
        actions={
          <Button variant="primary" onClick={() => products.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (data && data.count === 0) {
    content = filtersActive ? (
      <StatePanel
        role="status"
        title="No matching products"
        message="No products match your search or category filter."
        actions={<Button onClick={clearFilters}>Clear filters</Button>}
      />
    ) : (
      <StatePanel
        role="status"
        title="No products yet"
        message="Your inventory is empty. Add your first product to get started."
        actions={
          <ButtonLink to="/products/new" variant="primary" state={{ returnTo: listUrl }}>
            Add product
          </ButtonLink>
        }
      />
    );
  } else if (data) {
    content = (
      <>
        {products.isError && (
          <Alert tone="error" className={styles.notice}>
            Couldn't refresh the list.{" "}
            <Button size="small" variant="ghost" onClick={() => products.refetch()}>
              Try again
            </Button>
          </Alert>
        )}
        <ProductTable products={data.results} stale={stale} returnTo={listUrl} onDelete={openDelete} />
        <nav className={styles.pagination} aria-label="Pagination">
          <Button disabled={!data.previous || stale} onClick={() => update({ page: params.page - 1 })}>
            ← Previous
          </Button>
          <span className={styles.pageInfo}>
            Page {params.page} of {totalPages}
          </span>
          <Button disabled={!data.next || stale} onClick={() => update({ page: params.page + 1 })}>
            Next →
          </Button>
        </nav>
      </>
    );
  }

  return (
    <>
      <title>Products · Mini Inventory</title>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
            Products
          </h1>
          <p className={styles.subtitle}>Shared inventory for all signed-in users.</p>
        </div>
        <ButtonLink to="/products/new" variant="primary" state={{ returnTo: listUrl }}>
          + Add product
        </ButtonLink>
      </div>

      <div className={styles.toolbar} role="search">
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor="product-search">
            Search by name
          </label>
          <input
            id="product-search"
            type="search"
            className={fieldStyles.control}
            placeholder="e.g. mouse"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor="category-filter">
            Category
          </label>
          <select
            id="category-filter"
            className={fieldStyles.control}
            value={params.category === null ? "" : String(params.category)}
            disabled={categories.isError}
            onChange={(event) => update({ category: event.target.value ? Number(event.target.value) : null })}
          >
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.toolbarAction}>
          <Button onClick={clearFilters} disabled={!filtersActive && searchInput === ""}>
            Clear filters
          </Button>
        </div>
      </div>

      {categories.isError && (
        <Alert tone="warning" className={styles.notice}>
          Categories couldn't be loaded, so filtering by category is unavailable.{" "}
          <Button size="small" variant="ghost" onClick={() => categories.refetch()}>
            Retry
          </Button>
        </Alert>
      )}

      <div className={styles.summary} aria-live="polite">
        <span>
          {data && !products.isPending
            ? `${formatCount(data.count)} ${data.count === 1 ? "product" : "products"}${filtersActive ? " found" : ""}`
            : " "}
        </span>
        {(stale || searchPending) && <span className={styles.loading}>Updating…</span>}
      </div>

      {content}

      <DeleteProductDialog
        product={toDelete}
        pending={deleteMutation.isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        returnFocusTo={() =>
          deletedRef.current || !triggerRef.current?.isConnected ? headingRef.current : triggerRef.current
        }
      />
      <Toast message={notice} onDismiss={dismissNotice} />
    </>
  );
}
