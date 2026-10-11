import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAutoSync } from "@/features/campo/auto-sync";
import { pullBundle } from "@/lib/offline/sync";

export const Route = createFileRoute("/_auth/campo")({
  component: FieldLayout,
});

function FieldLayout() {
  useAutoSync();
  // Al abrir el modo campo con señal se refrescan parcelas, catálogos y reglas. Sin señal, se usa lo guardado.
  useEffect(() => {
    if (navigator.onLine) {
      pullBundle().catch(() => undefined);
    }
  }, []);
  return <Outlet />;
}
