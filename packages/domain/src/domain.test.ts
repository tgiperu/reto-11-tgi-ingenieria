import { describe, expect, it } from "bun:test";

import { carbonOf } from "./carbon";
import { categoryFactor } from "./categories";
import { distanceMeters, utmToLatLon } from "./geo";
import { healthRequired, parseHealth } from "./health";
import { autoMap, buildImportPreview } from "./import";
import {
  clinometerHeight,
  equivalentDiameter,
  heightError,
  MAX_HEIGHT_M,
  sanitizePositiveDecimal,
} from "./measure";
import { groupVariants, normalizeTime } from "./names";
import {
  defaultRuleSettings,
  evaluateMeasurement,
  hasBlocking,
  type RuleSetting,
} from "./rules";

describe("geo", () => {
  it("convierte UTM 17S a lat/lon dentro de Piura", () => {
    const { lat, lon } = utmToLatLon(548_726, 9_538_427);
    expect(lat).toBeGreaterThan(-4.5);
    expect(lat).toBeLessThan(-4);
    expect(lon).toBeGreaterThan(-80.8);
    expect(lon).toBeLessThan(-80.4);
  });

  it("calcula distancias en metros", () => {
    const a = utmToLatLon(548_726, 9_538_427);
    const b = utmToLatLon(548_826, 9_538_427);
    expect(distanceMeters(a, b)).toBeGreaterThan(99);
    expect(distanceMeters(a, b)).toBeLessThan(101);
  });
});

describe("medición", () => {
  it("calcula el diámetro equivalente y la altura con clinómetro", () => {
    expect(equivalentDiameter([38.2, 27.5])).toBeCloseTo(47.07, 1);
    expect(clinometerHeight(16, -5, 90)).toBeCloseTo(15.2, 5);
  });

  it("usa el factor de expansión de cada subparcela", () => {
    expect(categoryFactor("la")).toBeCloseTo(3.537, 3);
    expect(categoryFactor("ar")).toBeCloseTo(7.958, 3);
    expect(categoryFactor("br")).toBeCloseTo(31.831, 3);
  });

  it("da carbono negativo para brinzal con DAC < 0.4", () => {
    const small = carbonOf({
      category: "br",
      crownAvg: null,
      dacAvg: 0.3,
      dapEq: null,
      equationKey: null,
    });
    expect(small.total).toBeLessThan(0);
  });
});

describe("reglas", () => {
  const base = {
    category: "la" as const,
    codeLabel: "5",
    crownAvg: null,
    dacAvg: null,
    dapEq: 10,
    duplicate: false,
    gpsDistanceM: null,
    height: 8,
    notes: "",
    photoCount: 0,
    previous: null,
    species: { dapMax: 24.2, hMax: 17.5, id: 1, isNN: false, name: "Guayacán" },
  };

  it("evalúa alertas personalizadas por umbral", () => {
    const custom: RuleSetting = {
      active: true,
      custom: {
        action: "block_save",
        categories: ["la"],
        name: "Altura excesiva",
        operator: "gt",
        severity: "critical",
        variable: "height",
      },
      key: "custom:abc",
      param: 7,
    };
    const settings = [...defaultRuleSettings(), custom];
    const alerts = evaluateMeasurement(base, settings);
    expect(alerts.map((a) => a.rule)).toEqual(["custom:abc"]);
    expect(hasBlocking(alerts)).toBe(true);
    expect(
      evaluateMeasurement(base, [
        ...settings.slice(0, -1),
        { ...custom, active: false },
      ])
    ).toEqual([]);
    expect(
      evaluateMeasurement({ ...base, category: "fu" }, settings)
    ).not.toContainEqual(expect.objectContaining({ rule: "custom:abc" }));
  });

  it("no alerta con valores normales", () => {
    expect(evaluateMeasurement(base)).toEqual([]);
  });

  it("alerta DAP atípico y categoría incoherente", () => {
    const alerts = evaluateMeasurement({ ...base, dapEq: 70 });
    expect(alerts.map((a) => a.rule).sort()).toEqual(["cat", "dap"]);
    expect(hasBlocking(alerts)).toBe(true);
  });

  it("bloquea el código duplicado", () => {
    expect(hasBlocking(evaluateMeasurement({ ...base, duplicate: true }))).toBe(
      true
    );
  });
});

describe("normalización", () => {
  it("agrupa variantes de escritura", () => {
    const [group] = groupVariants([
      "Cabo Inga",
      "Cabo inga",
      "Cabo Inga",
      "cabo  inga",
    ]);
    expect(group?.canonical).toBe("Cabo Inga");
    expect(group?.variants.length).toBe(3);
  });

  it("corrige horas con a. m. / p. m.", () => {
    expect(normalizeTime("11: 10 a. m.")).toBe("11:10");
    expect(normalizeTime("2:05 p. m.")).toBe("14:05");
  });
});

describe("importación", () => {
  const grid = [
    [
      "N° de parcela",
      "Sector",
      "Categoría",
      "N°",
      "Especie",
      "DAP (cm)",
      "Altura total (m)",
      "Hora final",
    ],
    [
      30,
      "Cabo inga",
      "Latizal alto",
      "58.1",
      "Huarapo",
      16.2,
      8.6,
      "11: 10 a. m.",
    ],
    [30, "Cabo Inga", "Latizal alto", "58.2", "huarapo", 8, 6.8, ""],
    [30, "Cabo Inga", "Latizal alto", "58.2", "Huarapo", 8, 6.8, ""],
    [30, "Cabo Inga", "Latizal alto", "59", "Guayacán", 12, 9, ""],
  ];

  it("agrupa ejes, detecta duplicados y normaliza", () => {
    const mapping = autoMap(grid[0] as string[]);
    expect(mapping.plot).toBe(0);
    expect(mapping.dap).toBe(5);
    const preview = buildImportPreview(grid, mapping, {
      sectors: [],
      species: [],
    });
    expect(preview.records.length).toBe(2);
    expect(preview.records[0]?.stems).toEqual([16.2, 8]);
    expect(preview.blockedRows).toBe(1);
    expect(preview.warningRows).toBeGreaterThan(0);
  });
});

describe("estado sanitario", () => {
  it("reconoce las variantes escritas a mano", () => {
    expect(parseHealth("Quemados")).toBe("quemado");
    expect(parseHealth(" muerto en pie ")).toBe("muerto_pie");
    expect(parseHealth("Sano")).toBe("sano");
    expect(parseHealth("Dañado")).toBe("danado");
    expect(parseHealth("")).toBeNull();
    expect(parseHealth("xyz")).toBeNull();
  });

  it("no se exige en brinzales", () => {
    expect(healthRequired("br")).toBe(false);
    expect(healthRequired("fu")).toBe(true);
  });
});

describe("validación de altura", () => {
  it("acepta alturas dentro del rango y vacías", () => {
    expect(heightError(null)).toBeNull();
    expect(heightError(8.2)).toBeNull();
    expect(heightError(MAX_HEIGHT_M)).toBeNull();
  });

  it("rechaza cero, negativas y valores enormes", () => {
    expect(heightError(0)).not.toBeNull();
    expect(heightError(-3)).not.toBeNull();
    expect(heightError(MAX_HEIGHT_M + 0.1)).not.toBeNull();
    expect(heightError(9999)).not.toBeNull();
  });

  it("limpia el texto de un número positivo", () => {
    expect(sanitizePositiveDecimal("-12")).toBe("12");
    expect(sanitizePositiveDecimal("8,2")).toBe("8,2");
    expect(sanitizePositiveDecimal("8.2.5")).toBe("8.25");
    expect(sanitizePositiveDecimal("1e5")).toBe("15");
    expect(sanitizePositiveDecimal("abc")).toBe("");
  });
});
