import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./button";

/** Paginación simple: Anterior · «Página x de y» · Siguiente. Se oculta con una sola página. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  label,
  bordered = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  label: string;
  bordered?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) {
    return null;
  }
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav
      aria-label={`Paginación de ${label}`}
      className={`flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-3${bordered ? "border-line-2 border-t px-4 py-2.5" : ""}`}
    >
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          aria-label="Página anterior"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          size="sm"
        >
          <ChevronLeft aria-hidden="true" size={16} /> Anterior
        </Button>
        <span className="font-mono">
          Página {page + 1} de {pages}
        </span>
        <Button
          aria-label="Página siguiente"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
          size="sm"
        >
          Siguiente <ChevronRight aria-hidden="true" size={16} />
        </Button>
      </div>
    </nav>
  );
}
