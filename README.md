# BCN Radar

Explorador de propiedad urbana de Barcelona: haz clic en cualquier finca y obtén su
**dossier** —urbanismo, movilidad y entorno— unificado y contrastable con la fuente oficial.

🌐 **En vivo:** https://jplazadelosreyes.github.io/bcn-radar/

## Qué hace

- **Situación urbanística al clic** — calificación, clasificación del suelo, plan, sector
  y afectaciones (suspensión de licencias, planeamiento en trámite), en vivo desde el
  Portal de Información Urbanística del Ajuntament (WMS `GetFeatureInfo`).
- **Datos catastrales** de la parcela (referencia, año, superficie, nº de inmuebles).
- **Agregador de capas** públicas sobre el mapa: urbanismo del Ajuntament (con catálogo
  completo del servicio) y Mapa Urbanístic de Catalunya (Generalitat).
- **Movilidad** con fuentes abiertas: Bicing en tiempo real (GBFS) y carriles bici (OSM).
- **Basemaps**: callejero vectorial, satélite y ortofoto de alta resolución (ICGC).
- Herramientas: medición, radio de exploración desde la finca, edificios 3D.

Todo con datos oficiales y abiertos, enlazando siempre a la fuente para contrastar.

## Stack

Vue 3 + Vite + MapLibre GL. Sin backend: consume servicios públicos (WMS/WMTS, GBFS,
Overpass, Catastro, Open Data) directamente desde el cliente.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm run build    # build de producción (deploy automático a GitHub Pages en cada push a main)
```
