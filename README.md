# BCN Radar

Explorador de propiedad urbana de Barcelona: haz clic en cualquier finca y obtén su
**dossier** —urbanismo, catastro, mercado, movilidad y entorno— unificado y contrastable
con la fuente oficial.

🌐 **En vivo:** https://jplazadelosreyes.github.io/bcn-radar/

> Sin backend: la app consume servicios públicos (WMS/WMTS, GBFS, Overpass, Catastro,
> Open Data) directamente desde el cliente y enlaza siempre a la fuente para contrastar.

## Qué hace

- **Situación urbanística al clic** — calificación, clasificación del suelo, plan, sector
  y afectaciones (suspensión de licencias, planeamiento en trámite), en vivo desde el
  Portal de Información Urbanística del Ajuntament (WMS `GetFeatureInfo`).
- **Datos catastrales** de la parcela (referencia, año, superficie, nº de inmuebles).
- **Mercado** — alquiler medio de zona (Incasòl) y referencias de valor.
- **Agregador de capas** públicas: urbanismo del Ajuntament (catálogo completo del
  servicio) y Mapa Urbanístic de Catalunya (Generalitat).
- **Movilidad** con fuentes abiertas: transporte (GTFS + OSM/Overpass), Bicing en tiempo
  real (GBFS) y entorno (OSM).
- **Zonas administrativas** — distritos, barrios y secciones censales con renta media.
- **Mapa 2D o 3D**: callejero vectorial recoloreable (día/noche), satélite, ortofoto ICGC,
  relieve real (DEM) y edificios extruidos. Herramientas de medición y radio de exploración.

## Stack

**Vue 3** (`<script setup>` + TypeScript) · **Vite** · **MapLibre GL** · **Vitest**.
Estado compartido mediante **composables singleton** (sin dependencia de store externa).

## Arquitectura

```
src/
  components/
    layout/   TheTopbar
    map/      MapFabs · MapControls · StopExplorer · (MapCanvas)
    sidebar/  SectionCard (+ cards de sección y fichas)
  composables/  stores singleton: useMapStore · useMapTools · useSheetDrag ·
                useTheme · usePanels · useAutoZones
  services/     acceso a datos por fuente (catastro, piu, transit, poi, zones, renta…)
                y map-theme (paleta de colores del mapa, día/noche)
```

- **La UI no habla con el mapa directamente**: el estado (instancia MapLibre, contexto de
  zoom, herramientas) vive en composables singleton que los componentes consumen.
- **Los colores del mapa** están centralizados y son 100 % editables en
  [`src/services/map-theme.js`](src/services/map-theme.js) — cada capa y cada tipo de
  etiqueta con su propio rol, para día y noche.

## Calidad

| Comando            | Qué hace                                        |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Servidor de desarrollo                          |
| `npm run build`    | Build de producción                             |
| `npm run typecheck`| Chequeo de tipos (`vue-tsc`)                    |
| `npm run lint`     | ESLint (Vue 3 + TypeScript)                     |
| `npm run format`   | Prettier                                        |
| `npm run test`     | Tests unitarios (Vitest)                        |

**CI** (GitHub Actions): cada push a `main` corre `lint + typecheck + test`; solo si pasan
se construye y despliega a **GitHub Pages**.

## Fuentes de datos

Ajuntament de Barcelona (CartoBCN · Open Data · PIU) · Generalitat de Catalunya (ICGC ·
MUC · Incasòl) · Dirección General del Catastro · OpenStreetMap / Overpass · OpenFreeMap ·
GBFS (Bicing). Todos oficiales y abiertos.
