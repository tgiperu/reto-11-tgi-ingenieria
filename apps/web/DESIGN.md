---
name: Inventario Forestal AIDER
description: Manual de pestañas. Cada sección es un divisor de color pleno y la hoja de trabajo lechosa flota encima.
colors:
  ink: "#1b1b18"
  ink-2: "#3f3e38"
  ink-3: "#5e5c54"
  paper: "#ece9e1"
  sheet: "#f7f6f2"
  sunken: "#efede5"
  line: "#dad7cc"
  line-2: "#e6e3d8"
  edge: "#bdb9aa"
  field: "#8a8678"
  white: "#ffffff"
  primary: "#1b1b18"
  primary-2: "#34332d"
  sec-panel: "#f2b705"
  sec-mapa: "#1d3e8f"
  sec-parcelas: "#257a4a"
  sec-alertas: "#d2420e"
  sec-catalogos: "#6b3fa0"
  sec-campo: "#0e7c86"
  ok: "#257a4a"
  ok-bg: "#e0efe5"
  ok-fg: "#14522f"
  ok-band: "#9cc9ae"
  warn: "#d9730d"
  warn-deep: "#a8540a"
  warn-bg: "#fcebd0"
  warn-fg: "#6e3b00"
  warn-edge: "#ebc08a"
  info: "#1d3e8f"
  info-bg: "#e1e7f6"
  info-fg: "#17316f"
  crit: "#c8281e"
  crit-bg: "#fbe3de"
  crit-fg: "#8a1c12"
typography:
  display:
    fontFamily: "Public Sans Variable, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Public Sans Variable, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Public Sans Variable, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  prose:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Public Sans Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.33
  table-head:
    fontFamily: "Public Sans Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.05em"
  figure:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "tabular-nums"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "24px 32px 40px"
  panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-2}"
  button-primary-lg:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    height: "56px"
    padding: "0 20px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-secondary-hover:
    backgroundColor: "{colors.sunken}"
  button-danger:
    backgroundColor: "{colors.white}"
    textColor: "{colors.crit-fg}"
    rounded: "{rounded.md}"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.crit-bg}"
  button-warn:
    backgroundColor: "{colors.warn-deep}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    height: "44px"
  button-field-mode:
    backgroundColor: "{colors.sec-campo}"
    textColor: "{colors.white}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 14px"
  chip-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-fg}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  chip-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-fg}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  chip-crit:
    backgroundColor: "{colors.crit-bg}"
    textColor: "{colors.crit-fg}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  chip-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.info-fg}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 12px"
  filter-chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  table-head-cell:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-3}"
    typography: "{typography.table-head}"
    padding: "10px 8px"
  status-bar-ok:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
  status-bar-offline:
    backgroundColor: "{colors.warn}"
    textColor: "{colors.ink}"
  status-bar-syncing:
    backgroundColor: "{colors.info}"
    textColor: "{colors.white}"
---

# Design System: Inventario Forestal AIDER

## Overview

**Creative North Star: "El Manual de Pestañas"**

La interfaz es un manual de software con divisores de color. Cada sección tiene un tablero de color pleno (Panel amarillo cromo, Mapa ultramar, Parcelas verde pasto, Alertas naranja óxido, Catálogos violeta, Campo verde azulado) y la hoja de trabajo, una hoja lechosa, flota encima con una sombra dura y corta en su lado cortado. El supervisor sabe en qué división está por el color antes de leer. Rechaza el panel gris con un solo acento y la barra lateral verde oscura.

El sistema sirve a dos densidades con un solo lenguaje: gestión densa y escaneable en escritorio, campo grande y táctil en celular a pleno sol. Todo es plano y de tinta casi negra sobre papel cálido; el color pleno se concentra en el tablero de sección y en los estados. Los cambios de estado no se suavizan: ocurren en pasos secos de 90 ms.

**Key Characteristics:**
- Un color pleno por sección, fijado con `data-sec` y expuesto como `--sec` / `--sec-ink`.
- Hoja lechosa (#f7f6f2) sobre papel (#ece9e1); tinta #1b1b18 como único color de acción.
- Tres voces tipográficas: Public Sans (interfaz), Source Serif 4 (texto largo), JetBrains Mono (cifras).
- Severidad nunca solo por color: etiqueta, icono o trama diagonal acompañan.
- Estado de conexión y de envío siempre visible.

## Colors

Papel cálido y tinta casi negra con seis tableros plenos y un juego de estados sobrios.

### Primary
- **Tinta de Manual** (#1b1b18): texto, botones primarios, foco y chip sólido. Es el único color de acción; la sección no tiñe los botones.

### Secondary (tableros de sección)
- **Amarillo Cromo** (#f2b705): Panel; tinta oscura encima.
- **Ultramar** (#1d3e8f): Mapa; también es el tono informativo.
- **Verde Pasto** (#257a4a): Parcelas; también es el tono de éxito.
- **Naranja Óxido** (#d2420e): Alertas; tinta blanca encima.
- **Violeta de Catálogo** (#6b3fa0): Catálogos.
- **Verde Azulado de Campo** (#0e7c86): Campo y el botón «Modo campo».

### Neutral
- **Papel** (#ece9e1): fondo de página y tablero base.
- **Hoja Lechosa** (#f7f6f2): superficie de trabajo.
- **Hundido** (#efede5): cabeceras de tabla, vacíos, hover de secundarios.
- **Línea** (#dad7cc) y **Línea 2** (#e6e3d8): bordes y divisores finos.
- **Borde de Control** (#bdb9aa): contorno de campos y filtros.
- **Tinta 2** (#3f3e38) y **Tinta 3** (#5e5c54): texto secundario y etiquetas.

### Estados
- Éxito: fondo #e0efe5, texto #14522f, trazo #257a4a.
- Aviso: fondo #fcebd0, texto #6e3b00, trazo #d9730d; botón sólido en #a8540a.
- Info: fondo #e1e7f6, texto #17316f, trazo #1d3e8f.
- Error: fondo #fbe3de, texto #8a1c12, trazo #c8281e.

### Named Rules
**The Bermellón Rule.** El rojo (#c8281e) es de errores. No es decoración ni acento de sección; el naranja óxido de Alertas es otro tono y otra función.
**The Tablero Rule.** El color de sección vive en el tablero, la cuña de pestaña activa y el cuadrito de la pestaña. Los botones y controles se quedan en tinta.
**The Not-Color-Alone Rule.** Toda severidad se duplica con texto, icono o la trama diagonal `.trama`.

## Typography

**Display Font:** Public Sans Variable (con system-ui, sans-serif)
**Body Font:** Public Sans Variable; Source Serif 4 Variable (con Georgia) para subtítulos y texto largo
**Label/Mono Font:** JetBrains Mono Variable (con ui-monospace)

**Character:** Una grotesca neutra y legible para la interfaz, una serif editorial para lo que se lee en frases, y monoespaciada para toda cifra de datos.

### Hierarchy
- **Display** (700, 30px, 1.25, -0.025em): título del login.
- **Headline** (700, 26px, 1.25, -0.025em): título de página (`PageHeader`).
- **Body** (400, 14px, 1.5): interfaz general; tablas en 13px.
- **Prose** (Source Serif 4, 400, 15px, 1.625, máx. 68ch): subtítulos y explicaciones.
- **Label** (600, 12px): etiquetas de campo y chips; botones 13/14/16px en semibold/bold.
- **Table head** (600, 12px, 0.05em, mayúsculas): cabeceras de tabla.
- **Figure** (JetBrains Mono, 13px, tabulares): cifras, horas, DAP, alturas.

### Named Rules
**The Tabular Rule.** Cifras de datos en mono y `tabular-nums`; las tablas siempre tabulares.
**The Serif-For-Sentences Rule.** La serif solo para texto de lectura, nunca para títulos ni controles.

## Layout

Barra superior blanca de 56px pegada arriba (logo, pestañas con cuadrito de color, estado de conexión, «Modo campo»), debajo el tablero de sección (108px en celular, 124px desde lg) y la hoja que lo cubre con un margen negativo (-60px celular, -72px en escritorio), con 8px de margen lateral en celular y 40/48px en escritorio. Dentro de la hoja la columna usa gap de 20px y relleno de 16/24/32px según ancho. Escala base de 4px. Desde `lg` las pestañas van arriba; por debajo, barra inferior fija de 60px con icono y etiqueta de 11px y trazo superior de 3px en la sección activa. Lo diario (Panel, Mapa, Parcelas) va antes de un separador y lo de configuración (Alertas, Catálogos) después. Campo es una columna de celular centrada de máx. 480px: barra de estado, tablero con título y hoja encima (-32px). El login parte la pantalla: foto a la izquierda y tablero amarillo con la hoja a la derecha.

## Elevation & Depth

Plano por defecto; la profundidad la da la superposición de hoja sobre tablero y un solo trazo de sombra.

### Shadow Vocabulary
- **Corte de Hoja** (`box-shadow: 6px 0 0 rgb(27 27 24 / 18%)`): único borde de la hoja lechosa, sin desenfoque, solo del lado del corte.
- **Foco** (`outline: 3px solid #1b1b18; outline-offset: 2px; box-shadow: 0 0 0 5px #fff`): anillo doble visible sobre cualquier tablero.

### Named Rules
**The Cut-Edge Rule.** La única sombra del sistema es el corte de la hoja: desplazamiento horizontal, sin desenfoque. Menús y diálogos se separan con borde, no con sombras difusas.

## Shapes

Esquinas cortas y sobrias: 6px en botones y filtros, 8px en paneles y campos, 12px en menús, píldora completa solo para chips y puntos de estado. La hoja y el tablero son rectángulos de esquina viva. Las pestañas se subrayan con trazo de 3px en vez de formar cápsulas; el cuadrito de color de pestaña tiene 2px de radio.

## Components

### Buttons
- **Shape:** esquina de 6px (`rounded-md`).
- **Primary:** tinta (#1b1b18) con texto blanco, alto 44px, relleno 16px; versión grande de 56px, 16px bold, para campo y login. Hover a #34332d; `active` baja 1px.
- **Secondary:** blanco con trazo de tinta de 1.5px; hover hundido.
- **Danger:** blanco con trazo y texto #8a1c12; hover #fbe3de.
- **Warn:** #a8540a sólido con texto blanco; hover #d9730d.
- **Ghost:** transparente; hover hundido.
- **Modo campo:** en la barra superior, #0e7c86 con texto blanco, 40px.
- **Deshabilitado:** opacidad 45%.

### Chips
- **Style:** píldora de 12px semibold con fondo y texto del par de estado (ok, warn, crit, info); neutral en #e6e3d8; sólido en tinta.
- **Estado de parcela:** desbloqueada = crit, alerta = warn, revisión = info, bloqueada = ok, asignada = neutral.
- **Filter chip:** 36px, 6px de radio, trazo #bdb9aa; activo con fondo teñido por la sección (16% sobre blanco) y trazo de tinta.

### Cards / Containers
- **Hoja:** #f7f6f2 con Corte de Hoja; es el único contenedor flotante.
- **Panel:** blanco, borde #dad7cc, 8px, sin sombra.
- **Notice:** 8px, borde y fondo del tono, 13px, `role=status`.
- **Vacío:** fondo hundido, centrado, sin borde.

### Inputs / Fields
- **Style:** blanco, borde #bdb9aa, 8px (6px en login), mínimo 44px (48px en login), etiqueta de 12px semibold encima.
- **Focus:** borde de tinta más el anillo global de 3px.
- **Error:** bloque crit con `role=alert` bajo el formulario.

### Navigation
- Pestañas superiores de 14px, texto tinta-3; la activa va en negrita, tinta, con trazo inferior de 3px del color de su sección. Cada pestaña lleva un cuadrito de 10px del color de sección. La insignia de alertas es una píldora naranja óxido con texto blanco. En celular, barra inferior con icono de 18px y trazo superior.

### Barra de Estado de Campo (signature)
Franja de ancho completo sobre el tablero: tinta con texto blanco si está todo enviado, ámbar con tinta si no hay conexión, azul si sincroniza. Muestra el conteo de pendientes en una insignia sobre el botón de sincronizar, con botones táctiles de 44px.

### Tabla
Cabecera hundida con texto de 12px en mayúsculas espaciadas; filas de 13px con separador #e6e3d8 y 10px de relleno vertical.

## Do's and Don'ts

### Do:
- **Do** fijar `data-sec` en el contenedor de cada sección y derivar de `--sec` el tablero y la selección.
- **Do** dejar la hoja lechosa como único elemento con sombra, con el corte de 6px.
- **Do** usar tinta para toda acción primaria, en cualquier sección.
- **Do** poner cifras en JetBrains Mono con tabulares.
- **Do** mantener objetivos táctiles de 44px o más en campo y 56px en la acción principal.
- **Do** duplicar la severidad con texto, icono o trama.

### Don't:
- **Don't** usar el bermellón (#c8281e) fuera de errores.
- **Don't** reintroducir el verde bosque/crema anterior ni una barra lateral oscura.
- **Don't** suavizar cambios de estado con curvas ni duraciones largas; usar el paso seco de 90 ms (`.paso`).
- **Don't** añadir sombras difusas ni tarjetas flotantes en cada bloque; la profundidad es la hoja sobre el tablero.
- **Don't** teñir botones o campos con el color de la sección.
- **Don't** usar la serif para títulos o controles.
