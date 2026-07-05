import type { CreateServerRequest } from "@/lib/api/admin/servers";
import { formatServerHost } from "@/lib/api/servers";
import { serverPlatformMcutilsSlug } from "@/lib/api/platform";

import { mcutilsApi } from "./client";

export function lookupMcutilsServer(
  form: Pick<CreateServerRequest, "host" | "port" | "type">,
) {
  const host = formatServerHost(form.host, form.port);
  return mcutilsApi.fetchServer(host, serverPlatformMcutilsSlug(form.type));
}

export type McutilsServer = NonNullable<
  Awaited<ReturnType<typeof lookupMcutilsServer>>["server"]
>;
