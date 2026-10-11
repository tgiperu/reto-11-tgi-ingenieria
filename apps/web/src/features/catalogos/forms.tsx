import {
  DEFAULT_EQUATIONS,
  type Equations,
} from "@reto-11-tgi-ingenieria/domain/carbon";
import { parseDecimal } from "@reto-11-tgi-ingenieria/domain/measure";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { SelectField, TextField } from "@/components/app/field";
import { Modal } from "@/components/app/modal";
import { trpc } from "@/utils/trpc";

const LIFE_FORMS = ["Árbol", "Arbusto", "Árbol / arbusto"] as const;
type LifeForm = (typeof LIFE_FORMS)[number];

function useDone(message: string, onClose: () => void) {
  const queryClient = useQueryClient();
  return {
    onError: (e: { message: string }) => toast.error(e.message),
    onSuccess: async () => {
      toast.success(message);
      await queryClient.invalidateQueries();
      onClose();
    },
  };
}

export interface SpeciesEdit {
  id: number | null;
  lifeForm: string;
  name: string;
  scientificName: string | null;
}

export function SpeciesModal({
  value,
  onClose,
}: {
  value: SpeciesEdit | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(value?.name ?? "");
  const [sci, setSci] = useState(value?.scientificName ?? "");
  const [form, setForm] = useState<LifeForm>(
    (value?.lifeForm as LifeForm) ?? "Árbol"
  );
  const done = useDone(
    value?.id ? "Especie actualizada" : "Especie creada",
    onClose
  );
  const create = useMutation(trpc.catalog.species.create.mutationOptions(done));
  const update = useMutation(trpc.catalog.species.update.mutationOptions(done));
  const pending = create.isPending || update.isPending;
  const valid = name.trim().length >= 2;
  const submit = () => {
    if (value?.id) {
      update.mutate({
        id: value.id,
        lifeForm: form,
        name: name.trim(),
        scientificName: sci.trim() || null,
      });
    } else {
      create.mutate({
        lifeForm: form,
        name: name.trim(),
        scientificName: sci.trim() || undefined,
      });
    }
  };
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || pending}
            onClick={submit}
            variant="primary"
          >
            Guardar
          </Button>
        </>
      }
      onClose={onClose}
      open={value !== null}
      title={value?.id ? "Editar especie" : "Nueva especie"}
    >
      <TextField
        label="Nombre común"
        onChange={(e) => setName(e.target.value)}
        value={name}
      />
      <TextField
        hint="Déjalo vacío si aún está por validar."
        label="Nombre científico"
        onChange={(e) => setSci(e.target.value)}
        value={sci}
      />
      <SelectField
        label="Forma de vida"
        onChange={(e) => setForm(e.target.value as LifeForm)}
        value={form}
      >
        {LIFE_FORMS.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </SelectField>
    </Modal>
  );
}

export interface BrigadeEdit {
  devices: number;
  id: string | null;
  leaderName: string;
  members: string[];
}

export function BrigadeModal({
  value,
  onClose,
}: {
  value: BrigadeEdit | null;
  onClose: () => void;
}) {
  const [id, setId] = useState(value?.id ?? "");
  const [leader, setLeader] = useState(value?.leaderName ?? "");
  const [members, setMembers] = useState((value?.members ?? []).join(", "));
  const [devices, setDevices] = useState(String(value?.devices ?? 0));
  const done = useDone(
    value?.id ? "Brigada actualizada" : "Brigada creada",
    onClose
  );
  const create = useMutation(
    trpc.catalog.brigades.create.mutationOptions(done)
  );
  const update = useMutation(
    trpc.catalog.brigades.update.mutationOptions(done)
  );
  const list = members
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const valid =
    leader.trim().length >= 2 && (value?.id || id.trim().length >= 2);
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || create.isPending || update.isPending}
            onClick={() =>
              value?.id
                ? update.mutate({
                    devices: Number.parseInt(devices, 10) || 0,
                    id: value.id,
                    leaderName: leader.trim(),
                    members: list,
                  })
                : create.mutate({
                    id: id.trim(),
                    leaderName: leader.trim(),
                    members: list,
                  })
            }
            variant="primary"
          >
            Guardar
          </Button>
        </>
      }
      onClose={onClose}
      open={value !== null}
      title={value?.id ? `Editar ${value.id}` : "Nueva brigada"}
    >
      {value?.id ? null : (
        <TextField
          label="Código"
          mono
          onChange={(e) => setId(e.target.value)}
          placeholder="BR-04"
          value={id}
        />
      )}
      <TextField
        label="Jefe de brigada"
        onChange={(e) => setLeader(e.target.value)}
        value={leader}
      />
      <TextField
        label="Materos (separados por coma)"
        onChange={(e) => setMembers(e.target.value)}
        value={members}
      />
      {value?.id ? (
        <TextField
          inputMode="numeric"
          label="Dispositivos"
          mono
          onChange={(e) => setDevices(e.target.value)}
          value={devices}
        />
      ) : null}
    </Modal>
  );
}

export function SectorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const done = useDone("Sector creado", onClose);
  const create = useMutation(trpc.catalog.sectors.create.mutationOptions(done));
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={name.trim().length < 2 || create.isPending}
            onClick={() => create.mutate({ name })}
            variant="primary"
          >
            Crear sector
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Nuevo sector"
    >
      <TextField
        label="Nombre del sector"
        onChange={(e) => setName(e.target.value)}
        value={name}
      />
    </Modal>
  );
}

export const EQUATION_KEYS = [
  "latizal",
  "fustal",
  "arbusto",
  "overo",
  "brinzal",
] as const;
export type EquationKey = (typeof EQUATION_KEYS)[number];

const SHRUB_FIELDS = [
  {
    hint: "Multiplica la variable principal",
    label: "Coeficiente a",
    path: "a",
  },
  { hint: "Exponente o término restado", label: "Coeficiente b", path: "b" },
];
const TREE_SHARED = [
  { label: "Factor biomasa → carbono (compartido)", path: "biomassToCarbon" },
  { label: "Factor de raíces, árbol (compartido)", path: "rootRatioTree" },
];
const SHRUB_SHARED = [
  {
    label: "Factor de raíces, arbusto/brinzal (compartido)",
    path: "rootRatioShrub",
  },
];

/** Campos que intervienen en cada ecuación, con la ruta dentro de `Equations`. */
const FIELDS_BY_KEY: Record<EquationKey, { path: string; label: string }[]> = {
  arbusto: [
    ...SHRUB_FIELDS.map((f) => ({ label: f.label, path: `arbusto.${f.path}` })),
    ...SHRUB_SHARED,
  ],
  brinzal: [
    ...SHRUB_FIELDS.map((f) => ({ label: f.label, path: `brinzal.${f.path}` })),
    ...SHRUB_SHARED,
  ],
  fustal: [
    { label: "Constante c0", path: "fustal.c0" },
    { label: "Coeficiente c1 (de D)", path: "fustal.c1" },
    { label: "Coeficiente c2 (de D²)", path: "fustal.c2" },
    ...TREE_SHARED,
  ],
  latizal: [
    { label: "Coeficiente a", path: "latizal.a" },
    { label: "Exponente b", path: "latizal.b" },
    ...TREE_SHARED,
  ],
  overo: [
    ...SHRUB_FIELDS.map((f) => ({ label: f.label, path: `overo.${f.path}` })),
    ...SHRUB_SHARED,
  ],
};

function getPath(eq: Equations, path: string): number {
  const [a, b] = path.split(".") as [keyof Equations, string | undefined];
  const node = eq[a] as unknown;
  return typeof node === "number"
    ? node
    : ((node as Record<string, number>)[b ?? ""] ?? 0);
}

function setPath(eq: Equations, path: string, value: number): Equations {
  const [a, b] = path.split(".") as [keyof Equations, string | undefined];
  const node = eq[a] as unknown;
  if (typeof node === "number" || b === undefined) {
    return { ...eq, [a]: value };
  }
  return { ...eq, [a]: { ...(node as Record<string, number>), [b]: value } };
}

export function EquationsModal({
  equations,
  target,
  name,
  formula,
  open,
  onClose,
}: {
  equations: Equations;
  target: EquationKey;
  name: string;
  formula: string;
  open: boolean;
  onClose: () => void;
}) {
  const fields = FIELDS_BY_KEY[target];
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => [f.path, String(getPath(equations, f.path))])
    )
  );
  const queryClient = useQueryClient();
  const save = useMutation(
    trpc.catalog.equations.update.mutationOptions({
      onError: (e) => toast.error(e.message),
      onSuccess: async (res) => {
        toast.success(
          `${name} guardada · ${res.recomputed} mediciones recalculadas`
        );
        await queryClient.invalidateQueries();
        onClose();
      },
    })
  );
  const parsed = fields.map((f) => parseDecimal(draft[f.path] ?? ""));
  const valid = parsed.every((v) => v !== null);
  const submit = () => {
    let next = equations;
    for (const [i, f] of fields.entries()) {
      next = setPath(next, f.path, parsed[i] ?? 0);
    }
    save.mutate(next);
  };
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={submit}
            variant="primary"
          >
            {save.isPending ? "Recalculando…" : "Guardar y recalcular"}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={`Editar · ${name}`}
    >
      <code className="whitespace-pre-line rounded-md bg-paper px-3 py-2.5 font-mono text-xs">
        {formula}
      </code>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <TextField
            inputMode="decimal"
            key={f.path}
            label={f.label}
            mono
            onChange={(e) =>
              setDraft((d) => ({ ...d, [f.path]: e.target.value }))
            }
            value={draft[f.path] ?? ""}
          />
        ))}
      </div>
      <p className="text-ink-3 text-xs">
        Los factores marcados como compartidos también se usan en otras
        ecuaciones. Al guardar se recalcula el carbono de todas las mediciones:
        cambia estos valores solo con respaldo del equipo técnico.
      </p>
    </Modal>
  );
}
