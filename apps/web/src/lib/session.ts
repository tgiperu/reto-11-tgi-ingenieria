import type { Role } from "@reto-11-tgi-ingenieria/domain/constants";

import { authClient } from "./auth-client";

const STORAGE_KEY = "inventario.session";
const OFFLINE_VALID_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export interface CachedSession {
  savedAt: number;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    brigadeId: string | null;
  };
}

function toRole(value: string | null | undefined): Role {
  return value === "admin" || value === "supervisor" ? value : "brigadista";
}

function readCache(): CachedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedSession;
    const ageDays = (Date.now() - parsed.savedAt) / MS_PER_DAY;
    return ageDays <= OFFLINE_VALID_DAYS ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(session: CachedSession | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Sin almacenamiento disponible: la sesión simplemente no se guarda para uso sin conexión.
  }
}

export function getCachedSession(): CachedSession | null {
  return readCache();
}

/**
 * Sesión actual. Con conexión se valida en el servidor; sin ella (o si el servidor no responde)
 * se usa la sesión guardada en el equipo, válida 30 días, para poder trabajar en campo.
 */
export async function loadSession(): Promise<CachedSession | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return readCache();
  }
  try {
    const res = await authClient.getSession();
    if (res.data) {
      const { user } = res.data;
      const session: CachedSession = {
        savedAt: Date.now(),
        user: {
          brigadeId: user.brigadeId ?? null,
          email: user.email,
          id: user.id,
          name: user.name,
          role: toRole(user.role),
        },
      };
      writeCache(session);
      return session;
    }
    const status = res.error?.status ?? 0;
    if (status === 0 || status >= 500) {
      return readCache();
    }
    writeCache(null);
    return null;
  } catch {
    return readCache();
  }
}

export async function signOut(): Promise<void> {
  writeCache(null);
  try {
    await authClient.signOut();
  } catch {
    // Sin conexión: la cookie vence sola; ya borramos la copia local.
  }
}
