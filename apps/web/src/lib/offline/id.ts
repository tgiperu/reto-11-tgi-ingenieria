const HEX_BASE = 16;
const UUID_VERSION_4 = 0x40;
const UUID_VARIANT = 0x80;

/**
 * UUID v4 para el `clientId` de cada registro.
 * `crypto.randomUUID` solo existe en contextos seguros (HTTPS o localhost): abierta por
 * `http://192.168.x.x` desde el celular no está definida, así que se arma con `getRandomValues`.
 */
export function newClientId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | UUID_VERSION_4;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | UUID_VARIANT;
  const hex = Array.from(bytes, (b) => b.toString(HEX_BASE).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}
