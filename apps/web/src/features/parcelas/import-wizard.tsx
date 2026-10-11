import {
  autoMap,
  buildImportPreview,
  cellText,
  type FieldKey,
  IMPORT_FIELDS,
  IMPORT_TEMPLATE_HEADERS,
  type ImportPreview,
  importFieldLabel,
  type Mapping,
} from "@reto-11-tgi-ingenieria/domain/import";
import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { Chip } from "@/components/app/chip";
import { SelectField } from "@/components/app/field";
import { Notice, Panel, Table, Td, Th } from "@/components/app/panel";
import { fmtInt } from "@/lib/format";
import { downloadCsv, type GridFile, readGridFile } from "@/lib/xlsx";
import { trpc, trpcClient } from "@/utils/trpc";

const STEPS = ["Archivo", "Mapear columnas", "Validar", "Confirmar"] as const;
const CHUNK = 400;
const MAX_ISSUES_SHOWN = 150;
const MAX_COLUMNS = 80;

const REQUIRED = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key);

function StepBar({ step }: { step: number }) {
  return (
    <ol
      aria-label="Pasos"
      className="flex list-none flex-wrap gap-2 p-0 text-[13px]"
    >
      {STEPS.map((label, i) => (
        <li
          aria-current={i === step ? "step" : undefined}
          className={cn(
            "rounded-[4px] px-3 py-1.5 font-semibold",
            i < step && "bg-ok-bg text-ok-fg",
            i === step && "bg-primary text-white",
            i > step && "bg-sunken font-normal text-ink-2"
          )}
          key={label}
        >
          {i + 1} · {label}
        </li>
      ))}
    </ol>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "crit" | "neutral";
}) {
  const tones = {
    crit: "bg-crit-bg text-crit-fg",
    neutral: "bg-sunken text-ink-2",
    ok: "bg-ok-bg text-ok-fg",
    warn: "bg-warn-bg text-warn-fg",
  };
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-md p-3", tones[tone])}>
      <span className="text-xs">{label}</span>
      <strong className="font-mono text-xl text-ink">{value}</strong>
    </div>
  );
}

function FileStep({
  grid,
  fileName,
  onFile,
  onSheet,
  busy,
}: {
  grid: GridFile | null;
  fileName: string;
  onFile: (file: File) => void;
  onSheet: (sheet: string) => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-field border-dashed px-4 py-10 text-center text-sm hover:bg-sheet">
        <Upload aria-hidden="true" className="text-ink" size={28} />
        <strong>
          {busy
            ? "Leyendo el archivo…"
            : "Elige el archivo del inventario (.xlsx o .csv)"}
        </strong>
        <span className="text-ink-3">
          Se lee en tu equipo; solo se envían las filas ya validadas.
        </span>
        <input
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onFile(file);
            }
          }}
          type="file"
        />
      </label>
      {grid ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-field border-dashed p-3 text-[13px]">
          <FileSpreadsheet aria-hidden="true" className="text-ink" size={22} />
          <strong>{fileName}</strong>
          <span className="text-ink-3">
            Hoja "{grid.sheet}" · {fmtInt(Math.max(0, grid.grid.length - 1))}{" "}
            filas · {grid.grid[0]?.length ?? 0} columnas
          </span>
          {grid.sheets.length > 1 ? (
            <div className="ml-auto w-56">
              <SelectField
                label="Hoja"
                onChange={(e) => onSheet(e.target.value)}
                value={grid.sheet}
              >
                {grid.sheets.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SelectField>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button
          onClick={() =>
            downloadCsv("plantilla-inventario.csv", IMPORT_TEMPLATE_HEADERS, [
              [
                30,
                "Cherrelique",
                "Bosque denso",
                "",
                "Latizal alto",
                "58.1",
                "Huarapo",
                16.15,
                8.6,
              ],
            ])
          }
        >
          Descargar plantilla
        </Button>
      </div>
    </div>
  );
}

function fieldResult(
  field: FieldKey,
  summary: { errors: number; warnings: number } | undefined
): { tone: "ok" | "warn" | "crit" | "neutral"; text: string } {
  if (field === "carbon") {
    return { text: "Se recalcula en el sistema", tone: "neutral" };
  }
  if (summary?.errors) {
    return { text: `${summary.errors} con error`, tone: "crit" };
  }
  if (summary?.warnings) {
    return { text: `${summary.warnings} con advertencia`, tone: "warn" };
  }
  return { text: "OK", tone: "ok" };
}

function MappingStep({
  grid,
  columnField,
  onChange,
  preview,
}: {
  grid: GridFile;
  columnField: Map<number, FieldKey>;
  onChange: (col: number, field: FieldKey | "") => void;
  preview: ImportPreview;
}) {
  const headers = (grid.grid[0] ?? []).slice(0, MAX_COLUMNS);
  const sample = grid.grid[1] ?? [];
  const mapped = new Set(columnField.values());
  const missing = REQUIRED.filter((k) => !mapped.has(k));
  return (
    <div className="flex flex-col gap-3">
      {missing.length > 0 ? (
        <Notice tone="warn">
          Falta asignar: {missing.map(importFieldLabel).join(", ")}.
        </Notice>
      ) : null}
      <Table minWidth={680}>
        <thead>
          <tr>
            <Th>Columna del archivo</Th>
            <Th>Campo del sistema</Th>
            <Th>Ejemplo</Th>
            <Th>Resultado</Th>
          </tr>
        </thead>
        <tbody>
          {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse */}
          {headers.map((header, col) => {
            const field = columnField.get(col) ?? "";
            const summary = preview.fields.find((f) => f.key === field);
            let tone: "ok" | "warn" | "crit" | "neutral" = "neutral";
            let text = "No se importa";
            if (field) {
              ({ tone, text } = fieldResult(field, summary));
            }
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: la posición es la identidad de este elemento
              <tr key={`${col}-${cellText(header)}`}>
                <Td>{cellText(header) || `(columna ${col + 1})`}</Td>
                <Td>
                  <select
                    aria-label={`Campo para ${cellText(header)}`}
                    className="min-h-9 rounded-lg border border-edge bg-white px-2 text-[13px]"
                    onChange={(e) =>
                      onChange(col, e.target.value as FieldKey | "")
                    }
                    value={field}
                  >
                    <option value="">(no importar)</option>
                    {IMPORT_FIELDS.map((f) => (
                      <option
                        disabled={mapped.has(f.key) && field !== f.key}
                        key={f.key}
                        value={f.key}
                      >
                        {f.target}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td className="font-mono">{cellText(sample[col])}</Td>
                <Td>
                  <Chip tone={tone}>{text}</Chip>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

function ValidateStep({ preview }: { preview: ImportPreview }) {
  const [level, setLevel] = useState<"all" | "error" | "warning">("all");
  const issues = preview.issues.filter(
    (i) => level === "all" || i.level === level
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <Stat
          label="Filas válidas"
          tone="ok"
          value={fmtInt(preview.validRows)}
        />
        <Stat
          label="Con advertencias"
          tone="warn"
          value={fmtInt(preview.warningRows)}
        />
        <Stat
          label="Bloquean importación (se omiten)"
          tone="crit"
          value={fmtInt(preview.blockedRows)}
        />
        <Stat
          label="Catálogos nuevos"
          tone="neutral"
          value={`${preview.newSectors.length} sectores · ${preview.newSpecies.length} especies`}
        />
      </div>
      {preview.sectorVariants.length > 0 ||
      preview.speciesVariants.length > 0 ? (
        <Notice tone="info">
          Se normalizaron nombres con distinta escritura:{" "}
          {[...preview.sectorVariants, ...preview.speciesVariants]
            .slice(0, 6)
            .map((g) => `${g.variants.join(" / ")} → ${g.canonical}`)
            .join(" · ")}
          {preview.sectorVariants.length + preview.speciesVariants.length > 6
            ? " · …"
            : ""}
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-ink-3">Mostrar:</span>
        {(
          [
            ["all", "Todos"],
            ["error", "Errores"],
            ["warning", "Advertencias"],
          ] as const
        ).map(([id, label]) => (
          <button
            aria-pressed={level === id}
            className={cn(
              "min-h-8 cursor-pointer rounded-full border px-3",
              level === id
                ? "border-primary bg-ok-bg font-semibold"
                : "border-edge bg-white"
            )}
            key={id}
            onClick={() => setLevel(id)}
            type="button"
          >
            {label}
          </button>
        ))}
        <Button
          className="ml-auto"
          onClick={() =>
            downloadCsv(
              "observaciones-importacion.csv",
              ["Fila", "Nivel", "Campo", "Detalle"],
              preview.issues.map((i) => [
                i.row + 1,
                i.level === "error" ? "Error" : "Advertencia",
                i.field ? importFieldLabel(i.field) : "",
                i.message,
              ])
            )
          }
          size="sm"
        >
          Descargar observaciones
        </Button>
      </div>
      <Table minWidth={560}>
        <thead>
          <tr>
            <Th>Fila</Th>
            <Th>Nivel</Th>
            <Th>Campo</Th>
            <Th>Detalle</Th>
          </tr>
        </thead>
        <tbody>
          {issues.slice(0, MAX_ISSUES_SHOWN).map((i, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: una fila puede tener varias observaciones iguales
            <tr key={`${i.row}-${idx}`}>
              <Td className="font-mono">{i.row + 1}</Td>
              <Td>
                <Chip tone={i.level === "error" ? "crit" : "warn"}>
                  {i.level === "error" ? "Error" : "Advertencia"}
                </Chip>
              </Td>
              <Td>{i.field ? importFieldLabel(i.field) : "—"}</Td>
              <Td>{i.message}</Td>
            </tr>
          ))}
          {issues.length === 0 ? (
            <tr>
              <Td className="py-6 text-center text-ink-3" colSpan={4}>
                Sin observaciones en esta vista.
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
      {issues.length > MAX_ISSUES_SHOWN ? (
        <p className="text-ink-3 text-xs">
          Se muestran {MAX_ISSUES_SHOWN} de {fmtInt(issues.length)}. Descarga el
          archivo de observaciones para verlas todas.
        </p>
      ) : null}
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse
export function ImportWizard({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const existing = useQuery({
    ...trpc.imports.context.queryOptions(),
    enabled: isAdmin,
  });
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [grid, setGrid] = useState<GridFile | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const deferredMapping = useDeferredValue(mapping);
  const preview = useMemo<ImportPreview | null>(() => {
    if (!grid || grid.grid.length < 2 || step === 0) {
      return null;
    }
    return buildImportPreview(
      grid.grid,
      deferredMapping,
      existing.data ?? { sectors: [], species: [] }
    );
  }, [grid, deferredMapping, existing.data, step]);

  const columnField = useMemo(() => {
    const map = new Map<number, FieldKey>();
    for (const [key, col] of Object.entries(mapping)) {
      if (col !== undefined) {
        map.set(col, key as FieldKey);
      }
    }
    return map;
  }, [mapping]);

  if (!isAdmin) {
    return (
      <Notice tone="warn">
        Solo un administrador puede importar archivos.
      </Notice>
    );
  }

  async function load(next: File, sheet?: string) {
    setBusy(true);
    try {
      const loaded = await readGridFile(next, sheet);
      setFile(next);
      setGrid(loaded);
      setMapping(autoMap((loaded.grid[0] ?? []).map((h) => cellText(h))));
      setResult(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `No se pudo leer el archivo: ${error.message}`
          : "No se pudo leer el archivo"
      );
    } finally {
      setBusy(false);
    }
  }

  function onMap(col: number, field: FieldKey | "") {
    setMapping((prev) => {
      const next: Mapping = {};
      for (const [key, c] of Object.entries(prev)) {
        if (c !== col) {
          next[key as FieldKey] = c;
        }
      }
      if (field) {
        next[field] = col;
      }
      return next;
    });
  }

  async function commit() {
    if (!(preview && file)) {
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: preview.records.length });
    try {
      const { batchId } = await trpcClient.imports.begin.mutate({
        fileName: file.name,
        rows: preview.totalRows,
      });
      for (let i = 0; i < preview.records.length; i += CHUNK) {
        const records = preview.records.slice(i, i + CHUNK);
        // biome-ignore lint/performance/noAwaitInLoops: los bloques van en orden para mostrar el avance real
        await trpcClient.imports.chunk.mutate({ batchId, records });
        setProgress({
          done: Math.min(i + CHUNK, preview.records.length),
          total: preview.records.length,
        });
      }
      const { reevaluated } = await trpcClient.imports.finish.mutate({
        batchId,
        records: preview.records.length,
        summary: {
          blockedRows: preview.blockedRows,
          newSectors: preview.newSectors.length,
          newSpecies: preview.newSpecies.length,
          rows: preview.totalRows,
          warningRows: preview.warningRows,
        },
      });
      setResult(
        `Importación lista: ${fmtInt(preview.records.length)} individuos de ${fmtInt(preview.totalRows)} filas. Se recalcularon ${fmtInt(reevaluated)} mediciones con los rangos y reglas vigentes.`
      );
      toast.success("Importación terminada");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "La importación falló"
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const missing = REQUIRED.filter((k) => mapping[k] === undefined);
  const canNext =
    (step === 0 && grid !== null && grid.grid.length > 1) ||
    (step === 1 && missing.length === 0) ||
    (step === 2 && preview !== null && preview.records.length > 0);

  return (
    <Panel className="flex flex-col gap-5 p-5">
      <StepBar step={step} />
      {step === 0 ? (
        <FileStep
          busy={busy}
          fileName={file?.name ?? ""}
          grid={grid}
          onFile={(f) => load(f)}
          onSheet={(sheet) => file && load(file, sheet)}
        />
      ) : null}
      {step === 1 && grid && preview ? (
        <MappingStep
          columnField={columnField}
          grid={grid}
          onChange={onMap}
          preview={preview}
        />
      ) : null}
      {step === 2 && preview ? <ValidateStep preview={preview} /> : null}
      {step === 3 && preview ? (
        <div className="flex flex-col gap-3">
          {result ? (
            <Notice tone="ok">{result}</Notice>
          ) : (
            <Notice tone="info">
              Se importarán{" "}
              <strong>{fmtInt(preview.records.length)} individuos</strong> de{" "}
              <strong>{fmtInt(preview.totalRows)} filas</strong>.{" "}
              {preview.blockedRows > 0
                ? `${fmtInt(preview.blockedRows)} filas con errores se omiten. `
                : ""}
              Las parcelas nuevas quedan bloqueadas (histórico) y las existentes
              conservan su estado. Al terminar se recalculan los rangos por
              especie y las alertas.
            </Notice>
          )}
          {progress ? (
            <div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{
                    width: `${(progress.done / Math.max(1, progress.total)) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-ink-3 text-xs">
                Enviando {fmtInt(progress.done)} de {fmtInt(progress.total)}…
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          disabled={step === 0 || busy}
          onClick={() => setStep((s) => s - 1)}
        >
          Atrás
        </Button>
        {step < 3 ? (
          <Button
            disabled={!canNext || busy}
            onClick={() => setStep((s) => s + 1)}
            variant="primary"
          >
            {step === 2 ? "Revisar y confirmar" : "Continuar"}
          </Button>
        ) : (
          <Button
            disabled={busy || result !== null || !preview?.records.length}
            onClick={commit}
            variant="primary"
          >
            {busy
              ? "Importando…"
              : `Importar ${fmtInt(preview?.records.length ?? 0)} individuos`}
          </Button>
        )}
      </div>
    </Panel>
  );
}
