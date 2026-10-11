import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { Chip } from "@/components/app/chip";
import { FieldShell } from "@/features/campo/field-shell";
import { useBundleMeta } from "@/features/campo/hooks";
import { campoDb } from "@/lib/offline/db";
import { pullBundle, useSyncState } from "@/lib/offline/sync";
import {
  isStoragePersistent,
  requestPersistentStorage,
  storageUsageMb,
} from "@/lib/pwa";
import { getCachedSession } from "@/lib/session";

export const Route = createFileRoute("/_auth/campo/instalar")({
  component: InstallPage,
});

function CheckRow({
  label,
  detail,
  ok,
  action,
}: {
  label: string;
  detail: string;
  ok: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2.5 border-line-2 border-t py-1.5 text-sm first:border-t-0">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-[26px] flex-none items-center justify-center rounded-full font-bold text-sm",
          ok ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-warn-fg"
        )}
      >
        {ok ? <Check size={14} /> : "!"}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{label}</span>
        <span className="text-ink-3 text-xs">{detail}</span>
      </div>
      {action ?? (
        <Chip tone={ok ? "ok" : "warn"}>{ok ? "Listo" : "Pendiente"}</Chip>
      )}
    </div>
  );
}

function InstallPage() {
  const bundle = useBundleMeta();
  const plots = useLiveQuery(() => campoDb.plots.count(), [], 0);
  const speciesCount = useLiveQuery(() => campoDb.species.count(), [], 0);
  const { online, phase } = useSyncState();
  const [persistent, setPersistent] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const [offlineApp, setOfflineApp] = useState(false);
  const [busy, setBusy] = useState(false);
  const session = getCachedSession();

  useEffect(() => {
    isStoragePersistent().then(setPersistent);
    storageUsageMb().then(setUsage);
    navigator.serviceWorker
      ?.getRegistration()
      .then((r) => setOfflineApp(Boolean(r?.active)));
  }, []);

  async function onDownload() {
    setBusy(true);
    try {
      await pullBundle();
      setUsage(await storageUsageMb());
      toast.success("Datos descargados para trabajar sin señal");
    } catch {
      toast.error("No se pudo descargar. Revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  const activeRules = bundle?.rules.filter((r) => r.active).length ?? 0;
  const ready = plots > 0 && speciesCount > 0 && Boolean(session);
  const goClass = cn(
    "flex min-h-[52px] items-center justify-center rounded-lg font-semibold text-[15px] no-underline",
    ready ? "bg-primary text-white" : "bg-sunken text-ink-3"
  );

  return (
    <FieldShell
      footer={
        <Link className={goClass} to="/campo">
          {ready ? "Todo listo · empezar" : "Continuar"}
        </Link>
      }
      header={
        <div className="flex items-center gap-3">
          <img
            alt="AIDER"
            className="rounded-full bg-white"
            height={44}
            src="/brand/aider-mark.png"
            width={44}
          />
          <div className="flex flex-col">
            <strong className="text-lg">Preparar para campo</strong>
            <span className="text-[13px]">
              {bundle?.user.brigadeName
                ? `Brigada ${bundle.user.brigadeName}`
                : "Sin brigada"}
            </span>
          </div>
        </div>
      }
    >
      <section className="flex flex-col gap-1 rounded-lg border border-line bg-white p-3.5">
        <strong className="mb-1.5 text-[15px]">
          Descargar para trabajar sin señal
        </strong>
        <CheckRow
          detail="Válida 30 días sin conexión"
          label="Sesión guardada"
          ok={Boolean(session)}
        />
        <CheckRow
          detail={`${plots} parcelas asignadas · con sus coordenadas`}
          label="Mis parcelas"
          ok={plots > 0}
        />
        <CheckRow
          detail={`${speciesCount} especies · categorías y rangos (v${bundle?.catalogVersion ?? "—"})`}
          label="Catálogos"
          ok={speciesCount > 0}
        />
        <CheckRow
          detail={`${activeRules} reglas activas (${bundle?.rulesVersion ?? "—"})`}
          label="Reglas de alerta"
          ok={activeRules > 0}
        />
        <CheckRow
          detail="Para abrirla sin internet"
          label="Archivos de la app"
          ok={offlineApp}
        />
        <CheckRow
          action={
            persistent ? undefined : (
              <Button
                onClick={async () =>
                  setPersistent(await requestPersistentStorage())
                }
                size="sm"
              >
                Solicitar
              </Button>
            )
          }
          detail="El navegador no borrará los datos"
          label="Almacenamiento persistente"
          ok={persistent}
        />
        <Button
          className="mt-2"
          disabled={!online || busy || phase === "syncing"}
          onClick={onDownload}
        >
          <RefreshCw
            aria-hidden="true"
            className={busy ? "animate-spin" : undefined}
            size={16}
          />
          {online
            ? "Descargar / actualizar datos"
            : "Sin conexión: conéctate para descargar"}
        </Button>
      </section>

      <section className="flex flex-col gap-1.5 rounded-lg bg-ok-bg px-3.5 py-3 text-[13px]">
        <div className="flex justify-between">
          <strong>Espacio usado en el equipo</strong>
          <span className="font-mono font-semibold">
            {usage === null ? "—" : `${usage.toFixed(1)} MB`}
          </span>
        </div>
        <span className="text-ok-fg">
          Sin mapas: solo tus parcelas, catálogos y reglas. Cada foto ocupa ~300
          KB.
        </span>
      </section>
    </FieldShell>
  );
}
