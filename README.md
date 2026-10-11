# Inventario Forestal AIDER

PWA de inventario forestal de bosque seco (Tumbes y Piura). **Una sola aplicación responsiva** con dos caras:

- **Modo campo** (celular, `/campo`): el brigadista registra árboles, arbustos y brinzales **sin conexión**; todo queda en el equipo y se envía al sincronizar.
- **Gestión** (escritorio, `/`): supervisor y administrador validan diámetros y alturas atípicas, miran el mapa, importan el inventario histórico, administran catálogos y reglas de alerta.

El diseño de referencia vive en el artefacto de Claude "Inventario Forestal AIDER – Mockups MVP".

## Pantallas

| Ruta | Rol | Qué hace |
| --- | --- | --- |
| `/login` | todos | Ingreso con correo y contraseña (no hay registro público). |
| `/` | supervisor, admin | Panel: indicadores, rango esperado por especie, mediciones atípicas en vivo, exportación a Excel. |
| `/mapa` | supervisor, admin | Parcelas sobre OpenStreetMap (MapLibre), detalle por parcela. |
| `/parcelas` | supervisor, admin | Lista, registros por categoría, auditoría, bloqueo/desbloqueo, corrección (admin), importación CSV/Excel. |
| `/catalogos` | supervisor (lectura), admin | Especies, brigadas, sectores (con fusión de variantes), categorías y ecuaciones de carbono. |
| `/alertas` | supervisor (lectura), admin | Reglas versionadas, rango por especie, prueba contra datos históricos, publicación. |
| `/campo` | todos | Inicio del brigadista. |
| `/campo/instalar` | todos | Instalar la app y descargar parcelas, catálogos y reglas para trabajar sin señal. |
| `/campo/registro` | todos | Formulario de registro con búsqueda de parcela, categoría y especie. |

## Cómo funciona el trabajo sin conexión

- **Service worker** (`vite-plugin-pwa`) precarga la app; los mosaicos del mapa se guardan al verlos.
- **IndexedDB** (Dexie, `apps/web/src/lib/offline`) guarda parcelas asignadas, especies, reglas, códigos existentes y la cola de registros.
- Las reglas de alerta son las **mismas funciones** en el celular y en el servidor (`packages/domain`), así que lo que avisa en campo es lo que valida el servidor al sincronizar.
- **Sincronizar** (botón de la barra superior) envía por lotes, es idempotente (cada registro lleva un `clientId`) y vuelve a descargar catálogos. Lo enviado queda **bloqueado**: solo un administrador lo corrige desde escritorio, con motivo y auditoría.
- La sesión se guarda en el equipo 30 días para poder abrir la app sin señal.
- **Respaldo**: el botón de descarga de la barra superior genera un `.xlsx` con todo lo guardado en el equipo.

## Estructura

```
apps/
  web/        React + TanStack Router + Tailwind (PWA)
  server/     Hono + tRPC + Better Auth (+ seed)
packages/
  domain/     reglas, carbono, UTM, importación: funciones puras compartidas por web y servidor
  api/        routers tRPC (alerts, catalog, dashboard, imports, plots, sync)
  db/         esquema Drizzle (PostgreSQL / Neon)
  auth/       configuración de Better Auth (roles `admin`, `supervisor`, `brigadista`)
  ui/         primitivas shadcn compartidas
```

## Puesta en marcha

```bash
bun install
bun run db:push     # crea las tablas
bun run db:seed     # brigadas, sectores, 33 parcelas, especies, reglas y cuentas de prueba
bun run dev         # servidor en :3000 y web en :3001
```

Variables: `apps/server/.env` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`) y `apps/web/.env` (`VITE_SERVER_URL`).

`db:seed` crea una cuenta por rol (`romy.periche@aider.test` admin, `manuel.llanos@aider.test` supervisor, `segundo.ruiz@aider.test` brigadista…). La contraseña sale de `SEED_PASSWORD`; si no está definida se usa el valor de desarrollo de `apps/server/src/seed.ts`. **Cámbiala fuera de desarrollo.**

### Primer uso con datos reales

1. Entra como administrador → **Parcelas → Importar archivo** y sube `Base de datos Inventario Octubre 2024_v1.xlsx` (o un CSV con las columnas de la plantilla). El asistente mapea columnas, normaliza sectores y especies, agrupa los ejes `N.1, N.2…` de cada árbol, detecta duplicados y recalcula el carbono.
2. Al terminar se recalculan los rangos por especie (media ± k·DE) y las alertas.
3. Para abrir una campaña de re-medición: **Parcelas → elige la parcela → Asignar a brigada**. La brigada la recibe al sincronizar.

## Reglas de negocio

- Categorías: Latizal alto (DAP < 63 cm, r 30 m), Fustal (≥ 63 cm, r 30 m), Arbusto grande (copa ≥ 40 cm, r 20 m), Brinzal (DAP < 5 cm, r 10 m, se mide DAC). Factor de expansión = 1 / área de la subparcela (ha).
- Diámetro equivalente de árboles con varios ejes: √(Σd²).
- Ecuaciones de carbono: `packages/domain/src/carbon.ts` (editables por el administrador en Catálogos; al guardar se recalcula todo).
- Reglas de alerta: `packages/domain/src/rules.ts`. Las críticas con acción "impide guardar" (categoría incoherente, código duplicado) bloquean el guardado en campo; las advertencias piden confirmar y quedan **por revisar** (o **justificadas con foto**).
- Coordenadas: UTM WGS84 zona 17S, convertidas a lat/lon en `packages/domain/src/geo.ts`.

## Comandos

```bash
bun run check          # ultracite (lint + formato)
bun run fix            # corrige lo automático
bun run check-types    # tipos de todo el monorepo
(cd packages/domain && bun test)   # pruebas del dominio
bun run db:studio      # explorar la base
bun run docker:up      # web (nginx) + servidor en contenedores
```

## Notas y límites conocidos

- Las fotos se guardan en la base como base64 (~300 KB tras comprimirlas en el equipo). Si el volumen crece, muévelas a almacenamiento de objetos y guarda solo la URL en `measurement_photo`.
- El mapa usa los mosaicos públicos de OpenStreetMap; para operación intensiva conviene un proveedor propio. Los límites de las ANP se muestran si existe `apps/web/public/geo/anp.geojson` (no se incluye).
- La gestión de usuarios se hace con `db:seed` o directamente en la base; no hay pantalla de administración de cuentas.
- El panel arranca con el periodo "Todo el periodo" (el diseño mostraba "Hoy") para que el histórico importado sea visible.
