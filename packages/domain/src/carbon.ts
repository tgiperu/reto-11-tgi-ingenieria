import { type CategoryKey, categoryFactor } from "./categories";

const KG_PER_TONNE = 1000;

export interface Equations {
  arbusto: { a: number; b: number };
  biomassToCarbon: number;
  brinzal: { a: number; b: number };
  fustal: { c0: number; c1: number; c2: number };
  latizal: { a: number; b: number };
  overo: { a: number; b: number };
  rootRatioShrub: number;
  rootRatioTree: number;
}

export const DEFAULT_EQUATIONS: Equations = {
  arbusto: { a: 0.1151, b: 3.1299 },
  biomassToCarbon: 0.5,
  brinzal: { a: 0.0227, b: 0.0091 },
  fustal: { c0: 34.47, c1: -8.068, c2: 0.659 },
  latizal: { a: 0.2035, b: 2.3196 },
  overo: { a: 0.092, b: 2.912 },
  rootRatioShrub: 0.4,
  rootRatioTree: 0.27,
};

export type EquationKey = "overo" | null;

export interface CarbonInput {
  category: CategoryKey;
  crownAvg: number | null;
  dacAvg: number | null;
  dapEq: number | null;
  equationKey: EquationKey;
}

export interface CarbonResult {
  aerial: number;
  root: number;
  total: number;
}

const ZERO: CarbonResult = { aerial: 0, root: 0, total: 0 };

function withRoots(aerial: number, rootRatio: number): CarbonResult {
  const root = aerial * rootRatio;
  return { aerial, root, total: aerial + root };
}

/** Aporte del individuo a tC/ha (ya multiplicado por el factor de expansión de su subparcela). */
export function carbonOf(
  input: CarbonInput,
  eq: Equations = DEFAULT_EQUATIONS
): CarbonResult {
  const fe = categoryFactor(input.category);
  if (input.category === "la") {
    if (input.dapEq === null) {
      return ZERO;
    }
    const biomass =
      (eq.latizal.a * input.dapEq ** eq.latizal.b * fe) / KG_PER_TONNE;
    return withRoots(biomass * eq.biomassToCarbon, eq.rootRatioTree);
  }
  if (input.category === "fu") {
    if (input.dapEq === null) {
      return ZERO;
    }
    const d = input.dapEq;
    const biomass =
      ((eq.fustal.c0 + eq.fustal.c1 * d + eq.fustal.c2 * d * d) * fe) /
      KG_PER_TONNE;
    return withRoots(biomass * eq.biomassToCarbon, eq.rootRatioTree);
  }
  if (input.category === "ar") {
    if (input.crownAvg === null) {
      return ZERO;
    }
    const coef = input.equationKey === "overo" ? eq.overo : eq.arbusto;
    return withRoots(
      (coef.a * input.crownAvg ** coef.b * fe) / KG_PER_TONNE,
      eq.rootRatioShrub
    );
  }
  if (input.dacAvg === null) {
    return ZERO;
  }
  const aerial =
    ((eq.brinzal.a * input.dacAvg - eq.brinzal.b) * fe) / KG_PER_TONNE;
  return withRoots(aerial, eq.rootRatioShrub);
}

export interface FormulaText {
  name: string;
  text: string;
}

export function describeEquations(eq: Equations): FormulaText[] {
  const treeRoot = `C aéreo = B · ${eq.biomassToCarbon} · C subt. = C aéreo · ${eq.rootRatioTree}`;
  const shrubRoot = `C subt. = C aéreo · ${eq.rootRatioShrub}`;
  return [
    {
      name: "Latizal alto (árbol < 63 cm)",
      text: `B = ${eq.latizal.a} · D^${eq.latizal.b} · FE / 1000\n${treeRoot}`,
    },
    {
      name: "Fustal (árbol ≥ 63 cm)",
      text: `B = (${eq.fustal.c0} − ${Math.abs(eq.fustal.c1)}·D + ${eq.fustal.c2}·D²) · FE / 1000\n${treeRoot}`,
    },
    {
      name: "Arbusto grande",
      text: `C aéreo = ${eq.arbusto.a} · Dc^${eq.arbusto.b} · FE / 1000\n${shrubRoot}`,
    },
    {
      name: "Overo (arbusto)",
      text: `C aéreo = ${eq.overo.a} · Dc^${eq.overo.b} · FE / 1000\n${shrubRoot}`,
    },
    {
      name: "Brinzal",
      text: `C aéreo = (${eq.brinzal.a} · DAC − ${eq.brinzal.b}) · FE / 1000\n${shrubRoot} (alerta si DAC < 0.4 cm)`,
    },
  ];
}
