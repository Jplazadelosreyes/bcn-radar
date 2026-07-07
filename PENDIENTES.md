# BCN Radar — Pendientes y hoja de ruta

> Estado al **2026-07-06**. Este archivo evita reprocesar todo el proyecto al abrir una sesión
> nueva: resume qué está hecho, qué falta y en qué orden. Actualízalo al cerrar cada sesión.

## Objetivo del producto

Escáner de propiedad de Barcelona: clic en cualquier parcela → dossier completo (urbanismo,
transporte, entorno, riesgo, valor). Todas las capas son **datos públicos oficiales**, cada una
con toggle + enlace a la fuente. **Cero cifras inventadas.** Emocional: "dejar boquiabierto a
alguien que entra de curioso". **Persona objetivo: "mi madre" — cualquier neófito que quiera
entender cómo es la vida cotidiana en Barcelona.** Idioma: español neutro (tú, sin argentinismos).

- Repo: `git@github.com:Jplazadelosreyes/bcn-radar.git`
- Live: https://jplazadelosreyes.github.io/bcn-radar/ (GitHub Pages vía Actions)
- Stack: Vue 3 `<script setup>` + Vite 8 + MapLibre GL 5, SPA sin router.
- Dev: `npm run dev` (:5173).

## Método de trabajo (vigente)

- **Mobile-first en profundidad**; la adaptación a PC viene DESPUÉS de cerrar móvil.
  La lógica se escribe una sola vez agnóstica de dispositivo (composables); solo layout/gestos
  difieren. Interactividad de escritorio (hover) = fase PC.
- Modelo mental prestado de **Google Maps** (familiar para todos): bottom sheets, cards,
  potencia incremental — todo parte colapsado/mínimo y se revela a demanda.
- 1 hito por vez; el operador verifica el render en su navegador (WebGL no funciona en el
  entorno de la IA). Build con `npm run build` tras cada cambio.

## HECHO — sesión 2026-07-06 (rediseño móvil completo, ⚠️ SIN COMMIT al cierre)

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

1. **Commitear el checkpoint** — todo lo de arriba está sin commit (primera acción de la
   próxima sesión; el operador cerró la sesión antes de confirmar).
2. **Curaduría declarativa** — `src/config/catalog.js`: cada capa con `orden`, `destacada`
   (visible en card vs "ver más") y `porDefecto`. El operador cura editando ese archivo.
   Aplicar a Capas del mapa (1º Qualificació PIU, 2º MUC, …) y a Movilidad.
3. **Seguir rompiendo el monolito**: extraer `MapControls.vue` (panel der.), `LayerPanel.vue`,
   `MobilityPanel.vue` + explorador de paradas, `ZonesPanel.vue`, `FincaReport.vue`.
   Borrar `HelloWorld.vue` (basura del scaffold).
4. **Pulido móvil restante**, luego **fase PC**: hover en zonas manuales (feature-state:
   teñido+borde+nombre; en móvil el tap equivale), llevar los principios del layout móvil
   al escritorio, considerar distintos monitores.
5. **Iconos de paradas**: GTFS (oficial) y OSM no coinciden en posición — diferenciarlas
   con iconografía propia por fuente/modo (detectado por el operador).
6. **FUTURO (norte del producto): routing "llegar de A a B"** con rutas alternativas sobre el
   mapa. Requiere motor (OTP/Valhalla/GraphHopper; el GTFS ya es nuestro). Para neófitos —
   la app que "mi madre entiende". La multi-selección de líneas ya permite comparar a ojo.
7. Onboarding/aterrizaje con flujo creciente (idea del operador, sin diseñar).
8. Datos que faltan si Open Data BCN coopera: tráfico, ruido, aire. Venta €/m² descartada
   (solo dato 2015, engañoso). 3D fotorrealista = key de pago (Google 3D Tiles), producto maduro.

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
