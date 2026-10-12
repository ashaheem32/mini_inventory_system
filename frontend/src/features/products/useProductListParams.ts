import { useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";

import type { ProductListParams } from "./types";

function positiveInt(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && Number.isSafeInteger(n) ? n : null;
}

export interface ParamChanges {
  page?: number;
  category?: number | null;
  search?: string;
}

/** page/category/search live in the URL so reloads and back/forward restore them. */
export function useProductListParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  // setSearchParams changes identity on every navigation; keep `update` stable.
  const setRef = useRef(setSearchParams);
  setRef.current = setSearchParams;

  const params: ProductListParams = useMemo(
    () => ({
      page: positiveInt(searchParams.get("page")) ?? 1,
      category: positiveInt(searchParams.get("category")),
      search: (searchParams.get("search") ?? "").trim(),
    }),
    [searchParams],
  );

  const update = useCallback(
    (changes: ParamChanges, options: { replace?: boolean } = {}) => {
      setRef.current(
        (prev) => {
          const next = new URLSearchParams(prev);
          const filterChanged = "category" in changes || "search" in changes;
          if ("category" in changes) {
            if (changes.category == null) next.delete("category");
            else next.set("category", String(changes.category));
          }
          if ("search" in changes) {
            const s = (changes.search ?? "").trim();
            if (s) next.set("search", s);
            else next.delete("search");
          }
          // Filter changes always restart at page 1.
          const page = filterChanged ? 1 : (changes.page ?? positiveInt(prev.get("page")) ?? 1);
          if (page > 1) next.set("page", String(page));
          else next.delete("page");
          return next;
        },
        { replace: options.replace },
      );
    },
    [],
  );

  return { params, update, queryString: searchParams.toString() };
}
