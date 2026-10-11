---
version: 1
slug: "src-main-tsx"
primary_target: "src/main.tsx"
related_targets: []
---

# Surface brief: app completa (gestión + campo)

Modo: Operate. Alcance: toda la PWA (login, gestión, campo). Redesign: reemplaza el verde bosque/crema anterior.

Audiencia y tarea: supervisores validan atípicos en escritorio; brigadistas registran árboles en celular, a pleno sol, offline. Ambos por igual.

Dirección elegida: «Manual de pestañas» (rw-manual-acetate-tab-board). Mundo = manual de software con divisores de color y hojas de acetato.

Memorable: el tablero de color de la sección activa asoma detrás de una hoja lechosa con una sombra dura corta en su lado cortado.

Decisiones abiertas: ninguna de producto.

## Direction contract

THESIS: Cada sección es una división de un manual con su propio color pleno; la hoja de trabajo flota sobre ese tablero. Rechaza el panel gris con un acento y la barra lateral verde oscura.
OWN-WORLD: Tablero por sección: Panel amarillo cromo, Mapa ultramar, Parcelas verde pasto, Alertas naranja óxido, Catálogos violeta, Campo verde azulado; hoja lechosa #F7F6F2 sobre fondo #ECEAE2, tinta #1B1B18; Public Sans, Source Serif 4 para texto largo, JetBrains Mono para cifras. Bermellón reservado a errores. Nada cambia con transiciones suaves: pasos secos de 90 ms.
STORY: El supervisor sabe en qué división está por el color antes de leer; lo diario (Panel, Mapa, Parcelas) va antes que lo de configuración (Alertas, Catálogos); el brigadista ve siempre si puede salir sin señal y qué falta por enviar.
FIRST VIEWPORT: Barra superior blanca de 56px con logo AIDER, cinco pestañas con cuadrito de color, estado de conexión y botón «Modo campo». Debajo, tablero de 120px teñido con el nombre de la sección; encima, la hoja lechosa con título, filtros, banda de indicadores que filtran la lista y la lista de atípicos. Acción primaria en tinta a la derecha del título. En celular: barra inferior de pestañas y el tablero reducido a una franja.
FORM: Manual de pestañas, challenger 3 de la mano, semilla bfa582ee.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
