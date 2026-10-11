import { useIsFetching } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { TreeDeciduous } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MIN_VISIBLE_MS = 900;
/** Las consultas de la pantalla nueva arrancan tras montarla: se espera a que haya calma. */
const SETTLE_MS = 500;
const MAX_VISIBLE_MS = 8000;
const LEAVE_MS = 300;

type Phase = "idle" | "loading" | "leaving";

/**
 * Velo translúcido con desenfoque que cubre el contenido al cambiar de pestaña.
 * Un árbol se va llenando de verde mientras la pantalla nueva carga sus datos y
 * se desvanece cuando ya no quedan consultas por resolver. No aparece en la
 * primera carga. Va dentro de un contenedor `relative`.
 */
export function PageMask() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Solo cuentan las consultas sin datos previos: el refresco en vivo no la activa.
  const pending = useIsFetching({
    predicate: (q) => q.state.data === undefined,
  });
  const routing = useRouterState({ select: (s) => s.status === "pending" });
  const busy = pending > 0 || routing;
  const previous = useRef(pathname);
  const [phase, setPhase] = useState<Phase>("idle");
  const [minDone, setMinDone] = useState(false);
  const [settled, setSettled] = useState(false);
  const [maxDone, setMaxDone] = useState(false);

  useLayoutEffect(() => {
    if (previous.current === pathname) {
      return;
    }
    previous.current = pathname;
    setMinDone(false);
    setMaxDone(false);
    setSettled(false);
    setPhase("loading");
    const min = setTimeout(() => setMinDone(true), MIN_VISIBLE_MS);
    const max = setTimeout(() => setMaxDone(true), MAX_VISIBLE_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, [pathname]);

  // «Calma»: ninguna carga pendiente durante SETTLE_MS seguidos.
  useEffect(() => {
    if (phase !== "loading" || busy) {
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [phase, busy]);

  useEffect(() => {
    if (phase === "loading" && minDone && (settled || maxDone)) {
      setPhase("leaving");
    }
  }, [phase, minDone, settled, maxDone]);

  useEffect(() => {
    if (phase !== "leaving") {
      return;
    }
    const t = setTimeout(() => setPhase("idle"), LEAVE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "idle") {
    return null;
  }
  return (
    <div
      aria-hidden="true"
      className={`page-mask pointer-events-none absolute inset-0 z-30 flex items-start justify-center rounded-[inherit] bg-sheet/60 backdrop-blur-md ${phase === "leaving" ? "page-mask-out" : "page-mask-in"}`}
      key={pathname}
    >
      <div className="sticky size-16" style={{ top: "calc(50svh - 2rem)" }}>
        <TreeDeciduous
          className="absolute inset-0 text-ink-3/40"
          size={64}
          strokeWidth={1.5}
        />
        <TreeDeciduous
          className="page-mask-tree absolute inset-0 text-ok"
          size={64}
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
}
