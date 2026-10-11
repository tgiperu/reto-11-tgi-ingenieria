import { createFileRoute } from "@tanstack/react-router";

import { RegistroForm } from "@/features/campo/registro";

export const Route = createFileRoute("/_auth/campo/registro")({
  component: RegistroForm,
});
