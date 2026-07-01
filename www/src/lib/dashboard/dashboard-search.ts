export type DashboardView = "server" | "asn";

export function parseDashboardViewParam(
  value: unknown,
): DashboardView | undefined {
  if (value === "server" || value === "asn") {
    return value;
  }
  return undefined;
}
