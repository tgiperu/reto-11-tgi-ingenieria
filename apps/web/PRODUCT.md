# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Brigadista** (campo, Tumbes y Piura): mide árboles, arbustos grandes y brinzales en parcelas de bosque seco, desde el celular, a pleno sol, muchas veces sin señal. Necesita registrar rápido y con pocos errores.
- **Supervisor** (escritorio): valida diámetros (DAP) y alturas atípicas, revisa el mapa y las parcelas. Su trabajo diario es el panel de validación.
- **Administrador** (escritorio): además corrige registros bloqueados con motivo y auditoría, gestiona catálogos y publica reglas de alerta.

## Product Purpose

Inventario forestal de bosque seco para AIDER: registro offline en campo y validación de atípicos en gestión, para la evaluación de parcelas adicionales de carbono (PNCAM y CCEAN). Éxito: datos limpios y trazables que llegan del celular al escritorio sin perder registros.

## Positioning

Las mismas reglas de alerta corren en el celular y en el servidor (`packages/domain`), así que lo que avisa en campo es lo que valida gestión al sincronizar. Una sola PWA con dos caras: campo (`/campo`) y gestión (`/`).

## Operating Context

Sincronización por lotes e idempotente; lo enviado queda bloqueado. Sesión guardada 30 días para abrir sin señal. Respaldo `.xlsx` desde el equipo. Exportación a Excel de atípicos (3 hojas). Importación de inventario histórico CSV/Excel.

## Capabilities and Constraints

Rutas: `/login`, `/` (panel), `/mapa`, `/parcelas`, `/catalogos`, `/alertas`, `/campo`, `/campo/instalar`, `/campo/registro`. Roles: `admin`, `supervisor`, `brigadista`. Español. Stack fijo: React 19, TanStack Router, Tailwind 4, MapLibre, Dexie. Debe seguir funcionando offline y en pantallas pequeñas.

## Brand Commitments

Solo el nombre AIDER es obligatorio. Paleta, logo, imagen de login y estilo pueden cambiar por completo (decisión del usuario). Activos existentes en `public/brand/` y `public/bg-login.webp` son material, no restricción.

## Evidence on Hand

Logo AIDER (`public/brand/aider-logo.png`, verde bosque y lema "Bosque manejado ¡Futuro asegurado!"), foto de brigadista midiendo un guayacán en floración (`public/bg-login.webp`), datos semilla (33 parcelas). No hay testimonios ni métricas reales.

## Product Principles

1. Ambos usuarios por igual: un solo lenguaje, dos densidades (campo grande y táctil; gestión densa y escaneable).
2. El flujo sigue el trabajo: lo diario (validar atípicos, registrar árboles) primero; configuración (catálogos, reglas) después.
3. Estado de conexión y de sincronización siempre claro; nunca perder datos en silencio.
4. Campo y gestión deben sentirse una sola herramienta, con tránsito evidente entre ambos.

## Accessibility & Inclusion

Uso a pleno sol: contraste alto, objetivos táctiles grandes, estados no dependientes solo del color.
