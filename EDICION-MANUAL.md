# BCN Radar — Guía de edición manual

> Mapa de "cuando quieras tocar **X** a mano, ve a **Y**". Pensada para el trabajo final de
> óptica/estética que hace el operador directamente. Cada zona apunta al archivo exacto y a la
> variable/línea concreta. Los cambios de estilo son **hot-reload**: con `npm run dev -- --port 5174`
> abierto, guardas y lo ves al instante.

---

## 1. Coloramiento del mapa (sobre todo NOCTURNO)

**Archivo único:** `src/services/map-theme.js` → objeto `MAP_COLORS`.

- Dos paletas hermanas: `MAP_COLORS.day` (tema claro) y `MAP_COLORS.night` (tema oscuro).
- **Cada elemento del mapa tiene su propia línea con comentario** — ningún color por defecto.
- Para el nocturno, edita los hex bajo `MAP_COLORS.night`. Grupos (mismos nombres en day y night):

| Quieres cambiar… | Clave(s) en `MAP_COLORS.night` |
|---|---|
| Fondo / tierra | `background` |
| Mar, ríos | `water`, `waterway` |
| Parques, bosque, césped, playa… | `landPark`, `landWood`, `landGrass`, `landSand`, … |
| Manzanas residenciales | `landResidential` |
| Edificios (relleno / borde / 3D) | `building`, `buildingEdge`, `building3D` |
| **Calles** (autopista→menor) | `roadMotorway`, `roadTrunkPrimary`, `roadSecondaryTertiary`, `roadMinor`, … |
| Contorno de calles | `roadMajorCasing`, `roadMinorCasing` |
| Ferrocarril / metro | `rail` |
| Límites administrativos | `boundary` |
| **Etiquetas** (nombres de calle, ciudad, agua, POI, transporte…) | `labelStreet`, `labelCity`, `labelWater`, `labelPoi`, `labelPoiTransit`, … |
| Halo (borde blanco de las letras) | `labelHalo` |

**La máscara de Barcelona** (atenúa lo que no es la ciudad) tiene su color hardcodeado (día/noche)
en **dos** sitios que deben coincidir:
- `src/services/map-layers.js` → `addBcnMask()` (`isDark ? '#0B1017' : '#FFFFFF'`) — color inicial.
- `src/components/map/MapCanvas.vue` → watch de `theme` (`setPaintProperty('bcn-mask', …)`) — al
  alternar tema. *(Si algún día molesta, se centraliza en un token; hoy son estos dos.)*

---

## 2. Interfaz: estilo, transparencia y fuentes

**Panel de control central:** `src/styles/tokens.css` (todo son variables CSS, hot-reload).

### Transparencia / vidrio / sombras (el look "glass")
Sección `MATERIALES / EFECTOS` en `:root` (tema claro) y su gemela en `html[data-theme="dark"]`:
- `--glass-bg` → **transparencia** de los paneles. Menos alpha = más transparente (ej. `.72` → `.55`).
- `--glass-bg-strong` → versión casi opaca (contenido denso).
- `--glass-blur` → intensidad del desenfoque.
- `--glass-saturate` → saturación del color tras el vidrio.
- `--glass-brd` / `--glass-brd-soft` → brillo del borde del vidrio.
- `--shadow-sm` / `--shadow-md` / `--shadow-float` → profundidad de las sombras.

Estos tokens los usan: sidebar de escritorio, topbar, FABs, controles del mapa y explorador de
parada. Cambias un valor → cambia todo el chrome a la vez.

### Colores de la interfaz (no del mapa)
Bloque superior de `tokens.css` (`:root` y `dark`): `--bg`, `--surface`, `--text-hi`, `--accent`
(rojo BCN), `--carto` (azul datos), `--green/--amber/--red`, etc.

### Fuentes
Dos sitios (los dos hay que tocar para cambiar de familia):
1. **Cargar la familia** → `index.html`, el `<link>` de Google Fonts.
2. **Asignarla** → `tokens.css`: `--display` (titulares serif), `--sans` (cuerpo), `--serif`
   (itálicas decorativas), `--mono` (monoespaciada).

### Radios de esquina
En `tokens.css`: `--r-card`, `--r-inner`, `--r-pill`.

### Estilos concretos de un trozo de chrome
`src/styles/components.css` (sidebar, cards, ficha, capas…) y `src/styles/responsive.css` (móvil).
La topbar tiene su CSS propio dentro de `src/components/TheTopbar.vue` (`<style>`).

---

## 3. El selector de finca y los demás selectores

### Selector de finca (clic en el mapa → dossier)
- **Lógica**: `src/composables/useFincaPicker.ts` (`selectFincaAt`). Aquí está el **pin**
  (`new maplibregl.Marker({ color: '#D24B3E' })` ← color del pin) y cuándo se abre el popup.
- **Router del clic** (qué pasa al clicar el mapa, por zoom/modo): `src/components/map/MapCanvas.vue`
  (el `map.on('click', …)`: medición → parada → `zoom ≥ 16` selecciona finca).
- **HTML/estilo del popup** "🏢 Finca Seleccionada": `src/services/map-popups.js` → `fincaPopup()`.

### Todos los popups del mapa (un solo archivo)
`src/services/map-popups.js` — plantillas reutilizables:
- `fincaPopup(body)` — finca seleccionada.
- `direccionPopup(nombre)` — resultado del buscador.
- `stopPopup(s)` — parada de transporte (nombre + modo + líneas).
- `titlePopup(name)` — zonas / paradas de recorrido (solo nombre).
- `rentaPopup(p)` — sección censal con renta.
- *(El popup de las capas de datos — Bicing, POI… — vive en su catálogo:
  `src/config/capas-datos.js`, campo `popup` de cada capa.)*

### Otros selectores / controles
| Selector | Archivo |
|---|---|
| Buscador (topbar) | `src/composables/useSearch.ts` + `src/components/TheTopbar.vue` |
| Explorador de parada (líneas → recorrido) | `src/components/map/StopExplorer.vue` + `src/composables/useExploradorParadas.ts` |
| Chips de líneas por modo | `src/components/sidebar/movilidad/TransporteSection.vue` + `useTransporteModos.ts` |
| Capas de datos (Bicing/POI/temp) | `src/components/sidebar/movilidad/CapasDatosSection.vue` + `useCapasDatos.ts` |
| Capas WMS + parcelas | `src/components/sidebar/CapasCard.vue` + `useLayers.ts` |
| Zonas administrativas + renta | `src/components/sidebar/ZonasCard.vue` + `useZones.ts` |
| Mapa base / 3D / medir / radio | `src/components/map/MapControls.vue` (+ `useMapTools`, `useMeasure`, `useRadio`) |

---

## 4. Cada componente del mapa

**El motor y sus capas base viven separados:**
- `src/components/map/MapCanvas.vue` — ciclo de vida del mapa + cableado de eventos (clic, zoom,
  tema). No define capas: las ensambla llamando funciones.
- `src/services/map-layers.js` — **definición de cada capa base** (aquí se edita su `paint`):
  - `addBasemaps()` — satélite, ortofoto ICGC, relieve/topo, DEM, WMS Catastro.
  - `addBcnMask()` — máscara de Barcelona (opacidad/color).
  - `add3dBuildings()` — extrusión 3D (color, altura, opacidad).
  - `addRadioLayers()` — círculo del radio + paradas dentro (colores, grosor, dasharray).
  - `addMeasureLayers()` — línea y vértices de medición.

**Chrome flotante sobre el mapa:**
| Elemento | Archivo |
|---|---|
| Botones flotantes (info / reabrir paneles / tema / GPS) | `src/components/map/MapFabs.vue` |
| Panel de controles (abajo-derecha) | `src/components/map/MapControls.vue` |
| Explorador de parada | `src/components/map/StopExplorer.vue` |
| Barra superior (marca + buscador + tema) | `src/components/TheTopbar.vue` |

**Capas de transporte / datos** (su `paint` y su clic): en sus stores —
`useTransporteModos.ts` (líneas por modo), `useExploradorParadas.ts` (paradas GTFS + recorridos),
`useCapasDatos.ts` (datos abiertos) — y el catálogo declarativo en `src/config/`.

---

## Reglas de oro para editar a mano

- **Color del mapa** → `services/map-theme.js`. **Color/estilo del chrome** → `styles/tokens.css`.
- **Un cambio de estilo = un archivo**. Si te ves tocando varios sitios para lo mismo, avísame:
  probablemente falta centralizar (como hicimos con los popups).
- Tras editar: el hot-reload lo muestra solo. Antes de commitear, `npm run lint && npm run build`.
