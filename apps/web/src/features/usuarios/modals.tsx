import {
  ROLE_LABELS,
  ROLES,
  type Role,
} from "@reto-11-tgi-ingenieria/domain/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { SelectField, TextField } from "@/components/app/field";
import { Modal } from "@/components/app/modal";
import { trpc } from "@/utils/trpc";

const MIN_PASSWORD = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserEdit {
  brigadeId: string | null;
  email: string;
  id: string | null;
  name: string;
  roleId: string;
}

export interface RoleEdit {
  access: Role;
  id: string | null;
  name: string;
}

export function UserModal({
  value,
  onClose,
}: {
  value: UserEdit | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const roles = useQuery(trpc.access.roles.list.queryOptions());
  const [form, setForm] = useState<UserEdit>(
    value ?? { brigadeId: null, email: "", id: null, name: "", roleId: "" }
  );
  const [password, setPassword] = useState("");
  const isNew = value?.id === null;
  const roleId = form.roleId || (roles.data?.[0]?.id ?? "");

  const done = async (message: string) => {
    toast.success(message);
    await queryClient.invalidateQueries({
      queryKey: trpc.access.users.list.queryKey(),
    });
    await queryClient.invalidateQueries({
      queryKey: trpc.access.roles.list.queryKey(),
    });
    onClose();
  };
  const onError = (e: { message: string }) => toast.error(e.message);
  const create = useMutation(
    trpc.access.users.create.mutationOptions({
      onError,
      onSuccess: () => done("Usuario creado"),
    })
  );
  const update = useMutation(
    trpc.access.users.update.mutationOptions({
      onError,
      onSuccess: () => done("Usuario actualizado"),
    })
  );

  const passwordOk = isNew
    ? password.length >= MIN_PASSWORD
    : password === "" || password.length >= MIN_PASSWORD;
  const valid =
    form.name.trim().length >= 2 &&
    roleId !== "" &&
    passwordOk &&
    (!isNew || EMAIL_PATTERN.test(form.email.trim()));
  const busy = create.isPending || update.isPending;

  const submit = () => {
    const base = {
      brigadeId: form.brigadeId,
      name: form.name.trim(),
      roleId,
    };
    if (isNew) {
      create.mutate({ ...base, email: form.email.trim(), password });
    } else if (form.id) {
      update.mutate({
        ...base,
        id: form.id,
        password: password === "" ? undefined : password,
      });
    }
  };

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button disabled={!valid || busy} onClick={submit} variant="primary">
            {isNew ? "Crear usuario" : "Guardar cambios"}
          </Button>
        </>
      }
      onClose={onClose}
      open={value !== null}
      title={isNew ? "Nuevo usuario" : "Editar usuario"}
    >
      <TextField
        label="Nombre completo"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        value={form.name}
      />
      <TextField
        autoComplete="off"
        disabled={!isNew}
        label="Correo"
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        type="email"
        value={form.email}
      />
      <SelectField
        label="Rol"
        onChange={(e) => setForm({ ...form, roleId: e.target.value })}
        value={roleId}
      >
        {roles.data?.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </SelectField>
      <TextField
        autoComplete="new-password"
        hint={
          isNew
            ? `Mínimo ${MIN_PASSWORD} caracteres`
            : "Déjala vacía para conservar la actual"
        }
        label={isNew ? "Contraseña" : "Nueva contraseña (opcional)"}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        value={password}
      />
    </Modal>
  );
}

export function RoleModal({
  value,
  onClose,
}: {
  value: RoleEdit | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RoleEdit>(
    value ?? { access: "brigadista", id: null, name: "" }
  );
  const isNew = value?.id === null;
  const done = async (message: string) => {
    toast.success(message);
    await queryClient.invalidateQueries({
      queryKey: trpc.access.roles.list.queryKey(),
    });
    await queryClient.invalidateQueries({
      queryKey: trpc.access.users.list.queryKey(),
    });
    onClose();
  };
  const onError = (e: { message: string }) => toast.error(e.message);
  const create = useMutation(
    trpc.access.roles.create.mutationOptions({
      onError,
      onSuccess: () => done("Rol creado"),
    })
  );
  const update = useMutation(
    trpc.access.roles.update.mutationOptions({
      onError,
      onSuccess: () => done("Rol actualizado"),
    })
  );
  const valid = form.name.trim().length >= 2;
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || create.isPending || update.isPending}
            onClick={() => {
              const input = { access: form.access, name: form.name.trim() };
              if (isNew) {
                create.mutate(input);
              } else if (form.id) {
                update.mutate({ ...input, id: form.id });
              }
            }}
            variant="primary"
          >
            {isNew ? "Crear rol" : "Guardar cambios"}
          </Button>
        </>
      }
      onClose={onClose}
      open={value !== null}
      title={isNew ? "Nuevo rol" : "Editar rol"}
    >
      <TextField
        label="Nombre del rol"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Ej. Coordinador de campo"
        value={form.name}
      />
      <SelectField
        label="Nivel de acceso"
        onChange={(e) => setForm({ ...form, access: e.target.value as Role })}
        value={form.access}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>
      <p className="text-ink-3 text-xs">
        El rol funciona con el nivel de acceso elegido: quien lo tenga ve y
        puede hacer lo mismo que ese nivel.
      </p>
    </Modal>
  );
}
