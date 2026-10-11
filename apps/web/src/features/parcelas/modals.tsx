import {
  CATEGORY_LIST,
  type CategoryKey,
} from "@reto-11-tgi-ingenieria/domain/categories";
import {
  ANP_LABELS,
  ANPS,
  STRATA,
} from "@reto-11-tgi-ingenieria/domain/constants";
import {
  HEALTH_KEYS,
  HEALTH_LIST,
  type HealthKey,
} from "@reto-11-tgi-ingenieria/domain/health";
import { parseDecimal } from "@reto-11-tgi-ingenieria/domain/measure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/app/button";
import { SelectField, TextAreaField, TextField } from "@/components/app/field";
import { Modal } from "@/components/app/modal";
import { fmtDateTime, fmtNum, fmtTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";

export function ReasonModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || pending}
            onClick={() => onConfirm(reason.trim())}
            variant="danger"
          >
            {confirmLabel}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={title}
    >
      <p className="text-ink-2 text-sm">{description}</p>
      <TextAreaField
        label="Motivo (queda en la auditoría)"
        onChange={(e) => setReason(e.target.value)}
        value={reason}
      />
    </Modal>
  );
}

export function AssignModal({
  open,
  onClose,
  plot,
  currentBrigade,
}: {
  open: boolean;
  onClose: () => void;
  plot: number;
  currentBrigade: string | null;
}) {
  const queryClient = useQueryClient();
  const brigades = useQuery({
    ...trpc.catalog.brigades.list.queryOptions(),
    enabled: open,
  });
  const [brigade, setBrigade] = useState(currentBrigade ?? "");
  const assign = useMutation(
    trpc.plots.assign.mutationOptions({
      onError: (e) => toast.error(e.message),
      onSuccess: async () => {
        toast.success(`P-${plot} abierta para registrar en campo`);
        await queryClient.invalidateQueries();
        onClose();
      },
    })
  );
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!brigade || assign.isPending}
            onClick={() => assign.mutate({ brigadeId: brigade, plot })}
            variant="primary"
          >
            Asignar y abrir para campo
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={`Asignar P-${plot} a una brigada`}
    >
      <p className="text-ink-2 text-sm">
        La brigada descargará la parcela en su próxima sincronización y podrá
        registrar (o re-medir) árboles en ella.
      </p>
      <SelectField
        label="Brigada"
        onChange={(e) => setBrigade(e.target.value)}
        value={brigade}
      >
        <option value="">Elige una brigada…</option>
        {brigades.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.id} · {b.leaderName}
          </option>
        ))}
      </SelectField>
    </Modal>
  );
}

export function PhotoModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const photo = useQuery({
    ...trpc.plots.photo.queryOptions({ id: id ?? "" }),
    enabled: id !== null,
  });
  const [zoom, setZoom] = useState(false);
  const info = photo.data;
  const title = info
    ? `${info.species} · ${fmtTime(info.createdAt)} · P-${info.plot}`
    : "Evidencia";
  return (
    <Modal
      onClose={() => {
        setZoom(false);
        onClose();
      }}
      open={id !== null}
      size="lg"
      title={title}
    >
      {photo.isPending ? <p className="text-ink-3 text-sm">Cargando…</p> : null}
      {info ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
            <span>
              Cargada el <strong>{fmtDateTime(info.createdAt)}</strong>
            </span>
            <span>
              N° <strong className="font-mono">{info.code}</strong>
            </span>
            <span>{info.category}</span>
            {info.dapEq === null ? null : (
              <span className="font-mono">DAP {fmtNum(info.dapEq)} cm</span>
            )}
            {info.height === null ? null : (
              <span className="font-mono">Altura {fmtNum(info.height)} m</span>
            )}
          </div>
          <div
            className={`overflow-auto rounded-lg bg-sunken ${zoom ? "max-h-[65vh]" : ""}`}
          >
            {/* biome-ignore lint/correctness/useImageSize: imagen de tamaño variable (foto del equipo) */}
            <img
              alt={`Evidencia de ${info.species}, parcela P-${info.plot}`}
              className={
                zoom
                  ? "max-w-none cursor-zoom-out"
                  : "max-h-[60vh] w-full cursor-zoom-in object-contain"
              }
              onClick={() => setZoom((z) => !z)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setZoom((z) => !z);
                }
              }}
              src={info.dataUrl}
              tabIndex={0}
              title={zoom ? "Reducir" : "Ampliar"}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-ink-3 text-xs">
              Haz clic en la imagen para {zoom ? "reducirla" : "ampliarla"}.
            </span>
            <a
              className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-[13px] text-ink-2 hover:text-ink hover:underline"
              download={`evidencia-P${info.plot}-${info.code}.jpg`}
              href={info.dataUrl}
            >
              <Download aria-hidden="true" size={16} /> Descargar
            </a>
          </div>
        </>
      ) : null}
      {photo.data === null ? (
        <p className="text-ink-3 text-sm">Este registro no tiene foto.</p>
      ) : null}
    </Modal>
  );
}

export interface CorrectableRecord {
  category: string;
  code: string;
  crownMax: number | null;
  crownMin: number | null;
  dac1: number | null;
  dac2: number | null;
  health: string | null;
  height: number | null;
  id: string;
  notes: string;
  speciesId: number | null;
  stems: number[];
}

function toHealthKey(value: string): HealthKey | null {
  return HEALTH_KEYS.find((k) => k === value) ?? null;
}

const STEM_SEPARATOR = /[;,\s]+/;
const num = (v: string) => parseDecimal(v);

export function CorrectModal({
  record,
  onClose,
}: {
  record: CorrectableRecord | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const species = useQuery({
    ...trpc.catalog.species.list.queryOptions(),
    enabled: record !== null,
  });
  const [form, setForm] = useState({
    category: record?.category ?? "la",
    crownMax: String(record?.crownMax ?? ""),
    crownMin: String(record?.crownMin ?? ""),
    dac1: String(record?.dac1 ?? ""),
    dac2: String(record?.dac2 ?? ""),
    health: record?.health ?? "",
    height: String(record?.height ?? ""),
    notes: record?.notes ?? "",
    reason: "",
    speciesId:
      record?.speciesId === null || record?.speciesId === undefined
        ? ""
        : String(record.speciesId),
    stems: (record?.stems ?? []).join(", "),
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const correct = useMutation(
    trpc.plots.correct.mutationOptions({
      onError: (e) => toast.error(e.message),
      onSuccess: async () => {
        toast.success("Corrección guardada y registrada en la auditoría");
        await queryClient.invalidateQueries();
        onClose();
      },
    })
  );
  if (!record) {
    return (
      <Modal onClose={onClose} open={false} title="Corregir registro">
        {null}
      </Modal>
    );
  }
  const isTree = form.category === "la" || form.category === "fu";
  const submit = () => {
    const stems = form.stems
      .split(STEM_SEPARATOR)
      .map((v) => num(v))
      .filter((v): v is number => v !== null && v > 0);
    correct.mutate({
      category: form.category as CategoryKey,
      crownMax: num(form.crownMax),
      crownMin: num(form.crownMin),
      dac1: num(form.dac1),
      dac2: num(form.dac2),
      health: toHealthKey(form.health),
      height: num(form.height),
      id: record.id,
      notes: form.notes,
      reason: form.reason.trim(),
      speciesId: form.speciesId === "" ? null : Number(form.speciesId),
      stems: isTree ? stems : [],
    });
  };
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={form.reason.trim().length < 3 || correct.isPending}
            onClick={submit}
            variant="primary"
          >
            Guardar corrección
          </Button>
        </>
      }
      onClose={onClose}
      open
      title={`Corregir N° ${record.code}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Categoría"
          onChange={set("category")}
          value={form.category}
        >
          {CATEGORY_LIST.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Especie"
          onChange={set("speciesId")}
          value={form.speciesId}
        >
          <option value="">Sin especie</option>
          {species.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>
      {isTree ? (
        <TextField
          inputMode="decimal"
          label="DAP por eje (cm), separados por coma"
          mono
          onChange={set("stems")}
          value={form.stems}
        />
      ) : null}
      {form.category === "ar" ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            inputMode="decimal"
            label="Copa menor (m)"
            mono
            onChange={set("crownMin")}
            value={form.crownMin}
          />
          <TextField
            inputMode="decimal"
            label="Copa mayor (m)"
            mono
            onChange={set("crownMax")}
            value={form.crownMax}
          />
        </div>
      ) : null}
      {form.category === "br" ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            inputMode="decimal"
            label="DAC lectura 1 (cm)"
            mono
            onChange={set("dac1")}
            value={form.dac1}
          />
          <TextField
            inputMode="decimal"
            label="DAC lectura 2 (cm)"
            mono
            onChange={set("dac2")}
            value={form.dac2}
          />
        </div>
      ) : (
        <TextField
          inputMode="decimal"
          label="Altura (m)"
          mono
          onChange={set("height")}
          value={form.height}
        />
      )}
      <SelectField
        label="Estado sanitario"
        onChange={set("health")}
        value={form.health}
      >
        <option value="">Sin dato</option>
        {HEALTH_LIST.map((h) => (
          <option key={h.key} value={h.key}>
            {h.name}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label="Observaciones"
        onChange={set("notes")}
        value={form.notes}
      />
      <TextAreaField
        label="Motivo de la corrección (obligatorio)"
        onChange={set("reason")}
        value={form.reason}
      />
    </Modal>
  );
}

export function NewPlotModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const brigades = useQuery({
    ...trpc.catalog.brigades.list.queryOptions(),
    enabled: open,
  });
  const sectors = useQuery({
    ...trpc.catalog.sectors.list.queryOptions(),
    enabled: open,
  });
  const [form, setForm] = useState({
    anp: "",
    brigadeId: "",
    cabE: "",
    cabN: "",
    number: "",
    sector: "",
    stratum: STRATA[0] as string,
    utmE: "",
    utmN: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const create = useMutation(
    trpc.plots.create.mutationOptions({
      onError: (e) => toast.error(e.message),
      onSuccess: async (res) => {
        toast.success(`P-${res.number} creada`);
        await queryClient.invalidateQueries();
        onClose();
      },
    })
  );
  const number = Number.parseInt(form.number, 10);
  const valid =
    Number.isInteger(number) && number > 0 && form.sector.trim().length >= 2;
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || create.isPending}
            onClick={() =>
              create.mutate({
                anp:
                  form.anp === "" ? null : (form.anp as (typeof ANPS)[number]),
                brigadeId: form.brigadeId === "" ? null : form.brigadeId,
                cabE: num(form.cabE),
                cabN: num(form.cabN),
                number,
                sector: form.sector,
                stratum: form.stratum as (typeof STRATA)[number],
                utmE: num(form.utmE),
                utmN: num(form.utmN),
              })
            }
            variant="primary"
          >
            Crear parcela
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Nueva parcela"
    >
      <div className="grid grid-cols-2 gap-3">
        <TextField
          inputMode="numeric"
          label="N° de parcela"
          mono
          onChange={set("number")}
          value={form.number}
        />
        <SelectField
          label="Estrato"
          onChange={set("stratum")}
          value={form.stratum}
        >
          {STRATA.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
      </div>
      <TextField
        label="Sector"
        list="sector-options"
        onChange={set("sector")}
        value={form.sector}
      />
      <datalist id="sector-options">
        {sectors.data?.sectors.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Área (ANP)" onChange={set("anp")} value={form.anp}>
          <option value="">Sin definir</option>
          {ANPS.map((a) => (
            <option key={a} value={a}>
              {ANP_LABELS[a]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Brigada"
          onChange={set("brigadeId")}
          value={form.brigadeId}
        >
          <option value="">Sin asignar</option>
          {brigades.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id} · {b.leaderName}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          inputMode="decimal"
          label="UTM este (campo)"
          mono
          onChange={set("utmE")}
          value={form.utmE}
        />
        <TextField
          inputMode="decimal"
          label="UTM norte (campo)"
          mono
          onChange={set("utmN")}
          value={form.utmN}
        />
        <TextField
          inputMode="decimal"
          label="UTM este (gabinete)"
          mono
          onChange={set("cabE")}
          value={form.cabE}
        />
        <TextField
          inputMode="decimal"
          label="UTM norte (gabinete)"
          mono
          onChange={set("cabN")}
          value={form.cabN}
        />
      </div>
      <p className="text-ink-3 text-xs">
        Coordenadas UTM WGS84 zona 17S. Las de gabinete son el punto
        planificado.
      </p>
    </Modal>
  );
}
