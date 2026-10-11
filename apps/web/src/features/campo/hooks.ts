import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";

import { campoDb, getBundleMeta } from "@/lib/offline/db";

const CLOCK_MS = 30_000;

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function usePendingCount(): number {
  return useLiveQuery(
    () => campoDb.records.where("sent").equals(0).count(),
    [],
    0
  );
}

export function useBundleMeta() {
  return useLiveQuery(() => getBundleMeta(), [], undefined);
}

export interface GpsFix {
  accuracy: number;
  lat: number;
  lon: number;
}

/** Posición del equipo (alta precisión). `null` hasta tener la primera lectura o si no hay permiso. */
export function useGeolocation(): GpsFix | null {
  const [fix, setFix] = useState<GpsFix | null>(null);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setFix({
          accuracy: pos.coords.accuracy,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      () => setFix(null),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return fix;
}
