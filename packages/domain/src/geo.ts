const WGS84_A = 6_378_137;
const WGS84_F = 1 / 298.257_223_563;
const UTM_K0 = 0.9996;
const UTM_FALSE_EASTING = 500_000;
const UTM_FALSE_NORTHING_SOUTH = 10_000_000;
const EARTH_RADIUS_M = 6_371_008.8;
const UTM_ZONE_WIDTH_DEG = 6;
const UTM_ZONE_CENTER_OFFSET_DEG = 183;
const METERS_PER_KM = 1000;
const RAD = Math.PI / 180;

export interface LatLon {
  lat: number;
  lon: number;
}

/** UTM WGS84 (Krüger) → lat/lon. Zona 17 sur por defecto (Tumbes y Piura). */
export function utmToLatLon(
  easting: number,
  northing: number,
  zone = 17,
  south = true
): LatLon {
  const n = WGS84_F / (2 - WGS84_F);
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n3 * n;
  const bigA = (WGS84_A / (1 + n)) * (1 + n2 / 4 + n4 / 64);
  const beta = [
    n / 2 - (2 * n2) / 3 + (37 * n3) / 96 - n4 / 360,
    n2 / 48 + n3 / 15 - (437 * n4) / 1440,
    (17 * n3) / 480 - (37 * n4) / 840,
    (4397 * n4) / 161_280,
  ];
  const delta = [
    2 * n - (2 * n2) / 3 - 2 * n3 + (116 * n4) / 45,
    (7 * n2) / 3 - (8 * n3) / 5 - (227 * n4) / 45,
    (56 * n3) / 15 - (136 * n4) / 35,
    (4279 * n4) / 630,
  ];
  const xi =
    (northing - (south ? UTM_FALSE_NORTHING_SOUTH : 0)) / (UTM_K0 * bigA);
  const eta = (easting - UTM_FALSE_EASTING) / (UTM_K0 * bigA);
  let xiP = xi;
  let etaP = eta;
  for (const [i, b] of beta.entries()) {
    const j = 2 * (i + 1);
    xiP -= b * Math.sin(j * xi) * Math.cosh(j * eta);
    etaP -= b * Math.cos(j * xi) * Math.sinh(j * eta);
  }
  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  let phi = chi;
  for (const [i, d] of delta.entries()) {
    phi += d * Math.sin(2 * (i + 1) * chi);
  }
  const lon0 = zone * UTM_ZONE_WIDTH_DEG - UTM_ZONE_CENTER_OFFSET_DEG;
  const lambda = lon0 * RAD + Math.atan2(Math.sinh(etaP), Math.cos(xiP));
  return { lat: phi / RAD, lon: lambda / RAD };
}

export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function utmDistanceMeters(
  e1: number,
  n1: number,
  e2: number,
  n2: number
): number {
  return Math.hypot(e1 - e2, n1 - n2);
}

export function formatDistance(meters: number): string {
  if (meters >= METERS_PER_KM) {
    return `${(meters / METERS_PER_KM).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}
