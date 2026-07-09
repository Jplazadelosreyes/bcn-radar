<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any --
   MapCanvas es el LÍMITE con MapLibre GL: la instancia del mapa y los objetos de evento
   tienen tipos enormes y cambiantes; aquí `any` es deliberado y acotado a este archivo. */
// MapCanvas — dueño del ciclo de vida del mapa MapLibre: lo crea, monta las fuentes/capas
// base (basemaps, máscara, edificios 3D, radio, medición) y engancha los eventos (drill por
// zoom + selección de finca al clic, con Catastro + PIU + reverse-geocoding). Escribe los
// stores; su única UI es el lienzo del mapa.
import { onMounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { createMap } from '../../composables/useMap'
import { initAutoZones } from '../../composables/useAutoZones'
import { applyMapTheme } from '../../services/map-theme.js'
import { fetchAlquilerBarcelona } from '../../services/valor.js'
import { useTheme } from '../../composables/useTheme'
import { useMapStore } from '../../composables/useMapStore'
import { useFinca } from '../../composables/useFinca'
import { useMeasure } from '../../composables/useMeasure'
import { useFincaPicker } from '../../composables/useFincaPicker'

const { theme } = useTheme()
const mapStore = useMapStore()
const { mapContext, overlayClickLayers } = mapStore
const { valorZona } = useFinca()
const { measuring, addPoint } = useMeasure()
const { selectFincaAt } = useFincaPicker()

let map: any = null // instancia MapLibre (API amplia; se tipa como any a propósito)

// Recoloreo del mapa al cambiar de tema (paleta día/noche + máscara). Los colores se
// editan en src/services/map-theme.js
watch(theme, (t) => {
  const dark = t === 'dark'
  applyMapTheme(map, dark ? 'night' : 'day')
  if (map && map.getLayer('bcn-mask')) map.setPaintProperty('bcn-mask', 'fill-color', dark ? '#0B1017' : '#FFFFFF')
})

onMounted(() => {
  // Valor de mercado de zona (Incasòl) — dato de ciudad, se carga una vez
  fetchAlquilerBarcelona().then(v => { valorZona.value = v }).catch(err => console.warn('Incasòl', err))

  // Instancia única del mapa (composable singleton): motor, controles nativos y gestos 3D
  map = createMap('map')
  mapStore.map.value = map // registrar la instancia en el store (para futuros componentes)

  // Contornos automáticos: Barcelona → distritos → barrios → secciones según el zoom
  initAutoZones(map, mapContext)

  // Paradas de transporte: opt-in. Solo aparecen cuando el usuario las activa en la
  // card "Movilidad y servicios". (Antes se auto-activaban a z16 y, al alejar, se
  // dibujaban todas las paradas de la ciudad = miles de puntos. Se quitó.)


  // Capas de paradas (transit/radio) — compartidas con los stores para que el click-handler
  // no confunda su clic con seleccionar finca. Las llenan useTransporteModos/useExploradorParadas y useRadio.
  const stopLayerIds = mapStore.stopLayerIds

  map.on('load', () => {
    // Aplica la paleta de colores del mapa (día/noche) + limpieza (2D, sin paradas/POIs).
    // Los colores se editan en src/services/map-theme.js
    applyMapTheme(map, theme.value === 'dark' ? 'night' : 'day')

    // Modelo de elevación (DEM) para el terreno 3D real — AWS Terrain Tiles (terrarium, CORS, sin key)
    map.addSource('dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256, encoding: 'terrarium', maxzoom: 14,
      attribution: 'Elevación: Mapzen / AWS Terrain Tiles',
    })

    // Satélite de alta resolución (ESRI) como fuente raster
    map.addSource('satellite', {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19, // ESRI no sirve tiles >19: MapLibre sobre-escala (borroso) en vez de dejar el hueco
      attribution: 'Tiles © Esri — World Imagery',
    })
    map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } })

    // Basemaps ICGC (WMS, EPSG:3857 + CORS verificados) — alternativas de alta calidad
    map.addSource('icgc-orto', {
      type: 'raster',
      tiles: ['https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms/service?service=WMS&request=GetMap&version=1.3.0&layers=ortofoto_color_vigent&styles=&format=image/png&transparent=false&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256'],
      tileSize: 256,
      attribution: 'Ortofoto © Institut Cartogràfic i Geològic de Catalunya',
    })
    map.addLayer({ id: 'icgc-orto', type: 'raster', source: 'icgc-orto', layout: { visibility: 'none' } })
    // Relieve topográfico (OpenTopoMap): sombreado + curvas de nivel con cotas — muestra la "altura"
    map.addSource('topo', {
      type: 'raster',
      tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'],
      tileSize: 256, maxzoom: 17,
      attribution: '© OpenTopoMap (CC-BY-SA)',
    })
    map.addLayer({ id: 'topo', type: 'raster', source: 'topo', layout: { visibility: 'none' } })

    // WMS Catastro (límites de parcela) como overlay raster opcional
    map.addSource('catastro', {
      type: 'raster',
      tiles: ['https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx?service=WMS&request=GetMap&version=1.1.1&layers=Catastro&styles=&format=image/png&transparent=true&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256'],
      tileSize: 256,
      attribution: 'Dirección General del Catastro',
    })
    map.addLayer({ id: 'catastro', type: 'raster', source: 'catastro', layout: { visibility: 'none' } })

    // Máscara: atenúa todo lo que NO es el término municipal de Barcelona (foco visual)
    fetch('https://raw.githubusercontent.com/martgnz/bcn-geodata/master/terme-municipal/terme-municipal.geojson')
      .then(r => r.json())
      .then(geo => {
        const holes = []
        for (const feat of geo.features) {
          const g = feat.geometry
          if (g.type === 'Polygon') holes.push(g.coordinates[0])
          else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly: any) => holes.push(poly[0]))
        }
        const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
        map.addSource('bcn-mask', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] } } })
        // La máscara atenúa lo que NO es Barcelona: clara en tema claro, oscura en tema oscuro
        map.addLayer({ id: 'bcn-mask', type: 'fill', source: 'bcn-mask', paint: { 'fill-color': theme.value === 'dark' ? '#0B1017' : '#FFFFFF', 'fill-opacity': 0.6 } })
      })
      .catch(err => console.warn('No se pudo cargar la máscara de Barcelona:', err))

    // Edificios 3D: extrusión sobre la capa building del estilo vectorial
    try {
      map.addLayer({
        id: '3d-buildings',
        source: 'openmaptiles',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 14,
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#c2cbdb',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 9],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.88,
        },
      })
    } catch (err) {
      console.warn('No se pudo añadir la capa 3D de edificios:', err)
    }

    // Radio de exploración desde la finca
    map.addSource('radio', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'radio-fill', type: 'fill', source: 'radio', paint: { 'fill-color': '#2D5BD0', 'fill-opacity': 0.08 } })
    map.addLayer({ id: 'radio-line', type: 'line', source: 'radio', paint: { 'line-color': '#2D5BD0', 'line-width': 2, 'line-dasharray': [2, 2] } })

    // Paradas dentro del radio
    map.addSource('radio-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'radio-stops', type: 'circle', source: 'radio-stops', paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } })
    map.on('click', 'radio-stops', (e: any) => {
      const p = e.features[0].properties
      new maplibregl.Popup({ offset: 12 }).setLngLat(e.lngLat).setHTML(`<b>${p.name}</b><br><span style="color:#5B616B">${p.modo}${p.lines ? ' · ' + p.lines : ''}</span>`).addTo(map)
    })
    map.on('mouseenter', 'radio-stops', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'radio-stops', () => { map.getCanvas().style.cursor = '' })
    stopLayerIds.push('radio-stops')

    // Capa de medición de distancias
    map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: 'measure-line', type: 'line', source: 'measure', filter: ['==', '$type', 'LineString'],
      paint: { 'line-color': '#2D5BD0', 'line-width': 2.5, 'line-dasharray': [2, 1] },
    })
    map.addLayer({
      id: 'measure-points', type: 'circle', source: 'measure', filter: ['==', '$type', 'Point'],
      paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#2D5BD0', 'circle-stroke-width': 2 },
    })

    setDrillLevel(map.getZoom())
  })

  // Los controles de basemap / catastro / 3D los gestiona Vue (setBasemap, toggleFincas,
  // toggleEdificios3d, toggleRelieve3d) para que el checkbox nunca se desincronice del mapa.

  // ── Drill-down por zoom (Paso 1) ──
  // El sidebar cambia de capa según la altura. Los polígonos GeoJSON de
  // distritos/barrios/secciones (con hover + click para seleccionar/filtrar)
  // se portan a MapLibre en el Paso 2 con feature-state nativo.
  function setDrillLevel(z: number) {
    if (z < 12) mapContext.value.level = 'ciudad'
    else if (z < 14) mapContext.value.level = 'distrito'
    else if (z < 15) mapContext.value.level = 'barrio'
    else if (z < 16) mapContext.value.level = 'seccion'
    else mapContext.value.level = 'finca'
  }

  map.on('zoomend', () => setDrillLevel(map.getZoom()))

  // MAGIA INTERACTIVA: seleccionar la finca/dirección con el ratón (lógica en useFincaPicker).
  map.on('click', async function (e: any) {
    // En modo medición el clic añade un vértice, no selecciona finca
    if (measuring.value) {
      addPoint(e.lngLat)
      return
    }
    // Si el clic cae sobre una parada de transporte, deja que su popup lo maneje
    const guardLayers = [...stopLayerIds, ...overlayClickLayers].filter(id => map.getLayer(id))
    if (guardLayers.length && map.queryRenderedFeatures(e.point, { layers: guardLayers }).length) return
    // Solo permitimos clavar el pin si ya estamos a nivel de calle/finca (Zoom >= 16)
    if (map.getZoom() >= 16) await selectFincaAt(map, e.lngLat)
  });

})
</script>

<template>
  <div id="map" class="map-container"></div>
</template>
