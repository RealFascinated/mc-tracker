/**
 * Gets the current date as YYYY-MM-DD.
 *
 * @returns the date
 */
export function getFormattedDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formats a timestamp as YYYY-MM-DD.
 *
 * @param timestamp the timestamp
 * @returns the formatted timestamp
 */
export function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
