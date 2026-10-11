import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { loadSession } from "@/lib/session";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await loadSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: Outlet,
});
