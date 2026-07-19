// Definición de las capas base del mapa: fuentes raster alternativas (basemaps), máscara de
// Barcelona, edificios 3D, capas de radio y de medición. Puro montaje imperativo sobre la
// instancia MapLibre — se separó de MapCanvas para que el componente sea solo el ciclo de vida
// del motor + el cableado de eventos. Los colores del estilo vectorial viven en map-theme.js.
import maplibregl from 'maplibre-gl'
import { stopPopup } from './map-popups.js'

// Fuentes raster alternativas al callejero vectorial (satélite, ortofoto, relieve) + overlays
// (DEM para el 3D, WMS del Catastro). Todas arrancan ocultas; MapControls decide cuál se ve.
export function addBasemaps(map) {
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
}

// Máscara: atenúa todo lo que NO es el término municipal de Barcelona (foco visual). Clara en
// tema claro, oscura en tema oscuro. Carga el contorno oficial (GeoJSON) de forma asíncrona.
export function addBcnMask(map, isDark) {
  fetch('https://raw.githubusercontent.com/martgnz/bcn-geodata/master/terme-municipal/terme-municipal.geojson')
    .then(r => r.json())
    .then(geo => {
      const holes = []
      for (const feat of geo.features) {
        const g = feat.geometry
        if (g.type === 'Polygon') holes.push(g.coordinates[0])
        else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => holes.push(poly[0]))
      }
      const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
      map.addSource('bcn-mask', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] } } })
      map.addLayer({ id: 'bcn-mask', type: 'fill', source: 'bcn-mask', paint: { 'fill-color': isDark ? '#151D28' : '#FFFFFF', 'fill-opacity': 0.6 } })
    })
    .catch(err => console.warn('No se pudo cargar la máscara de Barcelona:', err))
}

// Edificios 3D: extrusión sobre la capa building del estilo vectorial (arranca oculta).
export function add3dBuildings(map) {
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
}

// Radio de exploración desde la finca + las paradas que caen dentro. Registra el id de la capa
// de paradas en stopLayerIds para que el click-handler de finca no lo confunda con un clic al mapa.
export function addRadioLayers(map, stopLayerIds) {
  map.addSource('radio', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'radio-fill', type: 'fill', source: 'radio', paint: { 'fill-color': '#2D5BD0', 'fill-opacity': 0.08 } })
  map.addLayer({ id: 'radio-line', type: 'line', source: 'radio', paint: { 'line-color': '#2D5BD0', 'line-width': 2, 'line-dasharray': [2, 2] } })

  map.addSource('radio-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'radio-stops', type: 'circle', source: 'radio-stops', paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } })
  map.on('click', 'radio-stops', (e) => {
    const p = e.features[0].properties
    new maplibregl.Popup({ offset: 12 }).setLngLat(e.lngLat).setHTML(stopPopup(p)).addTo(map)
  })
  map.on('mouseenter', 'radio-stops', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'radio-stops', () => { map.getCanvas().style.cursor = '' })
  stopLayerIds.push('radio-stops')
}

// Capa de medición de distancias (línea + vértices); la alimenta useMeasure con cada clic.
export function addMeasureLayers(map) {
  map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'measure-line', type: 'line', source: 'measure', filter: ['==', '$type', 'LineString'],
    paint: { 'line-color': '#2D5BD0', 'line-width': 2.5, 'line-dasharray': [2, 1] },
  })
  map.addLayer({
    id: 'measure-points', type: 'circle', source: 'measure', filter: ['==', '$type', 'Point'],
    paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#2D5BD0', 'circle-stroke-width': 2 },
  })
}
