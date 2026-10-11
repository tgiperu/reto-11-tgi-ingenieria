import { createFileRoute } from "@tanstack/react-router";

import { RegistroForm } from "@/features/campo/registro";

export const Route = createFileRoute("/_auth/campo/registro")({
  component: RegistroPage,
  validateSearch: (search: Record<string, unknown>): { editar?: string } => ({
    editar: typeof search.editar === "string" ? search.editar : undefined,
  }),
});

function RegistroPage() {
  const { editar } = Route.useSearch();
  // `key` reinicia el formulario al pasar de un registro a otro.
  return <RegistroForm editId={editar} key={editar ?? "nuevo"} />;
}
