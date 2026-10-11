import {
  ANP_LABELS,
  ANPS,
  type Anp,
  STRATA,
  type Stratum,
} from "@reto-11-tgi-ingenieria/domain/constants";
import {
  CalendarDays,
  Globe,
  Layers,
  Leaf,
  ListFilter,
  MapPin,
  Mountain,
  RotateCcw,
  Ruler,
  Sun,
  Timer,
  X,
} from "lucide-react";
import { useState } from "react";

import { DateRangePicker } from "@/components/app/date-range";
import { Modal } from "@/components/app/modal";
import {
  type MenuOption,
  MenuShell,
  OptionRow,
  SelectMenu,
} from "@/components/app/select-menu";
import { fmtIsoDay } from "@/lib/format";

export type PeriodKind = "today" | "week" | "custom";

export interface PanelFilters {
  anp: "all" | Anp;
  period: { kind: PeriodKind; from?: string; to?: string };
  speciesId: number | null;
  status: "all" | "open" | "done";
  stratum: "all" | Stratum;
  variable: "all" | "dap" | "alt";
}

export const DEFAULT_FILTERS: PanelFilters = {
  anp: "all",
  period: { kind: "today" },
  speciesId: null,
  status: "open",
  stratum: "all",
  variable: "all",
};

const ICON = 16;

const ANP_OPTIONS: MenuOption<"all" | Anp>[] = [
  {
    icon: <Globe aria-hidden="true" size={ICON} />,
    id: "all",
    label: "Todas las áreas",
  },
  ...ANPS.map((id) => ({
    icon: <Mountain aria-hidden="true" size={ICON} />,
    id,
    label: ANP_LABELS[id],
  })),
];

const STRATUM_COLORS: Record<Stratum, string> = {
  "Bosque denso": "#1F5A36",
  "Bosque ralo": "#B7C96A",
  "Bosque semidenso": "#4E9A68",
  Incendio: "#C9402F",
  Matorral: "#D9A441",
};

const STRATUM_OPTIONS: MenuOption<"all" | Stratum>[] = [
  {
    icon: <Leaf aria-hidden="true" size={ICON} />,
    id: "all",
    label: "Todos los estratos",
  },
  ...STRATA.map((id) => ({ dot: STRATUM_COLORS[id], id, label: id })),
];

const VARIABLE_OPTIONS: MenuOption<PanelFilters["variable"]>[] = [
  {
    icon: <ListFilter aria-hidden="true" size={ICON} />,
    id: "all",
    label: "DAP y altura",
  },
  {
    icon: <Ruler aria-hidden="true" size={ICON} />,
    id: "dap",
    label: "Solo DAP",
  },
  {
    icon: <Layers aria-hidden="true" size={ICON} />,
    id: "alt",
    label: "Solo altura",
  },
];

const PERIOD_OPTIONS: {
  id: PeriodKind;
  label: string;
  icon: React.ReactNode;
}[] = [
  { icon: <Sun aria-hidden="true" size={ICON} />, id: "today", label: "Hoy" },
  {
    icon: <Timer aria-hidden="true" size={ICON} />,
    id: "week",
    label: "Última semana",
  },
  {
    icon: <CalendarDays aria-hidden="true" size={ICON} />,
    id: "custom",
    label: "Rango personalizado…",
  },
];

function periodLabel(period: PanelFilters["period"]): string {
  if (period.kind === "custom" && period.from && period.to) {
    return `${fmtIsoDay(period.from).slice(0, 5)} – ${fmtIsoDay(period.to)}`;
  }
  return PERIOD_OPTIONS.find((o) => o.id === period.kind)?.label ?? "Hoy";
}

function PeriodMenu({
  period,
  dataRange,
  onChange,
}: {
  period: PanelFilters["period"];
  dataRange: { min: string | null; max: string | null };
  onChange: (period: PanelFilters["period"]) => void;
}) {
  const [calendar, setCalendar] = useState(false);
  return (
    <>
      <MenuShell
        active={period.kind !== "today"}
        icon={<CalendarDays aria-hidden="true" size={ICON} />}
        label="Periodo"
        valueLabel={periodLabel(period)}
      >
        {(close) =>
          PERIOD_OPTIONS.map((o) => (
            <OptionRow
              icon={o.icon}
              key={o.id}
              on={period.kind === o.id}
              onPick={() => {
                if (o.id === "custom") {
                  setCalendar(true);
                } else {
                  onChange({ kind: o.id });
                }
                close();
              }}
            >
              {o.label}
            </OptionRow>
          ))
        }
      </MenuShell>
      <Modal
        onClose={() => setCalendar(false)}
        open={calendar}
        size="lg"
        title="Rango de fechas"
      >
        <DateRangePicker
          from={period.from ?? null}
          max={dataRange.max}
          min={dataRange.min}
          onApply={(from, to) => {
            onChange({ from, kind: "custom", to });
            setCalendar(false);
          }}
          onCancel={() => setCalendar(false)}
          to={period.to ?? null}
        />
      </Modal>
    </>
  );
}

export function FilterBar({
  filters,
  onChange,
  speciesName,
  dataRange,
}: {
  filters: PanelFilters;
  onChange: (next: PanelFilters) => void;
  speciesName: string | null;
  dataRange: { min: string | null; max: string | null };
}) {
  const activeCount =
    (filters.anp === "all" ? 0 : 1) +
    (filters.stratum === "all" ? 0 : 1) +
    (filters.period.kind === "today" ? 0 : 1) +
    (filters.variable === "all" ? 0 : 1) +
    (filters.speciesId === null ? 0 : 1);

  return (
    <section
      aria-label="Filtros"
      className="relative z-20 flex flex-wrap items-center gap-2.5 border-line border-y py-3"
    >
      <SelectMenu
        defaultValue="all"
        icon={<MapPin aria-hidden="true" size={ICON} />}
        label="Área (ANP)"
        onChange={(anp) => onChange({ ...filters, anp })}
        options={ANP_OPTIONS}
        shortAll="Todas"
        value={filters.anp}
      />
      <SelectMenu
        defaultValue="all"
        icon={<Leaf aria-hidden="true" size={ICON} />}
        label="Estrato"
        onChange={(stratum) => onChange({ ...filters, stratum })}
        options={STRATUM_OPTIONS}
        shortAll="Todos"
        value={filters.stratum}
      />
      <PeriodMenu
        dataRange={dataRange}
        onChange={(period) => onChange({ ...filters, period })}
        period={filters.period}
      />
      <SelectMenu
        defaultValue="all"
        icon={<ListFilter aria-hidden="true" size={ICON} />}
        label="Variable"
        onChange={(variable) => onChange({ ...filters, variable })}
        options={VARIABLE_OPTIONS}
        shortAll="DAP y altura"
        value={filters.variable}
      />
      <div className="ml-auto flex items-center gap-1.5">
        {speciesName ? (
          <button
            className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-primary bg-sel py-0 pr-2 pl-2.5 font-semibold text-[13px] text-ink"
            onClick={() => onChange({ ...filters, speciesId: null })}
            type="button"
          >
            <Leaf aria-hidden="true" size={14} />
            {speciesName}
            <X aria-hidden="true" size={13} />
          </button>
        ) : null}
        <button
          aria-label="Limpiar filtros"
          className="flex min-h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-edge bg-white px-3 text-[13px] disabled:opacity-45"
          disabled={activeCount === 0}
          onClick={() => onChange(DEFAULT_FILTERS)}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={16} />
          {activeCount > 0 ? `Limpiar · ${activeCount}` : "Limpiar"}
        </button>
      </div>
    </section>
  );
}
