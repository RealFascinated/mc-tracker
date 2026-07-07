import { createFileRoute, redirect } from "@tanstack/react-router";

import { adminLandingPath } from "@/lib/auth/require-admin";
import { fetchCurrentUser } from "@/lib/auth/session";

export const Route = createFileRoute("/_admin/admin/")({
  beforeLoad: async () => {
    const user = await fetchCurrentUser();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    throw redirect({ to: adminLandingPath(user) });
  },
});
