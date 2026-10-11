import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/app/button";
import { Modal } from "@/components/app/modal";
import { PageHeader } from "@/components/app/panel";
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

const LIST_MAX = 200;
const TABLE_PAGE = 10;

function PlotsPage() {
  const { session } = Route.useRouteContext();
  const { plot, tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);

  const list = useQuery({
    ...trpc.plots.list.queryOptions({
      limit: LIST_MAX,
      search,
      status,
    }),
    placeholderData: (previous) => previous,
  });
  const { role } = session.user;
  const isAdmin = role === "admin";
  const selected = plot ?? list.data?.rows[0]?.number ?? null;

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
        title="Parcelas"
      />

      <PlotTable
        counts={list.data?.counts ?? { alert: 0, all: 0, locked: 0, review: 0 }}
        onOpen={(n) => {
          navigate({ search: (s) => ({ ...s, plot: n }) });
          setRecordsOpen(true);
        }}
        onSearch={setSearch}
        onStatus={setStatus}
        pageSize={TABLE_PAGE}
        rows={list.data?.rows ?? []}
        search={search}
        selected={selected}
        status={status}
      />

      <Modal
        onClose={() => setRecordsOpen(false)}
        open={recordsOpen && selected !== null}
        size="xl"
        title={selected === null ? "Registros" : `Registros de P-${selected}`}
      >
        {selected === null ? null : (
          <PlotRecords key={selected} plot={selected} role={role} />
        )}
      </Modal>

      <Modal
        onClose={() => navigate({ search: (s) => ({ ...s, tab: undefined }) })}
        open={tab === "import"}
        size="xl"
        title="Importar archivo"
      >
        <ImportWizard isAdmin={isAdmin} />
      </Modal>

      <NewPlotModal
        key={`new-${newOpen}`}
        onClose={() => setNewOpen(false)}
        open={newOpen}
      />
    </>
  );
}
