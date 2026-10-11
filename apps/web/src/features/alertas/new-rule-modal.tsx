import {
  CATEGORIES,
  CATEGORY_KEYS,
  type CategoryKey,
} from "@reto-11-tgi-ingenieria/domain/categories";
import { parseDecimal } from "@reto-11-tgi-ingenieria/domain/measure";
import {
  CUSTOM_ACTIONS,
  CUSTOM_OPERATORS,
  CUSTOM_VARIABLES,
  type CustomAction,
  type CustomOperator,
  type CustomVariable,
} from "@reto-11-tgi-ingenieria/domain/rules";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { SelectField, TextField } from "@/components/app/field";
import { Modal } from "@/components/app/modal";
import { trpc } from "@/utils/trpc";

const VARIABLE_KEYS = Object.keys(CUSTOM_VARIABLES) as CustomVariable[];
const OPERATOR_KEYS = Object.keys(CUSTOM_OPERATORS) as CustomOperator[];
const ACTION_KEYS = Object.keys(CUSTOM_ACTIONS) as CustomAction[];

export function NewRuleModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [variable, setVariable] = useState<CustomVariable>("dap");
  const [operator, setOperator] = useState<CustomOperator>("gt");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState<CategoryKey | "all">("all");
  const [severity, setSeverity] = useState<"warning" | "critical">("warning");
  const [action, setAction] = useState<CustomAction>("confirm");

  const create = useMutation(
    trpc.alerts.rules.createCustom.mutationOptions({
      onError: (e) => toast.error(e.message),
      onSuccess: async () => {
        toast.success("Alerta creada: publícala para que llegue a los equipos");
        await queryClient.invalidateQueries({
          queryKey: trpc.alerts.rules.list.queryKey(),
        });
        onClose();
      },
    })
  );

  const threshold = parseDecimal(value);
  const valid = name.trim().length >= 3 && threshold !== null;
  const { unit } = CUSTOM_VARIABLES[variable];

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || create.isPending}
            onClick={() =>
              threshold !== null &&
              create.mutate({
                action,
                categories: category === "all" ? null : [category],
                name: name.trim(),
                operator,
                severity,
                value: threshold,
                variable,
              })
            }
            variant="primary"
          >
            {create.isPending ? "Creando…" : "Crear alerta"}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Nueva alerta por umbral"
    >
      <TextField
        label="Nombre de la alerta"
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej. Altura excesiva en brinzal"
        value={name}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Variable"
          onChange={(e) => setVariable(e.target.value as CustomVariable)}
          value={variable}
        >
          {VARIABLE_KEYS.map((k) => (
            <option key={k} value={k}>
              {CUSTOM_VARIABLES[k].label} ({CUSTOM_VARIABLES[k].unit})
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Se dispara cuando es"
          onChange={(e) => setOperator(e.target.value as CustomOperator)}
          value={operator}
        >
          {OPERATOR_KEYS.map((k) => (
            <option key={k} value={k}>
              {CUSTOM_OPERATORS[k].label}
            </option>
          ))}
        </SelectField>
        <TextField
          hint={`Umbral en ${unit}`}
          inputMode="decimal"
          label="Valor"
          mono
          onChange={(e) => setValue(e.target.value)}
          value={value}
        />
        <SelectField
          label="Categoría"
          onChange={(e) => setCategory(e.target.value as CategoryKey | "all")}
          value={category}
        >
          <option value="all">Todas las categorías</option>
          {CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>
              {CATEGORIES[k].name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Severidad"
          onChange={(e) =>
            setSeverity(e.target.value as "warning" | "critical")
          }
          value={severity}
        >
          <option value="warning">Advertencia</option>
          <option value="critical">Crítica</option>
        </SelectField>
        <SelectField
          label="Al dispararse"
          onChange={(e) => setAction(e.target.value as CustomAction)}
          value={action}
        >
          {ACTION_KEYS.map((k) => (
            <option key={k} value={k}>
              {CUSTOM_ACTIONS[k]}
            </option>
          ))}
        </SelectField>
      </div>
      <p className="text-ink-3 text-xs">
        La alerta queda en borrador. Al publicar la nueva versión se aplica en
        campo (sin conexión) y en el servidor, y se reevalúan las mediciones.
      </p>
    </Modal>
  );
}
