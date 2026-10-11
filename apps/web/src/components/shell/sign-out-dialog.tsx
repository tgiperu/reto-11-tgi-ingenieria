import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/app/button";
import { Modal } from "@/components/app/modal";
import { signOut } from "@/lib/session";

/** Pide confirmación antes de cerrar la sesión y enviar al login. */
export function SignOutDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    // Se detienen las consultas en curso para que no fallen con «sin sesión» al salir.
    await queryClient.cancelQueries();
    await signOut();
    queryClient.clear();
    await navigate({ to: "/login" });
    setBusy(false);
    onClose();
  }

  return (
    <Modal
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={confirm} variant="primary">
            <LogOut aria-hidden="true" size={16} />
            {busy ? "Cerrando…" : "Sí, cerrar sesión"}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="¿Cerrar sesión?"
    >
      <p className="text-ink-2 text-sm">
        Saldrás de tu cuenta en este equipo. Los registros de campo pendientes
        de envío se conservan en el equipo.
      </p>
    </Modal>
  );
}
