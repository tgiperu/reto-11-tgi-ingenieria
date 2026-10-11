import { createFileRoute, redirect } from "@tanstack/react-router";

import { StaffShell } from "@/components/shell/staff-shell";

export const Route = createFileRoute("/_auth/_staff")({
  beforeLoad: ({ context }) => {
    if (context.session.user.role === "brigadista") {
      throw redirect({ to: "/campo" });
    }
  },
  component: StaffLayout,
});

function StaffLayout() {
  const { session } = Route.useRouteContext();
  return <StaffShell session={session} />;
}
