import {
  type PushRecord,
  pushRecordSchema,
} from "@reto-11-tgi-ingenieria/domain/sync";
import { useSyncExternalStore } from "react";

import { trpcClient } from "@/utils/trpc";

import { campoDb, type LocalRecord, treeKey } from "./db";
import { blobToBase64 } from "./photo";

const BATCH_MAX_RECORDS = 20;
const BATCH_MAX_BYTES = 2_500_000;
const PHOTO_BYTE_ESTIMATE_FACTOR = 1.37;
const BASE_RECORD_BYTES = 1200;

export type SyncPhase = "idle" | "syncing" | "done" | "error";

interface SyncState {
  message: string;
  online: boolean;
  phase: SyncPhase;
}

let state: SyncState = {
  message: "",
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  phase: "idle",
};
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) {
    l();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => setState({ online: true }));
  window.addEventListener("offline", () => setState({ online: false }));
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );
}

/** Descarga parcelas asignadas, catálogos, reglas y códigos existentes. */
export async function pullBundle(): Promise<void> {
  const bundle = await trpcClient.sync.pull.query();
  await campoDb.transaction(
    "rw",
    [
      campoDb.plots,
      campoDb.species,
      campoDb.trees,
      campoDb.meta,
      campoDb.records,
    ],
    async () => {
      await campoDb.plots.clear();
      await campoDb.plots.bulkPut(bundle.plots);
      await campoDb.species.clear();
      await campoDb.species.bulkPut(bundle.species);
      // Los árboles confirmados por el servidor reemplazan a los locales con la misma clave.
      await campoDb.trees.filter((t) => !t.local).delete();
      await campoDb.trees.bulkPut(
        bundle.trees.map((t) => ({
          category: t.category,
          code: t.code,
          dapEq: t.dapEq,
          height: t.height,
          key: treeKey(t.plot, t.series, t.code),
          local: false,
          measuredAt: t.measuredAt,
          plot: t.plot,
          series: t.series,
          speciesId: t.speciesId,
          speciesName: t.speciesName,
        }))
      );
      await campoDb.meta.put({
        key: "bundle",
        value: {
          catalogVersion: bundle.catalogVersion,
          downloadedAt: Date.now(),
          rules: bundle.rules,
          rulesVersion: bundle.rulesVersion,
          serverTime: bundle.serverTime,
          user: {
            brigadeId: bundle.user.brigadeId,
            brigadeName: bundle.user.brigadeName,
            id: bundle.user.id,
            name: bundle.user.name,
          },
        },
      });
    }
  );
}

async function toPayload(record: LocalRecord): Promise<PushRecord> {
  return {
    accuracy: record.accuracy,
    category: record.category,
    clientId: record.clientId,
    clino: record.clino,
    code: record.code,
    crownMax: record.crownMax,
    crownMin: record.crownMin,
    dac1: record.dac1,
    dac2: record.dac2,
    health: record.health ?? null,
    height: record.height,
    heightMode: record.heightMode,
    isRemeasure: record.isRemeasure,
    lat: record.lat,
    lon: record.lon,
    measuredAt: record.measuredAt,
    notes: record.notes,
    photo: record.photo
      ? {
          data: await blobToBase64(record.photo),
          mime: record.photo.type || "image/jpeg",
        }
      : null,
    plotNumber: record.plotNumber,
    speciesId: record.speciesId,
    stems: record.stems,
  };
}

function estimateBytes(record: LocalRecord): number {
  return (
    BASE_RECORD_BYTES +
    (record.photo ? record.photo.size * PHOTO_BYTE_ESTIMATE_FACTOR : 0)
  );
}

function splitBatches(records: readonly LocalRecord[]): LocalRecord[][] {
  const batches: LocalRecord[][] = [];
  let current: LocalRecord[] = [];
  let bytes = 0;
  for (const record of records) {
    const size = estimateBytes(record);
    if (
      current.length >= BATCH_MAX_RECORDS ||
      (current.length > 0 && bytes + size > BATCH_MAX_BYTES)
    ) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(record);
    bytes += size;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

export interface PushSummary {
  rejected: number;
  sent: number;
}

const FIELD_LABELS: Record<string, string> = {
  category: "La categoría",
  code: "El código",
  crownMax: "El diámetro de copa",
  crownMin: "El diámetro de copa",
  dac1: "El DAC",
  dac2: "El DAC",
  height: "La altura",
  lat: "La ubicación",
  lon: "La ubicación",
  notes: "Las observaciones",
  photo: "La foto",
  stems: "El DAP",
};

/** Explica en español por qué el servidor no aceptaría el registro. */
function describeInvalid(issue: {
  code: string;
  maximum?: unknown;
  path: PropertyKey[];
}): string {
  const key = String(issue.path[0] ?? "");
  const label = FIELD_LABELS[key] ?? `El campo «${key}»`;
  if (issue.code === "too_big" && issue.maximum !== undefined) {
    return `${label} supera el máximo permitido (${String(issue.maximum)}). Edita el registro y corrígelo.`;
  }
  return `${label} no es válido. Edita el registro y corrígelo.`;
}

async function pushBatch(batch: readonly LocalRecord[]): Promise<PushSummary> {
  const summary: PushSummary = { rejected: 0, sent: 0 };
  const records: PushRecord[] = [];
  const invalid = new Map<string, string>();
  for (const r of batch) {
    // biome-ignore lint/performance/noAwaitInLoops: la foto se convierte a base64 de a una para no saturar la memoria
    const payload = await toPayload(r);
    const check = pushRecordSchema.safeParse(payload);
    if (check.success) {
      records.push(payload);
    } else {
      // Un registro inválido no debe frenar el envío de los demás.
      invalid.set(r.clientId, describeInvalid(check.error.issues[0]));
    }
  }
  const results =
    records.length > 0
      ? (await trpcClient.sync.push.mutate({ records })).results
      : [];
  await campoDb.transaction("rw", campoDb.records, async () => {
    for (const [clientId, message] of invalid) {
      summary.rejected += 1;
      // biome-ignore lint/performance/noAwaitInLoops: lotes secuenciales: el orden importa y evita saturar la base o la señal
      await campoDb.records.update(clientId, { error: message, sent: 2 });
    }
    for (const result of results) {
      if (result.status === "rejected") {
        summary.rejected += 1;
        // biome-ignore lint/performance/noAwaitInLoops: lotes secuenciales: el orden importa y evita saturar la base o la señal
        await campoDb.records.update(result.clientId, {
          error: result.message ?? "Rechazado",
          sent: 2,
        });
      } else {
        summary.sent += 1;
        await campoDb.records.update(result.clientId, {
          error: null,
          photo: null,
          sent: 1,
        });
      }
    }
  });
  return summary;
}

function syncErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  // Los errores de validación llegan como JSON: no se le muestran así a la persona.
  return text === "" || text.startsWith("[") || text.startsWith("{")
    ? "No se pudo sincronizar"
    : text;
}

/** Envía todo lo pendiente por lotes y vuelve a descargar los catálogos. */
export async function syncNow(): Promise<PushSummary> {
  if (state.phase === "syncing") {
    return { rejected: 0, sent: 0 };
  }
  setState({ message: "Sincronizando…", phase: "syncing" });
  try {
    const pending = await campoDb.records
      .where("sent")
      .equals(0)
      .sortBy("createdAt");
    const total: PushSummary = { rejected: 0, sent: 0 };
    for (const batch of splitBatches(pending)) {
      // Los lotes van en orden: así una remedición llega después de su medición original.
      // biome-ignore lint/performance/noAwaitInLoops: el orden y el progreso importan con poca señal.
      const part = await pushBatch(batch);
      total.sent += part.sent;
      total.rejected += part.rejected;
      setState({
        message: `Sincronizando… ${total.sent + total.rejected}/${pending.length}`,
      });
    }
    await pullBundle();
    setState({ message: "", phase: "done" });
    return total;
  } catch (error) {
    setState({
      message: syncErrorMessage(error),
      phase: "error",
    });
    throw error;
  }
}

export function resetSyncPhase(): void {
  setState({ message: "", phase: "idle" });
}
