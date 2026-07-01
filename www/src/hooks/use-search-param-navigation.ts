import { useCallback } from "react";

import type { SearchNavigate } from "@/hooks/use-metric-time-window-controls";

export function useSearchParamNavigation<T extends string>(
  navigate: SearchNavigate,
  param: string,
  omitValue: NoInfer<T>,
) {
  return useCallback(
    (value: T) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          [param]: value === omitValue ? undefined : value,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate, omitValue, param],
  );
}
