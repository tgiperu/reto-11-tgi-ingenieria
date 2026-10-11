export const ROLES = ["admin", "supervisor", "brigadista"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  brigadista: "Brigadista",
  supervisor: "Supervisor",
};

export const STRATA = [
  "Bosque denso",
  "Bosque semidenso",
  "Bosque ralo",
  "Matorral",
  "Incendio",
] as const;
export type Stratum = (typeof STRATA)[number];

export const ANPS = ["PNCAM", "CCEAN"] as const;
export type Anp = (typeof ANPS)[number];

export const ANP_LABELS: Record<Anp, string> = {
  CCEAN: "CC El Angolo",
  PNCAM: "PN Cerros de Amotape",
};

/** Estados de una parcela. `locked` y `unlocked` hablan del candado de edición. */
export const PLOT_STATUSES = [
  "assigned",
  "review",
  "alert",
  "locked",
  "unlocked",
] as const;
export type PlotStatus = (typeof PLOT_STATUSES)[number];

export const PLOT_STATUS_LABELS: Record<PlotStatus, string> = {
  alert: "Con alertas",
  assigned: "Asignada",
  locked: "Bloqueada",
  review: "En revisión",
  unlocked: "Desbloqueada",
};

export const REVIEW_STATES = [
  "none",
  "pending",
  "justified",
  "accepted",
  "remeasure",
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_LABELS: Record<ReviewState, string> = {
  accepted: "Aceptada",
  justified: "Justificada con foto",
  none: "Sin alertas",
  pending: "Por revisar",
  remeasure: "Re-medición pedida",
};

export function isOpenReview(state: ReviewState): boolean {
  return state === "pending" || state === "justified";
}

export const NN_SPECIES_NAME = "NN (no identificada)";
