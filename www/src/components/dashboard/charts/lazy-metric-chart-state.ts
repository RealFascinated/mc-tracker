export type LazyMetricChartState =
  | { kind: "error" }
  | { kind: "idle" }
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "chart" };

export function resolveLazyMetricChartState({
  isVisible,
  hasBeenVisible,
  isPending,
  isError,
  hasData,
}: {
  isVisible: boolean;
  hasBeenVisible: boolean;
  isPending: boolean;
  isError: boolean;
  hasData: boolean;
}): LazyMetricChartState {
  if (isError) {
    return { kind: "error" };
  }

  const showLoading = isVisible && isPending && !hasData;
  // Mount only once real series exist; stay mounted after first load.
  const mountChart = hasBeenVisible && hasData;

  if (!mountChart && showLoading) {
    return { kind: "loading" };
  }

  // Fetch finished (visible, not pending) but there are no points to plot.
  if (!mountChart && isVisible && !isPending && !hasData) {
    return { kind: "empty" };
  }

  if (!mountChart) {
    return { kind: "idle" };
  }

  return { kind: "chart" };
}
