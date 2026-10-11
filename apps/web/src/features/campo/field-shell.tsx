import type { ReactNode } from "react";

import { StatusBar } from "./status-bar";

/**
 * Marco de las pantallas de campo: barra de conexión arriba, tablero verde azulado
 * con el título y la hoja de trabajo encima, en columna de celular centrada.
 */
export function FieldShell({
  header,
  children,
  footer,
}: {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="mx-auto flex min-h-svh w-full max-w-[480px] flex-col bg-paper text-ink"
      data-sec="campo"
    >
      <StatusBar />
      <header className="flex items-center justify-between gap-3 bg-sec px-4 pt-4 pb-12 text-sec-ink">
        {header}
      </header>
      <main className="hoja paso relative z-10 -mt-8 mr-2 mb-4 ml-2 flex flex-1 flex-col gap-3.5 px-4 pt-5 pb-5">
        {children}
        {footer ? <div className="mt-auto pt-2">{footer}</div> : null}
      </main>
    </div>
  );
}
