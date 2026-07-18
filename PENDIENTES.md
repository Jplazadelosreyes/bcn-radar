# BCN Radar — Pendientes y hoja de ruta

> Estado al **2026-07-17**. Este archivo evita reprocesar todo el proyecto al abrir una sesión
> nueva: resume qué está hecho, qué falta y en qué orden. Actualízalo al cerrar cada sesión.

## HECHO — sesión 2026-07-17 (QA de interactividad escritorio + móvil, 7 fixes)

QA end-to-end en navegador (escritorio 1280×720 y móvil 375×812). **El flujo clic-finca→dossier
quedó CONFIRMADO EN VIVO** (pendiente desde la sesión anterior): búsqueda→sugerencia→flyTo→pin→
dossier con Catastro en vivo; clic directo en edificio→dossier; clic en calle→estado vacío con
guía ("Prueba sobre un edificio"). Verde: typecheck 0 · eslint limpio · 19/19 tests. SIN commitear.

- **Mapa 400×300 si el contenedor mide 0 al crear** (`useMap.ts`): MapLibre descarta el primer
  aviso de su ResizeObserver y nunca se recuperaba. RO propio que fuerza `map.resize()`.
- **Chip activo ↔ checkbox desincronizados** (`TransporteSection.vue` + `useTransporteModos.ts`):
  el checkbox de modo no tenía `:checked` — quitar Metro por chip lo dejaba marcado. Enlazado a
  `transportVisible` (ahora expuesto) y las líneas se ocultan al apagar el modo.
- **"Medir distancia" sin binding** (`MapControls.vue`): `:checked="measuring"` añadido.
- **Panel de herramientas tapaba la barra de capas en escritorio** (`components.css`): la regla
  base (bottom:22) pisaba el override del media query por orden de cascada → especificidad
  `.map-section .map-floating-controls`.
- **Atribución expandida pisaba el zoom en móvil** (`useMap.ts`): MapLibre la re-abre cuando una
  fuente añade créditos tras el load → se pliega también en el primer `idle`. Franja inferior
  móvil ahora con CERO solapes medidos por geometría.
- **404 masivos de glyphs** (4 capas symbol): pedían "Open Sans Regular" que OpenFreeMap no
  sirve (cientos de 404). `text-font: ['Noto Sans Regular']` en zonas/auto-zonas/transporte/datos.
- **Sugerencias duplicadas en el buscador** (`geocode.js`): dedupe por etiqueta corta.
- **Auto-zonas no reintentaba** (`useAutoZones.ts`): un fallo cacheaba la promesa rechazada para
  siempre; ahora limpia el cache al fallar + 1 reintento a los 3 s.
- Ojo entorno de prueba: el panel de preview carga la página con viewport 0×0 y pausa rAF en
  segundo plano — el mapa chico y fuentes GeoJSON vacías de esta sesión eran ESO, no bugs de la
  app (en Chrome real no pasa). El fix del RO igual protege embeds/iframes reales.

### 2ª pasada (misma sesión): QA profundo de capas y herramientas — TODO verificado en vivo
Renta media (coropleta + popup "Sección 06-061 · 27.484 €/año") · Barrios/Secciones · WMS
urbanismo (PIU Qualificació urbanística, GetMap OK; catálogo MUC/ACA presente) · Parcelas
Catastro (WMS renderizando a z18) · Bicing/Carriles bici/Salud (status ok + chips) · explorador
de paradas COMPLETO (parada → chips → H10 dibuja recorrido → quitar) · drill-down del dossier
por zoom (ciudad→distrito→barrio→sección, con ficha de rentabilidad) · Edificios 3D (extrusión
verificada con pitch 65) · Radio 500 m (círculo + fill) · botón PDF = stub deliberado (alert).
**Fix nº 8** (commiteado aparte): `.stop-explorer` en escritorio quedaba en top:16/left:16
(herencia de la era topbar) DEBAJO del buscador (z 5 vs 900) y pegado al rail — título y ✕
inaccesibles. Ahora esquina superior derecha (`components.css`, mismo truco de especificidad).

### 3ª pasada (reporte del operador con pantallazos): 2 solapes más, corregidos
- **✕ de cerrar pisaba la cabecera del panel** (escritorio): `.panel-close` en top:8/right:8
  caía sobre la esquina del card de cabecera Y sobre el chevron (dos controles apilados).
  Ahora vive integrada en la fila de la cabecera y la cabecera reserva 60px a la derecha
  (`components.css`, media escritorio). En móvil ni existe (manda el asa del sheet).
- **Desplegable de capas se abría ENCIMA del panel de herramientas**: comparten esquina
  inferior-izquierda y el de herramientas ya contiene todo lo de la barra. Regla nueva en
  `MapLayersBar.vue`: mientras `controlsOpen`, el hover/click no despliega; y si se abre
  herramientas con el desplegable abierto, se pliega al instante (watch). En móvil la barra
  es `display:none` — sin efecto.
Verificado por geometría (getBoundingClientRect sin intersección) y por estado en los 3
escenarios (abrir A→B, hover con B abierto, cerrar B→hover vuelve). Verde: typecheck·lint·19 tests.

## HECHO — sesión 2026-07-14/15 (Chrome MCP + layout Google + móvil + sistema visual)

Se conectó **chrome-devtools-mcp** (Chrome real, WebGL de verdad) → por fin se puede VER el
render y auditar geometría. Todo commiteado y desplegado en `main`. Verde de punta a punta.

- **Puerto propio: 5190** (`npm run dev` a secas; preview 5191, strictPort). Fin del choque con
  Zerty Hub (:5173). En `vite.config.js`.
- **Fix de raíz — orden de CSS**: `maplibre-gl.css` se importaba en MapCanvas → se inyectaba
  DESPUÉS del nuestro y lo pisaba; cualquier reposición de sus controles era ignorada (el
  `bottom:78px` de la sesión previa NUNCA se aplicó). Movido a `main.js` antes de `index.css`.
- **Layout Google (escritorio)**: controles nativos en columna abajo-derecha (verificado en
  x:1382); barra de capas nueva `MapLayersBar.vue` abajo-izquierda (miniaturas: tiles reales de
  satélite/ortofoto + SVG de la retícula Cerdà para callejero/relieve); una sola brújula (se
  desactivó la nativa, duplicaba la rosa); cursor tipo Google (flecha + grab al arrastrar).
- **Móvil (Note 10+, verificado con Puppeteer sobre Chrome real)**: el rail se OCULTABA →
  Capas/Movilidad/Zonas eran INALCANZABLES. Ahora el mismo rail es **barra inferior** (bottom
  nav, 4 secciones). Token `--nav-h`/`--nav-safe`: todo el chrome inferior se apoya ahí. Chips
  de filtro vuelven al móvil. Cero solapes en 6 estados medidos. Sheet: snap de 3 estados
  arreglado (abajo-desde-expandido volvía a cerrar en vez de compactar).
- **Viewport móvil**: `position:fixed` en body (ya no se puede "bajar" la página, el bug que
  reportó el operador); `viewport-fit=cover` (los `env(safe-area-inset-*)` valían 0);
  theme-color + mobile-web-app-capable; `lang="es"`.
- **Sistema visual "Mediterrani" v3.1**: canto del vidrio en 2 capas (`--edge` tinta que recorta
  + `--edge-hi` brillo) — el borde era blanco sobre panel blanco, invisible en día. Escala
  tipográfica (`--fs-*`, suelo real 10px; había 8px ilegibles). `:focus-visible` global y
  `prefers-reduced-motion` (no existían). Controles de MapLibre vestidos con nuestro material.

### PENDIENTE INMEDIATO — las 2 etapas que pidió el operador (en orden)
1. **CONTENIDO** (siguiente). Sin definir el alcance con el operador. Candidatos del backlog:
   verificar el flujo clic-finca→dossier (nunca confirmado en vivo, ahora YA se puede con el MCP),
   curar qué capas/datos entran, revisar el copy de las fichas, onboarding.
2. **VISUAL / retoques** (al final). Incluye **Material Symbols** (los iconos del rail y las
   cards siguen siendo emojis 📍🗂️🚌🗺️; el operador quiere los de Google, Apache-2.0) y el
   ajuste fino del vidrio con el ojo del operador sobre cada basemap.

### Herramientas de verificación (nuevas, en el scratchpad de la sesión)
- `audit.mjs` (Puppeteer): emula Note 10+, mide cajas del chrome y reporta solapes por geometría.
- `drag*.mjs`: prueban el gesto del sheet con TouchEvents reales. Reutilizables si vuelve a tocarse el layout.

## HECHO — sesión 2026-07-10 (rediseño UI estilo Google Maps)

Se rediseñó la navegación para dar protagonismo al mapa (la barra superior "no aportaba"). Todo
commiteado en `main`. Verde: typecheck 0 · eslint limpio · 19 tests · build OK. Dev: `--port 5174`.

- **Fuera la topbar** (`TheTopbar.vue` borrado). Mapa a pantalla completa; todo flota encima.
- **Rail de iconos a la izquierda** (`components/map/MapRail.vue`): Info/Capas/Movilidad/Zonas,
  una sección abierta a la vez, activa con borde; tema día/noche al fondo del rail. Estado en
  `usePanels` (`activeSection`/`toggleSection`/`openSection`). Al clicar finca abre 'info' solo.
- **Buscador flotante** (`components/map/SearchBox.vue`) sin botón "Buscar" + **AUTOCOMPLETADO**
  de direcciones (`services/geocode.js` `suggestAddresses`; `useSearch` con debounce 350ms +
  `pickSuggestion`). Buscador y panel alineados (columna izq, `left:82`, ancho reactivo).
- **Sistema visual glass**: tokens `--glass-*`/`--shadow-*` en `tokens.css` (editables) aplicados
  al chrome. Ver `EDICION-MANUAL.md` para dónde tocar cada cosa a mano.
- **Chips de capas ACTIVAS arriba** (`components/map/ActiveLayerChips.vue`, estilo "filtros" de
  Google): solo muestran lo encendido, un clic apaga. Cada dominio expone `activeChips` (useLayers,
  useCapasDatos, useZones, useTransporteModos con nuevo `transportVisible`). Color **azul** (--carto).
  El chip ES el estado de la capa → sincronización perfecta, imposible desincronizar.
- **Controles nativos a abajo-derecha** en escritorio (`components.css` @media min-width:681px).

### RETOMAR AQUÍ (pendientes de esta línea de trabajo)
1. **Ajuste fino de posiciones abajo-derecha** (hecho a ciegas, sin WebGL): `.maplibregl-ctrl-top-right`
   (bottom:78 right:10) y `.fab-map` (bottom:20 right:14) en `components.css` @media escritorio.
   Pueden solaparse con el indicador de zoom / atribución. Requiere ojo del operador + captura.
2. **Modo móvil** (pospuesto a propósito): el rail se OCULTA en móvil (`@media max-width:680px`),
   así que Capas/Movilidad/Zonas quedan sin acceso; el ☰ (fab-info, solo-móvil) abre solo 'info';
   los chips activos se ocultan en móvil. Opciones a decidir: rail como barra inferior (bottom nav)
   o el ☰ abre menú de secciones. También adaptar chips + controles a móvil.
3. **"Facilitar activar las capas"** (idea del operador, a definir): cómo hacer más rápido encender
   las capas que suben como chip (hoy se activan dentro de los paneles del rail).

## HECHO — sesión 2026-07-09 (partición de InfoDossier)

Segunda pasada de segmentación: el operador quiere cada responsabilidad en su propio archivo
para trabajarlas de forma independiente. `InfoDossier.vue` era 5 componentes disfrazados de uno
(cadena `v-if` por nivel de zoom) + dos átomos visuales repetidos ~10-12 veces.

- **InfoDossier.vue: 579 → 48 líneas** — ahora un switch: `<component :is>` elige la ficha por
  `mapContext.level` y calcula `infoCtx`. Nuevo dir `components/sidebar/ficha/`:
  `FichaCiudad` (68), `FichaDistrito`/`FichaBarrio`/`FichaSeccion` (41 c/u), `FichaFinca` (293).
- **Átomos** `ficha/FichaVeredicto.vue` (bloque veredicto dot+título+desc) y `ficha/FichaDoc.vue`
  (enlace a fuente oficial con badge) — dejan de repetirse en todos los niveles.
- **Tipo fuente única** en useFinca: `export type VerTone` + `interface Veredicto`; lo consumen
  `claveSistema`, `veredictos` y el átomo. Cada ficha consume los stores singleton que necesita
  (sin prop-drilling). Cero cambio de comportamiento.
- **Verde**: typecheck 0 · eslint limpio · 10 tests · build OK. Falta verificación en navegador.

### Sub-hito: config declarativa de movilidad a `src/config/` (= PENDIENTE #1, parcial)

- **useMovilidad.ts: 519 → 397 líneas.** Se extrajo la CONFIG pura del god-composable:
  `config/transportes.ts` (18) = `TRANSPORTES` + `TRANSPORT_BBOX` + tipo `TransporteModo`;
  `config/capas-datos.ts` (128) = catálogo `MOVILIDAD` + interfaz `MovLayer` + helpers/loaders
  del catálogo (`poiLayer`, `loadCarrilBici`, `poiCategory`) + `poiDate` (metadato reactivo).
- La LÓGICA de mapa (loadTransport, toggleData, explorador GTFS, filtros de línea) se queda en
  useMovilidad; consume la config vía import y la re-expone en su return → consumidores intactos
  (MovilidadCard usa el return; StopExplorer solo importa tipos StopChip/SelectedStop, que se
  quedan). El operador ahora cura el catálogo editando `config/`. Cero cambio de comportamiento.
- **Verde**: typecheck 0 · eslint limpio · 10 tests · build OK. Falta verificación en navegador.

### Sub-hito: partir FichaFinca en bloques presentacionales

- **FichaFinca.vue: 293 → 78 líneas** (orquestador: cabecera + estado vacío + montaje de bloques
  + acción exportar). Nuevo dir `components/sidebar/ficha/finca/` con 7 bloques que consumen
  useFinca/useRadio por su cuenta: `BloqueCatastro` (76, gestiona sus estados de carga),
  `BloquePIU` (70), `BloquePrivado` (47), `BloqueTransporte` (25), `BloqueValor` (31),
  `BloqueLectura` (20), `BloqueCumplimiento` (18). Reutilizan los átomos FichaDoc/FichaVeredicto.
- La orquestación (v-if de estado `ok` y de existencia de radioStops/veredictos) se queda visible
  en FichaFinca; los bloques son "tontos". Cero cambio de comportamiento.
- **Verde**: typecheck 0 · eslint limpio · 10 tests · build OK. Falta verificación en navegador.

### Sub-hito: extraer useCapasDatos (dominio independiente)

- **useMovilidad.ts: 397 → 340 líneas.** Se sacó el dominio de capas de datos abiertos a
  `composables/useCapasDatos.ts` (78): estado (`dataActive`/`dataStatus`/`dataTimers`) + `toggleData`
  + re-export de `MOVILIDAD`/`poiDate`. Es 100% independiente (no comparte estado con líneas ni
  con la parada seleccionada) → corte seguro.
- **MovilidadCard consume ambos**: `useMovilidad()` (transporte + explorador) y `useCapasDatos()`
  (capas). Separación REAL, no de fachada. Cero cambio de comportamiento.
- useMovilidad queda cohesivo: transporte por modo + explorador de parada, que SÍ comparten
  `selectedStop` y el estado de líneas (explorador unificado GTFS+Overpass) — no se fuerza a
  separarlos. **Verde**: typecheck 0 · eslint limpio · 10 tests · build OK. Falta verif. navegador.

### Sub-hito: partir useMovilidad en dos dominios + estado compartido

- **useMovilidad.ts (340) ELIMINADO** → 3 archivos de responsabilidad única:
  `transporteState.ts` (38) = tipos + estado compartido (`transportLines`/`transportSelected`/
  `selectedStop`) + `isCurated`; `useTransporteModos.ts` (170) = líneas por modo Overpass
  (loadTransport, chips, filtros, todas/ninguna); `useExploradorParadas.ts` (165) = explorador
  GTFS unificado (paradas, recorridos multi-selección, pickStopLine/stopClear).
- El estado compartido se aisló en `transporteState` para que ningún composable sea dueño del
  otro. `useExploradorParadas` obtiene `applyLineFilter` llamando a `useTransporteModos()`
  (composición de composables, dependencia unidireccional).
- Consumidores migrados: App.vue → useExploradorParadas; MovilidadCard → los 3 stores
  (Modos + Explorador + Capas); StopExplorer → tipos desde transporteState. Cero cambio de
  comportamiento. **Verde**: typecheck 0 · eslint limpio · 10 tests · build OK.

### Sub-hito: MapCanvas + tests + salvaguarda anti-monolito

- **MapCanvas.vue: 288 → 211 líneas.** El click-handler de selección de finca (geocoding +
  Catastro + PIU + pin, ~86 líneas de lógica de negocio) salió a `composables/useFincaPicker.ts`
  (97): expone `selectFincaAt(map, lngLat)`; MapCanvas queda como ensamblaje del motor + routing
  del clic. El montaje de basemaps/capas se queda (es el motor, pertenece ahí).
- **Tests: 10 → 19.** Nuevos: `transporteState.test.ts` (isCurated, 4) y
  `useTransporteModos.test.ts` (chipsFor bus/no-bus/búsqueda/expandido, 5).
- **Salvaguarda anti-monolito**: regla ESLint `max-lines` (error a 300 líneas de código, sin
  comentarios ni blancos) en `eslint.config.js` → el CI bloquea que un archivo vuelva a crecer
  como el viejo App.vue. Hoy ningún archivo la roza.
- **Verde**: typecheck 0 · eslint limpio · 19 tests · build OK. Falta verificación en navegador.

### Sub-hito: auditoría "una responsabilidad = un componente" (2 splits finales)

Revisión de TODO el árbol para confirmar que nada agrupa varias responsabilidades. Dos casos
reales encontrados y partidos:
- **MovilidadCard.vue: 99 → 19** (composición). Metía dos dominios en un template → sub-secciones
  `components/sidebar/movilidad/`: `TransporteSection.vue` (65, useTransporteModos + useExplorador
  Paradas) y `CapasDatosSection.vue` (30, useCapasDatos).
- **MapCanvas.vue: 211 → 110**. El `map.on('load')` ensamblaba ~8 grupos de capas → salieron a
  `services/map-layers.js` (125): `addBasemaps`, `addBcnMask`, `add3dBuildings`, `addRadioLayers`,
  `addMeasureLayers`. MapCanvas queda como ciclo de vida del motor + cableado de eventos.
- Resto del árbol auditado y OK (App, fichas, CapasCard, ZonasCard, TheTopbar, StopExplorer,
  MapControls, MapFabs, SectionCard = cada uno una responsabilidad). **Verde**: typecheck 0 ·
  eslint limpio · 19 tests · build OK.

## Estado final del refactor (sesión 2026-07-09)

Monolito roto en piezas de responsabilidad única, todo commiteado en `main`:
- Sidebar/Información: InfoDossier (switch) + 5 fichas por nivel + FichaFinca (orquestador) + 7
  bloques en `ficha/finca/` + átomos FichaDoc/FichaVeredicto.
- Movilidad: config en `config/` + 3 stores (`useTransporteModos`, `useExploradorParadas`,
  `useCapasDatos`) + estado compartido `transporteState`.
- Mapa: `useFincaPicker` fuera de MapCanvas.
- Popups del mapa centralizados en `services/map-popups.js` (plantillas reutilizables).
- Acceso a APIs externas en `services/`: geocoding Nominatim → `services/geocode.js`
  (`geocodeAddress` + `reverseGeocode`, lo comparten useSearch y useFincaPicker); coords→RC del
  Catastro → `catastro.js` (`fetchRefFromCoords`). Ningún composable hace fetch a Nominatim/
  Catastro inline. (Queda el GetCapabilities WMS en useLayers = cohesión del dominio de capas.)
- Sistema visual glass: tokens `--glass-*`/`--shadow-*` en tokens.css (panel editable) + chrome
  de escritorio (sidebar/topbar/flotantes) con vidrio esmerilado.
- 19 tests · salvaguarda `max-lines` activa.

**PENDIENTE real ahora = FIXES** (tras verificación en navegador del operador). Lo opcional que
queda es de rendimiento decreciente: partir `map-theme.js` (235) si molesta; iconografía de
paradas GTFS vs OSM (punto 4 del plan original); routing A→B (norte del producto, punto 5).

## Objetivo del producto

Escáner de propiedad de Barcelona: clic en cualquier parcela → dossier completo (urbanismo,
transporte, entorno, riesgo, valor). Todas las capas son **datos públicos oficiales**, cada una
con toggle + enlace a la fuente. **Cero cifras inventadas.** Emocional: "dejar boquiabierto a
alguien que entra de curioso". **Persona objetivo: "mi madre" — cualquier neófito que quiera
entender cómo es la vida cotidiana en Barcelona.** Idioma: español neutro (tú, sin argentinismos).

- Repo: `git@github.com:Jplazadelosreyes/bcn-radar.git`
- Live: https://jplazadelosreyes.github.io/bcn-radar/ (GitHub Pages vía Actions)
- Stack: Vue 3 `<script setup lang="ts">` + **TypeScript** + Vite 8 + MapLibre GL 5, SPA sin router.
- Tooling: ESLint (flat) + Prettier, Vitest + jsdom, CI (job `check` lint+typecheck+test bloquea deploy).
  Scripts: `dev` · `build` · `typecheck` (vue-tsc) · `lint`/`lint:fix` · `format` · `test`/`test:watch`.
- Dev: `npm run dev` (:5173, pero **Zerty Hub suele ocupar :5173** → arrancar en `--port 5178`).

## Método de trabajo (vigente)

- **Mobile-first en profundidad**; la adaptación a PC viene DESPUÉS de cerrar móvil.
  La lógica se escribe una sola vez agnóstica de dispositivo (composables); solo layout/gestos
  difieren. Interactividad de escritorio (hover) = fase PC.
- Modelo mental prestado de **Google Maps** (familiar para todos): bottom sheets, cards,
  potencia incremental — todo parte colapsado/mínimo y se revela a demanda.
- 1 hito por vez; el operador verifica el render en su navegador (WebGL no funciona en el
  entorno de la IA). Build con `npm run build` tras cada cambio.

## HECHO — sesión 2026-07-08/09 (refactor profesional + TypeScript completo, todo commiteado)

El operador pidió estructurar el proyecto "como dios manda, mejores prácticas, es mi carta de
presentación". Se rompió el monolito y se cerró la migración a TS. **Todo pusheado a `main`.**

- **App.vue: 2.694 → 79 líneas** (composición pura). Se extrajeron TODOS los componentes:
  `components/map/` = MapCanvas (el motor: todo el `onMounted` + click-handler), MapFabs,
  MapControls, StopExplorer · `components/sidebar/` = SectionCard (colapsable reusable),
  InfoDossier (dossier finca 5 niveles), CapasCard, MovilidadCard, ZonasCard · TheTopbar.
- **CSS fuera de App.vue** → `src/styles/`: `tokens.css` (design tokens día/noche + reset),
  `components.css` (chrome), `responsive.css` (móvil), importados en cascada por `index.css`
  (lo carga `main.js`). App.vue ya no tiene `<style>`.
- **Stores singleton** en `src/composables/` (14, TODOS `.ts`): useMapStore (handle del mapa +
  mapContext + overlayClickLayers/stopLayerIds/marker), useMapTools, useSheetDrag, useZones,
  useLayers, useFinca, useRadio, useMovilidad, useSearch, useMeasure, useTheme, usePanels,
  useAutoZones, useMap. Servicios en `src/services/` siguen en `.js` (overpass, map-theme, catastro…).
- **TypeScript en TODO el árbol.** Tipos de dominio como fuente única exportados desde su store
  (TransportLine, StopChip, SelectedStop, MovLayer, RadioStop, WmsSource/WmsLayer, FincaData,
  MapContext, Basemap). El handle de MapLibre se tipa `any` en UN solo sitio (useMapStore) →
  sin fricción de tipos aguas abajo; `any` acotado y justificado por archivo solo en las
  fronteras imperativas (MapLibre + Overpass/GTFS). `vue/block-lang` reactivado como **error**
  (ningún SFC nuevo entra sin `lang="ts"`).
- **Tests** en `src/composables/__tests__/useFinca.test.ts` (6, lógica de veredictos ITE/uso/
  coeficiente) + `src/services/__tests__/map-theme.test.ts` (4). **10 verdes.**
- **Verde de punta a punta**: typecheck 0 errores · eslint limpio · 10 tests · build OK ·
  runtime verificado en navegador (mapa 2D, controles, dossier de ciudad renderizan).

## HECHO — sesión 2026-07-06 (rediseño móvil completo)

**Móvil (≤680px):**
- **Cápsula de búsqueda flotante glass** (blur+transparencia, chaflán Cerdà): logo + marca en
  2 líneas, input flex con botón-lupa DENTRO, sobre el mapa a pantalla completa.
- **Bottom sheets como cards flotantes** (margen 8px, radio 18, glass): sidebar y panel de
  controles suben desde abajo, nunca alcanzan el buscador (max-height con tope). Asa con
  gestos: tap=cerrar, arrastrar arriba=expandir a pantalla, abajo desde expandido=colapsar
  cards+compactar, abajo desde compacto=cerrar. Sin ✕ en móvil (el asa cumple esa función).
- **Speed-dial de utilidades** (abajo-izq): un botón chevron expande en cascada navegación/
  fullscreen/GPS/rosa (agrupados en tarjeta única, botones cuadrados `clamp(38px,9.5vw,46px)`).
  Tema día/noche = botón flotante abajo-der. Zoom abreviado `z11` + atribución plegada al ⓘ
  en fila abajo-der. Con un sheet abierto, todos los botones del mapa hacen fade out.
- Al abrir el sheet, **todas las cards colapsadas** (forma mínima).

**Sidebar reorganizado en 4 cards** (aún inline en App.vue): **📍 Información** (dossier
contextual por zoom; la cabecera muestra dónde estás: Barcelona→distrito→barrio→sección→finca,
computed `infoCtx`) → **🗂️ Capas del mapa** (WMS + Parcelas Catastro, movida desde el panel
der.) → **🚌 Movilidad** (GTFS + recorridos por modo Overpass, movidos desde el panel der. —
sin redundancia) → **🗺️ Zonas administrativas**. Expansión **independiente** (multi-open,
estado `cardOpen`), retícula de padding 16px, cards con borde/radio/glass. Panel derecho quedó
SOLO lienzo: Mapa base + Vista 3D + Herramientas.

**Transporte (lo más nuevo):**
- **Control masivo por modo**: barra `Todas / Ninguna / n·m` en metro, bus, Rodalies, FGC.
  Bus: buscador + botón "Ver todas" (lista expandible ~200 chips). Con búsqueda activa,
  Todas/Ninguna operan SOLO sobre lo filtrado (`setAllLines`).
- **Explorador de paradas unificado**: tocar CUALQUIER parada (GTFS oficial u Overpass/OSM)
  abre el mismo panel (card inferior glass en móvil, zona del pulgar): nombre + modo + chips.
  **Multi-selección**: GTFS acumula recorridos (`activeRouteIds` + `renderRoutes`, color real
  por línea con paint data-driven); Overpass cura el filtro línea a línea vía `pickStopLine`
  (1er tap=solo esa; quitar la última=vuelven todas). "Quitar recorridos" limpia todo.
- **Auto-activación por zoom**: al llegar a z16 la 1ª vez se activan las paradas GTFS solas
  (transit.json 1.9MB se descarga recién ahí — nada en la carga inicial). Si el usuario las
  apaga después, se respeta (`transitAutoDone`).
- **Contornos automáticos**: solo el borde municipal suave (rojo 45%) a nivel ciudad.
  Los de distrito/barrio/sección quedaron DESACTIVADOS por defecto (flag
  `AUTO_ZONE_LEVELS=false` en useAutoZones.js) porque distraían sobre otras capas;
  siguen disponibles manualmente en la card Zonas.

**Modularización (parcial):** `composables/useMap.js` (instancia+controles custom+gestos),
`usePanels.js` (sheets/FABs/`isMobile` reactivo con matchMedia), `useAutoZones.js`,
`useTheme.js` + `components/TheTopbar.vue`. **App.vue sigue siendo monolito (~2.694 líneas)**
— bajó lógica de mapa pero creció el template; la extracción de componentes sigue pendiente.

## PENDIENTE — orden propuesto

> Estructura y migración TS: **HECHAS** (ver sesión 07-08/09). Monolito roto, checkpoint commiteado.

1. **Curaduría declarativa** — `src/config/`: cada capa con `orden`, `destacada` (visible en
   card vs "ver más") y `porDefecto`. El operador cura editando ese archivo. Aplicar a Capas
   del mapa (1º Qualificació PIU, 2º MUC, …) y a Movilidad. **Nota**: se pospuso a propósito —
   MOVILIDAD está acoplado a sus loaders (no es dato puro); TRANSPORTES/WMS_SOURCES sí son puros
   y podrían salir a `config/`. Decidir si vale la indirección o se quedan en sus stores.
2. **Más tests** — hoy 10 (useFinca + map-theme). Subir cobertura de lógica pura testeable
   (chipsFor/isCurated de useMovilidad, derivados de useFinca, servicios de parseo).
3. **Pulido móvil restante**, luego **fase PC**: hover en zonas manuales (feature-state:
   teñido+borde+nombre; en móvil el tap equivale), llevar los principios del layout móvil
   al escritorio, considerar distintos monitores.
4. **Iconos de paradas**: GTFS (oficial) y OSM no coinciden en posición — diferenciarlas
   con iconografía propia por fuente/modo (detectado por el operador).
5. **FUTURO (norte del producto): routing "llegar de A a B"** con rutas alternativas sobre el
   mapa. Requiere motor (OTP/Valhalla/GraphHopper; el GTFS ya es nuestro). Para neófitos —
   la app que "mi madre entiende". La multi-selección de líneas ya permite comparar a ojo.
6. Onboarding/aterrizaje con flujo creciente (idea del operador, sin diseñar).
7. Datos que faltan si Open Data BCN coopera: tráfico, ruido, aire. Venta €/m² descartada
   (solo dato 2015, engañoso). 3D fotorrealista = key de pago (Google 3D Tiles), producto maduro.

## Verificación NO cerrada (probar en navegador real)

- **Click-de-finca a z≥16** (Catastro → dossier de finca): es código movido verbatim y sus
  piezas (InfoDossier + useFinca) sí renderizan, pero el flujo completo clic→dossier no se
  llegó a confirmar en vivo (el zoom vía automatización quedaba atascado en z14).

## Deuda técnica

- `catastro.js → pctFromCpt`: coeficiente fuera de rango reportado en sesiones previas;
  blindado en el veredicto, revisar XML crudo si reaparece.
- Carriles bici aún vía Overpass en runtime (migrar a estático como los POI).
- Glass del sheet (80% + blur): si la legibilidad sufre sobre zonas densas del mapa,
  subir opacidad a 88-90%.
- `.sidebar` de escritorio sigue fija en 416px; la fase PC la revisará.

## Restricciones que se mantienen (seguridad / integridad)

- **Nunca exponer secretos.** Key TMB en `.env` (gitignored, sin `VITE_`), solo se usó una vez
  para bajar el GTFS; no está en runtime ni en el bundle. No commitear `.env`.
- Cero cifras inventadas. Sin scraping de idealista (ToS).
- Cada capa con enlace a su fuente oficial.
