import { useCallback, useLayoutEffect, useRef } from "react";

import type { SearchNavigate } from "@/hooks/metrics/use-metric-time-window-controls";
import {
  DEFAULT_SERVER_SORT,
  parseStoredServerSort,
  resolveServerSort,
  SERVER_SORT_STORAGE_KEY,
  serverSortToSearchParams,
} from "@/lib/api/server-sort";
import type {
  ServerSort,
  ServerSortField,
  SortOrder,
} from "@/lib/api/server-sort";
import {
  localStorageJsonOptions,
  useLocalStorage,
} from "@/hooks/use-local-storage";

type ServerSortSearch = {
  sort?: ServerSortField;
  order?: SortOrder;
};

export function usePersistedServerSort(
  navigate: SearchNavigate,
  search: ServerSortSearch,
) {
  const initialized = useRef(false);
  const [storedSort, setStoredSort] = useLocalStorage(SERVER_SORT_STORAGE_KEY, {
    defaultValue: DEFAULT_SERVER_SORT,
    ...localStorageJsonOptions(parseStoredServerSort),
  });

  const hasUrlSort = search.sort !== undefined || search.order !== undefined;
  const serverSort = hasUrlSort ? resolveServerSort(search) : storedSort;

  useLayoutEffect(() => {
    if (initialized.current) {
      return;
    }
    initialized.current = true;

    if (hasUrlSort) {
      return;
    }

    const params = serverSortToSearchParams(storedSort);
    void navigate({
      search: (previous) => ({
        ...previous,
        sort: params.sort,
        order: params.order,
      }),
      replace: true,
      resetScroll: false,
    });
  }, [hasUrlSort, navigate, storedSort]);

  const setServerSort = useCallback(
    (sort: ServerSort) => {
      setStoredSort(sort);
      const params = serverSortToSearchParams(sort);
      void navigate({
        search: (previous) => ({
          ...previous,
          sort: params.sort,
          order: params.order,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate, setStoredSort],
  );

  return { serverSort, setServerSort };
}
