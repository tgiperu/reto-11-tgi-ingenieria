import { registerSW } from "virtual:pwa-register";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { toast } from "sonner";

import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";
import "./lib/pwa";
import { queryClient, trpc } from "./utils/trpc";

const router = createRouter({
  context: { queryClient, trpc },
  defaultPendingComponent: () => <Loader />,
  defaultPreload: "intent",
  routeTree,
  scrollRestoration: true,
  Wrap({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const OFFLINE_READY_KEY = "inventario.offlineReady";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast("Hay una versión nueva de la app", {
      action: { label: "Actualizar", onClick: () => updateSW(true) },
      duration: Number.POSITIVE_INFINITY,
    });
  },
  onOfflineReady() {
    try {
      localStorage.setItem(OFFLINE_READY_KEY, "1");
    } catch {
      // Sin almacenamiento: solo se pierde el aviso.
    }
    toast.success("Lista para trabajar sin conexión");
  },
});

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);
}
