const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Si la web se abre desde otro equipo de la red (p. ej. el celular en `http://192.168.x.x:3001`),
 * `localhost` apuntaría al propio celular: se reemplaza por el host con el que se abrió la página.
 */
export function resolveServerUrl(url: string): string {
  if (typeof window === "undefined") {
    return url;
  }
  const target = new URL(url);
  const { hostname } = window.location;
  if (LOCAL_HOSTS.has(target.hostname) && !LOCAL_HOSTS.has(hostname)) {
    target.hostname = hostname;
  }
  return target.toString().replace(/\/$/, "");
}
