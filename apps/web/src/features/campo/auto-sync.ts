import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { resetSyncPhase, syncNow, useSyncState } from "@/lib/offline/sync";

import { usePendingCount } from "./hooks";

const FIRST_TRY_DELAY_MS = 1500;
const RETRY_EVERY_MS = 30_000;
const PHASE_RESET_MS = 3000;

/**
 * Envía solo lo pendiente apenas hay señal: al abrir, al volver la conexión, tras guardar
 * un registro y, si falló, cada 30 s mientras queden registros sin enviar.
 */
export function useAutoSync(): void {
  const { online } = useSyncState();
  const pending = usePendingCount();
  const busy = useRef(false);
  const ready = useRef({ online, pending });
  ready.current = { online, pending };

  async function attempt() {
    const { online: isOnline, pending: count } = ready.current;
    if (!isOnline || count === 0 || busy.current) {
      return;
    }
    busy.current = true;
    try {
      const res = await syncNow();
      if (res.rejected > 0) {
        toast.warning(
          `${res.rejected} registros fueron rechazados: revísalos en Inicio.`
        );
      }
    } catch {
      // Sin señal estable: se reintenta en el siguiente ciclo.
    } finally {
      busy.current = false;
      setTimeout(resetSyncPhase, PHASE_RESET_MS);
    }
  }

  // Cada vez que cambia la conexión o la cantidad pendiente (p. ej. se guardó un registro).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` lee valores actuales desde refs
  useEffect(() => {
    if (!online || pending === 0) {
      return;
    }
    const timer = setTimeout(attempt, FIRST_TRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [online, pending]);

  // Reintento periódico mientras haya pendientes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` lee valores actuales desde refs
  useEffect(() => {
    const timer = setInterval(attempt, RETRY_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
}
