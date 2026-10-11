import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CircleCheck,
  LogOut,
  Monitor,
  Plus,
  Settings2,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/app/button";
import { Chip } from "@/components/app/chip";
import { FieldShell } from "@/features/campo/field-shell";
import { useBundleMeta, useNow } from "@/features/campo/hooks";
import { fmtDateTime, longClock } from "@/lib/format";
import { campoDb } from "@/lib/offline/db";
import { signOut } from "@/lib/session";

export const Route = createFileRoute("/_auth/campo/")({
  component: FieldHome,
});

function Count({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-2 ${tone}`}
    >
      <strong className="font-mono text-xl">{value}</strong>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function categoryLabel(category: string): string {
  if (category === "br") {
    return "Brinzal";
  }
  return category === "ar" ? "Arbusto grande" : "Árboles";
}

function plotTone(closed: boolean, pending: number): "ok" | "info" | "neutral" {
  if (closed) {
    return "ok";
  }
  return pending > 0 ? "info" : "neutral";
}

function FieldHome() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const now = useNow();
  const bundle = useBundleMeta();
  const plots = useLiveQuery(() => campoDb.plots.toArray(), [], []);
  const last = useLiveQuery(
    () => campoDb.records.orderBy("createdAt").last(),
    [],
    undefined
  );
  const problems = useLiveQuery(
    () => campoDb.records.where("sent").equals(2).toArray(),
    [],
    []
  );
  const pendingByPlot = useLiveQuery(
    async () => {
      const counts = new Map<number, number>();
      await campoDb.records
        .where("sent")
        .equals(0)
        .each((r) =>
          counts.set(r.plotNumber, (counts.get(r.plotNumber) ?? 0) + 1)
        );
      return counts;
    },
    [],
    new Map<number, number>()
  );

  const open = plots.filter((p) => !p.closed);
  const inProgress = open.filter(
    (p) => (pendingByPlot.get(p.number) ?? 0) > 0
  ).length;
  const todo = open.length - inProgress;
  const sent = plots.length - open.length;
  const [firstName] = session.user.name.split(" ");
  const isStaff = session.user.role !== "brigadista";

  async function onSignOut() {
    await signOut();
    await navigate({ to: "/login" });
  }

  const ready = plots.length > 0 && Boolean(bundle);

  return (
    <FieldShell
      footer={
        <div className="flex flex-col gap-2">
          {isStaff ? (
            <Link
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-edge bg-white font-semibold text-sm no-underline hover:bg-sunken"
              to="/"
            >
              <Monitor aria-hidden="true" size={16} /> Volver a gestión
            </Link>
          ) : null}
          <Button onClick={onSignOut} variant="ghost">
            <LogOut aria-hidden="true" size={16} /> Cerrar sesión
          </Button>
        </div>
      }
      header={
        <>
          <div className="flex flex-col">
            <strong className="text-xl">Hola, {firstName}</strong>
            <span className="font-semibold text-[15px]">{longClock(now)}</span>
            <span className="text-[13px]">
              {bundle?.user.brigadeName
                ? `Brigada ${bundle.user.brigadeName}`
                : "Sin brigada asignada"}
            </span>
          </div>
          <img
            alt="AIDER"
            className="rounded-full bg-white"
            height={44}
            src="/brand/aider-mark.png"
            width={44}
          />
        </>
      }
    >
      {ready ? (
        <Link
          className="flex min-h-12 items-center gap-2.5 rounded-lg bg-ok-bg px-3 text-ok-fg text-sm no-underline"
          to="/campo/instalar"
        >
          <CircleCheck aria-hidden="true" className="flex-none" size={18} />
          <span className="flex-1">
            <strong>Listo para trabajar sin señal.</strong> Datos del{" "}
            {fmtDateTime(bundle ? new Date(bundle.downloadedAt) : null)}
          </span>
          <span className="font-semibold underline">Actualizar</span>
        </Link>
      ) : (
        <section
          className="flex flex-col gap-2 rounded-lg border border-warn-edge bg-warn-bg p-3.5 text-sm text-warn-fg"
          role="status"
        >
          <strong className="flex items-center gap-2">
            <TriangleAlert aria-hidden="true" size={16} /> Prepara el equipo
            antes de salir
          </strong>
          <span>
            Todavía no hay parcelas descargadas. Hazlo con señal: sin esto no
            podrás registrar en el monte.
          </span>
          <Link
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-white no-underline"
            to="/campo/instalar"
          >
            <Settings2 aria-hidden="true" size={16} /> Preparar para campo
          </Link>
        </section>
      )}

      <Link
        className="flex flex-col gap-2.5 rounded-lg bg-primary p-[18px] text-white no-underline"
        to="/campo/registro"
      >
        <span className="font-semibold text-[13px] text-white/75">
          {last ? "Continuar donde quedaste" : "Empieza a registrar"}
        </span>
        <span className="font-bold text-xl">
          {last
            ? `P-${last.plotNumber} · ${categoryLabel(last.category)}`
            : "Tu primera parcela"}
        </span>
        {last ? (
          <span className="text-sm text-white/85">
            Último guardado:{" "}
            <strong className="font-mono">N° {last.code}</strong> ·{" "}
            {last.speciesName}
          </span>
        ) : null}
        <span className="mt-1 flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-sec-panel font-bold text-base text-ink">
          <Plus aria-hidden="true" size={20} strokeWidth={2.6} />
          Registrar árbol
        </span>
      </Link>

      <section className="flex flex-col gap-2">
        <strong className="text-[15px]">Mis parcelas</strong>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Count
            label="en curso"
            tone="bg-info-bg text-info-fg"
            value={inProgress}
          />
          <Count label="por hacer" tone="bg-sunken text-ink-2" value={todo} />
          <Count label="enviadas" tone="bg-ok-bg text-ok-fg" value={sent} />
        </div>
        <span className="text-ink-3 text-xs">
          La parcela y la categoría se eligen dentro del formulario. Sincroniza
          al terminar una parcela: lo enviado queda bloqueado.
        </span>
        {plots.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {plots.map((p) => (
              <li key={p.number}>
                <Chip
                  tone={plotTone(p.closed, pendingByPlot.get(p.number) ?? 0)}
                >
                  P-{p.number} · {p.sector}
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {problems.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-lg border border-crit/30 bg-crit-bg px-4 py-3.5 text-[13px] text-crit-fg">
          <strong className="flex items-center gap-2 text-sm">
            <TriangleAlert aria-hidden="true" size={16} /> {problems.length}{" "}
            registros rechazados
          </strong>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {problems.map((r) => (
              <li
                className="flex items-center justify-between gap-2"
                key={r.clientId}
              >
                <span>
                  P-{r.plotNumber} · N° {r.code} — {r.error}
                </span>
                <Button
                  onClick={() => campoDb.records.delete(r.clientId)}
                  size="sm"
                >
                  Descartar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </FieldShell>
  );
}
