import {
  CATEGORIES,
  CATEGORY_LIST,
  type CategoryKey,
  isTreeCategory,
} from "@reto-11-tgi-ingenieria/domain/categories";
import {
  distanceMeters,
  formatDistance,
} from "@reto-11-tgi-ingenieria/domain/geo";
import {
  type HealthKey,
  healthRequired,
} from "@reto-11-tgi-ingenieria/domain/health";
import {
  clinometerHeight,
  deriveMetrics,
  nextFreeCode,
  parseDecimal,
} from "@reto-11-tgi-ingenieria/domain/measure";
import {
  defaultRuleSettings,
  evaluateMeasurement,
  hasBlocking,
} from "@reto-11-tgi-ingenieria/domain/rules";
import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, History, MapPin, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/app/button";
import { Combobox, type ComboItem } from "@/components/app/combobox";
import { fmtIsoDay, fmtNum, plural, shortClock } from "@/lib/format";
import {
  campoDb,
  type LocalRecord,
  type LocalTree,
  treeKey,
} from "@/lib/offline/db";
import { newClientId } from "@/lib/offline/id";
import { compressPhoto } from "@/lib/offline/photo";

import { useBundleMeta, useGeolocation, useNow } from "./hooks";
import {
  AlertList,
  CrownSection,
  DacSection,
  HealthSection,
  type HeightMode,
  HeightSection,
  PhotoSection,
  StemsSection,
  StepHead,
} from "./sections";
import { StatusBar } from "./status-bar";

const NEAREST_HINT = "Más cercana por GPS · cambia si estás en otra parcela";
const TOAST_MS = 4500;

function codeBorderClass(duplicate: boolean, isRemeasure: boolean): string {
  if (duplicate) {
    return "border-2 border-crit-fg";
  }
  return isRemeasure ? "border-2 border-info" : "border border-field";
}

function codeHint(
  code: string,
  duplicate: boolean,
  isRemeasure: boolean
): string {
  if (code === "") {
    return "Escribe el número de la placa del árbol.";
  }
  if (duplicate) {
    return "Código repetido en esta parcela.";
  }
  return isRemeasure
    ? "Código existente: se registrará como remedición."
    : "Código nuevo: se creará un individuo nuevo al sincronizar.";
}

function speciesHint(sp: { dapMax: number | null } | null): string {
  if (!sp) {
    return "";
  }
  return sp.dapMax
    ? `Rango esperado de DAP: hasta ${sp.dapMax} cm`
    : "Sin rango histórico: no se valida el DAP";
}

function useToastMessage() {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (text: string) => {
    setMessage(text);
    // biome-ignore lint/suspicious/noUnnecessaryConditions: valor mutable en tiempo de ejecución (ref o dato externo)
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setMessage(""), TOAST_MS);
  };
  useEffect(
    () => () => {
      // biome-ignore lint/suspicious/noUnnecessaryConditions: valor mutable en tiempo de ejecución (ref o dato externo)
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );
  return { message, show };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse
export function RegistroForm() {
  const now = useNow();
  const fix = useGeolocation();
  const bundle = useBundleMeta();
  const plots = useLiveQuery(() => campoDb.plots.toArray(), [], []);
  const species = useLiveQuery(() => campoDb.species.toArray(), [], []);
  const toastState = useToastMessage();

  const [plotNumber, setPlotNumber] = useState<number | null>(null);
  const [category, setCategory] = useState<CategoryKey>("la");
  const [code, setCode] = useState("");
  const codeTouched = useRef(false);
  const [speciesId, setSpeciesId] = useState<number | null>(null);
  const [stems, setStems] = useState<string[]>([""]);
  const [crownMin, setCrownMin] = useState("");
  const [crownMax, setCrownMax] = useState("");
  const [dac1, setDac1] = useState("");
  const [dac2, setDac2] = useState("");
  const [hMode, setHMode] = useState<HeightMode>("direct");
  const [hDirect, setHDirect] = useState("");
  const [dist, setDist] = useState("");
  const [p0, setP0] = useState("");
  const [p1, setP1] = useState("");
  const [health, setHealth] = useState<HealthKey | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { series } = CATEGORIES[category];
  const trees = useLiveQuery(
    () =>
      plotNumber === null
        ? []
        : campoDb.trees.where("plot").equals(plotNumber).toArray(),
    [plotNumber],
    [] as LocalTree[]
  );
  const pendingInPlot = useLiveQuery(
    () =>
      plotNumber === null
        ? 0
        : campoDb.records
            .where("plotNumber")
            .equals(plotNumber)
            .and((r) => r.sent === 0)
            .count(),
    [plotNumber],
    0
  );

  // Parcelas ordenadas por cercanía cuando hay GPS.
  const plotItems = useMemo<ComboItem<number>[]>(() => {
    const withDistance = plots.map((p) => ({
      d:
        fix && p.lat !== null && p.lon !== null
          ? distanceMeters(fix, { lat: p.lat, lon: p.lon })
          : null,
      p,
    }));
    withDistance.sort(
      (a, b) =>
        Number(a.p.closed) - Number(b.p.closed) ||
        (a.d ?? Number.POSITIVE_INFINITY) - (b.d ?? Number.POSITIVE_INFINITY) ||
        a.p.number - b.p.number
    );
    const nearest = withDistance.find((x) => !x.p.closed && x.d !== null)?.p
      .number;
    return withDistance.map(({ p, d }) => {
      let sub = d === null ? p.stratum : `a ${formatDistance(d)}`;
      if (p.closed) {
        sub = "enviada · bloqueada";
      } else if (p.number === nearest) {
        sub = `${sub} · la más cercana`;
      }
      return {
        disabled: p.closed,
        id: p.number,
        label: `P-${p.number} · ${p.sector}`,
        name: `P-${p.number} · ${p.sector}`,
        search: `${p.number} p-${p.number} ${p.sector}`,
        sub,
      };
    });
  }, [plots, fix]);

  useEffect(() => {
    if (plotNumber === null) {
      const first = plotItems.find((i) => !i.disabled);
      if (first) {
        setPlotNumber(first.id);
      }
    }
  }, [plotItems, plotNumber]);

  const speciesItems = useMemo<ComboItem<number>[]>(
    () =>
      [...species]
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .map((s) => ({
          hint: `${s.count.toLocaleString("en-US")} reg.`,
          id: s.id,
          label: s.name,
          name: s.name,
          sub: s.dapMax
            ? `DAP máx. esperado ${s.dapMax} cm`
            : "sin rango histórico",
        })),
    [species]
  );
  const categoryItems = useMemo<ComboItem<CategoryKey>[]>(
    () =>
      CATEGORY_LIST.map((c) => ({
        hint: `r ${c.radiusM} m`,
        id: c.key,
        label: c.name,
        name: c.name,
        search: `${c.name} ${c.criterion}`,
        sub: c.criterion,
      })),
    []
  );

  const plot = plots.find((p) => p.number === plotNumber) ?? null;
  const sp = species.find((s) => s.id === speciesId) ?? null;
  const nnSpecies = species.find((s) => s.isNN) ?? null;

  const suggested = useMemo(
    () =>
      nextFreeCode(trees.filter((t) => t.series === series).map((t) => t.code)),
    [trees, series]
  );
  // La sugerencia sigue a la parcela y a la serie mientras la persona no escriba su propio código.
  useEffect(() => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: valor mutable en tiempo de ejecución (ref o dato externo)
    if (!codeTouched.current) {
      setCode(suggested);
    }
  }, [suggested]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al cambiar de parcela o de serie
  useEffect(() => {
    codeTouched.current = false;
    setCode(suggested);
  }, [plotNumber, series]);

  const existing =
    plotNumber === null || code === ""
      ? undefined
      : trees.find((t) => t.key === treeKey(plotNumber, series, code));
  const isRemeasure = Boolean(existing && !existing.local);
  const duplicate = Boolean(existing?.local);

  const nums = stems
    .map((s) => parseDecimal(s))
    .filter((v): v is number => v !== null && v > 0);
  const metrics = deriveMetrics({
    crownMax: parseDecimal(crownMax),
    crownMin: parseDecimal(crownMin),
    dac1: parseDecimal(dac1),
    dac2: parseDecimal(dac2),
    stems: nums,
  });
  const clino = {
    distance: parseDecimal(dist),
    pctBase: parseDecimal(p0),
    pctTop: parseDecimal(p1),
  };
  const clinoHeight =
    clino.distance !== null && clino.pctBase !== null && clino.pctTop !== null
      ? clinometerHeight(clino.distance, clino.pctBase, clino.pctTop)
      : null;
  const height = hMode === "direct" ? parseDecimal(hDirect) : clinoHeight;
  const gpsDistance =
    fix && plot && plot.lat !== null && plot.lon !== null
      ? distanceMeters(fix, { lat: plot.lat, lon: plot.lon })
      : null;

  const alerts = useMemo(
    () =>
      evaluateMeasurement(
        {
          category,
          codeLabel: code,
          crownAvg: metrics.crownAvg,
          dacAvg: metrics.dacAvg,
          dapEq: metrics.dapEq,
          duplicate,
          gpsDistanceM: gpsDistance,
          height,
          notes,
          photoCount: photo ? 1 : 0,
          previous:
            existing && !existing.local
              ? {
                  dapEq: existing.dapEq,
                  speciesId: existing.speciesId,
                  speciesName: existing.speciesName ?? "",
                }
              : null,
          species: sp
            ? {
                dapMax: sp.dapMax,
                hMax: sp.hMax,
                id: sp.id,
                isNN: sp.isNN,
                name: sp.name,
              }
            : null,
        },
        bundle?.rules ?? defaultRuleSettings()
      ),
    [
      category,
      code,
      metrics.crownAvg,
      metrics.dacAvg,
      metrics.dapEq,
      duplicate,
      gpsDistance,
      height,
      notes,
      photo,
      existing,
      sp,
      bundle?.rules,
    ]
  );
  const blocked = hasBlocking(alerts);
  const hasAlerts = alerts.length > 0;

  function missingField(): string | null {
    if (plotNumber === null || plot?.closed) {
      return "Elige una parcela abierta";
    }
    if (code === "") {
      return "Falta el código del árbol";
    }
    if (!sp) {
      return "Elige la especie";
    }
    if (isTreeCategory(category) && nums.length === 0) {
      return "Falta el DAP";
    }
    if (category === "ar" && metrics.crownAvg === null) {
      return "Falta el diámetro de copa";
    }
    if (category === "br" && metrics.dacAvg === null) {
      return "Falta la lectura de DAC";
    }
    if (health === null && healthRequired(category)) {
      return "Elige el estado sanitario";
    }
    return null;
  }

  function resetForm() {
    codeTouched.current = false;
    setCode(suggested);
    setStems([""]);
    setCrownMin("");
    setCrownMax("");
    setDac1("");
    setDac2("");
    setHDirect("");
    setHealth(null);
    setPhoto(null);
    setNotes("");
  }

  async function doSave() {
    if (plotNumber === null || !sp) {
      return;
    }
    setSaving(true);
    try {
      const measuredAt = new Date().toISOString();
      const record: LocalRecord = {
        accuracy: fix?.accuracy ?? null,
        alertTitles: alerts.map((a) => a.title),
        category,
        clientId: newClientId(),
        clino:
          hMode === "clino" &&
          clino.distance !== null &&
          clino.pctBase !== null &&
          clino.pctTop !== null
            ? {
                distance: clino.distance,
                pctBase: clino.pctBase,
                pctTop: clino.pctTop,
              }
            : null,
        code,
        createdAt: Date.now(),
        crownMax: parseDecimal(crownMax),
        crownMin: parseDecimal(crownMin),
        dac1: parseDecimal(dac1),
        dac2: parseDecimal(dac2),
        dapEq: metrics.dapEq,
        error: null,
        health,
        height,
        heightMode: hMode,
        isRemeasure,
        lat: fix?.lat ?? null,
        lon: fix?.lon ?? null,
        measuredAt,
        notes: notes.trim(),
        photo,
        plotNumber,
        sent: 0,
        speciesId: sp.id,
        speciesName: sp.name,
        stems: isTreeCategory(category) ? nums : [],
      };
      await campoDb.transaction(
        "rw",
        campoDb.records,
        campoDb.trees,
        async () => {
          await campoDb.records.add(record);
          await campoDb.trees.put({
            category,
            code,
            dapEq: metrics.dapEq,
            height,
            key: treeKey(plotNumber, series, code),
            local: true,
            measuredAt,
            plot: plotNumber,
            series,
            speciesId: sp.id,
            speciesName: sp.name,
          });
        }
      );
      toastState.show(
        isRemeasure
          ? `N° ${code} guardado como remedición (historial)`
          : `N° ${code} guardado`
      );
      resetForm();
    } catch (error) {
      const noSpace =
        error instanceof DOMException && error.name === "QuotaExceededError";
      toast.error(
        noSpace
          ? "No se pudo guardar en el equipo. Libera espacio e inténtalo de nuevo."
          : `No se pudo guardar el registro (${error instanceof Error ? error.message : "error desconocido"}).`
      );
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  async function onSave() {
    const missing = missingField();
    if (missing) {
      toast.warning(missing);
      return;
    }
    if (blocked) {
      toast.warning("Corrige las alertas en rojo antes de guardar");
      return;
    }
    if (hasAlerts) {
      setConfirmOpen(true);
      return;
    }
    await doSave();
  }

  async function onPhoto(file: Blob | null) {
    setPhoto(file ? await compressPhoto(file) : null);
  }

  const crownAvg =
    metrics.crownAvg === null ? "—" : metrics.crownAvg.toFixed(2);
  const dacAvg = metrics.dacAvg === null ? "—" : metrics.dacAvg.toFixed(2);
  const eq = metrics.dapEq === null ? "0.00" : metrics.dapEq.toFixed(2);
  const sendText =
    pendingInPlot > 0
      ? `P-${plotNumber} · pendiente de envío · ${plural(pendingInPlot, "registro", "registros")}`
      : `P-${plotNumber} · sin registros por enviar`;
  const noBundle = bundle === undefined || plots.length === 0;
  const photoRecommended = hasAlerts && !photo;

  if (noBundle && bundle !== undefined) {
    return (
      <Shell fix={fix} message="" now={now}>
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm">
            Aún no tienes parcelas descargadas en este equipo.
          </p>
          <Link
            className="font-semibold text-ink underline"
            to="/campo/instalar"
          >
            Ir a Preparar para campo
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell fix={fix} message={toastState.message} now={now}>
      <div className="flex flex-1 flex-col gap-3.5 px-4 pt-3.5 pb-4">
        <StepHead n={1} title="¿Dónde estás?" />
        <Combobox
          headline={(n, all) =>
            `${all ? "Tus parcelas asignadas, la más cercana primero · " : ""}${plural(n, "resultado", "resultados")}`
          }
          hint={plotNumber === null ? NEAREST_HINT : NEAREST_HINT}
          items={plotItems}
          label="Parcela"
          onPick={(id) => setPlotNumber(id)}
          placeholder="Buscar N° o sector"
          selected={plotNumber}
        />
        <div
          className={cn(
            "-mt-1.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-semibold text-[13px]",
            pendingInPlot > 0
              ? "bg-warn-bg text-warn-fg"
              : "bg-sunken text-ink-2"
          )}
          role="status"
        >
          <span
            className={cn(
              "size-2 flex-none rounded-full",
              pendingInPlot > 0 ? "bg-warn-deep" : "bg-field"
            )}
          />
          <span className="flex-1">{sendText}</span>
        </div>
        <Combobox
          headline={(n) => plural(n, "categoría", "categorías")}
          hint={`${CATEGORIES[category].criterion} · subparcela r ${CATEGORIES[category].radiusM} m`}
          items={categoryItems}
          label="Categoría"
          onPick={setCategory}
          placeholder="Buscar categoría"
          selected={category}
        />

        <StepHead n={2} title="¿Qué árbol es?" />
        <div className="flex flex-col gap-1.5">
          <label
            className="font-semibold text-[13px] text-ink-2"
            htmlFor="campo-codigo"
          >
            Código del árbol (N° de placa)
          </label>
          <input
            autoComplete="off"
            className={cn(
              "min-h-[52px] w-full rounded-md bg-white px-3 font-mono font-semibold text-xl",
              codeBorderClass(duplicate, isRemeasure)
            )}
            id="campo-codigo"
            inputMode="numeric"
            onChange={(e) => {
              codeTouched.current = true;
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            }}
            placeholder="N° de placa"
            type="text"
            value={code}
          />
          <span className="text-ink-3 text-xs">
            {codeHint(code, duplicate, isRemeasure)}
          </span>
        </div>

        {isRemeasure && existing ? (
          <div
            className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-bg p-3 text-[13px] text-info-fg"
            role="status"
          >
            <History aria-hidden="true" className="mt-px flex-none" size={18} />
            <div className="flex flex-col gap-1">
              <strong>
                N° {code} ya existe en P-{plotNumber} · remedición
              </strong>
              <span>
                Medición anterior ({fmtIsoDay(existing.measuredAt)}):{" "}
                {existing.speciesName ?? "sin especie"}
                {existing.dapEq === null
                  ? ""
                  : ` · DAP ${fmtNum(existing.dapEq, 2)} cm`}
                {existing.height === null
                  ? ""
                  : ` · H ${fmtNum(existing.height, 2)} m`}
                .
              </span>
              <span>
                Al sincronizar se vincula a su ID interno y se agrega al
                historial de inventarios.
              </span>
            </div>
          </div>
        ) : null}

        <Combobox
          emptyLabel="Sin resultados · registrar como NN (foto obligatoria)"
          headline={(n, all) =>
            `${all ? "Más registradas primero · " : ""}${plural(n, "resultado", "resultados")}`
          }
          hint={speciesHint(sp)}
          items={speciesItems}
          label="Especie (nombre común)"
          onEmpty={nnSpecies ? () => setSpeciesId(nnSpecies.id) : undefined}
          onPick={setSpeciesId}
          placeholder="Buscar especie"
          selected={speciesId}
        />

        <StepHead n={3} title="Medidas" />
        {isTreeCategory(category) ? (
          <StemsSection code={code} eq={eq} onChange={setStems} stems={stems} />
        ) : null}
        {category === "ar" ? (
          <CrownSection
            avg={crownAvg}
            max={crownMax}
            min={crownMin}
            onMax={setCrownMax}
            onMin={setCrownMin}
          />
        ) : null}
        {category === "br" ? (
          <DacSection
            a={dac1}
            avg={dacAvg}
            b={dac2}
            onA={setDac1}
            onB={setDac2}
          />
        ) : null}

        <AlertList alerts={alerts} />

        {category === "br" ? null : (
          <HeightSection
            computed={clinoHeight === null ? "—" : clinoHeight.toFixed(2)}
            direct={hDirect}
            dist={dist}
            mode={hMode}
            onDirect={setHDirect}
            onDist={setDist}
            onMode={setHMode}
            onP0={setP0}
            onP1={setP1}
            p0={p0}
            p1={p1}
          />
        )}

        <HealthSection
          onChange={setHealth}
          required={healthRequired(category)}
          value={health}
        />

        <StepHead n={4} title="Cierre" />
        <PhotoSection
          hint={
            photoRecommended ? "Recomendada por la alerta" : "Opcional · 1 foto"
          }
          onPhoto={onPhoto}
          photo={photo}
          warn={photoRecommended}
        />

        <section className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm" htmlFor="campo-obs">
            Observaciones{" "}
            <span className="font-normal text-ink-3">(opcional)</span>
          </label>
          <textarea
            className="min-h-[84px] w-full resize-y rounded-md border border-field bg-white px-3 py-2.5 text-base"
            id="campo-obs"
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej.: inclinado, rama seca, medido sobre la aleta"
            rows={3}
            value={notes}
          />
        </section>
      </div>

      <footer className="sticky bottom-0 z-20 border-line border-t bg-white px-4 pt-2.5 pb-4">
        <Button
          className="w-full"
          disabled={saving}
          onClick={onSave}
          size="lg"
          variant="primary"
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </footer>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-primary/50">
          <div
            aria-labelledby="conf-title"
            aria-modal="true"
            className="mx-auto flex w-full max-w-[480px] flex-col gap-3 rounded-t-[18px] bg-white px-4 pt-[18px] pb-5"
            role="dialog"
          >
            <strong className="text-lg" id="conf-title">
              ¿Guardar con {plural(alerts.length, "alerta", "alertas")}?
            </strong>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-[18px] text-sm text-warn-fg">
              {alerts.map((a) => (
                <li key={`${a.rule}-${a.title}`}>{a.title}</li>
              ))}
            </ul>
            <span className="text-[13px] text-ink-2">
              {photo
                ? "Se guardará marcado para revisión del supervisor."
                : "Se guardará marcado para revisión. Te recomendamos tomar una foto."}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="!text-[15px]"
                onClick={() => setConfirmOpen(false)}
                size="lg"
              >
                Revisar
              </Button>
              <Button
                className="!text-[15px]"
                disabled={saving}
                onClick={doSave}
                size="lg"
                variant="warn"
              >
                Guardar igual
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({
  now,
  fix,
  message,
  children,
}: {
  now: Date;
  fix: { accuracy: number } | null;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative mx-auto flex min-h-svh w-full max-w-[480px] flex-col bg-sheet text-ink"
      data-sec="campo"
    >
      <StatusBar />
      <header
        className="flex items-center gap-2 bg-sec px-4 py-3 text-sec-ink"
        data-sec="campo"
      >
        <Link
          aria-label="Cerrar formulario"
          className="flex size-11 items-center justify-center rounded-full bg-white/25 text-sec-ink hover:bg-white/40"
          to="/campo"
        >
          <X aria-hidden="true" size={20} />
        </Link>
        <div className="flex flex-1 flex-col">
          <strong className="text-lg">Registrar árbol</strong>
          <span className="font-medium text-[13px]">{shortClock(now)}</span>
        </div>
        <span className="flex items-center gap-1 font-semibold text-xs">
          <MapPin aria-hidden="true" size={14} />
          {fix ? `±${Math.round(fix.accuracy)} m` : "sin GPS"}
        </span>
      </header>
      {message ? (
        <div
          className="flex items-center gap-2 bg-ok-bg px-4 py-2.5 font-semibold text-ok-fg text-sm"
          role="status"
        >
          <Check aria-hidden="true" size={16} />
          {message}
        </div>
      ) : null}
      {children}
    </div>
  );
}
