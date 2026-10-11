import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { type ReactNode, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/app/button";
import { PageHeader } from "@/components/app/panel";
import { Tabs } from "@/components/app/tabs";
import { ImportWizard } from "@/features/parcelas/import-wizard";
import { NewPlotModal } from "@/features/parcelas/modals";
import { PlotTable, type StatusFilter } from "@/features/parcelas/plot-table";
import { PlotRecords } from "@/features/parcelas/records";
import { trpc } from "@/utils/trpc";

const searchSchema = z.object({
  plot: z.number().int().optional(),
  tab: z.enum(["records", "import"]).optional(),
});

export const Route = createFileRoute("/_auth/_staff/parcelas")({
  component: PlotsPage,
  validateSearch: searchSchema,
});

const LIST_PAGE = 7;
const LIST_ALL = 200;

function PlotsPage() {
  const { session } = Route.useRouteContext();
  const { plot, tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const list = useQuery({
    ...trpc.plots.list.queryOptions({
      limit: showAll ? LIST_ALL : LIST_PAGE,
      search,
      status,
    }),
    placeholderData: (previous) => previous,
  });
  const { role } = session.user;
  const isAdmin = role === "admin";
  const activeTab = tab ?? "records";
  const selected = plot ?? list.data?.rows[0]?.number ?? null;

  let detail: ReactNode = <ImportWizard isAdmin={isAdmin} />;
  if (activeTab === "records") {
    detail =
      selected === null ? (
        <p className="text-ink-3 text-sm">
          Elige una parcela para ver sus registros.
        </p>
      ) : (
        <PlotRecords key={selected} plot={selected} role={role} />
      );
  }

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button
              onClick={() =>
                navigate({ search: (s) => ({ ...s, tab: "import" }) })
              }
            >
              <Upload aria-hidden="true" size={16} /> Importar CSV / Excel
            </Button>
            <Button onClick={() => setNewOpen(true)} variant="primary">
              <Plus aria-hidden="true" size={16} /> Nueva parcela
            </Button>
          </>
        }
        subtitle="Los registros sincronizados quedan bloqueados. Solo el rol Administrador puede editarlos, con motivo y auditoría."
        title="Parcelas"
      />

      <PlotTable
        counts={list.data?.counts ?? { alert: 0, all: 0, locked: 0, review: 0 }}
        onOpen={(n) => navigate({ search: { plot: n, tab: "records" } })}
        onSearch={setSearch}
        onStatus={setStatus}
        onToggleAll={() => setShowAll((v) => !v)}
        rows={list.data?.rows ?? []}
        search={search}
        selected={selected}
        showingAll={showAll}
        shown={list.data?.shown ?? 0}
        status={status}
        total={list.data?.total ?? 0}
      />

      <Tabs
        label="Detalle"
        onChange={(id) => navigate({ search: (s) => ({ ...s, tab: id }) })}
        tabs={[
          {
            id: "records",
            label:
              selected === null ? "Registros" : `Registros de P-${selected}`,
          },
          { id: "import", label: "Importar archivo" },
        ]}
        value={activeTab}
      />

      {detail}

      <NewPlotModal
        key={`new-${newOpen}`}
        onClose={() => setNewOpen(false)}
        open={newOpen}
      />
    </>
  );
}
