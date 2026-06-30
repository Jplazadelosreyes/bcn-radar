<script setup>
import { onMounted, ref, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchFinca } from './services/catastro.js'

// Variables reactivas para el panel
const searchQuery = ref('')
const selectedAddress = ref(null)
const selectedBarrio = ref(null)
const measureTotal = ref(null) // distancia acumulada de la herramienta de medición

// Capas de transporte (recorridos reales desde OpenStreetMap / Overpass)
const TRANSPORTES = [
  { key: 'metro',    label: 'Metro',           color: '#E2231A', filter: '["route"="subway"]' },
  { key: 'rodalies', label: 'Rodalies / Renfe', color: '#1A8A4A', filter: '["route"="train"]' },
  { key: 'bus',      label: 'Bus',             color: '#0067B1', filter: '["route"="bus"]' },
  { key: 'tram',     label: 'FGC / Tranvía',   color: '#E87200', filter: '["route"~"tram|light_rail"]' },
]
const transportStatus = ref({}) // { metro: 'loading'|'ok'|'error', ... }

// Estado Reactivo del Panel Lateral Dinámico
const mapContext = ref({
  level: 'ciudad', // 'ciudad', 'distrito', 'barrio', 'seccion', 'finca'
  distritoName: null,
  barrioName: null,
  seccionCode: null,
});

const fincaData = ref({
  estado: 'vacio', // 'vacio' | 'cargando' | 'ok' | 'sin-parcela' | 'error'
  refCatastral: null,   // RC parcela (14)
  rcInmueble: null,     // RC inmueble (20)
  ano: null,
  superficie: null,
  uso: null,
  coefParticipacion: null,
  nInmuebles: null,
  plantas: null,
})

// Coordenadas del último clic, para la miniatura satélite de la parcela
const clickedCoords = ref(null)

// Miniatura satélite real (ortofoto ESRI) centrada en la parcela seleccionada
const satelliteThumb = computed(() => {
  if (!clickedCoords.value) return null
  const { lat, lng } = clickedCoords.value
  const d = 0.0006 // ~60 m de margen
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`
  return `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=160,160&format=jpg&f=image`
})

// Antigüedad del edificio en años
const antiguedad = computed(() =>
  fincaData.value.ano ? new Date().getFullYear() - fincaData.value.ano : null
)

// Superficie útil estimada (~85% de la construida) — siempre marcada como estimación
const supUtilEstimada = computed(() =>
  fincaData.value.superficie ? Math.round(fincaData.value.superficie * 0.85) : null
)

// ── Lectura crítica de la finca ──
// Cada veredicto cruza un DATO REAL del Catastro con REGULACIÓN real (ITE, LPH, uso).
// No inventa nada: interpreta lo que ya tenemos para que cada cifra "pese".
const veredictos = computed(() => {
  if (fincaData.value.estado !== 'ok') return []
  const f = fincaData.value
  const v = []

  // Antigüedad → ITE obligatoria en Cataluña (>45 años)
  if (antiguedad.value != null) {
    if (antiguedad.value > 45) {
      v.push({
        tone: 'amber',
        titulo: `Edificio de ${antiguedad.value} años · ITE obligatoria`,
        desc: 'En Cataluña los edificios de más de 45 años deben pasar la Inspección Técnica (ITE). Exige el Certificado de Aptitud vigente; sin él, riesgo de derramas estructurales.',
      })
    } else {
      v.push({
        tone: 'green',
        titulo: `Edificio de ${antiguedad.value} años`,
        desc: 'Por debajo del umbral de ITE obligatoria (45 años).',
      })
    }
  }

  // Uso catastral → ¿apto para vivienda?
  if (f.uso) {
    if (/resid|vivienda/i.test(f.uso)) {
      v.push({
        tone: 'green',
        titulo: 'Uso residencial',
        desc: 'Apto para vivienda y financiación hipotecaria estándar.',
      })
    } else {
      v.push({
        tone: 'red',
        titulo: `Uso catastral: ${f.uso} (no residencial)`,
        desc: 'Verifica que tenga cédula de habitabilidad para vivienda antes de plantear vivir, empadronarte o hipotecarlo como hogar.',
      })
    }
  }

  // Coeficiente de participación → cuánto te toca en derramas.
  // Solo tiene sentido en finca plurifamiliar y con un % plausible (0–100).
  // OJO: catastro.js (pctFromCpt) devuelve valores fuera de rango para algunos
  // inmuebles (p.ej. 10000%) — pendiente de verificar el XML crudo del DGC.
  if (f.coefParticipacion > 0 && f.coefParticipacion <= 100 && f.nInmuebles > 1) {
    const derrama = Math.round((100000 * f.coefParticipacion) / 100)
    v.push({
      tone: 'blue',
      titulo: `Tu cuota en la comunidad: ${f.coefParticipacion}%`,
      desc: `Es tu parte en gastos comunes y derramas. Una derrama de 100.000 € de la finca = ~${derrama.toLocaleString('es-ES')} € para ti.`,
    })
  }

  // Plurifamiliar → comunidad de propietarios
  if (f.nInmuebles > 1) {
    v.push({
      tone: 'blue',
      titulo: `Finca plurifamiliar · ${f.nInmuebles} inmuebles`,
      desc: 'Hay comunidad de propietarios activa. Pide actas y el estado de derramas aprobadas (Art. 9 LPH) antes de firmar.',
    })
  }

  return v
})

// ── Mercado de ZONA (estimación · sin feed oficial en vivo todavía) ──
// Placeholders explícitos hasta cablear Incasòl / Registradores.
const mercadoZona = {
  yield: '4,8',
  venta: '4.820',
  alquiler: '17,8',
}

// Deep-links oficiales con la referencia catastral inyectada (regla de verificabilidad)
const deepLinks = computed(() => {
  const rc14 = fincaData.value.refCatastral
  return {
    catastro: 'https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?buscar=S',
    piu: rc14 ? `https://ajuntament.barcelona.cat/informaciourbanistica/cerca/es/fitxa/${rc14}/--/--/pa/` : '#',
    cedula: 'https://agenciahabitatge.gencat.cat/es/temas/rehabilitacion-y-calidad-de-la-edificacion/control-de-calidad-de-la-vivienda/buscador-de-cedulas',
    cee: 'https://certificacioenergetica.gencat.cat/icaen-visor/AppJava/views/portada.xhtml',
    indiceAlquiler: 'https://agenciahabitatge.gencat.cat/indexlloguer/',
    hutb: 'https://meet.barcelona.cat/habitatgesturistics/es',
  }
})

// Enlaces oficiales a nivel ciudad (Capa 1) — hechos legales reales, no estimaciones
const ciudadLinks = {
  indiceAlquiler: 'https://agenciahabitatge.gencat.cat/indexlloguer/',
  serpavi: 'https://serpavi.mivau.gob.es/',
  itpAtc: 'https://atc.gencat.cat/es/tributs/itpajd/tpo/tarifes-tipus/',
  avalIco: 'https://www.ico.es/en/linea-avales-hipoteca-primera-vivienda',
  openData: 'https://opendata-ajuntament.barcelona.cat/es',
}

// Enlaces oficiales por zona (Capas 2-4) — fuentes públicas reales, sin cifras inventadas
const zonaLinks = {
  portalDades: 'https://portaldades.ajuntament.barcelona.cat/ca/',
  incasolLloguer: 'https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/mercat_de_lloguer/lloguers-barcelona-per-districtes-i-barris/',
  idescatEmex: 'https://www.idescat.cat/emex/?id=080193',
  lloguerBarris: 'https://opendata-ajuntament.barcelona.cat/data/ca/dataset/h2mallo-a',
  ineAtlasRenta: 'https://www.ine.es/experimental/atlas/experimental_atlas.htm',
  hutb: 'https://meet.barcelona.cat/habitatgesturistics/es',
}

// Copiar al portapapeles (referencias catastrales)
const copiar = (texto) => {
  if (texto && navigator.clipboard) navigator.clipboard.writeText(texto)
}

// Checklist del comprador (contenido estático didáctico — NO se inventa nada privado)
const checklistComprador = [
  { icono: '📄', titulo: 'Nota Simple (Registro de la Propiedad)', desc: 'Comprueba titularidad real, hipotecas vigentes, embargos o usufructos.', url: 'https://sede.registradores.org/site/propiedad' },
  { icono: '🏗️', titulo: 'ITE y Certificado de Aptitud', desc: 'Obligatorio si el edificio tiene >45 años. Te salva de vicios estructurales y derramas.', url: null },
  { icono: '📜', titulo: 'Cédula de Habitabilidad y CEE', desc: 'La cédula garantiza mínimos de habitabilidad. Ambos obligatorios para arras y notaría.', url: null },
  { icono: '🏛️', titulo: 'Certificado de Deudas de la Comunidad', desc: 'Emitido por el Administrador. Evita heredar deudas o derramas aprobadas (Art. 9 LPH).', url: null },
  { icono: '🧾', titulo: 'Último recibo de IBI y Basuras', desc: 'Asegura que los impuestos municipales están al día; el año en curso se prorratea.', url: null },
  { icono: '⚡', titulo: 'Últimas facturas de suministros', desc: 'Evita cortes; si la luz lleva meses de baja, exigirán un nuevo Boletín (CIE).', url: 'https://www.edistribucion.com/' },
]

let map = null
let searchMarker = null

// Simulación de generar PDF
const exportReport = () => {
  alert("Generando Informe Oficial en PDF...\\nEn el producto final, esto enviará un email al reclutador con el branding de la empresa.");
}

// Función de Geocoding (Convertir texto a Coordenadas)
const buscarDireccion = async () => {
  if (!searchQuery.value) return;
  
  // Usamos la API gratuita de Nominatim (OpenStreetMap)
  // Agregamos ", Barcelona" automáticamente para acotar la búsqueda a la ciudad
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.value + ', Barcelona')}`
  
  try {
    const response = await fetch(url)
    const results = await response.json()
    
    if (results && results.length > 0) {
      const { lat, lon, display_name } = results[0]
      
      // Hacemos zoom directamente a la calle encontrada
      map.flyTo({ center: [Number(lon), Number(lat)], zoom: 17 })

      // Clavamos (o movemos) el pin en la dirección exacta
      const popup = new maplibregl.Popup({ offset: 24 }).setHTML(`<b>🏠 Dirección encontrada:</b><br>${display_name}`)
      if (searchMarker) {
        searchMarker.setLngLat([Number(lon), Number(lat)]).setPopup(popup)
      } else {
        searchMarker = new maplibregl.Marker({ color: '#D24B3E' }).setLngLat([Number(lon), Number(lat)]).setPopup(popup).addTo(map)
      }
      searchMarker.togglePopup()

    } else {
      alert("No se encontró la dirección. Intenta quitar el número o ser más general.")
    }
  } catch (error) {
    console.error("Error en la búsqueda:", error)
  }
}

// Indicador de zoom como control nativo de MapLibre
class ZoomIndicatorControl {
  onAdd(m) {
    this._map = m
    this._box = document.createElement('div')
    this._box.className = 'maplibregl-ctrl zoom-indicator-box'
    const render = () => { this._box.innerHTML = `<b>🔍 Zoom:</b> ${m.getZoom().toFixed(0)}` }
    render(); m.on('zoom', render)
    return this._box
  }
  onRemove() { this._box.remove(); this._map = undefined }
}

// Rosa de los vientos: gira con la orientación; clic = volver al norte y aplanar
class CompassRoseControl {
  onAdd(m) {
    this._map = m
    this._box = document.createElement('div')
    this._box.className = 'maplibregl-ctrl maplibregl-ctrl-group compass-rose'
    this._box.title = 'Volver al norte'
    this._box.innerHTML = `
      <svg viewBox="0 0 48 48" width="40" height="40">
        <g class="compass-dial">
          <circle cx="24" cy="24" r="21" fill="#fff" stroke="#E6E9EF"/>
          <polygon points="24,5 28,24 24,21 20,24" fill="#D24B3E"/>
          <polygon points="24,43 20,24 24,27 28,24" fill="#8A93A3"/>
          <text x="24" y="13" text-anchor="middle" font-size="8" font-weight="700" fill="#0E1726" font-family="Inter,sans-serif">N</text>
          <text x="24" y="42" text-anchor="middle" font-size="6" fill="#9098A4" font-family="Inter,sans-serif">S</text>
          <text x="42" y="26.5" text-anchor="middle" font-size="6" fill="#9098A4" font-family="Inter,sans-serif">E</text>
          <text x="6" y="26.5" text-anchor="middle" font-size="6" fill="#9098A4" font-family="Inter,sans-serif">O</text>
        </g>
      </svg>`
    this._dial = this._box.querySelector('.compass-dial')
    this._box.addEventListener('click', () => m.easeTo({ bearing: 0, pitch: 0, duration: 500 }))
    const rotate = () => { this._dial.style.transform = `rotate(${-m.getBearing()}deg)` }
    m.on('rotate', rotate); rotate()
    return this._box
  }
  onRemove() { this._box.remove(); this._map = undefined }
}

onMounted(() => {
  // Límites amplios (toda la provincia) para que nunca se vean bordes grises
  const bcnBounds = [[1.7000, 41.1000], [2.5000, 41.6000]] // [SW],[NE] en lng,lat

  // Motor MapLibre GL (open source) + basemap vectorial OpenFreeMap (sin API key)
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [2.1734, 41.3851],
    zoom: 11,
    minZoom: 11,
    maxZoom: 21,
    maxPitch: 70,
    maxBounds: bcnBounds,
    attributionControl: { compact: true },
  })

  // Navegación completa: zoom, brújula (rotar/orientar) e inclinación 3D
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }), 'top-right')
  // Pantalla completa
  map.addControl(new maplibregl.FullscreenControl(), 'top-right')
  // Geolocalización (mi ubicación, con rumbo)
  map.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true,
  }), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
  map.addControl(new ZoomIndicatorControl(), 'top-left')
  map.addControl(new CompassRoseControl(), 'top-right')

  // Gestos 3D: arrastrar con botón derecho o Ctrl+arrastrar para rotar/inclinar
  map.dragRotate.enable()
  map.touchZoomRotate.enableRotation()
  if (map.touchPitch) map.touchPitch.enable()

  // ── Herramienta de medición de distancias ──
  let measuring = false
  const measurePoints = []
  const haversine = (a, b) => {
    const R = 6371000, toRad = d => d * Math.PI / 180
    const dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0])
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
  }
  const renderMeasure = () => {
    const feats = measurePoints.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p } }))
    if (measurePoints.length >= 2) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: measurePoints } })
    const src = map.getSource('measure')
    if (src) src.setData({ type: 'FeatureCollection', features: feats })
    let total = 0
    for (let i = 1; i < measurePoints.length; i++) total += haversine(measurePoints[i - 1], measurePoints[i])
    measureTotal.value = measurePoints.length < 2 ? null : (total >= 1000 ? `${(total / 1000).toFixed(2)} km` : `${Math.round(total)} m`)
  }
  const clearMeasure = () => { measurePoints.length = 0; renderMeasure() }
  const setMeasuring = (on) => {
    measuring = on
    map.getCanvas().style.cursor = on ? 'crosshair' : ''
    if (!on) clearMeasure()
  }
  const checkMeasure = document.getElementById('check-measure')
  if (checkMeasure) checkMeasure.addEventListener('change', (e) => setMeasuring(e.target.checked))
  const btnMeasureClear = document.getElementById('btn-measure-clear')
  if (btnMeasureClear) btnMeasureClear.addEventListener('click', () => clearMeasure())

  // ── Capas de transporte (lazy-load desde Overpass al activar el toggle) ──
  const TRANSPORT_BBOX = '41.27,2.00,41.50,2.30' // S,W,N,E (BCN + área cercana)
  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ]
  // Prueba los mirrors en orden hasta obtener una respuesta válida (Overpass público suele saturarse)
  async function overpassFetch(q) {
    let lastErr
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(q),
        })
        if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue }
        return await res.json()
      } catch (e) { lastErr = e }
    }
    throw lastErr || new Error('Overpass sin respuesta')
  }
  async function loadTransport(cfg, visible) {
    const srcId = `tr-${cfg.key}`
    const layerId = `${srcId}-line`
    if (map.getSource(srcId)) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
      return
    }
    if (!visible) return
    transportStatus.value = { ...transportStatus.value, [cfg.key]: 'loading' }
    try {
      const q = `[out:json][timeout:90];(relation${cfg.filter}(${TRANSPORT_BBOX}););out geom;`
      const data = await overpassFetch(q)
      const features = (data.elements || [])
        .filter(el => el.type === 'relation' && el.members)
        .map(rel => {
          const lines = rel.members
            .filter(m => m.type === 'way' && m.geometry)
            .map(m => m.geometry.map(g => [g.lon, g.lat]))
          return {
            type: 'Feature',
            properties: { colour: rel.tags?.colour || null, ref: rel.tags?.ref || '', name: rel.tags?.name || '' },
            geometry: { type: 'MultiLineString', coordinates: lines },
          }
        })
        .filter(f => f.geometry.coordinates.length)
      map.addSource(srcId, { type: 'geojson', data: { type: 'FeatureCollection', features } })
      map.addLayer({
        id: layerId, type: 'line', source: srcId,
        layout: { 'line-join': 'round', 'line-cap': 'round', visibility: visible ? 'visible' : 'none' },
        paint: {
          'line-color': ['coalesce', ['get', 'colour'], cfg.color],
          'line-width': cfg.key === 'bus' ? 1.2 : 3,
          'line-opacity': cfg.key === 'bus' ? 0.55 : 0.85,
        },
      })
      transportStatus.value = { ...transportStatus.value, [cfg.key]: 'ok' }
    } catch (err) {
      console.warn('Overpass transporte', cfg.key, err)
      transportStatus.value = { ...transportStatus.value, [cfg.key]: 'error' }
    }
  }
  TRANSPORTES.forEach(cfg => {
    const el = document.getElementById(`tr-${cfg.key}`)
    if (el) el.addEventListener('change', (e) => loadTransport(cfg, e.target.checked))
  })

  map.on('load', () => {
    // Satélite de alta resolución (ESRI) como fuente raster
    map.addSource('satellite', {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19, // ESRI no sirve tiles >19: MapLibre sobre-escala (borroso) en vez de dejar el hueco
      attribution: 'Tiles © Esri — World Imagery',
    })
    map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } })

    // WMS Catastro (límites de parcela) como overlay raster opcional
    map.addSource('catastro', {
      type: 'raster',
      tiles: ['https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx?service=WMS&request=GetMap&version=1.1.1&layers=Catastro&styles=&format=image/png&transparent=true&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256'],
      tileSize: 256,
      attribution: 'Dirección General del Catastro',
    })
    map.addLayer({ id: 'catastro', type: 'raster', source: 'catastro', layout: { visibility: 'none' } })

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

  // Alternar callejero vectorial ↔ satélite
  document.querySelectorAll('input[name="mapStyle"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const sat = e.target.value === 'satelite'
      if (map.getLayer('satellite')) map.setLayoutProperty('satellite', 'visibility', sat ? 'visible' : 'none')
    })
  })

  // Encender/apagar parcelas (Catastro WMS)
  document.getElementById('check-fincas').addEventListener('change', function (e) {
    if (map.getLayer('catastro')) map.setLayoutProperty('catastro', 'visibility', e.target.checked ? 'visible' : 'none')
    if (e.target.checked && map.getZoom() < 17) map.easeTo({ zoom: 17 })
  })

  // Encender/apagar edificios 3D (inclina la cámara para que se aprecie el volumen)
  const check3d = document.getElementById('check-3d')
  if (check3d) check3d.addEventListener('change', function (e) {
    if (map.getLayer('3d-buildings')) map.setLayoutProperty('3d-buildings', 'visibility', e.target.checked ? 'visible' : 'none')
    map.easeTo({ pitch: e.target.checked ? 55 : 0, duration: 600 })
    if (e.target.checked && map.getZoom() < 15) map.easeTo({ zoom: 15.5, pitch: 55 })
  })

  // ── Drill-down por zoom (Paso 1) ──
  // El sidebar cambia de capa según la altura. Los polígonos GeoJSON de
  // distritos/barrios/secciones (con hover + click para seleccionar/filtrar)
  // se portan a MapLibre en el Paso 2 con feature-state nativo.
  function setDrillLevel(z) {
    if (z < 12) mapContext.value.level = 'ciudad'
    else if (z < 14) mapContext.value.level = 'distrito'
    else if (z < 15) mapContext.value.level = 'barrio'
    else if (z < 16) mapContext.value.level = 'seccion'
    else mapContext.value.level = 'finca'
  }

  map.on('zoomend', () => setDrillLevel(map.getZoom()))

  // MAGIA INTERACTIVA: Seleccionar la finca/dirección con el ratón
  map.on('click', async function(e) {
    // En modo medición el clic añade un vértice, no selecciona finca
    if (measuring) {
      measurePoints.push([e.lngLat.lng, e.lngLat.lat])
      renderMeasure()
      return
    }
    // Solo permitimos clavar el pin si ya estamos a nivel de calle/finca (Zoom >= 16)
    if (map.getZoom() >= 16) {
      const lat = e.lngLat.lat;
      const lng = e.lngLat.lng;
      clickedCoords.value = { lat, lng };

      // Movemos el pin o lo creamos
      if (searchMarker) {
        searchMarker.setLngLat([lng, lat]);
      } else {
        searchMarker = new maplibregl.Marker({ color: '#D24B3E' }).setLngLat([lng, lat]).addTo(map);
      }

      // Reverse Geocoding (Traducir coordenadas a Calle y Número)
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.address) {
          // Extraemos la calle y el número
          const calle = data.address.road || data.address.pedestrian || 'Calle Desconocida';
          const numero = data.address.house_number || '';
          const direccionCorta = `${calle} ${numero}`.trim();
          
          // Actualizamos la caja de búsqueda visualmente para el usuario
          searchQuery.value = direccionCorta;
          selectedAddress.value = direccionCorta;
          
          searchMarker.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`<b>🏢 Finca Seleccionada</b><br>${data.display_name}`));
          if (!searchMarker.getPopup().isOpen()) searchMarker.togglePopup();
        } else {
          selectedAddress.value = `Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          searchMarker.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`<b>🏢 Finca Seleccionada</b><br>Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`));
          if (!searchMarker.getPopup().isOpen()) searchMarker.togglePopup();
        }

        // Datos catastrales REALES: coords → ref. de parcela (14) → finca (edificio + unidad)
        fincaData.value = { ...fincaData.value, estado: 'cargando', refCatastral: null };
        try {
          const coordUrl = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=${lng}&Coordenada_Y=${lat}`;
          const coordDoc = new DOMParser().parseFromString(await (await fetch(coordUrl)).text(), 'text/xml');
          const pc1 = coordDoc.getElementsByTagName('pc1')[0]?.textContent || '';
          const pc2 = coordDoc.getElementsByTagName('pc2')[0]?.textContent || '';

          if (!pc1 || !pc2) {
            fincaData.value = { estado: 'sin-parcela', refCatastral: null, ano: null, superficie: null, uso: null, nInmuebles: null, plantas: null };
          } else {
            const finca = await fetchFinca(pc1 + pc2);
            fincaData.value = {
              estado: 'ok',
              refCatastral: finca.rc14,
              rcInmueble: finca.rcInmueble,
              ano: finca.ano,
              superficie: finca.superficie,
              uso: finca.uso,
              coefParticipacion: finca.coefParticipacion,
              nInmuebles: finca.nInmuebles,
              plantas: finca.plantas,
            };
          }
        } catch (catErr) {
          console.error('Error Catastro', catErr);
          fincaData.value = { ...fincaData.value, estado: 'error' };
        }

      } catch (error) {
        console.error("Error obteniendo la dirección:", error);
      }
    }
  });

})
</script>

<template>
  <div class="app-container">
    <header class="topbar">
      <div class="topbar-brand">
        <div class="topbar-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7FA0E8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 12 18.5 5.5"></path></svg>
        </div>
        <div class="topbar-titles">
          <span class="topbar-name">BCN Radar</span>
          <span class="topbar-tag">Escáner de propiedad · Barcelona</span>
        </div>
      </div>

      <div class="search-box">
        <span class="search-ic">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7689" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
        </span>
        <input
          v-model="searchQuery"
          @keyup.enter="buscarDireccion"
          type="text"
          placeholder="Ej: Carrer de València, 285"
        />
        <button @click="buscarDireccion">Buscar</button>
      </div>
    </header>
    
    <main class="main-content">
      
      <!-- PANEL LATERAL (IZQUIERDA) -->
      <aside class="sidebar">
        
        <!-- NIVEL 0: CIUDAD — marco legal real de toda Barcelona (hub de fuentes oficiales) -->
        <div v-if="mapContext.level === 'ciudad'" class="context-panel">
          <div class="ficha-header">
            <div class="ficha-crumb">Barcelona · marco legal de ciudad</div>
            <h2 class="ficha-address">Barcelona</h2>
            <p class="ficha-note-sm" style="margin-top:7px">Reglas que aplican a toda la ciudad. Haz clic en un distrito para bajar de nivel.</p>
          </div>

          <!-- Alquiler: zona tensionada -->
          <div class="ficha-block">
            <div class="ficha-block-head">
              <span class="ficha-block-title">Régimen de alquiler</span>
              <span class="ficha-source">Ley Vivienda · Generalitat</span>
            </div>
            <div class="ver ver-amber">
              <span class="ver-dot"></span>
              <div class="ver-body">
                <span class="ver-titulo">Toda Barcelona es zona tensionada</span>
                <span class="ver-desc">El alquiler de vivienda habitual está topado por el índice de referencia. Si compras para alquilar, calcula el máximo legal antes de cerrar números.</span>
              </div>
            </div>
            <a class="ficha-cta" :href="ciudadLinks.indiceAlquiler" target="_blank" rel="noopener">Índice de alquiler · Generalitat →</a>
            <a class="ficha-doc" :href="ciudadLinks.serpavi" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Sistema estatal de referencia (SERPAVI)</span>
                <span class="ficha-doc-d">Calcula el alquiler máximo permitido</span>
              </span>
              <span class="ficha-badge">consultar 🔗</span>
            </a>
          </div>

          <!-- Comprar: ITP -->
          <div class="ficha-block">
            <div class="ficha-block-head">
              <span class="ficha-block-title">Comprar · Impuesto ITP</span>
              <span class="ficha-source">ATC · Generalitat</span>
            </div>
            <div class="ver ver-blue">
              <span class="ver-dot"></span>
              <div class="ver-body">
                <span class="ver-titulo">ITP: 10 % hasta 600.000 €</span>
                <span class="ver-desc">Por encima de 600.000 € se aplica una tarifa progresiva. Se calcula sobre el precio de compra o el Valor de Referencia de Catastro, el que sea mayor.</span>
              </div>
            </div>
            <div class="clave-legend">
              <div class="clave-row ok"><span class="clave-tag">5 %</span><span>Vivienda habitual de joven ≤35, familia numerosa, monoparental o con discapacidad.</span></div>
              <div class="clave-row ok"><span class="clave-tag">7 %</span><span>Vivienda habitual de protección oficial (VPO).</span></div>
            </div>
            <a class="ficha-cta" :href="ciudadLinks.itpAtc" target="_blank" rel="noopener">Tarifas oficiales ITP · ATC →</a>
          </div>

          <!-- Financiación: Aval ICO -->
          <div class="ficha-block">
            <div class="ficha-block-head">
              <span class="ficha-block-title">Financiación · Aval ICO</span>
              <span class="ficha-source">ICO · Mº Vivienda</span>
            </div>
            <div class="ver ver-green">
              <span class="ver-dot"></span>
              <div class="ver-body">
                <span class="ver-titulo">Aval del Estado de hasta el 20 %</span>
                <span class="ver-desc">Para menores de 35 o con menores a cargo en su primera vivienda: el aval cubre la entrada y permite hipoteca de hasta el 100 % (25 % si el CEE es D o superior).</span>
              </div>
            </div>
            <div class="ver ver-amber">
              <span class="ver-dot"></span>
              <div class="ver-body">
                <span class="ver-titulo">En pausa durante 2026</span>
                <span class="ver-desc">La firma de nuevos avales está temporalmente parada a la espera de la addenda de prórroga (vigente hasta 2027). Confírmalo con tu banco.</span>
              </div>
            </div>
            <a class="ficha-cta" :href="ciudadLinks.avalIco" target="_blank" rel="noopener">Línea de avales ICO →</a>
          </div>

          <!-- Hub de fuentes abiertas -->
          <div class="ficha-block">
            <div class="ficha-block-head"><span class="ficha-block-title">Fuentes abiertas de ciudad</span></div>
            <a class="ficha-doc" :href="ciudadLinks.openData" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Open Data BCN</span>
                <span class="ficha-doc-d">Portal de datos abiertos del Ajuntament</span>
              </span>
              <span class="ficha-badge">abrir 🔗</span>
            </a>
            <p class="ficha-note-sm">Baja a un distrito o barrio para ver datos de mercado y entorno con su fuente.</p>
          </div>
        </div>

        <!-- NIVEL 1: DISTRITO — foto media + accesos a la estadística oficial del distrito -->
        <div v-else-if="mapContext.level === 'distrito'" class="context-panel">
          <div class="ficha-header">
            <div class="ficha-crumb"><span class="ficha-crumb-hi">Barcelona</span><span class="ficha-crumb-sep">›</span>distrito</div>
            <h2 class="ficha-address">{{ mapContext.distritoName || 'Selecciona un distrito' }}</h2>
            <p class="ficha-note-sm" style="margin-top:7px">Compara este distrito con la media de la ciudad. Haz clic en un barrio para bajar de nivel.</p>
          </div>

          <div class="ficha-block">
            <div class="ficha-block-head">
              <span class="ficha-block-title">Qué mirar en un distrito</span>
            </div>
            <div class="ver ver-blue">
              <span class="ver-dot"></span>
              <div class="ver-body">
                <span class="ver-titulo">Precio medio y liquidez</span>
                <span class="ver-desc">El distrito da la foto agregada: precio €/m² frente a la media de la ciudad y cuánta oferta se mueve. Sirve para descartar zonas, no para decidir un piso concreto.</span>
              </div>
            </div>
          </div>

          <div class="ficha-block">
            <div class="ficha-block-head">
              <span class="ficha-block-title">Fuentes oficiales</span>
              <span class="ficha-source">Ajuntament · Generalitat</span>
            </div>
            <a class="ficha-doc" :href="zonaLinks.portalDades" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Barcelona Dades</span>
                <span class="ficha-doc-d">Estadística por distrito y barrio · Ajuntament</span>
              </span>
              <span class="ficha-badge">abrir 🔗</span>
            </a>
            <a class="ficha-doc" :href="zonaLinks.incasolLloguer" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Alquiler medio oficial (INCASÒL)</span>
                <span class="ficha-doc-d">Fianzas depositadas, por distrito y barrio</span>
              </span>
              <span class="ficha-badge">consultar 🔗</span>
            </a>
            <a class="ficha-doc" :href="zonaLinks.idescatEmex" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Barcelona en cifras (Idescat)</span>
                <span class="ficha-doc-d">Población, renta y actividad económica</span>
              </span>
              <span class="ficha-badge">abrir 🔗</span>
            </a>
          </div>
        </div>

        <!-- NIVEL 2: BARRIO — donde se decide: mercado, rentabilidad y entorno con fuente -->
        <div v-else-if="mapContext.level === 'barrio'" class="context-panel">
          <div class="ficha-header">
            <div class="ficha-crumb"><span class="ficha-crumb-hi">{{ mapContext.distritoName || 'Barcelona' }}</span><span class="ficha-crumb-sep">›</span>barrio</div>
            <h2 class="ficha-address">{{ mapContext.barrioName || 'Selecciona un barrio' }}</h2>
            <p class="ficha-note-sm" style="margin-top:7px">El barrio es donde se decide la compra: mercado, entorno y servicios. Haz clic para ver las secciones censales.</p>
          </div>

          <div class="ficha-block">
            <div class="ficha-block-head">
              <span class="ficha-block-title">Rentabilidad · cómo calcularla</span>
            </div>
            <div class="ver ver-blue">
              <span class="ver-dot"></span>
              <div class="ver-body">
                <span class="ver-titulo">Yield bruto = alquiler anual ÷ precio de compra</span>
                <span class="ver-desc">Cruza el alquiler medio y el precio de venta del barrio (fuentes abajo). El resultado te dice si conviene comprar para vivir o para alquilar (buy-to-let).</span>
              </div>
            </div>
          </div>

          <div class="ficha-block">
            <div class="ficha-block-head">
              <span class="ficha-block-title">Fuentes oficiales del barrio</span>
              <span class="ficha-source">Open Data · Generalitat</span>
            </div>
            <a class="ficha-doc" :href="zonaLinks.lloguerBarris" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Precio de alquiler por barrios</span>
                <span class="ficha-doc-d">Estimación mensual · Open Data BCN</span>
              </span>
              <span class="ficha-badge">abrir 🔗</span>
            </a>
            <a class="ficha-doc" :href="zonaLinks.incasolLloguer" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Alquiler medio oficial (INCASÒL)</span>
                <span class="ficha-doc-d">Fianzas depositadas, por barrio</span>
              </span>
              <span class="ficha-badge">consultar 🔗</span>
            </a>
            <a class="ficha-doc" :href="zonaLinks.hutb" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Pisos turísticos (HUT)</span>
                <span class="ficha-doc-d">Densidad de licencias activas en la zona</span>
              </span>
              <span class="ficha-badge">consultar 🔗</span>
            </a>
          </div>
        </div>

        <!-- NIVEL 3: SECCIÓN CENSAL — micro-entorno: renta, demografía y presión turística -->
        <div v-else-if="mapContext.level === 'seccion'" class="context-panel">
          <div class="ficha-header">
            <div class="ficha-crumb"><span class="ficha-crumb-hi">{{ mapContext.barrioName || 'Barcelona' }}</span><span class="ficha-crumb-sep">›</span>sección censal</div>
            <h2 class="ficha-address ficha-crumb-mono" style="font-size:20px">{{ mapContext.seccionCode || 'Selecciona una sección' }}</h2>
            <p class="ficha-note-sm" style="margin-top:7px">El micro-entorno: renta, demografía y presión turística de unas pocas manzanas. Haz clic en cualquier calle para ver la finca.</p>
          </div>

          <div class="ficha-block">
            <div class="ficha-block-head">
              <span class="ficha-block-title">Qué mide una sección</span>
            </div>
            <div class="ver ver-blue">
              <span class="ver-dot"></span>
              <div class="ver-body">
                <span class="ver-titulo">Renta y perfil del hogar</span>
                <span class="ver-desc">La sección censal es la unidad más fina con datos de renta del INE. Te da el poder adquisitivo real del vecindario inmediato, no la media del barrio.</span>
              </div>
            </div>
          </div>

          <div class="ficha-block">
            <div class="ficha-block-head">
              <span class="ficha-block-title">Fuentes oficiales de la sección</span>
              <span class="ficha-source">INE · Ajuntament</span>
            </div>
            <a class="ficha-doc" :href="zonaLinks.ineAtlasRenta" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Atlas de renta (INE)</span>
                <span class="ficha-doc-d">Renta media por persona y hogar, por sección</span>
              </span>
              <span class="ficha-badge">abrir 🔗</span>
            </a>
            <a class="ficha-doc" :href="zonaLinks.hutb" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Pisos turísticos (HUT)</span>
                <span class="ficha-doc-d">Licencias activas en estas manzanas</span>
              </span>
              <span class="ficha-badge">consultar 🔗</span>
            </a>
            <a class="ficha-doc" :href="zonaLinks.portalDades" target="_blank" rel="noopener">
              <span class="ficha-doc-main">
                <span class="ficha-doc-t">Padrón y demografía</span>
                <span class="ficha-doc-d">Densidad poblacional · Barcelona Dades</span>
              </span>
              <span class="ficha-badge">abrir 🔗</span>
            </a>
          </div>
        </div>

        <!-- NIVEL 4: FINCA (CATASTRO) -->
        <div v-else-if="mapContext.level === 'finca'" class="context-panel">
          <div v-if="selectedAddress" class="ficha-header">
            <div class="ficha-crumb">
              <span v-if="mapContext.barrioName" class="ficha-crumb-hi">{{ mapContext.barrioName }}</span>
              <template v-if="mapContext.distritoName"><span class="ficha-crumb-sep">›</span>{{ mapContext.distritoName }}</template>
              <template v-if="mapContext.seccionCode"><span class="ficha-crumb-sep">›</span><span class="ficha-crumb-mono">{{ mapContext.seccionCode }}</span></template>
              <template v-if="!mapContext.barrioName">Barcelona · Catastro en vivo</template>
            </div>
            <div class="ficha-head-row">
              <div class="ficha-head-main">
                <h2 class="ficha-address">{{ selectedAddress }}</h2>
                <div v-if="fincaData.refCatastral" class="ficha-ref">
                  <span class="ficha-ref-label">Ref. parcela</span>
                  <span class="ficha-ref-value">{{ fincaData.refCatastral }}</span>
                </div>
              </div>
              <img v-if="satelliteThumb" :src="satelliteThumb" class="ficha-thumb" alt="Vista satélite de la parcela" />
            </div>
          </div>
          <div v-else class="panel-head ficha-empty-head">
            <div class="panel-crumb">Nivel finca</div>
            <h2 class="panel-title">Explorador de fincas</h2>
          </div>

          <div v-if="!selectedAddress" class="empty-state">
            <div class="empty-pin">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2D5BD0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"></path><circle cx="12" cy="9" r="2.4"></circle></svg>
            </div>
            <p>Haz clic en cualquier parcela del mapa para cargar los datos en vivo del Catastro y las afectaciones urbanísticas (PIU).</p>
          </div>
          
          <div v-else>
            <!-- ===== GRUPO 1: DATOS OFICIALES (CONTRASTABLES) ===== -->
            <div class="ficha-block">
              <div class="ficha-block-head">
                <span class="ficha-block-title">Catastro</span>
                <span class="ficha-source">FUENTE · Catastro</span>
              </div>

              <div v-if="fincaData.estado === 'cargando'" class="ficha-grid">
                <div v-for="n in 6" :key="n" class="ficha-cell"><span class="skeleton"></span></div>
              </div>

              <template v-else-if="fincaData.estado === 'ok'">
                <!-- Referencias registrales: la llave maestra -->
                <div class="ficha-reg">
                  <div class="ficha-reg-row">
                    <span class="ficha-reg-k">Parcela (14)</span>
                    <span class="ficha-reg-rc">{{ fincaData.refCatastral }}</span>
                    <button class="ficha-copy" @click="copiar(fincaData.refCatastral)" title="Copiar parcela">⧉</button>
                  </div>
                  <div v-if="fincaData.rcInmueble" class="ficha-reg-row">
                    <span class="ficha-reg-k">Inmueble (20)</span>
                    <span class="ficha-reg-rc">{{ fincaData.rcInmueble }}</span>
                    <button class="ficha-copy" @click="copiar(fincaData.rcInmueble)" title="Copiar inmueble">⧉</button>
                  </div>
                  <a class="ficha-verify" :href="deepLinks.catastro" target="_blank" rel="noopener">🔗 Verificar en Sede del Catastro</a>
                </div>

                <!-- KPIs físicos -->
                <div class="ficha-grid">
                  <div class="ficha-cell">
                    <span class="ficha-k">Año constr.</span>
                    <span class="ficha-v">{{ fincaData.ano ?? '—' }}</span>
                    <span v-if="antiguedad" class="ficha-sub">{{ antiguedad }} años</span>
                  </div>
                  <div class="ficha-cell">
                    <span class="ficha-k">Sup. constr.</span>
                    <span class="ficha-v"><template v-if="fincaData.superficie">{{ fincaData.superficie }}<small> m²</small></template><template v-else>—</template></span>
                    <span v-if="fincaData.superficie" class="ficha-sub">{{ fincaData.nInmuebles > 1 ? 'unidad ref.' : 'construida' }}</span>
                  </div>
                  <div class="ficha-cell">
                    <span class="ficha-k">Sup. útil est.</span>
                    <span class="ficha-v"><template v-if="supUtilEstimada">{{ supUtilEstimada }}<small> m²</small></template><template v-else>—</template></span>
                    <span v-if="supUtilEstimada" class="ficha-sub">estimada</span>
                  </div>
                  <div class="ficha-cell">
                    <span class="ficha-k">Plantas</span>
                    <span class="ficha-v">{{ fincaData.plantas ?? '—' }}</span>
                  </div>
                  <div class="ficha-cell">
                    <span class="ficha-k">Inmuebles</span>
                    <span class="ficha-v">{{ fincaData.nInmuebles ?? '—' }}</span>
                    <span v-if="fincaData.nInmuebles" class="ficha-sub">en la finca</span>
                  </div>
                  <div class="ficha-cell">
                    <span class="ficha-k">Uso princ.</span>
                    <span class="ficha-v ficha-v-sm">{{ fincaData.uso ?? '—' }}</span>
                  </div>
                </div>
              </template>

              <div v-else-if="fincaData.estado === 'sin-parcela'" class="ficha-msg">
                Sin parcela catastral en este punto. Prueba sobre un edificio.
              </div>
              <div v-else-if="fincaData.estado === 'error'" class="ficha-msg ficha-msg-err">
                No se pudo consultar el Catastro. Reintenta el clic.
              </div>
            </div>

            <!-- Resto del dossier solo si hay datos -->
            <template v-if="fincaData.estado === 'ok'">
              <!-- Afectaciones urbanísticas (PGM / PIU) -->
              <div class="ficha-block">
                <div class="ficha-block-head">
                  <span class="ficha-block-title">Afectaciones urbanísticas</span>
                  <span class="ficha-source">PGM · Ajuntament</span>
                </div>

                <!-- Aviso crítico -->
                <div class="ver ver-amber">
                  <span class="ver-dot"></span>
                  <div class="ver-body">
                    <span class="ver-titulo">Comprueba la clave del PGM antes de firmar</span>
                    <span class="ver-desc">La calificación urbanística decide si la finca está libre o reservada para una calle o un equipamiento público. Una clave de sistema = riesgo de expropiación total o parcial.</span>
                  </div>
                </div>

                <!-- Claves a vigilar -->
                <div class="clave-legend">
                  <div class="clave-row danger"><span class="clave-tag">Clave 5</span><span>Sistema viario — reservada para ampliar calles. Riesgo de expropiación.</span></div>
                  <div class="clave-row danger"><span class="clave-tag">Clave 7</span><span>Equipamientos — reservada para colegios, hospitales o servicios.</span></div>
                  <div class="clave-row ok"><span class="clave-tag">12–18</span><span>Residencial / actividad consolidada — zona segura para invertir.</span></div>
                </div>

                <!-- Acción: clave real de esta parcela en la fuente oficial -->
                <a class="ficha-cta" :href="deepLinks.piu" target="_blank" rel="noopener">
                  Ver la clave de esta parcela en la ficha PIU oficial →
                </a>
              </div>

              <!-- Cumplimiento: Cédula y CEE -->
              <div class="ficha-block">
                <div class="ficha-block-head"><span class="ficha-block-title">Cumplimiento</span></div>
                <a class="ficha-doc" :href="deepLinks.cedula" target="_blank" rel="noopener">
                  <span class="ficha-doc-main">
                    <span class="ficha-doc-t">Cédula de habitabilidad</span>
                    <span class="ficha-doc-d">Búscala con la ref. de inmueble (20)</span>
                  </span>
                  <span class="ficha-badge">consultar 🔗</span>
                </a>
                <a class="ficha-doc" :href="deepLinks.cee" target="_blank" rel="noopener">
                  <span class="ficha-doc-main">
                    <span class="ficha-doc-t">Certificado energético (CEE)</span>
                    <span class="ficha-doc-d">Búscalo con la ref. de inmueble (20)</span>
                  </span>
                  <span class="ficha-badge">consultar 🔗</span>
                </a>
              </div>

              <!-- Lectura crítica: la síntesis (qué significan los datos para ti) -->
              <div v-if="veredictos.length" class="ficha-block">
                <div class="ficha-block-head">
                  <span class="ficha-block-title">Lectura crítica</span>
                  <span class="ficha-source">BCN Radar</span>
                </div>
                <div class="ficha-lectura">
                  <div v-for="(ver, i) in veredictos" :key="i" class="ver" :class="'ver-' + ver.tone">
                    <span class="ver-dot"></span>
                    <div class="ver-body">
                      <span class="ver-titulo">{{ ver.titulo }}</span>
                      <span class="ver-desc">{{ ver.desc }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Mercado (estimación de zona — sin feed oficial en vivo) -->
              <div class="ficha-block">
                <div class="ficha-block-head">
                  <span class="ficha-block-title">Mercado</span>
                  <span class="ficha-source">ESTIMACIÓN · zona</span>
                </div>
                <div class="ficha-mercado">
                  <div class="ficha-yield">
                    <span class="ficha-yield-k">Yield bruto est.</span>
                    <span class="ficha-yield-v">{{ mercadoZona.yield }}<small>%</small></span>
                  </div>
                  <div class="ficha-mercado-side">
                    <div class="ficha-mini">
                      <span class="ficha-mini-k">Venta zona</span>
                      <span class="ficha-mini-v">{{ mercadoZona.venta }}<small> €/m²</small></span>
                    </div>
                    <div class="ficha-mini">
                      <span class="ficha-mini-k">Alquiler zona</span>
                      <span class="ficha-mini-v">{{ mercadoZona.alquiler }}<small> €/m²·mes</small></span>
                    </div>
                  </div>
                </div>
                <div class="ficha-note-sm">Estimación de zona, no del inmueble. Pendiente de cablear fuente oficial (Incasòl · Registradores).</div>
              </div>

              <!-- ===== GRUPO 2: PRIVADO / DUE DILIGENCE ===== -->
              <div class="ficha-grouptag">Privado · a solicitar al propietario</div>

              <div class="ficha-block">
                <div class="ficha-block-head"><span class="ficha-block-title">Gastos ordinarios</span></div>
                <div class="ficha-gasto-row"><span>IBI (anual)</span><span class="ficha-na">a solicitar</span></div>
                <div class="ficha-gasto-row"><span>Comunidad (mes)</span><span class="ficha-na">a solicitar</span></div>
                <div class="ficha-gasto-row"><span>Tasa de basuras</span><span class="ficha-na">a solicitar</span></div>
                <div class="ficha-note-sm">No los inventamos: dependen del inmueble y los aporta el vendedor.</div>
              </div>

              <!-- Checklist del comprador -->
              <div class="ficha-block">
                <div class="ficha-block-head"><span class="ficha-block-title">Checklist del comprador</span></div>
                <p class="ficha-note-sm">Papeles a exigir al propietario antes de firmar arras o ir a notaría:</p>
                <div class="ficha-check" v-for="(d, i) in checklistComprador" :key="i">
                  <div class="ficha-check-head">
                    <span class="ficha-check-t">{{ d.icono }} {{ d.titulo }}</span>
                    <a v-if="d.url" class="ficha-verify-sm" :href="d.url" target="_blank" rel="noopener">🔗</a>
                  </div>
                  <p class="ficha-check-d">{{ d.desc }}</p>
                </div>
              </div>

              <!-- Enlaces de interés -->
              <div class="ficha-block">
                <div class="ficha-block-head"><span class="ficha-block-title">Enlaces de la finca</span></div>
                <a class="ficha-link" :href="deepLinks.indiceAlquiler" target="_blank" rel="noopener">
                  <span class="ficha-link-t">📈 Índice de referencia de alquiler</span>
                  <span class="ficha-link-d">Tope legal de la renta para esta zona (Ley de Vivienda).</span>
                </a>
                <a class="ficha-link" :href="deepLinks.hutb" target="_blank" rel="noopener">
                  <span class="ficha-link-t">🧳 Licencias turísticas (HUTB)</span>
                  <span class="ficha-link-d">Comprueba si hay viviendas de uso turístico cerca.</span>
                </a>
              </div>
            </template>

            <!-- Acciones -->
            <div class="action-buttons">
              <button class="export-btn" @click="exportReport">Generar informe (PDF)</button>
            </div>
          </div>
        </div>

      </aside>

      <!-- MAPA Y SUS CONTROLES (DERECHA) -->
      <div class="map-section">
        <div id="map" class="map-container"></div>
        
        <!-- Controles flotantes del mapa (Abajo Derecha) -->
        <div class="map-floating-controls">
          <div class="control-section">
            <h4>Mapa base</h4>
            <div class="control-group">
              <label class="ctrl"><input type="radio" name="mapStyle" value="calle" checked><span>Callejero</span></label>
              <label class="ctrl"><input type="radio" name="mapStyle" value="satelite"><span>Satélite</span></label>
            </div>
          </div>

          <hr class="divider">

          <div class="control-section">
            <h4>Transporte</h4>
            <div class="control-group">
              <label v-for="t in TRANSPORTES" :key="t.key" class="ctrl">
                <input type="checkbox" :id="'tr-' + t.key" :value="t.key">
                <span class="tr-swatch" :style="{ background: t.color }"></span>
                <span>{{ t.label }}</span>
                <span v-if="transportStatus[t.key] === 'loading'" class="tr-status">cargando…</span>
                <span v-else-if="transportStatus[t.key] === 'error'" class="tr-status tr-err">error</span>
              </label>
            </div>
            <p class="ctrl-hint">Recorridos reales de OpenStreetMap. El bus son muchas líneas: puede tardar.</p>
          </div>

          <hr class="divider">

          <div class="control-section">
            <h4>Capas urbanísticas</h4>
            <div class="control-group">
              <label class="ctrl"><input type="checkbox" id="check-fincas" value="fincas"><span>Parcelas (Catastro)</span></label>
            </div>
          </div>

          <hr class="divider">

          <div class="control-section">
            <h4>Vista 3D</h4>
            <div class="control-group">
              <label class="ctrl"><input type="checkbox" id="check-3d" value="3d"><span>Edificios 3D</span></label>
            </div>
            <p class="ctrl-hint">Arrastra con clic derecho (o Ctrl+arrastrar) para rotar e inclinar.</p>
          </div>

          <hr class="divider">

          <div class="control-section">
            <h4>Herramientas</h4>
            <div class="control-group">
              <label class="ctrl"><input type="checkbox" id="check-measure" value="measure"><span>Medir distancia</span></label>
            </div>
            <div v-if="measureTotal" class="measure-readout">
              <span class="measure-total">{{ measureTotal }}</span>
              <button id="btn-measure-clear" class="measure-clear" type="button">Limpiar</button>
            </div>
            <p class="ctrl-hint">Haz clic en el mapa para marcar puntos; la distancia se suma tramo a tramo.</p>
          </div>
        </div>
      </div>
      
    </main>
  </div>
</template>

<style>
/* ===== Tokens del sistema visual v1 (BCN Radar) ===== */
:root {
  --ink: #0E1726;
  --ink-soft: #1B2740;
  --ink-line: #2A3850;
  --blue: #2D5BD0;
  --blue-l: #7FA0E8;
  --green: #1F9D5B;
  --amber: #D98A1F;
  --red: #D24B3E;
  --paper: #E6E7E2;
  --card: #ffffff;
  --line: #EAEDF2;
  --line-2: #EEF0F4;
  --line-3: #E7EAF0;
  --muted: #9098A4;
  --muted-2: #B6BCC6;
  --text-2: #5B616B;
  --text-3: #404B5E;
  --sans: 'Inter', -apple-system, sans-serif;
  --serif: 'Source Serif 4', Georgia, serif;
  --mono: 'IBM Plex Mono', monospace;
}

*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--sans);
  height: 100vh;
  width: 100vw;
  background-color: var(--paper);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
::selection { background: var(--blue); color: #fff; }
#app { height: 100%; }
.app-container { display: flex; flex-direction: column; height: 100vh; }

/* ===== Barra superior ===== */
.topbar {
  background: var(--ink); color: #fff; height: 56px; flex: none;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 18px;
}
.topbar-brand { display: flex; align-items: center; gap: 11px; }
.topbar-logo {
  width: 26px; height: 26px; border-radius: 7px; background: var(--ink-soft);
  display: flex; align-items: center; justify-content: center; flex: none;
}
.topbar-titles { display: flex; align-items: baseline; gap: 9px; }
.topbar-name { font: 700 14px/1 var(--sans); letter-spacing: -.01em; }
.topbar-tag { font: 500 11px/1 var(--sans); color: #6B7689; }

.search-box { display: flex; align-items: center; gap: 8px; }
.search-box .search-ic {
  position: absolute; margin-left: 12px; pointer-events: none;
  display: flex; align-items: center;
}
.search-box input {
  height: 34px; width: 280px; padding: 0 12px 0 34px;
  border-radius: 8px; border: 1px solid var(--ink-line); background: var(--ink-soft);
  color: #fff; font: 500 12px/1 var(--sans);
}
.search-box input::placeholder { color: #6B7689; }
.search-box input:focus { outline: none; border-color: var(--blue); }
.search-box button {
  height: 34px; padding: 0 14px; border: none; border-radius: 8px;
  background: var(--blue); color: #fff; font: 600 12px/1 var(--sans); cursor: pointer;
  transition: background .15s;
}
.search-box button:hover { background: #2550BC; }

.main-content { display: flex; flex: 1; overflow: hidden; }

.map-section { flex: 1; position: relative; height: 100%; }
.map-container { width: 100%; height: 100%; z-index: 1; }

/* ===== Controles flotantes del mapa ===== */
.map-floating-controls {
  position: absolute; bottom: 24px; right: 18px;
  background: rgba(255,255,255,.96); backdrop-filter: blur(6px);
  padding: 14px 16px; border-radius: 12px;
  box-shadow: 0 8px 30px -10px rgba(14,23,38,.28);
  z-index: 1000; width: 204px; border: 1px solid var(--line-3);
}
.map-floating-controls h4 {
  margin: 0 0 10px; font: 600 9px/1 var(--sans);
  color: var(--muted); text-transform: uppercase; letter-spacing: .1em;
}
.map-floating-controls .control-group { display: flex; flex-direction: column; gap: 9px; }
.map-floating-controls .ctrl {
  display: flex; align-items: center; gap: 9px;
  font: 500 12px/1 var(--sans); color: var(--ink); cursor: pointer;
}
.map-floating-controls .ctrl input { accent-color: var(--blue); width: 14px; height: 14px; }
.map-floating-controls .divider { border: 0; border-top: 1px solid var(--line-2); margin: 13px 0; }
.map-floating-controls .ctrl-hint { font: 500 9px/1.4 'Inter', sans-serif; color: #9098A4; margin: 8px 0 0; }
.map-floating-controls .measure-readout { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; }
.map-floating-controls .measure-total { font: 700 13px/1 'IBM Plex Mono', monospace; color: var(--blue); }
.map-floating-controls .measure-clear { font: 600 9px/1 'Inter', sans-serif; color: #5B616B; background: #F1F3F6; border: 1px solid #E6E9EF; border-radius: 6px; padding: 5px 8px; cursor: pointer; }
.map-floating-controls .measure-clear:hover { background: #E6E9EF; }

.map-floating-controls .tr-swatch { width: 14px; height: 3px; border-radius: 2px; flex: none; }
.map-floating-controls .tr-status { font: 600 8px/1 'IBM Plex Mono', monospace; color: #9098A4; margin-left: auto; }
.map-floating-controls .tr-status.tr-err { color: #D24B3E; }

/* Rosa de los vientos */
.compass-rose { cursor: pointer; padding: 2px; }
.compass-rose .compass-dial { transform-origin: 24px 24px; transition: transform .1s linear; }

/* ===== Panel lateral ===== */
.sidebar {
  width: 408px; flex: none; background: var(--card);
  border-right: 1px solid var(--line-3); padding: 0;
  overflow-y: auto; z-index: 10;
}
.sidebar::-webkit-scrollbar { width: 8px; }
.sidebar::-webkit-scrollbar-thumb { background: #C7CBD1; border-radius: 8px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }

/* Niveles macro: contenedor con su propio padding */
.panel { padding: 22px; }

/* Cabecera de panel (niveles macro) */
.panel-head { margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--line-2); }
/* Cabecera del nivel finca vacío (sin contenedor padded) */
.ficha-empty-head { padding: 22px 22px 0; }
.panel-crumb {
  font: 600 9px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase;
  color: var(--blue); margin-bottom: 11px;
}
.panel-title { font: 600 22px/1.1 var(--serif); letter-spacing: -.01em; color: var(--ink); margin: 0; }
.panel-sub { font: 500 11px/1.5 var(--sans); color: var(--muted); margin: 8px 0 0; }

/* Tarjeta */
.card {
  background: #fff; border: 1px solid var(--line); border-radius: 12px;
  padding: 15px 16px; margin-bottom: 14px;
}
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.card-title { font: 600 12px/1 var(--sans); letter-spacing: .03em; color: var(--ink); }
.src-chip {
  font: 500 9px/1 var(--mono); color: var(--text-2);
  background: #F1F3F6; border: 1px solid #E6E9EF; padding: 4px 8px; border-radius: 6px;
}

.rows { display: flex; flex-direction: column; }
.row {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 9px 0; border-bottom: 1px solid var(--line-2);
}
.row:last-child { border-bottom: none; }
.row-k { font: 500 12px/1 var(--sans); color: var(--text-2); }
.row-v { font: 600 14px/1 var(--mono); color: var(--ink); }
.row-v small { font: 500 10px/1 var(--sans); color: var(--muted); }
.row-v.pos { color: var(--green); }
.row-v.neg { color: var(--red); }

.callout {
  margin-top: 13px; padding: 11px 13px; border-radius: 9px;
  background: #FBF6EC; border: 1px solid #F0E2C4;
  font: 500 11px/1.5 var(--sans); color: #7A5A22;
}
.callout strong { color: var(--amber); }

/* Estado vacío */
.empty-state {
  display: flex; flex-direction: column; align-items: flex-start; gap: 14px;
  padding: 22px;
}
.empty-pin {
  width: 42px; height: 42px; border-radius: 11px; flex: none;
  background: #EEF3FE; border: 1px solid #D7E2FB;
  display: flex; align-items: center; justify-content: center;
}
.empty-state p { font: 500 12px/1.6 var(--sans); color: var(--muted); margin: 0; }

/* Botones de acción */
.action-buttons { display: flex; flex-direction: column; gap: 9px; padding: 18px 22px 24px; }
.export-btn {
  height: 44px; border: none; border-radius: 10px;
  background: var(--blue); color: #fff; font: 600 13px/1 var(--sans);
  cursor: pointer; transition: background .15s;
}
.export-btn:hover { background: #2550BC; }

/* ===== Indicador de zoom (Leaflet control) ===== */
.zoom-indicator-box {
  background: #fff; padding: 7px 11px; border-radius: 8px;
  box-shadow: 0 2px 8px rgba(14,23,38,.16);
  font: 600 10px/1 var(--mono); color: var(--text-3);
}

/* ===== Tooltips de zonas en el mapa ===== */
.zone-tooltip {
  background: transparent; color: #5B616B; border: none;
  font-family: var(--sans); font-weight: 700; font-size: 12px;
  padding: 0; box-shadow: none;
  text-shadow: 1.5px 1.5px 0 rgba(255,255,255,.95),
              -1.5px -1.5px 0 rgba(255,255,255,.95),
               1.5px -1.5px 0 rgba(255,255,255,.95),
              -1.5px 1.5px 0 rgba(255,255,255,.95);
}
.zone-tooltip::before { display: none !important; }

</style>

<!-- Sistema visual de la Ficha de Propiedad (diseño BCN Radar) -->
<style>
.ficha-header { padding: 22px 22px 18px; border-bottom: 1px solid var(--line-2); }
.ficha-crumb {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  font: 500 10px/1.3 'Inter', sans-serif;
  color: #9098A4; margin-bottom: 14px;
}
.ficha-crumb-hi { color: #2D5BD0; font-weight: 600; }
.ficha-crumb-sep { color: #C7CCD4; }
.ficha-crumb-mono { font-family: 'IBM Plex Mono', monospace; font-size: 9px; }
.ficha-address {
  font: 600 22px/1.12 'Source Serif 4', Georgia, serif;
  letter-spacing: -.01em; color: #0E1726; margin: 0 0 12px;
}
.ficha-head-row { display: flex; gap: 14px; align-items: flex-start; }
.ficha-head-main { flex: 1; min-width: 0; }
.ficha-thumb {
  width: 74px; height: 74px; flex: none; border-radius: 10px; object-fit: cover;
  border: 1px solid #E7EAF0; background: #EEF0F4;
}
.ficha-ref { display: flex; align-items: center; gap: 8px; }
.ficha-ref-label {
  font: 600 8px/1 'Inter', sans-serif; letter-spacing: .1em;
  text-transform: uppercase; color: #9098A4;
}
.ficha-ref-value {
  font: 500 11px/1 'IBM Plex Mono', monospace; color: #404B5E;
  background: #F3F5F8; border: 1px solid #E7EAF0; padding: 3px 6px; border-radius: 5px;
}

/* Lectura crítica: veredictos por dato */
.ficha-lectura { display: flex; flex-direction: column; gap: 8px; }
.ver {
  display: flex; gap: 10px; padding: 11px 13px;
  border: 1px solid; border-radius: 10px;
}
.ver-dot { width: 8px; height: 8px; border-radius: 99px; flex: none; margin-top: 4px; }
.ver-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ver-titulo { font: 600 12px/1.3 'Inter', sans-serif; color: #0E1726; }
.ver-desc { font: 500 10px/1.5 'Inter', sans-serif; color: #5B616B; }

.ver-red   { background: #FCEEEC; border-color: #F3CFCB; }
.ver-red   .ver-dot { background: #D24B3E; }
.ver-amber { background: #FBF4E9; border-color: #F0E0BE; }
.ver-amber .ver-dot { background: #D98A1F; }
.ver-green { background: #ECF6F0; border-color: #CFE9DA; }
.ver-green .ver-dot { background: #1F9D5B; }
.ver-blue  { background: #EEF3FD; border-color: #D5E1FA; }
.ver-blue  .ver-dot { background: #2D5BD0; }

/* Mercado (estimación de zona) */
.ficha-mercado { display: flex; gap: 10px; }
.ficha-yield {
  flex: 1.1; background: #0E1726; border-radius: 11px; padding: 14px 15px;
  display: flex; flex-direction: column; gap: 8px;
}
.ficha-yield-k {
  font: 500 9px/1 'Inter', sans-serif; letter-spacing: .12em;
  text-transform: uppercase; color: #7E8AA0;
}
.ficha-yield-v { font: 600 30px/1 'IBM Plex Mono', monospace; color: #fff; }
.ficha-yield-v small { font-size: 15px; color: #7FA0E8; margin-left: 2px; }
.ficha-mercado-side { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.ficha-mini { border: 1px solid #EAEDF2; border-radius: 9px; padding: 9px 11px; }
.ficha-mini-k {
  display: block; font: 500 8px/1 'Inter', sans-serif; letter-spacing: .08em;
  text-transform: uppercase; color: #9098A4; margin-bottom: 5px;
}
.ficha-mini-v { font: 600 14px/1 'IBM Plex Mono', monospace; color: #0E1726; }
.ficha-mini-v small { font-size: 9px; color: #9098A4; }

.ficha-block { padding: 18px 22px; border-bottom: 1px solid var(--line-2); }
.ficha-block-head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px;
}
.ficha-block-title {
  font: 600 12px/1 'Inter', sans-serif; letter-spacing: .04em; color: #0E1726;
}
.ficha-source {
  font: 500 9px/1 'IBM Plex Mono', monospace; color: #64748B;
  background: #F1F3F6; border: 1px solid #E6E9EF; padding: 4px 8px; border-radius: 5px;
}

.ficha-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px;
  background: #EEF0F4; border: 1px solid #EEF0F4; border-radius: 10px; overflow: hidden;
}
.ficha-cell {
  background: #fff; padding: 11px 12px;
  display: flex; flex-direction: column; gap: 7px; min-height: 56px;
}
.ficha-k {
  font: 500 9px/1 'Inter', sans-serif; letter-spacing: .07em;
  text-transform: uppercase; color: #9098A4;
}
.ficha-v { font: 600 18px/1 'IBM Plex Mono', monospace; color: #0E1726; }
.ficha-v small { font-size: 11px; color: #9098A4; }
.ficha-v-sm { font: 600 13px/1.1 'Inter', sans-serif; }
.ficha-na { color: #B6BCC6; }
.ficha-sub { font: 500 9px/1 'Inter', sans-serif; color: #B6BCC6; }

.ficha-msg {
  font: 500 12px/1.5 'Inter', sans-serif; color: #7f8c8d;
  padding: 12px 14px; background: #FAFBFC; border: 1px solid #EAEDF2; border-radius: 10px;
}
.ficha-msg-err { color: #c0392b; background: #FBEDEB; border-color: #F5C6CB; }

.skeleton {
  display: block; height: 18px; width: 72%; border-radius: 4px;
  background: linear-gradient(90deg, #EEF0F4 25%, #F6F7F9 50%, #EEF0F4 75%);
  background-size: 200% 100%; animation: sk 1.2s ease-in-out infinite;
}
@keyframes sk { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Referencias registrales + verificación */
.ficha-reg { background: #FAFBFC; border: 1px solid #EAEDF2; border-radius: 10px; padding: 12px 13px; margin-bottom: 12px; }
.ficha-reg-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.ficha-reg-k { font: 600 8px/1 'Inter', sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #9098A4; width: 76px; flex: none; }
.ficha-reg-rc { font: 500 11px/1.3 'IBM Plex Mono', monospace; color: #0E1726; word-break: break-all; flex: 1; }
.ficha-copy { flex: none; border: none; background: none; cursor: pointer; color: #B6BCC6; font-size: 13px; padding: 2px; line-height: 1; transition: color .15s; }
.ficha-copy:hover { color: #2D5BD0; }
.ficha-verify { display: inline-flex; align-items: center; gap: 4px; margin-top: 3px; font: 600 10px/1 'Inter', sans-serif; color: #2D5BD0; text-decoration: none; }
.ficha-verify:hover { text-decoration: underline; }
.ficha-verify-sm { font: 600 9px/1 'Inter', sans-serif; color: #2D5BD0; text-decoration: none; }
.ficha-verify-sm:hover { text-decoration: underline; }

/* Leyenda de claves PGM + CTA a la ficha oficial */
.clave-legend { display: flex; flex-direction: column; gap: 7px; margin-top: 11px; }
.clave-row {
  display: flex; gap: 9px; align-items: baseline;
  font: 500 10px/1.45 'Inter', sans-serif; color: #5B616B;
}
.clave-tag {
  flex: none; min-width: 48px; text-align: center;
  font: 600 9px/1 'IBM Plex Mono', monospace; letter-spacing: .02em;
  padding: 4px 6px; border-radius: 5px;
}
.clave-row.danger .clave-tag { color: #B23A2E; background: #FCEEEC; border: 1px solid #F3CFCB; }
.clave-row.ok .clave-tag { color: #167A46; background: #ECF6F0; border: 1px solid #CFE9DA; }

.ficha-cta {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: 13px; height: 38px; border-radius: 9px;
  background: #0E1726; color: #fff; text-decoration: none;
  font: 600 11px/1 'Inter', sans-serif; transition: background .15s;
}
.ficha-cta:hover { background: #1B2740; }

.ficha-note { font: 500 11px/1.5 'Inter', sans-serif; color: #6B7280; }
.ficha-note-sm { font: 500 10px/1.5 'Inter', sans-serif; color: #9098A4; margin: 0 0 9px; }

/* El último elemento de cada sección no aporta margen propio:
   la separación la define SIEMPRE el padding de la sección (18px). */
.ficha-block > :last-child { margin-bottom: 0; }

/* Documentos (Cédula / CEE) */
.ficha-doc { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 13px; border: 1px solid #EAEDF2; border-radius: 9px; margin-bottom: 8px; text-decoration: none; background: #fff; transition: border-color .15s; }
.ficha-doc:hover { border-color: #C3D2F2; }
.ficha-doc-main { display: flex; flex-direction: column; gap: 3px; }
.ficha-doc-t { font: 600 12px/1.2 'Inter', sans-serif; color: #0E1726; }
.ficha-doc-d { font: 500 9px/1.2 'Inter', sans-serif; color: #9098A4; }
.ficha-badge { flex: none; font: 600 9px/1 'IBM Plex Mono', monospace; color: #5B616B; background: #F1F3F6; border: 1px solid #E6E9EF; padding: 5px 8px; border-radius: 6px; white-space: nowrap; }

/* Tag de grupo (privado) — cabecera del bloque "a solicitar":
   más aire arriba para despegarse de Cumplimiento, pegado a Gastos abajo. */
.ficha-grouptag { font: 600 9px/1 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: #fff; background: #312E81; display: inline-block; padding: 6px 10px; border-radius: 6px; margin: 22px 22px 0; }
.ficha-grouptag + .ficha-block { padding-top: 11px; }

/* Gastos */
.ficha-gasto-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #EEF0F4; font: 500 11px/1 'Inter', sans-serif; color: #5B616B; }
.ficha-gasto-row:last-of-type { border-bottom: none; }

/* Checklist del comprador */
.ficha-check { background: #FAFBFC; border: 1px solid #EAEDF2; border-radius: 9px; padding: 11px 13px; margin-bottom: 8px; }
.ficha-check-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.ficha-check-t { font: 600 11px/1.35 'Inter', sans-serif; color: #0E1726; }
.ficha-check-d { font: 500 9px/1.45 'Inter', sans-serif; color: #9098A4; margin: 5px 0 0; }

/* Enlaces de interés */
.ficha-link { display: flex; flex-direction: column; gap: 3px; padding: 11px 13px; border: 1px solid #EAEDF2; border-radius: 9px; margin-bottom: 8px; text-decoration: none; background: #fff; transition: all .15s; }
.ficha-link:hover { border-color: #C3D2F2; background: #F7F9FE; }
.ficha-link-t { font: 600 11px/1.2 'Inter', sans-serif; color: #2D5BD0; }
.ficha-link-d { font: 500 9px/1.3 'Inter', sans-serif; color: #9098A4; }
</style>
