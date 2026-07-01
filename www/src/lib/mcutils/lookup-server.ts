import type { CreateServerRequest } from "@/lib/api/admin/servers";

import { mcutilsApi } from "./client";

function formatMcutilsServerHost(
  host: string,
  port: number | null | undefined,
): string {
  const trimmed = host.trim();
  if (port != null) {
    return `${trimmed}:${port}`;
  }
  return trimmed;
}

function serverPlatform(type: string): "java" | "bedrock" {
  return type === "PE" ? "bedrock" : "java";
}

export function lookupMcutilsServer(
  form: Pick<CreateServerRequest, "host" | "port" | "type">,
) {
  const host = formatMcutilsServerHost(form.host, form.port);
  return mcutilsApi.fetchServer(host, serverPlatform(form.type));
}

export type McutilsServer = NonNullable<
  Awaited<ReturnType<typeof lookupMcutilsServer>>["server"]
>;
