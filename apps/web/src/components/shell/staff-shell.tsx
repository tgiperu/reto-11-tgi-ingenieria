import { ROLE_LABELS } from "@reto-11-tgi-ingenieria/domain/constants";
import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  BarChart3,
  Leaf,
  LogOut,
  Map as MapIcon,
  RefreshCw,
  Smartphone,
  Square,
  TriangleAlert,
} from "lucide-react";
import type { ComponentType } from "react";

import { fmtTime } from "@/lib/format";
import { useSyncState } from "@/lib/offline/sync";
import { type CachedSession, signOut } from "@/lib/session";
import { trpc } from "@/utils/trpc";

type SectionId = "panel" | "mapa" | "parcelas" | "alertas" | "catalogos";

interface NavItem {
  hue: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  id: SectionId;
  label: string;
  line: string;
  to: "/" | "/mapa" | "/parcelas" | "/catalogos" | "/alertas";
}

/** Lo diario va primero; la configuración queda después del separador. */
const DAILY: NavItem[] = [
  {
    hue: "bg-sec-panel",
    icon: BarChart3,
    id: "panel",
    label: "Panel",
    line: "border-sec-panel",
    to: "/",
  },
  {
    hue: "bg-sec-mapa",
    icon: MapIcon,
    id: "mapa",
    label: "Mapa",
    line: "border-sec-mapa",
    to: "/mapa",
  },
  {
    hue: "bg-sec-parcelas",
    icon: Square,
    id: "parcelas",
    label: "Parcelas",
    line: "border-sec-parcelas",
    to: "/parcelas",
  },
];

const SETUP: NavItem[] = [
  {
    hue: "bg-sec-alertas",
    icon: TriangleAlert,
    id: "alertas",
    label: "Alertas",
    line: "border-sec-alertas",
    to: "/alertas",
  },
  {
    hue: "bg-sec-catalogos",
    icon: Leaf,
    id: "catalogos",
    label: "Catálogos",
    line: "border-sec-catalogos",
    to: "/catalogos",
  },
];

const ALL = [...DAILY, ...SETUP];

function sectionOf(pathname: string): NavItem {
  const hit = ALL.find((n) => n.to !== "/" && pathname.startsWith(n.to));
  return hit ?? (DAILY[0] as NavItem);
}

export function StaffShell({ session }: { session: CachedSession }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { online } = useSyncState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = sectionOf(pathname);
  const badge = useQuery({
    ...trpc.dashboard.badge.queryOptions(),
    refetchInterval: 15_000,
  });
  const fetching = useIsFetching();

  async function onSignOut() {
    await signOut();
    queryClient.clear();
    await navigate({ to: "/login" });
  }

  function tab(item: NavItem, compact: boolean) {
    const alerts = item.id === "alertas" ? badge.data?.alerts : undefined;
    return (
      <Link
        activeOptions={{ exact: item.to === "/" }}
        activeProps={{
          "aria-current": "page",
          className: cn("font-bold text-ink", item.line),
        }}
        className={cn(
          compact
            ? "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 border-t-[3px] text-xs"
            : "-mb-px flex h-full items-center gap-2 border-b-[3px] px-3.5 text-sm",
          "border-transparent text-ink-3 hover:text-ink"
        )}
        key={item.to}
        to={item.to}
      >
        {compact ? (
          <item.icon aria-hidden size={18} />
        ) : (
          <span
            aria-hidden="true"
            className={cn("size-2.5 rounded-[2px]", item.hue)}
          />
        )}
        {item.label}
        {alerts ? (
          <span className="rounded-[4px] bg-sec-alertas px-1.5 py-px font-bold text-white text-xs">
            {alerts}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <div
      className="flex min-h-svh flex-col bg-paper pb-[60px] text-ink lg:pb-0"
      data-sec={current.id}
    >
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-line border-b bg-white px-4 lg:gap-6 lg:px-10">
        <Link className="flex items-center gap-2.5" to="/">
          <img
            alt="AIDER"
            className="rounded-full"
            height={34}
            src="/brand/aider-mark.png"
            width={34}
          />
          <span className="hidden flex-col leading-tight sm:flex">
            <strong className="text-sm">SIBOSE</strong>
            <span className="hidden text-ink-3 text-xs sm:block">
              Bosque seco · AIDER
            </span>
          </span>
        </Link>

        <nav
          aria-label="Principal"
          className="ml-2 hidden h-full items-stretch lg:flex"
        >
          {DAILY.map((i) => tab(i, false))}
          <span aria-hidden="true" className="mx-2 my-3.5 w-px bg-line" />
          {SETUP.map((i) => tab(i, false))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:gap-3">
          <span
            aria-live="polite"
            className="hidden items-center gap-2 text-[13px] text-ink-3 md:flex"
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                online ? "bg-ok" : "bg-warn"
              )}
            />
            {online ? "En línea" : "Sin conexión"} · datos{" "}
            <span className="font-mono">{fmtTime(badge.data?.lastSync)}</span>
          </span>
          <button
            aria-label="Sincronizar ahora"
            className="flex size-11 cursor-pointer items-center justify-center rounded-md border border-edge bg-white text-ink hover:bg-sunken"
            onClick={() => queryClient.invalidateQueries()}
            title="Sincronizar ahora"
            type="button"
          >
            <RefreshCw
              aria-hidden
              className={fetching > 0 ? "animate-spin" : undefined}
              size={16}
            />
          </button>
          <Link
            className="flex min-h-11 items-center gap-2 rounded-md bg-sec-campo px-3 font-semibold text-sm text-white hover:brightness-110 sm:px-3.5"
            to="/campo"
          >
            <Smartphone aria-hidden size={16} />
            Modo campo
          </Link>
          <span className="hidden h-6 w-px bg-line xl:block" />
          <span className="hidden flex-col text-right leading-tight xl:flex">
            <span className="font-semibold text-[13px]">
              {session.user.name}
            </span>
            <span className="text-ink-3 text-xs">
              {ROLE_LABELS[session.user.role]}
            </span>
          </span>
          <button
            aria-label="Cerrar sesión"
            className="flex size-11 cursor-pointer items-center justify-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
            onClick={onSignOut}
            title="Cerrar sesión"
            type="button"
          >
            <LogOut aria-hidden size={16} />
          </button>
        </div>
      </header>

      <div aria-hidden="true" className="h-[84px] bg-sec lg:h-[104px]" />

      <main className="hoja paso relative z-10 -mt-[48px] mr-2 ml-2 flex min-w-0 flex-1 flex-col gap-5 px-4 pt-6 pb-10 sm:px-6 lg:-mt-[60px] lg:mr-12 lg:ml-10 lg:px-8">
        <Outlet />
      </main>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 flex border-line border-t bg-white lg:hidden"
      >
        {ALL.map((i) => tab(i, true))}
      </nav>
    </div>
  );
}
