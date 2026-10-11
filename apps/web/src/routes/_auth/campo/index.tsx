import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  LogOut,
  Monitor,
  Plus,
  Settings2,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/app/button";
import { EmptyState } from "@/components/app/panel";
import { FieldShell } from "@/features/campo/field-shell";
import { useBundleMeta, useNow } from "@/features/campo/hooks";
import { RecordRow } from "@/features/campo/record-row";
import { shortClock } from "@/lib/format";
import { campoDb } from "@/lib/offline/db";
import { signOut } from "@/lib/session";

export const Route = createFileRoute("/_auth/campo/")({
  component: FieldHome,
});

const HEADER_BUTTON =
  "flex size-11 flex-none cursor-pointer items-center justify-center rounded-md bg-white/20 text-sec-ink no-underline hover:bg-white/35";

function FieldHome() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const now = useNow();
  const bundle = useBundleMeta();
  const plots = useLiveQuery(() => campoDb.plots.count(), [], 0);
  const records = useLiveQuery(
    () => campoDb.records.orderBy("createdAt").reverse().toArray(),
    [],
    []
  );
  const unsent = records.filter((r) => r.sent === 0).length;
  const problems = records.filter((r) => r.sent === 2);
  const [firstName] = session.user.name.split(" ");
  const isStaff = session.user.role !== "brigadista";
  const ready = plots > 0 && Boolean(bundle);

  async function onSignOut() {
    await signOut();
    await navigate({ to: "/login" });
  }

  return (
    <FieldShell
      contained
      footer={
        <div className="flex flex-col items-center gap-1 border-line border-t pt-3 pb-4">
          <Link
            aria-label="Nuevo registro"
            className="flex size-16 items-center justify-center rounded-full bg-primary text-white no-underline ring-4 ring-sec-panel active:translate-y-px"
            to="/campo/registro"
          >
            <Plus aria-hidden="true" size={30} strokeWidth={2.6} />
          </Link>
          <span className="font-semibold text-sm">Nuevo registro</span>
        </div>
      }
      header={
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <img
                alt="AIDER"
                className="rounded-full bg-white"
                height={36}
                src="/brand/aider-mark.png"
                width={36}
              />
              <strong className="font-bold text-lg tracking-wide">
                SIBOSE
              </strong>
            </div>
            <span className="text-sm">
              {bundle?.user.brigadeName
                ? `Brigada ${bundle.user.brigadeName}`
                : "Sin brigada"}
            </span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="truncate font-bold text-3xl tracking-tight">
                Hola, {firstName}
              </h1>
              <span className="font-semibold text-[15px]">
                {shortClock(now)}
              </span>
            </div>
            <div className="flex gap-2">
              {isStaff ? (
                <Link
                  aria-label="Volver a gestión"
                  className={HEADER_BUTTON}
                  title="Volver a gestión"
                  to="/"
                >
                  <Monitor aria-hidden="true" size={20} />
                </Link>
              ) : null}
              <button
                aria-label="Cerrar sesión"
                className={HEADER_BUTTON}
                onClick={onSignOut}
                title="Cerrar sesión"
                type="button"
              >
                <LogOut aria-hidden="true" size={20} />
              </button>
            </div>
          </div>
        </div>
      }
    >
      {ready ? null : (
        <section
          className="flex flex-none flex-col gap-2 rounded-lg border border-warn-edge bg-warn-bg p-3.5 text-sm text-warn-fg"
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

      {problems.length > 0 ? (
        <section className="flex flex-none flex-col gap-2 rounded-lg border border-crit/30 bg-crit-bg px-4 py-3 text-[13px] text-crit-fg">
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

      <section
        aria-labelledby="h-registros"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex flex-none items-baseline justify-between gap-3 pb-1">
          <h2 className="font-bold text-base" id="h-registros">
            Registros realizados
          </h2>
          <span className="text-ink-3 text-sm">
            {records.length} · {unsent > 0 ? `${unsent} sin enviar` : "al día"}
          </span>
        </div>
        {records.length === 0 ? (
          <EmptyState>
            Aún no hay registros en este equipo. Toca + para crear el primero.
          </EmptyState>
        ) : (
          <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2.5 overflow-y-auto overscroll-contain px-0.5 pt-1 pb-3">
            {records.map((r) => (
              <RecordRow key={r.clientId} record={r} />
            ))}
          </ul>
        )}
      </section>
    </FieldShell>
  );
}
