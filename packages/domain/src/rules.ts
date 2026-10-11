import {
  type CategoryKey,
  FUSTAL_MIN_DIAMETER_CM,
  isTreeCategory,
} from "./categories";

export type Severity = "warning" | "critical";
export type RuleScope = "app" | "server" | "both";
export type RuleAction =
  | "confirm"
  | "block_save"
  | "block_sync"
  | "flag"
  | "require_photo"
  | "fix_format";

export const RULE_KEYS = [
  "dap",
  "alt",
  "cat",
  "coord",
  "gps",
  "dup",
  "neg",
  "nn",
  "hora",
  "sp_prev",
  "dap_prev",
] as const;
export type RuleKey = (typeof RULE_KEYS)[number];

/** Clave de una regla creada por el administrador. */
export type CustomRuleKey = `custom:${string}`;

export const CUSTOM_VARIABLES = {
  crown: { label: "Copa promedio", unit: "m" },
  dac: { label: "DAC promedio", unit: "cm" },
  dap: { label: "DAP equivalente", unit: "cm" },
  height: { label: "Altura", unit: "m" },
} as const;
export type CustomVariable = keyof typeof CUSTOM_VARIABLES;

export const CUSTOM_OPERATORS = {
  gt: { label: "mayor que", symbol: ">" },
  lt: { label: "menor que", symbol: "<" },
} as const;
export type CustomOperator = keyof typeof CUSTOM_OPERATORS;

export const CUSTOM_ACTIONS = {
  block_save: "Impide guardar",
  confirm: "Pide re-medir o justificar",
  flag: "Marca para revisión",
} as const;
export type CustomAction = keyof typeof CUSTOM_ACTIONS;

/** Definición de una alerta por umbral; el valor del umbral va en `param` de la regla. */
export interface CustomRuleDef {
  action: CustomAction;
  /** `null` = todas las categorías. */
  categories: CategoryKey[] | null;
  name: string;
  operator: CustomOperator;
  severity: Severity;
  variable: CustomVariable;
}

export interface RuleMeta {
  action: RuleAction | CustomAction;
  actionLabel: string;
  defaultParam: number | null;
  description: string;
  key: RuleKey | CustomRuleKey;
  name: string;
  paramLabel: string;
  paramUnit: string;
  scope: RuleScope;
  scopeLabel: string;
  severity: Severity;
  severityLabel: string;
}

const SCOPE_LABELS: Record<RuleScope, string> = {
  app: "Solo app",
  both: "App + servidor",
  server: "Servidor",
};

function meta(
  base: Omit<RuleMeta, "scopeLabel"> & { scope: RuleScope }
): RuleMeta {
  return { ...base, scopeLabel: SCOPE_LABELS[base.scope] };
}

export const RULE_META: Record<RuleKey, RuleMeta> = {
  alt: meta({
    action: "confirm",
    actionLabel: "Pide re-medir o justificar",
    defaultParam: 15,
    description: "Latizal alto entre 1.5 y el máximo",
    key: "alt",
    name: "Altura atípica por categoría",
    paramLabel: "máx.",
    paramUnit: "m",
    scope: "both",
    severity: "warning",
    severityLabel: "Advertencia",
  }),
  cat: meta({
    action: "block_save",
    actionLabel: "Impide guardar",
    defaultParam: FUSTAL_MIN_DIAMETER_CM,
    description: "Fustal ≥ 63 cm · latizal < 63 cm · brinzal < 5 cm",
    key: "cat",
    name: "Categoría incoherente con el diámetro",
    paramLabel: "corte",
    paramUnit: "cm",
    scope: "both",
    severity: "critical",
    severityLabel: "Crítica",
  }),
  coord: meta({
    action: "block_sync",
    actionLabel: "Bloquea sincronización",
    defaultParam: 100,
    description: "Distancia entre coordenada de campo y de gabinete",
    key: "coord",
    name: "Coordenada lejos del punto planificado",
    paramLabel: ">",
    paramUnit: "m",
    scope: "both",
    severity: "warning",
    severityLabel: "Crítica si > 1 km",
  }),
  dap: meta({
    action: "confirm",
    actionLabel: "Pide re-medir o justificar",
    defaultParam: 3,
    description: "Fuera de media ± k·DE de la especie (latizal y fustal)",
    key: "dap",
    name: "DAP atípico por especie",
    paramLabel: "k =",
    paramUnit: "DE",
    scope: "both",
    severity: "warning",
    severityLabel: "Advertencia",
  }),
  dap_prev: meta({
    action: "confirm",
    actionLabel: "Pide re-medir",
    defaultParam: 1,
    description: "El árbol no puede encogerse: tolerancia de 1 cm",
    key: "dap_prev",
    name: "DAP menor que en la medición anterior",
    paramLabel: "tol.",
    paramUnit: "cm",
    scope: "both",
    severity: "warning",
    severityLabel: "Advertencia",
  }),
  dup: meta({
    action: "block_save",
    actionLabel: "Impide guardar",
    defaultParam: null,
    description: "N° (con ejes N.1, N.2…) único dentro de la parcela",
    key: "dup",
    name: "Código de individuo duplicado",
    paramLabel: "",
    paramUnit: "",
    scope: "both",
    severity: "critical",
    severityLabel: "Crítica",
  }),
  gps: meta({
    action: "flag",
    actionLabel: "Aviso en pantalla",
    defaultParam: 30,
    description: "El equipo está a más del radio de la parcela al registrar",
    key: "gps",
    name: "Posición GPS fuera de la parcela",
    paramLabel: ">",
    paramUnit: "m",
    scope: "app",
    severity: "warning",
    severityLabel: "Advertencia",
  }),
  hora: meta({
    action: "fix_format",
    actionLabel: "Corrige formato",
    defaultParam: null,
    description: "Hora de inicio / fin con formato HH:MM y fin > inicio",
    key: "hora",
    name: "Formato de hora inválido",
    paramLabel: "",
    paramUnit: "",
    scope: "both",
    severity: "warning",
    severityLabel: "Advertencia",
  }),
  neg: meta({
    action: "flag",
    actionLabel: "Marca para revisión",
    defaultParam: 0.4,
    description: "Brinzal con DAC < 0.4 cm produce valores negativos",
    key: "neg",
    name: "Carbono calculado negativo",
    paramLabel: "DAC mín.",
    paramUnit: "cm",
    scope: "both",
    severity: "critical",
    severityLabel: "Crítica",
  }),
  nn: meta({
    action: "require_photo",
    actionLabel: "Foto obligatoria",
    defaultParam: 1,
    description: "Exige al menos una foto y comentario",
    key: "nn",
    name: "Especie no identificada (NN)",
    paramLabel: "fotos",
    paramUnit: "",
    scope: "app",
    severity: "warning",
    severityLabel: "Advertencia",
  }),
  sp_prev: meta({
    action: "confirm",
    actionLabel: "Pide confirmar la especie",
    defaultParam: null,
    description: "En una remedición la especie difiere de la registrada antes",
    key: "sp_prev",
    name: "Especie distinta a la medición anterior",
    paramLabel: "",
    paramUnit: "",
    scope: "both",
    severity: "warning",
    severityLabel: "Advertencia",
  }),
};

export const RULE_LIST: RuleMeta[] = RULE_KEYS.map((key) => RULE_META[key]);

/** Parte editable de una regla (lo que guarda y publica el administrador). */
export interface RuleSetting {
  active: boolean;
  /** Solo en reglas personalizadas. */
  custom?: CustomRuleDef | null;
  key: RuleKey | CustomRuleKey;
  param: number | null;
}

export function isCustomKey(key: string): key is CustomRuleKey {
  return key.startsWith("custom:");
}

/** Ficha de una regla personalizada con el mismo formato que las integradas. */
export function customRuleMeta(setting: RuleSetting): RuleMeta | null {
  const def = setting.custom;
  if (!def) {
    return null;
  }
  const variable = CUSTOM_VARIABLES[def.variable];
  const operator = CUSTOM_OPERATORS[def.operator];
  const where =
    def.categories === null
      ? "todas las categorías"
      : def.categories.join(", ");
  return {
    action: def.action,
    actionLabel: CUSTOM_ACTIONS[def.action],
    defaultParam: setting.param,
    description: `${variable.label} ${operator.label} el umbral · ${where}`,
    key: setting.key,
    name: def.name,
    paramLabel: operator.symbol,
    paramUnit: variable.unit,
    scope: "both",
    scopeLabel: SCOPE_LABELS.both,
    severity: def.severity,
    severityLabel: def.severity === "critical" ? "Crítica" : "Advertencia",
  };
}

export function defaultRuleSettings(): RuleSetting[] {
  return RULE_LIST.map((m) => ({
    active: true,
    key: m.key,
    param: m.defaultParam,
  }));
}

export interface RuleAlert {
  /** Impide guardar (o sincronizar) mientras no se corrija. */
  blocking: boolean;
  rule: RuleKey | CustomRuleKey;
  severity: Severity;
  text: string;
  title: string;
}

export interface EvalSpecies {
  dapMax: number | null;
  hMax: number | null;
  id: number | null;
  isNN: boolean;
  name: string;
}

export interface EvalPrevious {
  dapEq: number | null;
  speciesId: number | null;
  speciesName: string;
}

export interface EvalInput {
  category: CategoryKey;
  codeLabel: string;
  crownAvg: number | null;
  dacAvg: number | null;
  dapEq: number | null;
  duplicate: boolean;
  gpsDistanceM: number | null;
  height: number | null;
  notes: string;
  photoCount: number;
  previous: EvalPrevious | null;
  species: EvalSpecies | null;
}

const MIN_LATIZAL_HEIGHT_M = 1.5;
const MIN_SEEDLING_DAC_CM = 0.4;

type Lookup = (key: RuleKey) => { active: boolean; param: number | null };

function lookupFor(settings: readonly RuleSetting[]): Lookup {
  const map = new Map(settings.map((s) => [s.key, s]));
  return (key) => {
    const found = map.get(key);
    if (found) {
      return { active: found.active, param: found.param };
    }
    return { active: true, param: RULE_META[key].defaultParam };
  };
}

function blocks(key: RuleKey): boolean {
  const { action } = RULE_META[key];
  return action === "block_save" || action === "require_photo";
}

function makeAlert(
  rule: RuleKey,
  severity: Severity,
  title: string,
  text: string
): RuleAlert {
  return { blocking: blocks(rule), rule, severity, text, title };
}

function cm(value: number): string {
  return `${value.toFixed(2)} cm`;
}

function customValue(
  input: EvalInput,
  variable: CustomVariable
): number | null {
  switch (variable) {
    case "dap":
      return input.dapEq;
    case "height":
      return input.height;
    case "crown":
      return input.crownAvg;
    default:
      return input.dacAvg;
  }
}

/** Alertas por umbral creadas por el administrador (misma función en campo y servidor). */
export function evaluateCustomRules(
  input: EvalInput,
  settings: readonly RuleSetting[]
): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  for (const setting of settings) {
    const def = setting.custom;
    if (!(def && setting.active) || setting.param === null) {
      continue;
    }
    if (def.categories !== null && !def.categories.includes(input.category)) {
      continue;
    }
    const value = customValue(input, def.variable);
    if (value === null) {
      continue;
    }
    const hit =
      def.operator === "gt" ? value > setting.param : value < setting.param;
    if (!hit) {
      continue;
    }
    const { label, unit } = CUSTOM_VARIABLES[def.variable];
    const { symbol } = CUSTOM_OPERATORS[def.operator];
    alerts.push({
      blocking: def.action === "block_save",
      rule: setting.key,
      severity: def.severity,
      text: `${label} ${value.toFixed(2)} ${unit} ${symbol} ${setting.param} ${unit}. Verifica la medición.`,
      title: def.name,
    });
  }
  return alerts;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: muchas reglas de negocio o ramas de presentación que no ganan claridad al dividirse
export function evaluateMeasurement(
  input: EvalInput,
  settings: readonly RuleSetting[] = defaultRuleSettings()
): RuleAlert[] {
  const rule = lookupFor(settings);
  const alerts: RuleAlert[] = [];
  const isTree = isTreeCategory(input.category);
  const eq = input.dapEq;
  const sp = input.species;

  const dapLimit = sp?.dapMax ?? null;
  if (
    sp &&
    rule("dap").active &&
    isTree &&
    eq !== null &&
    dapLimit !== null &&
    eq > dapLimit
  ) {
    alerts.push(
      makeAlert(
        "dap",
        "warning",
        `DAP atípico para ${sp.name}`,
        `${cm(eq)} supera el límite de ${dapLimit} cm. Vuelve a medir o justifica con una foto.`
      )
    );
  }

  const cut = rule("cat").param ?? FUSTAL_MIN_DIAMETER_CM;
  if (rule("cat").active && eq !== null && eq > 0) {
    if (input.category === "la" && eq >= cut) {
      alerts.push(
        makeAlert(
          "cat",
          "critical",
          "Debería ser Fustal",
          `Con DAP ≥ ${cut} cm la categoría es Fustal. Cámbiala en el campo Categoría.`
        )
      );
    }
    if (input.category === "fu" && eq < cut) {
      alerts.push(
        makeAlert(
          "cat",
          "critical",
          "Debería ser Latizal alto",
          `Con DAP menor a ${cut} cm la categoría es Latizal alto.`
        )
      );
    }
  }

  const negLimit = rule("neg").param ?? MIN_SEEDLING_DAC_CM;
  if (
    rule("neg").active &&
    input.category === "br" &&
    input.dacAvg !== null &&
    input.dacAvg < negLimit
  ) {
    alerts.push(
      makeAlert(
        "neg",
        "critical",
        "DAC demasiado pequeño",
        `Con DAC menor a ${negLimit} cm la fórmula da carbono negativo. Verifica la medición.`
      )
    );
  }

  const heightRule = rule("alt");
  if (heightRule.active && input.height !== null && input.category !== "br") {
    const limit =
      sp?.hMax ?? (input.category === "fu" ? null : heightRule.param);
    if (limit !== null && input.height > limit) {
      alerts.push(
        makeAlert(
          "alt",
          "warning",
          "Altura atípica",
          `${input.height.toFixed(2)} m supera el máximo de ${limit} m para ${sp && sp.hMax !== null ? sp.name : "esta categoría"}.`
        )
      );
    }
    if (
      input.category === "la" &&
      input.height > 0 &&
      input.height < MIN_LATIZAL_HEIGHT_M
    ) {
      alerts.push(
        makeAlert(
          "alt",
          "warning",
          "Altura menor al mínimo",
          `${input.height.toFixed(2)} m es menor a ${MIN_LATIZAL_HEIGHT_M} m, el mínimo de un latizal alto.`
        )
      );
    }
  }

  if (rule("dup").active && input.duplicate) {
    alerts.push(
      makeAlert(
        "dup",
        "critical",
        `N° ${input.codeLabel} ya existe en esta parcela`,
        "No se puede guardar dos veces el mismo código. Revisa el número de la placa."
      )
    );
  }

  const gps = rule("gps");
  if (
    gps.active &&
    input.gpsDistanceM !== null &&
    input.gpsDistanceM > (gps.param ?? 0)
  ) {
    alerts.push(
      makeAlert(
        "gps",
        "warning",
        "Estás lejos de la parcela",
        `El equipo está a ${Math.round(input.gpsDistanceM)} m del centro de la parcela seleccionada.`
      )
    );
  }

  if (rule("nn").active && sp?.isNN) {
    const needed = rule("nn").param ?? 1;
    const hasComment = input.notes.trim() !== "";
    if (input.photoCount < needed || !hasComment) {
      alerts.push(
        makeAlert(
          "nn",
          "warning",
          "Especie sin identificar (NN)",
          "Agrega al menos una foto y un comentario que ayude a identificarla."
        )
      );
    }
  }

  alerts.push(...evaluateCustomRules(input, settings));

  const prev = input.previous;
  if (
    rule("sp_prev").active &&
    prev &&
    prev.speciesId !== null &&
    sp &&
    sp.id !== null &&
    prev.speciesId !== sp.id
  ) {
    alerts.push(
      makeAlert(
        "sp_prev",
        "warning",
        "Especie distinta a la anterior",
        `En la medición anterior se registró como ${prev.speciesName}. Confirma la especie o corrígela.`
      )
    );
  }
  const tol = rule("dap_prev").param ?? 0;
  if (
    rule("dap_prev").active &&
    prev &&
    isTree &&
    eq !== null &&
    prev.dapEq !== null &&
    eq < prev.dapEq - tol
  ) {
    alerts.push(
      makeAlert(
        "dap_prev",
        "warning",
        "DAP menor que en la medición anterior",
        `${cm(eq)} frente a ${cm(prev.dapEq)} antes. Vuelve a medir en la marca de pintura.`
      )
    );
  }

  return alerts;
}

export const COORD_CRITICAL_M = 1000;

export interface PlotCoordCheck {
  deviationM: number | null;
}

/** Regla de nivel parcela: coordenada de campo vs. punto de gabinete. */
export function evaluatePlotCoordinates(
  check: PlotCoordCheck,
  settings: readonly RuleSetting[] = defaultRuleSettings()
): RuleAlert | null {
  const rule = lookupFor(settings)("coord");
  if (
    !rule.active ||
    check.deviationM === null ||
    check.deviationM <= (rule.param ?? 0)
  ) {
    return null;
  }
  const critical = check.deviationM > COORD_CRITICAL_M;
  return {
    blocking: critical,
    rule: "coord",
    severity: critical ? "critical" : "warning",
    text: `La parcela quedó a ${Math.round(check.deviationM)} m del punto de gabinete.`,
    title: "Coordenada lejos del punto planificado",
  };
}

export function hasBlocking(alerts: readonly RuleAlert[]): boolean {
  return alerts.some((a) => a.blocking);
}
