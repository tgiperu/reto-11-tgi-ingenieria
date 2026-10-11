/**
 * Datos iniciales del inventario forestal AIDER (Bosque seco, Tumbes y Piura).
 * Uso: `bun run db:seed` desde la raíz. Es idempotente: se puede repetir sin duplicar.
 *
 * Crea catálogos (brigadas, sectores, especies), las 33 parcelas del diseño, la primera
 * publicación de reglas y cuentas de prueba. La contraseña de las cuentas sale de
 * `SEED_PASSWORD`; si no está definida se usa el valor de desarrollo de este archivo.
 */

import { account, user } from "@reto-11-tgi-ingenieria/db/schema/auth";
import {
  brigade,
  sector,
  species,
} from "@reto-11-tgi-ingenieria/db/schema/catalog";
import {
  measurement,
  plot,
  ruleRelease,
  tree,
} from "@reto-11-tgi-ingenieria/db/schema/inventory";
import { carbonOf } from "@reto-11-tgi-ingenieria/domain/carbon";
import { utmToLatLon } from "@reto-11-tgi-ingenieria/domain/geo";
import { defaultRuleSettings } from "@reto-11-tgi-ingenieria/domain/rules";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { db } from "./services";

const DEV_PASSWORD = "inventario-dev-2026";

const BRIGADES = [
  {
    devices: 2,
    id: "BR-01",
    leaderName: "Manuel Llanos Aguilar",
    members: ["Jaime Montalván Huamán"],
  },
  {
    devices: 2,
    id: "BR-02",
    leaderName: "Arbildo García Nuñez",
    members: ["Paul Madrid Marchán", "Alan García Cruz"],
  },
  {
    devices: 3,
    id: "BR-03",
    leaderName: "Romy Periche Viera",
    members: [
      "Segundo Ruiz Castillo",
      "Segundo Delgado Palacios",
      "Edinson Guerrero Romero",
    ],
  },
];

interface SpeciesSeed {
  dapMax?: number;
  equationKey?: "overo";
  hMax?: number;
  isNN?: boolean;
  lifeForm: "Árbol" | "Arbusto" | "Árbol / arbusto";
  mean?: number;
  name: string;
  scientific?: string;
  sd?: number;
}

const SPECIES: SpeciesSeed[] = [
  {
    dapMax: 14,
    hMax: 7.5,
    lifeForm: "Árbol / arbusto",
    mean: 5.8,
    name: "Huapala",
    sd: 2.7,
  },
  {
    dapMax: 30.4,
    hMax: 8,
    lifeForm: "Árbol",
    mean: 11.8,
    name: "Oreja de león",
    sd: 6.2,
  },
  {
    dapMax: 24.2,
    hMax: 17.5,
    lifeForm: "Árbol",
    mean: 7.4,
    name: "Guayacán",
    scientific: "Handroanthus chrysanthus",
    sd: 5.6,
  },
  {
    dapMax: 31.9,
    hMax: 11,
    lifeForm: "Árbol",
    mean: 12.4,
    name: "Huarapo",
    sd: 6.5,
  },
  {
    equationKey: "overo",
    hMax: 12.5,
    lifeForm: "Arbusto",
    name: "Overo",
    scientific: "Cordia lutea",
  },
  {
    dapMax: 53.9,
    hMax: 9,
    lifeForm: "Árbol",
    mean: 22.1,
    name: "Polo polo",
    scientific: "Cochlospermum vitifolium",
    sd: 10.6,
  },
  {
    dapMax: 37.2,
    hMax: 15,
    lifeForm: "Árbol",
    mean: 12,
    name: "Palo santo",
    scientific: "Bursera graveolens",
    sd: 8.4,
  },
  {
    dapMax: 73.8,
    lifeForm: "Árbol",
    mean: 28.8,
    name: "Pasallo",
    scientific: "Eriotheca ruizii",
    sd: 15,
  },
  { dapMax: 25.5, lifeForm: "Árbol", name: "Barbasco blanco" },
  { dapMax: 41.8, lifeForm: "Árbol", name: "Charán negro" },
  { dapMax: 25, lifeForm: "Árbol", name: "Charán blanco" },
  { dapMax: 30.9, lifeForm: "Árbol", name: "Negrito" },
  { dapMax: 35.8, lifeForm: "Árbol", name: "Angolo" },
  { hMax: 6, lifeForm: "Árbol", name: "Crucita" },
  { lifeForm: "Árbol", name: "Aserrilla" },
  { lifeForm: "Árbol", name: "Chicho" },
  { lifeForm: "Árbol", name: "Palo blanco" },
  { lifeForm: "Árbol", name: "Palo de vaca" },
  { lifeForm: "Árbol", name: "Pico pico" },
  { lifeForm: "Árbol", name: "Hualtaco", scientific: "Loxopterygium huasango" },
  { lifeForm: "Árbol", name: "Almendro" },
  { lifeForm: "Árbol", name: "Algarrobo", scientific: "Prosopis pallida" },
  { lifeForm: "Árbol", name: "Mote mote" },
  { lifeForm: "Árbol", name: "Pego pego" },
  { isNN: true, lifeForm: "Árbol", name: "NN (no identificada)" },
];

/** [N°, estrato, sector, jefe, matero, fecha dd/mm/aaaa, UTM este, UTM norte, desvío vs. gabinete (m)] */
const PLOTS: [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  number,
  number,
][] = [
  [
    1,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "29/10/2024",
    561_510,
    9_562_009,
    13,
  ],
  [
    2,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "03/11/2024",
    560_715,
    9_561_748,
    32,
  ],
  [
    3,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "01/11/2024",
    561_246,
    9_561_741,
    6,
  ],
  [
    4,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "28/10/2024",
    562_243,
    9_562_249,
    11,
  ],
  [
    5,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "05/11/2024",
    560_172,
    9_562_547,
    383,
  ],
  [
    6,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "04/11/2024",
    560_637,
    9_562_796,
    562,
  ],
  [
    7,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "30/10/2024",
    561_232,
    9_562_233,
    27,
  ],
  [
    8,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "24/10/2024",
    564_739,
    9_561_261,
    13,
  ],
  [
    9,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "27/10/2024",
    564_491,
    9_561_520,
    8,
  ],
  [
    10,
    "Incendio",
    "Cabo Inga",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "21/10/2024",
    564_236,
    9_561_744,
    12,
  ],
  [
    11,
    "Matorral",
    "Pampas de Poza de Bola",
    "Romy Periche Viera",
    "Edinson Guerrero Romero",
    "30/10/2024",
    513_250,
    9_532_879,
    102,
  ],
  [
    12,
    "Matorral",
    "Puebla Leona",
    "Romy Periche Viera",
    "Edinson Guerrero Romero",
    "31/10/2024",
    514_014,
    9_534_615,
    138,
  ],
  [
    13,
    "Matorral",
    "La Breita",
    "Romy Periche Viera",
    "Edinson Guerrero Romero",
    "29/10/2024",
    512_542,
    9_529_490,
    45,
  ],
  [
    14,
    "Matorral",
    "Hierba Buena",
    "Romy Periche Viera",
    "Edinson Guerrero Romero",
    "29/10/2024",
    511_766,
    9_527_471,
    22,
  ],
  [
    15,
    "Bosque ralo",
    "Qda. Carrizalillo-Chunga",
    "Arbildo García Nuñez",
    "Paul Madrid Marchán",
    "28/10/2024",
    547_326,
    9_573_537,
    28,
  ],
  [
    16,
    "Bosque ralo",
    "Qda. Las Rosas",
    "Arbildo García Nuñez",
    "Paul Madrid Marchán",
    "26/10/2024",
    549_538,
    9_572_840,
    39,
  ],
  [
    17,
    "Bosque ralo",
    "La Perdiz-Rica Playa",
    "Arbildo García Nuñez",
    "Paul Madrid Marchán",
    "30/10/2024",
    551_429,
    9_578_107,
    129,
  ],
  [
    18,
    "Bosque semidenso",
    "La Mira-Puchos",
    "Arbildo García Nuñez",
    "Paul Madrid Marchán",
    "24/10/2024",
    555_678,
    9_574_218,
    69,
  ],
  [
    19,
    "Bosque semidenso",
    "La N Puchos",
    "Arbildo García Nuñez",
    "Paul Madrid Marchán",
    "25/10/2024",
    556_817,
    9_576_941,
    42,
  ],
  [
    20,
    "Bosque semidenso",
    "Teniente Astete",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "06/11/2024",
    560_015,
    9_556_741,
    47,
  ],
  [
    21,
    "Bosque denso",
    "Huarapal",
    "Arbildo García Nuñez",
    "Alan García Cruz",
    "18/10/2024",
    572_126,
    9_582_250,
    803,
  ],
  [
    22,
    "Bosque denso",
    "Brunos",
    "Arbildo García Nuñez",
    "Paul Madrid Marchán",
    "20/10/2024",
    568_892,
    9_581_833,
    10_141,
  ],
  [
    23,
    "Bosque denso",
    "Anonas",
    "Arbildo García Nuñez",
    "Alan García Cruz",
    "22/10/2024",
    566_263,
    9_581_717,
    28,
  ],
  [
    24,
    "Bosque denso",
    "Pozo Azul",
    "Arbildo García Nuñez",
    "Alan García Cruz",
    "17/10/2024",
    573_791,
    9_581_679,
    23_156,
  ],
  [
    25,
    "Bosque denso",
    "Huasimo",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "08/11/2024",
    555_759,
    9_558_524,
    12,
  ],
  [
    26,
    "Bosque denso",
    "Taloneras",
    "Romy Periche Viera",
    "Segundo Delgado Palacios",
    "25/10/2024",
    535_557,
    9_526_565,
    3387,
  ],
  [
    27,
    "Bosque denso",
    "La Rinconada",
    "Romy Periche Viera",
    "Segundo Delgado Palacios",
    "24/10/2024",
    537_164,
    9_528_114,
    2470,
  ],
  [
    28,
    "Bosque denso",
    "Chulucana",
    "Arbildo García Nuñez",
    "Paul Madrid Marchán",
    "29/10/2024",
    561_479,
    9_580_457,
    237,
  ],
  [
    29,
    "Bosque denso",
    "Qda. Chulucanas",
    "Arbildo García Nuñez",
    "Paul Madrid Marchán",
    "31/10/2024",
    561_180,
    9_581_067,
    324,
  ],
  [
    30,
    "Bosque denso",
    "Cherrelique",
    "Romy Periche Viera",
    "Segundo Ruiz Castillo",
    "18/10/2024",
    548_726,
    9_538_427,
    37,
  ],
  [
    31,
    "Bosque denso",
    "Qda. El Rudy",
    "Romy Periche Viera",
    "Segundo Ruiz Castillo",
    "21/10/2024",
    550_427,
    9_534_700,
    3337,
  ],
  [
    32,
    "Bosque denso",
    "Qda. Cueva del Tigre",
    "Romy Periche Viera",
    "Segundo Ruiz Castillo",
    "20/10/2024",
    549_389,
    9_535_183,
    499,
  ],
  [
    33,
    "Bosque denso",
    "Teniente Astete",
    "Manuel Llanos Aguilar",
    "Jaime Montalván Huamán",
    "17/10/2024",
    558_523,
    9_555_277,
    48,
  ],
];

/** Medición anterior (18/10/2024) de los 10 primeros árboles de P-30: sirve para probar remediciones. */
const P30_HISTORY: [string, string, number, number][] = [
  ["1", "Huarapo", 13.0, 9.0],
  ["2", "Pico pico", 9.78, 4.5],
  ["3", "Pego pego", 12.8, 10.8],
  ["4", "Oreja de león", 10.05, 7.36],
  ["5", "Oreja de león", 22.45, 17.6],
  ["6", "Almendro", 56.05, 18.0],
  ["7", "Pico pico", 9.4, 6.93],
  ["8", "Huarapo", 14.9, 11.6],
  ["9", "Negrito", 13.0, 6.8],
  ["10", "Huarapo", 16.18, 8.5],
];

const USERS = [
  {
    brigadeId: "BR-03",
    email: "romy.periche@aider.test",
    name: "Romy Periche",
    role: "admin",
  },
  {
    brigadeId: "BR-01",
    email: "manuel.llanos@aider.test",
    name: "Manuel Llanos",
    role: "supervisor",
  },
  {
    brigadeId: "BR-03",
    email: "segundo.ruiz@aider.test",
    name: "Segundo Ruiz",
    role: "brigadista",
  },
  {
    brigadeId: "BR-02",
    email: "arbildo.garcia@aider.test",
    name: "Arbildo García",
    role: "brigadista",
  },
  {
    brigadeId: "BR-01",
    email: "jaime.montalvan@aider.test",
    name: "Jaime Montalván",
    role: "brigadista",
  },
];

const STANDARD_DEVIATION_MULTIPLIER = 3;
const LIMA_OFFSET = "-05:00";

function isoDate(dmy: string): string {
  const [d, m, y] = dmy.split("/");
  return `${y}-${m}-${d}`;
}

function anpFor(e: number, n: number): string {
  return e < 540_000 && n < 9_545_000 ? "CCEAN" : "PNCAM";
}

async function seedCatalogs(): Promise<void> {
  await db.insert(brigade).values(BRIGADES).onConflictDoNothing();
  const sectorNames = [...new Set(PLOTS.map((p) => p[2]))];
  await db
    .insert(sector)
    .values(sectorNames.map((name) => ({ name })))
    .onConflictDoNothing();
  await db
    .insert(species)
    .values(
      SPECIES.map((s) => ({
        dapMax: s.dapMax ?? null,
        dapMean: s.mean ?? null,
        dapMin: s.dapMax ? 1 : null,
        dapSd: s.sd ?? null,
        equationKey: s.equationKey ?? null,
        heightMax: s.hMax ?? null,
        isNN: s.isNN ?? false,
        lifeForm: s.lifeForm,
        name: s.name,
        scientificName: s.scientific ?? null,
      }))
    )
    .onConflictDoNothing();
}

async function seedPlots(): Promise<void> {
  const sectors = await db.select().from(sector);
  const sectorId = new Map(sectors.map((s) => [s.name, s.id]));
  const brigadeOfLeader = new Map(BRIGADES.map((b) => [b.leaderName, b.id]));
  const rows = PLOTS.map(
    ([number, stratum, sectorName, leader, crew, date, e, n, deviation]) => {
      const coords = utmToLatLon(e, n);
      return {
        anp: anpFor(e, n),
        brigadeId: brigadeOfLeader.get(leader) ?? null,
        cabE: e + deviation,
        cabN: n,
        crew,
        deviationM: deviation,
        lat: coords.lat,
        lon: coords.lon,
        number,
        sampleDate: isoDate(date),
        sectorId: sectorId.get(sectorName) ?? 0,
        status: "assigned",
        stratum,
        utmE: e,
        utmN: n,
      };
    }
  );
  await db.insert(plot).values(rows).onConflictDoNothing();
}

async function seedHistory(): Promise<void> {
  const [already] = await db
    .select({ id: tree.id })
    .from(tree)
    .where(eq(tree.plotNumber, 30))
    .limit(1);
  if (already) {
    return;
  }
  const speciesRows = await db.select().from(species);
  const idByName = new Map(speciesRows.map((s) => [s.name, s.id]));
  for (const [code, name, dap, height] of P30_HISTORY) {
    const speciesId = idByName.get(name) ?? null;
    // biome-ignore lint/performance/noAwaitInLoops: lotes secuenciales: el orden importa y evita saturar la base o la señal
    const [row] = await db
      .insert(tree)
      .values({
        category: "la",
        code,
        plotNumber: 30,
        series: "arbol",
        speciesId,
      })
      .returning({ id: tree.id });
    if (!row) {
      continue;
    }
    const carbon = carbonOf({
      category: "la",
      crownAvg: null,
      dacAvg: null,
      dapEq: dap,
      equationKey: null,
    });
    await db.insert(measurement).values({
      carbonAerial: carbon.aerial,
      carbonRoot: carbon.root,
      carbonTotal: carbon.total,
      category: "la",
      dapEq: dap,
      height,
      measuredAt: new Date(`2024-10-18T12:00:00${LIMA_OFFSET}`),
      plotNumber: 30,
      source: "import",
      speciesId,
      stems: [dap],
      treeId: row.id,
    });
  }
}

async function seedRules(): Promise<void> {
  const [existing] = await db
    .select({ id: ruleRelease.id })
    .from(ruleRelease)
    .limit(1);
  if (!existing) {
    await db
      .insert(ruleRelease)
      .values({ publishedBy: "seed", settings: defaultRuleSettings() });
  }
}

async function seedUsers(): Promise<void> {
  const password = await hashPassword(
    process.env.SEED_PASSWORD ?? DEV_PASSWORD
  );
  for (const u of USERS) {
    // biome-ignore lint/performance/noAwaitInLoops: lotes secuenciales: el orden importa y evita saturar la base o la señal
    const [found] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, u.email))
      .limit(1);
    if (found) {
      continue;
    }
    const id = crypto.randomUUID();
    await db.insert(user).values({ ...u, emailVerified: true, id });
    await db.insert(account).values({
      accountId: id,
      id: crypto.randomUUID(),
      password,
      providerId: "credential",
      userId: id,
    });
  }
}

async function main(): Promise<void> {
  await seedCatalogs();
  await seedPlots();
  await seedHistory();
  await seedRules();
  await seedUsers();
  // Con DE conocidas, el límite de DAP de cada especie es media + k·DE.
  process.stdout.write(
    `Listo: ${BRIGADES.length} brigadas, ${PLOTS.length} parcelas, ${SPECIES.length} especies, ${USERS.length} cuentas (k = ${STANDARD_DEVIATION_MULTIPLIER}).\n`
  );
  for (const u of USERS) {
    process.stdout.write(`  ${u.role.padEnd(10)} ${u.email}\n`);
  }
  process.stdout.write(
    "La contraseña es SEED_PASSWORD (o el valor de desarrollo de apps/server/src/seed.ts).\n"
  );
}

await main();
