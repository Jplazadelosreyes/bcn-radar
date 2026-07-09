# BCN Radar — Pendientes y hoja de ruta

> Estado al **2026-07-09**. Este archivo evita reprocesar todo el proyecto al abrir una sesión
> nueva: resume qué está hecho, qué falta y en qué orden. Actualízalo al cerrar cada sesión.

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

**Resta**: (a) más tests de lógica pura (chipsFor/isCurated, derivados); (b) revisar
`MapCanvas.vue` (288) por lógica extraíble; (c) salvaguarda anti-monolito (regla lint max-lines).

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
