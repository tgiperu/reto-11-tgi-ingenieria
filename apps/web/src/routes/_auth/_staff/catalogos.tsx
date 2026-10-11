import { normalizeKey } from "@reto-11-tgi-ingenieria/domain/names";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/app/button";
import { Pager } from "@/components/app/pager";
import {
  Notice,
  PageHeader,
  Panel,
  Table,
  Td,
  Th,
} from "@/components/app/panel";
import { type TabDef, Tabs } from "@/components/app/tabs";
import {
  type BrigadeEdit,
  BrigadeModal,
  EQUATION_KEYS,
  EquationsModal,
  SectorModal,
  type SpeciesEdit,
  SpeciesModal,
} from "@/features/catalogos/forms";
import { fmtDateTime, fmtInt, fmtNum } from "@/lib/format";
import { usePaged } from "@/lib/use-paged";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/_staff/catalogos")({
  component: CatalogsPage,
});

const TABLE_PAGE = 10;

type TabId = "sp" | "br" | "se" | "ca";

function SpeciesTab({
  isAdmin,
  onEdit,
}: {
  isAdmin: boolean;
  onEdit: (s: SpeciesEdit) => void;
}) {
  const { data = [] } = useQuery(trpc.catalog.species.list.queryOptions());
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const q = normalizeKey(search);
    return q === ""
      ? data
      : data.filter((s) =>
          normalizeKey(`${s.name} ${s.scientificName ?? ""}`).includes(q)
        );
  }, [data, search]);
  const paged = usePaged(rows, TABLE_PAGE);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-line border-b px-4 py-3">
        <label className="flex min-h-10 min-w-60 flex-[1_1_240px] items-center gap-2 rounded-lg border border-edge px-3">
          <Search aria-hidden="true" className="text-ink-3" size={16} />
          <span className="sr-only">Buscar especie</span>
          <input
            className="w-full border-0 bg-transparent text-sm outline-none"
            onChange={(e) => {
              paged.reset();
              setSearch(e.target.value);
            }}
            placeholder={`Buscar entre ${data.length} especies`}
            type="search"
            value={search}
          />
        </label>
        <span className="text-ink-3 text-xs">
          Los rangos alimentan las alertas de DAP y altura atípicos
        </span>
      </div>
      <Table minWidth={760}>
        <thead>
          <tr>
            <Th>Nombre común</Th>
            <Th>Nombre científico</Th>
            <Th>Forma de vida</Th>
            <Th className="text-right">Individuos</Th>
            <Th className="text-right">DAP medio ± DE</Th>
            <Th className="text-right">Alerta si DAP &gt;</Th>
            {isAdmin ? (
              <Th>
                <span className="sr-only">Editar</span>
              </Th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {paged.items.map((s) => (
            <tr key={s.id}>
              <Td className="font-semibold">{s.name}</Td>
              <Td
                className={s.scientificName ? "italic" : "text-warn-fg italic"}
              >
                {s.scientificName ?? "[por validar]"}
              </Td>
              <Td>{s.lifeForm}</Td>
              <Td className="text-right font-mono">{fmtInt(s.count)}</Td>
              <Td className="text-right font-mono">
                {s.dapMean === null
                  ? "—"
                  : `${fmtNum(s.dapMean)} ± ${fmtNum(s.dapSd)}`}
              </Td>
              <Td className="text-right font-mono">
                {s.dapMax === null ? "—" : fmtNum(s.dapMax)}
              </Td>
              {isAdmin ? (
                <Td className="text-right">
                  <Button
                    aria-label={`Editar ${s.name}`}
                    onClick={() =>
                      onEdit({
                        id: s.id,
                        lifeForm: s.lifeForm,
                        name: s.name,
                        scientificName: s.scientificName,
                      })
                    }
                    size="sm"
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </Button>
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager
        bordered
        label="especies"
        onPage={paged.setPage}
        page={paged.page}
        pageSize={paged.pageSize}
        total={paged.total}
      />
    </>
  );
}

function BrigadesTab({
  isAdmin,
  onEdit,
}: {
  isAdmin: boolean;
  onEdit: (b: BrigadeEdit) => void;
}) {
  const { data = [] } = useQuery(trpc.catalog.brigades.list.queryOptions());
  const paged = usePaged(data, TABLE_PAGE);
  return (
    <>
      <Table minWidth={720}>
        <thead>
          <tr>
            <Th>Brigada</Th>
            <Th>Jefe de brigada</Th>
            <Th>Materos</Th>
            <Th className="text-right">Parcelas</Th>
            <Th>Dispositivos</Th>
            {isAdmin ? (
              <Th>
                <span className="sr-only">Editar</span>
              </Th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {paged.items.map((b) => (
            <tr key={b.id}>
              <Td className="py-3 font-mono font-semibold">{b.id}</Td>
              <Td className="py-3">{b.leaderName}</Td>
              <Td className="py-3">{b.members.join(", ") || "—"}</Td>
              <Td className="py-3 text-right font-mono">{b.plots}</Td>
              <Td className="py-3">
                {b.devices} equipos ·{" "}
                {b.lastSync
                  ? `último envío ${fmtDateTime(b.lastSync)}`
                  : "sin envíos"}
              </Td>
              {isAdmin ? (
                <Td className="text-right">
                  <Button
                    aria-label={`Editar ${b.id}`}
                    onClick={() =>
                      onEdit({
                        devices: b.devices,
                        id: b.id,
                        leaderName: b.leaderName,
                        members: b.members,
                      })
                    }
                    size="sm"
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </Button>
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager
        bordered
        label="brigadas"
        onPage={paged.setPage}
        page={paged.page}
        pageSize={paged.pageSize}
        total={paged.total}
      />
    </>
  );
}

function SectorsTab({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.catalog.sectors.list.queryOptions());
  const merge = useMutation(
    trpc.catalog.sectors.merge.mutationOptions({
      onError: (e) => toast.error(e.message),
      onSuccess: async () => {
        toast.success("Sectores fusionados");
        await queryClient.invalidateQueries();
      },
    })
  );
  const suggestions = data?.suggestions ?? [];
  const paged = usePaged(data?.sectors ?? [], TABLE_PAGE);
  return (
    <>
      {suggestions.length > 0 ? (
        <div className="border-line border-b bg-warn-bg px-4 py-3 text-[13px] text-warn-fg">
          Se detectaron nombres con distinta escritura. Confirma la fusión para
          normalizarlos.
        </div>
      ) : null}
      {suggestions.length > 0 ? (
        <Table minWidth={640}>
          <thead>
            <tr>
              <Th>Valor canónico</Th>
              <Th>Variantes encontradas</Th>
              <Th className="text-right">Registros</Th>
              <Th>
                <span className="sr-only">Acción</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.canonical}>
                <Td className="font-semibold">{s.canonical}</Td>
                <Td className="font-mono">{s.variants.join(" · ")}</Td>
                <Td className="text-right font-mono">{fmtInt(s.records)}</Td>
                <Td className="text-right">
                  <Button
                    disabled={
                      !isAdmin || s.canonicalId === null || merge.isPending
                    }
                    onClick={() =>
                      s.canonicalId !== null &&
                      merge.mutate({
                        keepId: s.canonicalId,
                        mergeIds: s.mergeIds,
                      })
                    }
                    size="sm"
                  >
                    Fusionar
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      <Table fixed minWidth={640}>
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <Th>Sector</Th>
            <Th className="text-right">Parcelas</Th>
            <Th className="text-right">Registros</Th>
            <Th>Otras escrituras fusionadas</Th>
          </tr>
        </thead>
        <tbody>
          {paged.items.map((s) => (
            <tr key={s.id}>
              <Td className="font-semibold">{s.name}</Td>
              <Td className="text-right font-mono">{s.plots}</Td>
              <Td className="text-right font-mono">{fmtInt(s.records)}</Td>
              <Td className="whitespace-normal break-words font-mono text-xs">
                {s.variants.join(" · ") || "—"}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager
        bordered
        label="sectores"
        onPage={paged.setPage}
        page={paged.page}
        pageSize={paged.pageSize}
        total={paged.total}
      />
    </>
  );
}

function CategoriesTab() {
  const { data } = useQuery(trpc.catalog.categories.queryOptions());
  return (
    <Table minWidth={720}>
      <thead>
        <tr>
          <Th>Categoría</Th>
          <Th>Criterio de inclusión</Th>
          <Th>Radio de subparcela</Th>
          <Th>Variable principal</Th>
          <Th className="text-right">Factor de expansión</Th>
        </tr>
      </thead>
      <tbody>
        {data?.categories.map((c) => (
          <tr key={c.key}>
            <Td className="py-2.5 font-semibold">{c.name}</Td>
            <Td>{c.criterion}</Td>
            <Td className="font-mono">{c.radiusM} m</Td>
            <Td>{c.variable}</Td>
            <Td className="text-right font-mono">
              {(10_000 / (Math.PI * c.radiusM * c.radiusM)).toFixed(3)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

const TABS: { id: TabId; label: string; add: string }[] = [
  { add: "Nueva especie", id: "sp", label: "Especies" },
  { add: "Nueva brigada", id: "br", label: "Brigadas" },
  { add: "Nuevo sector", id: "se", label: "Sectores" },
  { add: "", id: "ca", label: "Categorías" },
];

function CatalogsPage() {
  const { session } = Route.useRouteContext();
  const isAdmin = session.user.role === "admin";
  const [tab, setTab] = useState<TabId>("sp");
  const [species, setSpecies] = useState<SpeciesEdit | null>(null);
  const [brigade, setBrigade] = useState<BrigadeEdit | null>(null);
  const [sectorOpen, setSectorOpen] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);
  const [eqIndex, setEqIndex] = useState<number | null>(null);
  const categories = useQuery(trpc.catalog.categories.queryOptions());
  const version = useQuery(trpc.catalog.version.queryOptions());
  const current = TABS.find((t) => t.id === tab);
  const tabs: TabDef<TabId>[] = TABS.map((t) => ({ id: t.id, label: t.label }));

  const onAdd = () => {
    if (tab === "sp") {
      setSpecies({
        id: null,
        lifeForm: "Árbol",
        name: "",
        scientificName: null,
      });
    } else if (tab === "br") {
      setBrigade({ devices: 0, id: null, leaderName: "", members: [] });
    } else if (tab === "se") {
      setSectorOpen(true);
    }
  };

  return (
    <>
      <PageHeader
        actions={
          current?.add ? (
            <Button disabled={!isAdmin} onClick={onAdd} variant="primary">
              <Plus aria-hidden="true" size={16} /> {current.add}
            </Button>
          ) : null
        }
        title="Catálogos"
      />
      {isAdmin ? null : (
        <Notice tone="info">
          Puedes consultar los catálogos. Solo un administrador puede
          modificarlos.
        </Notice>
      )}
      <Tabs label="Catálogo" onChange={setTab} tabs={tabs} value={tab} />
      <div className="flex flex-wrap items-start gap-4">
        <Panel className="min-w-0 flex-[999_1_560px] overflow-hidden">
          {tab === "sp" ? (
            <SpeciesTab isAdmin={isAdmin} onEdit={setSpecies} />
          ) : null}
          {tab === "br" ? (
            <BrigadesTab isAdmin={isAdmin} onEdit={setBrigade} />
          ) : null}
          {tab === "se" ? <SectorsTab isAdmin={isAdmin} /> : null}
          {tab === "ca" ? <CategoriesTab /> : null}
        </Panel>
        <Panel className="flex min-w-0 flex-[1_1_340px] flex-col gap-3 p-[18px]">
          <h2 className="font-semibold text-[15px]">Ecuaciones de carbono</h2>
          <span className="text-ink-3 text-xs">
            D = diámetro equivalente (cm), Dc = diámetro de copa promedio (m),
            FE = 1 / área de subparcela (ha).
          </span>
          {categories.data?.formulas.map((f, i) => (
            <button
              aria-pressed={eqIndex === i}
              className={`flex cursor-pointer flex-col items-start gap-1 rounded-md border-2 px-3 py-2.5 text-left ${eqIndex === i ? "border-primary bg-sel" : "border-transparent bg-paper hover:bg-sunken"}`}
              key={f.name}
              onClick={() => setEqIndex(eqIndex === i ? null : i)}
              type="button"
            >
              <strong className="text-[13px]">{f.name}</strong>
              <code className="whitespace-pre-line font-mono text-xs">
                {f.text}
              </code>
            </button>
          ))}
          <Button
            disabled={!(isAdmin && categories.data) || eqIndex === null}
            onClick={() => setEqOpen(true)}
          >
            Editar
          </Button>
        </Panel>
      </div>
      <SpeciesModal
        key={`sp-${species?.id ?? "new"}-${species === null}`}
        onClose={() => setSpecies(null)}
        value={species}
      />
      <BrigadeModal
        key={`br-${brigade?.id ?? "new"}-${brigade === null}`}
        onClose={() => setBrigade(null)}
        value={brigade}
      />
      <SectorModal
        key={`se-${sectorOpen}`}
        onClose={() => setSectorOpen(false)}
        open={sectorOpen}
      />
      {categories.data && eqIndex !== null ? (
        <EquationsModal
          equations={categories.data.equations}
          formula={categories.data.formulas[eqIndex]?.text ?? ""}
          key={`eq-${eqIndex}-${eqOpen}`}
          name={categories.data.formulas[eqIndex]?.name ?? ""}
          onClose={() => setEqOpen(false)}
          open={eqOpen}
          target={EQUATION_KEYS[eqIndex] ?? "latizal"}
        />
      ) : null}
    </>
  );
}
