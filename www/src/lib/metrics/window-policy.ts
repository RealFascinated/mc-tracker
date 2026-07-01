const DAY_SECONDS = 86_400;

/** Minimum allowed metric query window span (matches backend `step_policy::MIN_SPAN`). */
export const METRIC_WINDOW_MIN_SPAN_SECONDS = 5 * 60;

/** Maximum allowed metric query window span (matches backend `step_policy::MAX_SPAN`). */
export const METRIC_WINDOW_MAX_SPAN_SECONDS = 730 * DAY_SECONDS;
