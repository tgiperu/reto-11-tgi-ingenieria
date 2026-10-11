import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import { Search } from "lucide-react";

import { Button } from "@/components/app/button";
import { PlotStatusChip } from "@/components/app/chip";
import { Panel, Table, Td, Th } from "@/components/app/panel";
import { FilterChips } from "@/components/app/tabs";
import { fmtInt, fmtIsoDay, fmtNum } from "@/lib/format";

export type StatusFilter = "all" | "locked" | "review" | "alert";

export interface PlotRow {
  brigade: string;
  carbon: number;
  date: string | null;
  individuals: number;
  number: number;
  openAlerts: number;
  sector: string;
  status: string;
  stratum: string;
}

export function PlotTable({
  rows,
  counts,
  status,
  onStatus,
  search,
  onSearch,
  selected,
  onOpen,
  shown,
  total,
  onToggleAll,
  showingAll,
}: {
  rows: PlotRow[];
  counts: { all: number; locked: number; review: number; alert: number };
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  search: string;
  onSearch: (q: string) => void;
  selected: number | null;
  onOpen: (n: number) => void;
  shown: number;
  total: number;
  onToggleAll: () => void;
  showingAll: boolean;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-line border-b px-4 py-3">
        <span className="mr-1 text-[13px] text-ink-3">Estado:</span>
        <FilterChips
          label="Estado de la parcela"
          onChange={onStatus}
          options={[
            { count: counts.all, id: "all", label: "Todas" },
            { count: counts.locked, id: "locked", label: "Bloqueadas" },
            { count: counts.review, id: "review", label: "En revisión" },
            { count: counts.alert, id: "alert", label: "Con alertas" },
          ]}
          value={status}
        />
        <label className="ml-auto flex min-h-9 items-center gap-2 rounded-lg border border-edge px-2.5 text-[13px]">
          <Search aria-hidden="true" className="text-ink-3" size={14} />
          <span className="sr-only">Buscar parcela</span>
          <input
            className="w-44 border-0 bg-transparent outline-none"
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar N° o sector"
            type="search"
            value={search}
          />
        </label>
      </div>
      <Table minWidth={860}>
        <thead>
          <tr>
            <Th>N°</Th>
            <Th>Sector</Th>
            <Th>Estrato</Th>
            <Th>Brigada</Th>
            <Th>Fecha</Th>
            <Th className="text-right">Individuos</Th>
            <Th className="text-right">tC/ha</Th>
            <Th>Estado</Th>
            <Th>
              <span className="sr-only">Acciones</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              className={cn(r.number === selected && "bg-sel")}
              key={r.number}
            >
              <Td className="whitespace-nowrap font-mono font-semibold">
                P-{r.number}
              </Td>
              <Td>{r.sector}</Td>
              <Td>{r.stratum}</Td>
              <Td>{r.brigade}</Td>
              <Td className="font-mono">{fmtIsoDay(r.date)}</Td>
              <Td className="text-right font-mono">{fmtInt(r.individuals)}</Td>
              <Td className="text-right font-mono">{fmtNum(r.carbon)}</Td>
              <Td>
                <PlotStatusChip status={r.status} />
              </Td>
              <Td className="text-right">
                <Button
                  aria-label={`Ver registros de la parcela ${r.number}`}
                  onClick={() => onOpen(r.number)}
                  size="sm"
                >
                  Ver registros
                </Button>
              </Td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <Td className="py-8 text-center text-ink-3" colSpan={9}>
                No hay parcelas con estos filtros.
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
      <div className="flex items-center gap-2 border-line-2 border-t px-4 py-2.5 text-ink-3 text-xs">
        Mostrando {shown} de {total} ·
        <button
          className="cursor-pointer border-0 bg-transparent p-0 text-ink underline"
          onClick={onToggleAll}
          type="button"
        >
          {showingAll ? "Ver menos" : "Ver todas"}
        </button>
      </div>
    </Panel>
  );
}
