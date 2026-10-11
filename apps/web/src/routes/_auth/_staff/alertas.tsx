import { parseDecimal } from "@reto-11-tgi-ingenieria/domain/measure";
import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleX, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { Chip } from "@/components/app/chip";
import { SelectField, TextField } from "@/components/app/field";
import {
  Notice,
  PageHeader,
  Panel,
  Table,
  Td,
  Th,
} from "@/components/app/panel";
import { fmtInt, fmtNum } from "@/lib/format";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/_staff/alertas")({
  component: AlertsPage,
});

interface RuleView {
  actionLabel: string;
  active: boolean;
  description: string;
  hits: number;
  hitsUnit: string;
  key: string;
  name: string;
  param: number | null;
  paramLabel: string;
  paramUnit: string;
  scopeLabel: string;
  severity: "warning" | "critical";
  severityLabel: string;
}

function RuleRow({
  rule,
  editable,
  tested,
  onToggle,
  onParam,
}: {
  rule: RuleView;
  editable: boolean;
  tested: number | undefined;
  onToggle: (active: boolean) => void;
  onParam: (param: number | null) => void;
}) {
  const [text, setText] = useState(
    rule.param === null ? "" : String(rule.param)
  );
  useEffect(
    () => setText(rule.param === null ? "" : String(rule.param)),
    [rule.param]
  );
  const hasParam = rule.paramLabel !== "";
  const commit = () => {
    const value = parseDecimal(text);
    if (value !== null && value !== rule.param) {
      onParam(value);
    } else {
      setText(rule.param === null ? "" : String(rule.param));
    }
  };
  return (
    <tr className={cn(!rule.active && "opacity-55")}>
      <Td className="pl-4">
        <button
          aria-checked={rule.active}
          aria-label={`Activar regla ${rule.name}`}
          className={cn(
            "relative h-[26px] w-11 cursor-pointer rounded-full border-0 p-0 disabled:cursor-not-allowed",
            rule.active ? "bg-primary" : "bg-edge"
          )}
          disabled={!editable}
          onClick={() => onToggle(!rule.active)}
          role="switch"
          type="button"
        >
          <span
            className="absolute top-[3px] size-5 rounded-full bg-white transition-[left]"
            style={{ left: rule.active ? 21 : 3 }}
          />
        </button>
      </Td>
      <Td>
        <div className="flex flex-col gap-0.5">
          <strong className="font-semibold">{rule.name}</strong>
          <span className="text-ink-3 text-xs">{rule.description}</span>
        </div>
      </Td>
      <Td>
        {hasParam ? (
          <label className="flex items-center gap-1.5 text-ink-3 text-xs">
            {rule.paramLabel}
            <input
              className="min-h-[34px] w-16 rounded-md border border-edge px-2 font-mono text-[13px] text-ink disabled:bg-sheet"
              disabled={!editable}
              inputMode="decimal"
              onBlur={commit}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              type="text"
              value={text}
            />
            {rule.paramUnit}
          </label>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </Td>
      <Td>
        <Chip tone={rule.severity === "critical" ? "crit" : "warn"}>
          {rule.severityLabel}
        </Chip>
      </Td>
      <Td>{rule.scopeLabel}</Td>
      <Td>{rule.actionLabel}</Td>
      <Td className="pr-4 text-right font-mono font-semibold">
        {tested === undefined ? (
          <>
            {fmtInt(rule.hits)}
            {rule.hitsUnit ? ` ${rule.hitsUnit}` : ""}
          </>
        ) : (
          <span
            className="text-info-fg"
            title="Resultado de la prueba con el borrador"
          >
            {fmtInt(tested)} · prueba
          </span>
        )}
      </Td>
    </tr>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse
function RangeEditor({ editable }: { editable: boolean }) {
  const queryClient = useQueryClient();
  const species = useQuery(trpc.catalog.species.list.queryOptions());
  const [speciesId, setSpeciesId] = useState<number | null>(null);
  const withRange =
    species.data?.find((s) => s.dapMax !== null) ?? species.data?.[0];
  const id = speciesId ?? withRange?.id ?? null;
  const range = useQuery({
    ...trpc.alerts.range.get.queryOptions({ speciesId: id ?? 0 }),
    enabled: id !== null,
  });
  const [form, setForm] = useState({ dapMax: "", dapMin: "", heightMax: "" });
  const { data } = range;
  useEffect(() => {
    if (data) {
      setForm({
        dapMax: data.dapMax === null ? "" : String(data.dapMax),
        dapMin: data.dapMin === null ? "" : String(data.dapMin),
        heightMax: data.heightMax === null ? "" : String(data.heightMax),
      });
    }
  }, [data]);
  const done = (message: string) => async () => {
    toast.success(message);
    await queryClient.invalidateQueries();
  };
  const onError = (e: { message: string }) => toast.error(e.message);
  const save = useMutation(
    trpc.alerts.range.update.mutationOptions({
      onError,
      onSuccess: done("Límites guardados y alertas recalculadas"),
    })
  );
  const reset = useMutation(
    trpc.alerts.range.reset.mutationOptions({
      onError,
      onSuccess: done("Límites restablecidos a los calculados"),
    })
  );

  const scale = Math.max(60, (data?.dapMax ?? 0) * 1.4);
  const at = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <Panel className="flex min-w-0 flex-[1_1_420px] flex-col gap-3 p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-[15px]">Rango por especie</h2>
        <div className="w-52">
          <SelectField
            label="Especie"
            onChange={(e) => setSpeciesId(Number(e.target.value))}
            value={id ?? ""}
          >
            {species.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      {data ? (
        <>
          <span className="text-ink-3 text-xs">
            {data.manual
              ? "Límites fijados a mano."
              : `Calculado con ${fmtInt(data.sample)} mediciones históricas.`}{" "}
            Puedes fijar límites manuales.
          </span>
          <div aria-hidden="true" className="relative my-2 h-14">
            <div className="absolute inset-x-0 top-6 h-2 rounded bg-sunken" />
            {data.dapMax === null ? null : (
              <div
                className="absolute top-6 h-2 rounded bg-ok-band"
                style={{
                  left: at(data.dapMin ?? 0),
                  width: `calc(${at(data.dapMax)} - ${at(data.dapMin ?? 0)})`,
                }}
              />
            )}
            {data.dapMean === null ? null : (
              <>
                <div
                  className="absolute top-[18px] h-5 w-[3px] bg-primary"
                  style={{ left: at(data.dapMean) }}
                />
                <span
                  className="absolute top-0 text-ink-2 text-xs"
                  style={{ left: at(data.dapMean) }}
                >
                  media {fmtNum(data.dapMean)}
                </span>
              </>
            )}
            {data.dapMax === null ? null : (
              <>
                <div
                  className="absolute top-3.5 h-7 w-[3px] bg-warn"
                  style={{ left: at(data.dapMax) }}
                />
                <span
                  className="absolute top-[42px] font-semibold text-warn-fg text-xs"
                  style={{ left: at(data.dapMax) }}
                >
                  límite {fmtNum(data.dapMax)}
                </span>
              </>
            )}
            <span className="absolute top-[42px] right-0 text-ink-3 text-xs">
              {Math.round(scale)} cm
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <TextField
              disabled={!editable}
              inputMode="decimal"
              label="DAP mín. (cm)"
              mono
              onChange={(e) => setForm({ ...form, dapMin: e.target.value })}
              value={form.dapMin}
            />
            <TextField
              disabled={!editable}
              inputMode="decimal"
              label="DAP máx. (cm)"
              mono
              onChange={(e) => setForm({ ...form, dapMax: e.target.value })}
              value={form.dapMax}
            />
            <TextField
              disabled={!editable}
              inputMode="decimal"
              label="Altura máx. (m)"
              mono
              onChange={(e) => setForm({ ...form, heightMax: e.target.value })}
              value={form.heightMax}
            />
          </div>
          {editable ? (
            <div className="flex flex-wrap justify-end gap-2">
              {data.manual ? (
                <Button
                  disabled={reset.isPending}
                  onClick={() => reset.mutate({ speciesId: data.id })}
                  size="sm"
                >
                  Volver a los calculados
                </Button>
              ) : null}
              <Button
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    dapMax: parseDecimal(form.dapMax),
                    dapMin: parseDecimal(form.dapMin),
                    heightMax: parseDecimal(form.heightMax),
                    speciesId: data.id,
                  })
                }
                size="sm"
                variant="primary"
              >
                Guardar límites
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-ink-3 text-sm">Elige una especie.</p>
      )}
    </Panel>
  );
}

function AppPreview() {
  return (
    <Panel className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5 p-[18px]">
      <h2 className="font-semibold text-[15px]">Cómo se ve en la app</h2>
      <div className="flex items-start gap-2.5 rounded-md bg-warn-bg p-3 text-[13px] text-warn-fg">
        <TriangleAlert
          aria-hidden="true"
          className="mt-px flex-none"
          size={18}
        />
        <div className="flex flex-col gap-1">
          <strong>DAP atípico para Guayacán</strong>
          <span>
            48.10 cm supera el límite de 24.2 cm. Vuelve a medir o justifica con
            una foto.
          </span>
        </div>
      </div>
      <div className="flex items-start gap-2.5 rounded-md bg-crit-bg p-3 text-[13px] text-crit-fg">
        <CircleX aria-hidden="true" className="mt-px flex-none" size={18} />
        <div className="flex flex-col gap-1">
          <strong>N° 58 ya existe en esta parcela</strong>
          <span>
            No se puede guardar dos veces el mismo código. Revisa el número de
            la placa.
          </span>
        </div>
      </div>
      <span className="text-ink-3 text-xs">
        Advertencia: se puede guardar y queda marcada para revisión. Crítica:
        impide guardar o sincronizar hasta corregirla.
      </span>
    </Panel>
  );
}

function AlertsPage() {
  const { session } = Route.useRouteContext();
  const editable = session.user.role === "admin";
  const queryClient = useQueryClient();
  const rules = useQuery(trpc.alerts.rules.list.queryOptions());
  const [tested, setTested] = useState<Record<string, number> | null>(null);
  const onError = (e: { message: string }) => toast.error(e.message);
  const update = useMutation(
    trpc.alerts.rules.update.mutationOptions({
      onError,
      onSuccess: async () => {
        setTested(null);
        await queryClient.invalidateQueries({
          queryKey: trpc.alerts.rules.list.queryKey(),
        });
      },
    })
  );
  const publish = useMutation(
    trpc.alerts.rules.publish.mutationOptions({
      onError,
      onSuccess: async (res) => {
        setTested(null);
        toast.success(
          `Reglas publicadas · ${fmtInt(res.reevaluated)} mediciones reevaluadas`
        );
        await queryClient.invalidateQueries();
      },
    })
  );
  const test = useMutation(
    trpc.alerts.rules.test.mutationOptions({
      onError,
      onSuccess: (res) => {
        setTested(res.hits);
        toast.success(
          `Prueba lista sobre ${fmtInt(res.evaluated)} mediciones. Nada se guardó.`
        );
      },
    })
  );

  const { data } = rules;
  return (
    <>
      <PageHeader
        actions={
          <>
            <Button
              disabled={!editable || test.isPending}
              onClick={() => test.mutate()}
            >
              {test.isPending ? "Probando…" : "Probar contra datos históricos"}
            </Button>
            <Button
              disabled={!editable || publish.isPending || !data?.dirty}
              onClick={() => publish.mutate()}
              variant="primary"
            >
              {publish.isPending
                ? "Publicando…"
                : `Publicar nueva versión (${data?.activeCount ?? 0} activas)`}
            </Button>
          </>
        }
        subtitle="Las reglas se publican como un paquete versionado y se descargan a la app: se evalúan en tiempo real en campo, sin conexión, y otra vez en el servidor al sincronizar."
        title="Reglas de alerta y validación"
      />
      {data ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          Versión vigente en los equipos: <Chip tone="ok">{data.version}</Chip>
          {data.dirty ? (
            <Chip tone="warn">Hay cambios sin publicar</Chip>
          ) : null}
        </div>
      ) : null}
      {editable ? null : (
        <Notice tone="info">
          Puedes consultar las reglas. Solo un administrador puede cambiarlas.
        </Notice>
      )}
      <Panel className="overflow-hidden">
        <Table minWidth={980}>
          <thead>
            <tr>
              <Th className="pl-4">Activa</Th>
              <Th>Regla</Th>
              <Th>Parámetro</Th>
              <Th>Severidad</Th>
              <Th>Dónde</Th>
              <Th>Al dispararse</Th>
              <Th className="pr-4 text-right">Hallazgos</Th>
            </tr>
          </thead>
          <tbody>
            {data?.rules.map((r) => (
              <RuleRow
                editable={editable}
                key={r.key}
                onParam={(param) => update.mutate({ key: r.key, param })}
                onToggle={(active) => update.mutate({ active, key: r.key })}
                rule={r}
                tested={tested?.[r.key] ?? (tested ? 0 : undefined)}
              />
            ))}
          </tbody>
        </Table>
      </Panel>
      <div className="flex flex-wrap items-start gap-4">
        <RangeEditor editable={editable} />
        <AppPreview />
      </div>
    </>
  );
}
