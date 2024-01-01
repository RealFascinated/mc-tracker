/**
 * Gets the current date as YYYY-MM-DD.
 *
 * @returns the date
 */
export function getFormattedDate() {
  return new Date().toISOString().slice(0, 10);
}
