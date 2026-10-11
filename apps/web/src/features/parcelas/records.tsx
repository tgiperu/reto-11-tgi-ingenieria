import type { CategoryKey } from "@reto-11-tgi-ingenieria/domain/categories";
import {
  REVIEW_LABELS,
  type ReviewState,
  type Role,
} from "@reto-11-tgi-ingenieria/domain/constants";
import { healthLabel } from "@reto-11-tgi-ingenieria/domain/health";
import { average } from "@reto-11-tgi-ingenieria/domain/measure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Lock, LockOpen } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { Chip } from "@/components/app/chip";
import { Table, Td, Th } from "@/components/app/panel";
import { type TabDef, Tabs } from "@/components/app/tabs";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { trpc } from "@/utils/trpc";

import {
  AssignModal,
  type CorrectableRecord,
  CorrectModal,
  PhotoModal,
  type PhotoTarget,
  ReasonModal,
} from "./modals";

const CATEGORY_TABS: TabDef<CategoryKey>[] = [
  { id: "la", label: "Latizal alto" },
  { id: "fu", label: "Fustal" },
  { id: "ar", label: "Arbusto grande" },
  { id: "br", label: "Brinzal" },
];

const PAGE = 300;

const ACTION_LABELS: Record<string, string> = {
  import: "Importación de archivo",
  "measurement.accept": "Alerta aceptada",
  "measurement.correct": "Corrección de Admin",
  "measurement.remeasure": "Re-medición pedida",
  "plot.assign": "Asignada a brigada",
  "plot.create": "Parcela creada",
  "plot.lock": "Parcela bloqueada",
  "plot.relock": "Volvió a bloquearse",
  "plot.unlock": "Desbloqueada para corrección",
  sync: "Sincronizada desde campo",
};

const ACTION_COLORS: Record<string, string> = {
  "measurement.correct": "text-warn-fg",
  "plot.unlock": "text-crit-fg",
  sync: "text-ink",
};

interface RecordRow {
  alerts: { rule: string; title: string }[];
  category: string;
  code: string;
  crownMax: number | null;
  crownMin: number | null;
  dac1: number | null;
  dac2: number | null;
  dapEq: number | null;
  hasPhoto: boolean;
  health: string | null;
  height: number | null;
  id: string;
  measuredAt: string;
  notes: string;
  review: string;
  speciesId: number | null;
  speciesName: string | null;
  stems: number[];
}

const REVIEW_TONES: Record<string, "warn" | "info" | "ok" | "neutral"> = {
  accepted: "ok",
  justified: "info",
  pending: "warn",
  remeasure: "neutral",
};

function ReviewChip({ review }: { review: string }) {
  const tone = REVIEW_TONES[review] ?? "neutral";
  return review === "none" ? (
    <span className="text-ink-3">—</span>
  ) : (
    <Chip tone={tone}>{REVIEW_LABELS[review as ReviewState] ?? review}</Chip>
  );
}

function AlertTags({ alerts }: { alerts: RecordRow["alerts"] }) {
  if (alerts.length === 0) {
    return <span className="text-ink-3">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {alerts.map((a) => (
        <Chip key={`${a.rule}-${a.title}`} tone="warn">
          {a.title}
        </Chip>
      ))}
    </div>
  );
}

function PhotoCell({
  row,
  onPhoto,
}: {
  row: RecordRow;
  onPhoto: (row: RecordRow) => void;
}) {
  return row.hasPhoto ? (
    <Button
      aria-label={`Ver foto de N° ${row.code}`}
      onClick={() => onPhoto(row)}
      size="sm"
    >
      <Camera aria-hidden="true" size={14} /> Ver
    </Button>
  ) : (
    <span className="text-ink-3">—</span>
  );
}

function RecordsTable({
  category,
  rows,
  editable,
  onPhoto,
  onCorrect,
}: {
  category: CategoryKey;
  rows: RecordRow[];
  editable: boolean;
  onPhoto: (row: RecordRow) => void;
  onCorrect: (row: RecordRow) => void;
}) {
  const isTree = category === "la" || category === "fu";
  return (
    <Table minWidth={1040}>
      <thead>
        <tr>
          <Th>Código</Th>
          <Th>Especie</Th>
          {isTree ? (
            <>
              <Th className="text-right">DAP (cm)</Th>
              <Th className="text-right">D. equiv. (cm)</Th>
              <Th className="text-right">Altura (m)</Th>
            </>
          ) : null}
          {category === "ar" ? (
            <>
              <Th className="text-right">Copa menor (m)</Th>
              <Th className="text-right">Copa mayor (m)</Th>
              <Th className="text-right">Copa prom. (m)</Th>
              <Th className="text-right">Altura (m)</Th>
            </>
          ) : null}
          {category === "br" ? (
            <>
              <Th className="text-right">DAC 1 (cm)</Th>
              <Th className="text-right">DAC 2 (cm)</Th>
              <Th className="text-right">DAC prom. (cm)</Th>
            </>
          ) : null}
          <Th>Sanidad</Th>
          <Th>Alertas</Th>
          <Th>Estado</Th>
          <Th>Foto</Th>
          {editable ? (
            <Th>
              <span className="sr-only">Acciones</span>
            </Th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const axes =
            isTree && r.stems.length > 1 ? r.stems : [r.stems[0] ?? null];
          return (
            <Fragment key={r.id}>
              {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse */}
              {axes.map((stem, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: la posición es la identidad de este elemento
                <tr key={`${r.id}-${i + 1}`}>
                  <Td
                    className={`font-mono ${i === 0 ? "font-semibold" : "pl-7 text-ink-3"}`}
                  >
                    {axes.length > 1 ? `${r.code}.${i + 1}` : r.code}
                  </Td>
                  <Td>{i === 0 ? (r.speciesName ?? "—") : ""}</Td>
                  {isTree ? (
                    <>
                      <Td className="text-right font-mono">
                        {fmtNum(stem, 2)}
                      </Td>
                      <Td className="text-right font-mono">
                        {i === 0 && axes.length > 1 ? fmtNum(r.dapEq, 2) : "—"}
                      </Td>
                      <Td className="text-right font-mono">
                        {i === 0 ? fmtNum(r.height, 2) : ""}
                      </Td>
                    </>
                  ) : null}
                  {category === "ar" ? (
                    <>
                      <Td className="text-right font-mono">
                        {fmtNum(r.crownMin, 2)}
                      </Td>
                      <Td className="text-right font-mono">
                        {fmtNum(r.crownMax, 2)}
                      </Td>
                      <Td className="text-right font-mono">
                        {fmtNum(average([r.crownMin, r.crownMax]), 2)}
                      </Td>
                      <Td className="text-right font-mono">
                        {fmtNum(r.height, 2)}
                      </Td>
                    </>
                  ) : null}
                  {category === "br" ? (
                    <>
                      <Td className="text-right font-mono">
                        {fmtNum(r.dac1, 2)}
                      </Td>
                      <Td className="text-right font-mono">
                        {fmtNum(r.dac2, 2)}
                      </Td>
                      <Td className="text-right font-mono">
                        {fmtNum(average([r.dac1, r.dac2]), 2)}
                      </Td>
                    </>
                  ) : null}
                  <Td>{i === 0 ? healthLabel(r.health) : ""}</Td>
                  <Td>{i === 0 ? <AlertTags alerts={r.alerts} /> : null}</Td>
                  <Td>{i === 0 ? <ReviewChip review={r.review} /> : null}</Td>
                  <Td>
                    {i === 0 ? <PhotoCell onPhoto={onPhoto} row={r} /> : null}
                  </Td>
                  {editable ? (
                    <Td className="text-right">
                      {i === 0 ? (
                        <Button onClick={() => onCorrect(r)} size="sm">
                          Corregir
                        </Button>
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </Fragment>
          );
        })}
        {rows.length === 0 ? (
          <tr>
            <Td className="py-8 text-center text-ink-3" colSpan={12}>
              Sin registros en esta categoría.
            </Td>
          </tr>
        ) : null}
      </tbody>
    </Table>
  );
}

function AuditAside({ plot }: { plot: number }) {
  const audit = useQuery(trpc.plots.audit.queryOptions({ plot }));
  return (
    <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-lg border border-line bg-white p-4">
      <h2 className="font-semibold text-[15px]">Historial (auditoría)</h2>
      {audit.data?.length === 0 ? (
        <p className="text-[13px] text-ink-3">Aún no hay movimientos.</p>
      ) : null}
      <ol className="flex list-none flex-col gap-3 p-0 text-[13px]">
        {audit.data?.map((a) => {
          const records = (a.detail as { records?: number } | null)?.records;
          return (
            <li
              className={
                "flex flex-col gap-0.5 border-line-2 border-t pt-3 first:border-t-0 first:pt-0"
              }
              key={a.id}
            >
              <strong className={ACTION_COLORS[a.action] ?? "text-info-fg"}>
                {ACTION_LABELS[a.action] ?? a.action}
                {records ? ` · ${records} registros` : ""}
              </strong>
              <span className="text-ink-3">
                {fmtDateTime(a.at)} · {a.userName ?? "sistema"}
              </span>
              {a.reason ? (
                <span className="text-ink-2">Motivo: {a.reason}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function usePlotRecords(plot: number, category: CategoryKey) {
  const key = `${plot}-${category}`;
  const [offsets, setOffsets] = useState({ key, value: 0 });
  const offset = offsets.key === key ? offsets.value : 0;
  const [state, setState] = useState<{ key: string; rows: RecordRow[] }>({
    key,
    rows: [],
  });
  // Al cambiar de categoría no se muestran las filas de la anterior.
  const rows = state.key === key ? state.rows : [];
  const page = useQuery(
    trpc.plots.records.queryOptions({ category, offset, plot })
  );

  useEffect(() => {
    if (page.data) {
      setState((prev) => ({
        key,
        rows:
          offset === 0 || prev.key !== key
            ? page.data.rows
            : [...prev.rows, ...page.data.rows],
      }));
    }
  }, [page.data, offset, key]);
  return {
    loadMore: () => setOffsets({ key, value: rows.length }),
    loading: rows.length === 0 && page.isFetching,
    page,
    rows,
  };
}

export function PlotRecords({ plot, role }: { plot: number; role: Role }) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<CategoryKey>("la");
  const detail = useQuery(trpc.plots.get.queryOptions({ plot }));
  const { rows, page, loadMore, loading } = usePlotRecords(plot, category);
  const [photo, setPhoto] = useState<PhotoTarget | null>(null);
  const [correcting, setCorrecting] = useState<CorrectableRecord | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const done = (message: string) => async () => {
    toast.success(message);
    await queryClient.invalidateQueries();
  };
  const onError = (e: { message: string }) => toast.error(e.message);
  const unlock = useMutation(
    trpc.plots.unlock.mutationOptions({
      onError,
      onSuccess: async () => {
        setUnlockOpen(false);
        await done(
          "Parcela desbloqueada: ya se pueden corregir sus registros"
        )();
      },
    })
  );
  const relock = useMutation(
    trpc.plots.relock.mutationOptions({
      onError,
      onSuccess: done("Parcela bloqueada de nuevo"),
    })
  );
  const close = useMutation(
    trpc.plots.close.mutationOptions({
      onError,
      onSuccess: done("Parcela cerrada y bloqueada"),
    })
  );

  const status = detail.data?.status ?? "assigned";
  const unlocked = status === "unlocked";
  const isAdmin = role === "admin";
  const total = page.data?.total ?? 0;

  return (
    <section className="flex flex-wrap gap-4">
      <div className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-lg border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-line border-b px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            {unlocked ? (
              <LockOpen aria-hidden="true" className="text-crit-fg" size={16} />
            ) : (
              <Lock aria-hidden="true" className="text-ok-fg" size={16} />
            )}
            {unlocked ? "Desbloqueada para corrección" : "Solo lectura"} ·{" "}
            {CATEGORY_TABS.find((t) => t.id === category)?.label}
            {detail.data ? (
              <span className="font-normal text-ink-3">
                · {detail.data.sector} · {detail.data.leader ?? "sin brigada"}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Button onClick={() => setAssignOpen(true)} size="sm">
                Asignar a brigada…
              </Button>
            ) : null}
            {isAdmin && !unlocked ? (
              <Button
                onClick={() => setUnlockOpen(true)}
                size="sm"
                variant="danger"
              >
                Desbloquear para corrección (Admin)
              </Button>
            ) : null}
            {isAdmin && unlocked ? (
              <Button
                disabled={relock.isPending}
                onClick={() => relock.mutate({ plot })}
                size="sm"
                variant="primary"
              >
                Volver a bloquear
              </Button>
            ) : null}
            {!unlocked && (status === "review" || status === "alert") ? (
              <Button
                disabled={close.isPending}
                onClick={() => close.mutate({ plot })}
                size="sm"
                variant="primary"
              >
                Cerrar y bloquear
              </Button>
            ) : null}
          </div>
        </div>
        <div className="px-2">
          <Tabs
            label="Categoría"
            onChange={setCategory}
            tabs={CATEGORY_TABS}
            value={category}
          />
        </div>
        {loading ? (
          <div
            aria-live="polite"
            className="flex min-h-[260px] items-center justify-center gap-2.5 text-ink-3 text-sm"
            role="status"
          >
            <Loader2 aria-hidden="true" className="animate-spin" size={22} />
            Cargando registros…
          </div>
        ) : (
          <div className="fade-in" key={category}>
            <RecordsTable
              category={category}
              editable={unlocked && isAdmin}
              onCorrect={setCorrecting}
              onPhoto={(r) =>
                setPhoto({
                  at: r.measuredAt,
                  id: r.id,
                  plot,
                  species: r.speciesName ?? "Sin especie",
                })
              }
              rows={rows}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-line-2 border-t px-4 py-2.5 text-ink-3 text-xs">
          <span>
            Mostrando {rows.length} de {total}. Árboles con varios ejes: código
            N.1, N.2… El diámetro equivalente = √(d₁² + d₂² + … + dₙ²) se
            calcula en la app. Medición del{" "}
            {rows[0] ? fmtDateTime(rows[0].measuredAt) : "—"}.
          </span>
          {rows.length < total ? (
            <Button disabled={page.isFetching} onClick={loadMore} size="sm">
              Cargar {Math.min(PAGE, total - rows.length)} más
            </Button>
          ) : null}
        </div>
      </div>
      <AuditAside plot={plot} />
      <PhotoModal onClose={() => setPhoto(null)} target={photo} />
      <CorrectModal
        key={correcting?.id ?? "none"}
        onClose={() => setCorrecting(null)}
        record={correcting}
      />
      <AssignModal
        currentBrigade={detail.data?.brigadeId ?? null}
        key={`assign-${plot}`}
        onClose={() => setAssignOpen(false)}
        open={assignOpen}
        plot={plot}
      />
      <ReasonModal
        confirmLabel="Desbloquear"
        description="Mientras esté desbloqueada podrás corregir sus registros uno a uno. Cada corrección queda en el historial con su motivo."
        key={`unlock-${plot}-${unlockOpen}`}
        onClose={() => setUnlockOpen(false)}
        onConfirm={(reason) => unlock.mutate({ plot, reason })}
        open={unlockOpen}
        pending={unlock.isPending}
        title={`Desbloquear P-${plot}`}
      />
    </section>
  );
}
