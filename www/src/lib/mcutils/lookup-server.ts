import type { CreateServerRequest } from "@/lib/api/admin/servers";
import { formatServerHost } from "@/lib/api/servers";

import { mcutilsApi } from "./client";

function serverPlatform(type: string): "java" | "bedrock" {
  return type === "PE" ? "bedrock" : "java";
}

export function lookupMcutilsServer(
  form: Pick<CreateServerRequest, "host" | "port" | "type">,
) {
  const host = formatServerHost(form.host, form.port);
  return mcutilsApi.fetchServer(host, serverPlatform(form.type));
}

export type McutilsServer = NonNullable<
  Awaited<ReturnType<typeof lookupMcutilsServer>>["server"]
>;
