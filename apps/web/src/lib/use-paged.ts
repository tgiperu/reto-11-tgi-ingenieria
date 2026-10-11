import { useState } from "react";

/** Paginación en el cliente para tablas con todas las filas ya cargadas. */
export function usePaged<T>(items: readonly T[], size: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return {
    items: items.slice(current * size, (current + 1) * size),
    page: current,
    pageSize: size,
    reset: () => setPage(0),
    setPage,
    total: items.length,
  };
}
