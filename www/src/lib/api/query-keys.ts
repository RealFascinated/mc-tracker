/**
 * Dashboard query keys, isolated from the query modules so the root refresh
 * provider can reference them without pulling the API callers into every page.
 */
export const serversQueryKey = ["servers", "list"] as const;

export const serverQueryKey = ["servers", "detail"] as const;

export const serversTimeseriesQueryKey = ["servers", "timeseries"] as const;

export const serversSearchQueryKey = ["servers", "search"] as const;

export const asnsQueryKey = ["asns", "list"] as const;

export const asnQueryKey = ["asns", "detail"] as const;

export const asnsTimeseriesQueryKey = ["asns", "timeseries"] as const;

export const pinnedServersQueryKey = ["pinned-servers"] as const;
