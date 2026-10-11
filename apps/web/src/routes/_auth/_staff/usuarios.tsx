import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { Chip } from "@/components/app/chip";
import { Pager } from "@/components/app/pager";
import {
  Notice,
  PageHeader,
  Panel,
  Table,
  Td,
  Th,
} from "@/components/app/panel";
import { type TabDef, Tabs } from "@/components/app/tabs";
import {
  type RoleEdit,
  RoleModal,
  type UserEdit,
  UserModal,
} from "@/features/usuarios/modals";
import { fmtDate } from "@/lib/format";
import { usePaged } from "@/lib/use-paged";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/_staff/usuarios")({
  component: AccessPage,
});

type TabId = "users" | "roles";

const TABS: TabDef<TabId>[] = [
  { id: "users", label: "Usuarios" },
  { id: "roles", label: "Roles" },
];
const TABLE_PAGE = 10;

function UsersTab({ onEdit }: { onEdit: (u: UserEdit) => void }) {
  const { data = [] } = useQuery(trpc.access.users.list.queryOptions());
  const paged = usePaged(data, TABLE_PAGE);
  return (
    <>
      <Table minWidth={760}>
        <thead>
          <tr>
            <Th>Nombre</Th>
            <Th>Correo</Th>
            <Th>Rol</Th>
            <Th>Brigada</Th>
            <Th>Alta</Th>
            <Th>
              <span className="sr-only">Editar</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {paged.items.map((u) => (
            <tr key={u.id}>
              <Td className="font-semibold">{u.name}</Td>
              <Td className="font-mono text-xs">{u.email}</Td>
              <Td>
                <Chip>{u.roleName}</Chip>
              </Td>
              <Td>
                {u.brigadeId
                  ? `${u.brigadeId} · ${u.brigadeLeader ?? ""}`
                  : "—"}
              </Td>
              <Td className="font-mono text-xs">{fmtDate(u.createdAt)}</Td>
              <Td className="text-right">
                <Button
                  aria-label={`Editar ${u.name}`}
                  onClick={() =>
                    onEdit({
                      brigadeId: u.brigadeId,
                      email: u.email,
                      id: u.id,
                      name: u.name,
                      roleId: u.roleId,
                    })
                  }
                  size="sm"
                >
                  <Pencil aria-hidden="true" size={14} /> Editar
                </Button>
              </Td>
            </tr>
          ))}
          {data.length === 0 ? (
            <tr>
              <Td className="py-8 text-center text-ink-3" colSpan={6}>
                Aún no hay usuarios.
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
      <Pager
        bordered
        label="usuarios"
        onPage={paged.setPage}
        page={paged.page}
        pageSize={paged.pageSize}
        total={paged.total}
      />
    </>
  );
}

function RolesTab({ onEdit }: { onEdit: (r: RoleEdit) => void }) {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery(trpc.access.roles.list.queryOptions());
  const remove = useMutation(
    trpc.access.roles.delete.mutationOptions({
      onError: (e) => toast.error(e.message),
      onSuccess: async () => {
        toast.success("Rol eliminado");
        await queryClient.invalidateQueries({
          queryKey: trpc.access.roles.list.queryKey(),
        });
      },
    })
  );
  const paged = usePaged(data, TABLE_PAGE);
  return (
    <>
      <Table minWidth={620}>
        <thead>
          <tr>
            <Th>Rol</Th>
            <Th>Tipo</Th>
            <Th>Nivel de acceso</Th>
            <Th className="text-right">Usuarios</Th>
            <Th>
              <span className="sr-only">Acciones</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {paged.items.map((r) => (
            <tr key={r.id}>
              <Td className="font-semibold">{r.name}</Td>
              <Td>
                <Chip tone={r.system ? "neutral" : "info"}>
                  {r.system ? "De fábrica" : "Personalizado"}
                </Chip>
              </Td>
              <Td>{r.accessLabel}</Td>
              <Td className="text-right font-mono">{r.users}</Td>
              <Td className="text-right">
                {r.system ? (
                  <span className="text-ink-3 text-xs">—</span>
                ) : (
                  <div className="flex justify-end gap-1.5">
                    <Button
                      aria-label={`Editar ${r.name}`}
                      onClick={() =>
                        onEdit({ access: r.access, id: r.id, name: r.name })
                      }
                      size="sm"
                    >
                      <Pencil aria-hidden="true" size={14} /> Editar
                    </Button>
                    <Button
                      aria-label={`Eliminar ${r.name}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ id: r.id })}
                      size="sm"
                      variant="danger"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </Button>
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager
        bordered
        label="roles"
        onPage={paged.setPage}
        page={paged.page}
        pageSize={paged.pageSize}
        total={paged.total}
      />
    </>
  );
}

function AccessPage() {
  const { session } = Route.useRouteContext();
  const isAdmin = session.user.role === "admin";
  const [tab, setTab] = useState<TabId>("users");
  const [user, setUser] = useState<UserEdit | null>(null);
  const [role, setRole] = useState<RoleEdit | null>(null);

  const onAdd = () => {
    if (tab === "users") {
      setUser({ brigadeId: null, email: "", id: null, name: "", roleId: "" });
    } else {
      setRole({ access: "brigadista", id: null, name: "" });
    }
  };

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Usuarios y roles" />
        <Notice tone="info">
          Solo un administrador puede gestionar usuarios y roles.
        </Notice>
      </>
    );
  }

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={onAdd} variant="primary">
            <Plus aria-hidden="true" size={16} />{" "}
            {tab === "users" ? "Nuevo usuario" : "Nuevo rol"}
          </Button>
        }
        title="Usuarios y roles"
      />
      <Tabs label="Acceso" onChange={setTab} tabs={TABS} value={tab} />
      <Panel className="overflow-hidden">
        {tab === "users" ? <UsersTab onEdit={setUser} /> : null}
        {tab === "roles" ? <RolesTab onEdit={setRole} /> : null}
      </Panel>
      <UserModal
        key={`user-${user?.id ?? "new"}-${user === null}`}
        onClose={() => setUser(null)}
        value={user}
      />
      <RoleModal
        key={`role-${role?.id ?? "new"}-${role === null}`}
        onClose={() => setRole(null)}
        value={role}
      />
    </>
  );
}
