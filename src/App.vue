<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchFinca } from './services/catastro.js'
import { fetchAfectaciones, classificLabel } from './services/piu.js'
import { fetchBicing } from './services/movilidad.js'
import { loadTransit, stopsGeoJSON, routeGeoJSON, routeChip } from './services/transit.js'
import { describeLayer } from './services/layer-info.js'
import { loadPoi, poiFC } from './services/poi.js'
import { fetchTemperatura } from './services/meteo.js'
import { fetchAlquilerBarcelona } from './services/valor.js'
import { useTheme } from './composables/useTheme.js'
import { createMap } from './composables/useMap.js'
import { usePanels } from './composables/usePanels.js'
import { initAutoZones } from './composables/useAutoZones.js'
import TheTopbar from './components/TheTopbar.vue'
import { applyMapTheme } from './services/map-theme.js'
import { useMapStore } from './composables/useMapStore.js'
import MapFabs from './components/map/MapFabs.vue'
import StopExplorer from './components/map/StopExplorer.vue'
import MapControls from './components/map/MapControls.vue'
import { useSheetDrag } from './composables/useSheetDrag.js'
import SectionCard from './components/sidebar/SectionCard.vue'
import ZonasCard from './components/sidebar/ZonasCard.vue'

// Tema claro/oscuro (estado compartido en el composable). El chrome lo gestiona
// useTheme; aquí recoloreamos el mapa (paleta completa día/noche) + la máscara.
// ⚙️  Los colores del mapa se editan en src/services/map-theme.js
const { theme } = useTheme()
watch(theme, (t) => {
  const dark = t === 'dark'
  applyMapTheme(map, dark ? 'night' : 'day')
  if (map && map.getLayer('bcn-mask')) map.setPaintProperty('bcn-mask', 'fill-color', dark ? '#0B1017' : '#FFFFFF')
})

// Paneles ocultables (composable singleton): todos parten colapsados, potencia incremental
const { isMobile, sidebarOpen, controlsOpen, utilsOpen } = usePanels()

// Bottom sheets (móvil) con arrastre real en el asa y snap de 3 estados:
// compacto ⇄ expandido (arrastrar arriba) ⇄ cerrado (arrastrar abajo desde compacto).
// Bajar estando expandido colapsa además todas las cards (vuelta al estado mínimo).
// Arrastre del asa de los sheets (composable compartido). El sidebar colapsa las cards
// al bajar desde expandido; los controles no lo necesitan (importan useSheetDrag sin callback).
const { sheetFull, start: sheetTouchStart, move: sheetTouchMove, end: sheetTouchEnd } = useSheetDrag(() => { cardOpen.value = {} })

// ── Controles del mapa ── basemap + 3D los gestiona MapControls vía el store useMapTools.
const fincasOn = ref(false)        // parcelas Catastro
function toggleFincas() {
  fincasOn.value = !fincasOn.value
  if (map.getLayer('catastro')) map.setLayoutProperty('catastro', 'visibility', fincasOn.value ? 'visible' : 'none')
  if (fincasOn.value && map.getZoom() < 17) map.easeTo({ zoom: 17 })
}

// Variables reactivas para el panel
const searchQuery = ref('')
const selectedAddress = ref(null)
const measureTotal = ref(null) // distancia acumulada de la herramienta de medición

// Capas de transporte (recorridos reales desde OpenStreetMap / Overpass)
const TRANSPORTES = [
  { key: 'metro',    label: 'Metro',           color: '#E2231A', filter: '["route"="subway"]' },
  { key: 'rodalies', label: 'Rodalies / Renfe', color: '#1A8A4A', filter: '["route"="train"]' },
  { key: 'bus',      label: 'Bus',             color: '#0067B1', filter: '["route"="bus"]' },
  { key: 'tram',     label: 'FGC / Tranvía',   color: '#E87200', filter: '["route"~"tram|light_rail"]' },
]
const transportStatus = ref({}) // { metro: 'loading'|'ok'|'error', ... }
const transportLines = ref({})    // key -> [{ ref, colour }]
const transportSelected = ref({}) // key -> [refs visibles]
const busSearch = ref('')
const busExpanded = ref(false)    // lista completa de buses desplegada

// Chips a renderizar por modo (el bus: al buscar, o la lista completa si se expande)
const chipsFor = (key) => {
  const all = transportLines.value[key] || []
  if (key !== 'bus') return all
  const q = busSearch.value.trim().toLowerCase()
  if (q) return all.filter(l => (l.ref || '').toLowerCase().includes(q)).slice(0, 200)
  return busExpanded.value ? all : []
}

// Selección masiva: Todas/Ninguna. En bus con búsqueda activa opera SOLO sobre lo
// filtrado (suma o resta del resto) — control fino sin perder lo ya elegido.
const setAllLines = (key, on) => {
  const all = transportLines.value[key] || []
  let next
  if (key === 'bus' && busSearch.value.trim()) {
    const shown = new Set(chipsFor(key).map(l => l.ref))
    const cur = new Set(transportSelected.value[key] || [])
    shown.forEach(r => on ? cur.add(r) : cur.delete(r))
    next = [...cur]
  } else {
    next = on ? all.map(l => l.ref) : []
  }
  transportSelected.value = { ...transportSelected.value, [key]: next }
  applyLineFilter(key)
}
// Aplica el filtro de líneas seleccionadas a la línea + paradas + etiquetas del modo
const applyLineFilter = (key) => {
  if (!map) return
  const sel = transportSelected.value[key] || []
  const ids = [`tr-${key}-line`, `tr-${key}-stops`, `tr-${key}-labels`]
  if (!map.getLayer(ids[0])) return
  if (!sel.length) {
    ids.forEach((id, i) => map.setFilter(id, ['==', ['get', i === 0 ? 'ref' : 'name'], '__none__']))
    return
  }
  map.setFilter(ids[0], ['in', ['get', 'ref'], ['literal', sel]])
  const stopFilter = ['any', ...sel.map(l => ['in', l, ['get', 'linesArr']])]
  map.setFilter(ids[1], stopFilter)
  map.setFilter(ids[2], stopFilter)
}
const toggleLine = (key, ref) => {
  const cur = transportSelected.value[key] || []
  const next = cur.includes(ref) ? cur.filter(r => r !== ref) : [...cur, ref]
  transportSelected.value = { ...transportSelected.value, [key]: next }
  applyLineFilter(key)
}

// Estado Reactivo del Panel Lateral Dinámico
// Estado del mapa centralizado en el store (Fase 1 del refactor a componentes).
// `map` sigue como variable local de trabajo aquí y se registra en el store al crearse.
const mapStore = useMapStore()
const mapContext = mapStore.mapContext

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

// Situación urbanística de la parcela (PIU · GetFeatureInfo) — independiente del Catastro
const afectaciones = ref({ estado: 'vacio' }) // 'vacio'|'cargando'|'ok'|'error'
const classific = classificLabel
// ¿La clave es de sistema (5 viario / 7 equipamiento)? → riesgo de afectación
const claveSistema = computed(() => {
  const c = afectaciones.value?.qualificacio?.clau || ''
  if (/^5/.test(c)) return { tone: 'red', titulo: `Clave ${c} · Sistema viario`, desc: 'Suelo reservado para vial. Riesgo de expropiación total o parcial. Verifica el alcance antes de comprometerte.' }
  if (/^7/.test(c)) return { tone: 'red', titulo: `Clave ${c} · Equipamientos`, desc: 'Suelo reservado para equipamiento público (colegio, sanitario, etc.). Riesgo de afectación.' }
  if (/^6/.test(c)) return { tone: 'amber', titulo: `Clave ${c} · Espacios libres`, desc: 'Suelo de zona verde / espacio libre. Edificabilidad muy limitada.' }
  return null
})

// Miniatura satélite real (ortofoto ESRI) centrada en la parcela seleccionada
const satelliteThumb = computed(() => {
  if (!clickedCoords.value) return null
  const { lat, lng } = clickedCoords.value
  const d = 0.0006 // ~60 m de margen
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`
  return `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=160,160&format=jpg&f=image`
})

// ── Helpers Overpass + geo (reutilizados por transporte y radio) ──
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
// Prueba los mirrors en orden hasta obtener una respuesta válida (el Overpass público se satura)
async function overpassFetch(q) {
  let lastErr
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) })
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue }
      return await res.json()
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('Overpass sin respuesta')
}
// Distancia en metros entre [lng,lat] y [lng,lat]
const haversine = (a, b) => {
  const R = 6371000, toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// ── Radio de exploración desde la finca (Fase B1) ──
const radioOn = ref(false)
const radioMetros = ref(500)
const radioLabel = computed(() => radioMetros.value >= 1000 ? (radioMetros.value / 1000).toFixed(1) + ' km' : radioMetros.value + ' m')
// Polígono de círculo (64 lados) a partir de centro [lng,lat] y radio en metros
const circlePolygon = (center, meters) => {
  const [lng, lat] = center
  const earth = 6378137
  const dLat = (meters / earth) * (180 / Math.PI)
  const dLng = (meters / (earth * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI)
  const pts = []
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI
    pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] } }
}
const renderRadio = () => {
  if (!map || !map.getSource('radio')) return
  const c = clickedCoords.value
  if (!radioOn.value || !c) { map.getSource('radio').setData({ type: 'FeatureCollection', features: [] }); return }
  map.getSource('radio').setData(circlePolygon([c.lng, c.lat], radioMetros.value))
}

// ── Paradas dentro del radio (Fase B2) ──
const RADIO_MAX = 2100
const STOP_COLORS = { metro: '#E2231A', train: '#1A8A4A', bus: '#0067B1', tram: '#E87200' }
const radioStops = ref([])      // paradas dentro del radio actual (para la barra lateral)
let radioStopsData = []         // todas las paradas traídas (~2 km), filtradas en cliente
let radioLoadedKey = null       // centro ya consultado, para no re-pedir al mover el slider
const modeFromTags = (t) => {
  if (t.station === 'subway') return 'metro'
  if (t.railway === 'tram_stop') return 'tram'
  if (t.railway === 'station' || t.railway === 'halt') return 'train'
  return 'bus'
}
async function loadRadioStops() {
  const c = clickedCoords.value
  if (!c) return
  const R = RADIO_MAX
  const q = `[out:json][timeout:60];(node[highway=bus_stop](around:${R},${c.lat},${c.lng});node[railway=station](around:${R},${c.lat},${c.lng});node[railway=halt](around:${R},${c.lat},${c.lng});node[railway=tram_stop](around:${R},${c.lat},${c.lng});node[station=subway](around:${R},${c.lat},${c.lng}););out;`
  try {
    const data = await overpassFetch(q)
    radioStopsData = (data.elements || []).filter(n => n.tags?.name).map(n => {
      const modo = modeFromTags(n.tags)
      return { name: n.tags.name, lng: n.lon, lat: n.lat, modo, color: STOP_COLORS[modo] || '#5B616B', lines: n.tags.route_ref || '', dist: Math.round(haversine([c.lng, c.lat], [n.lon, n.lat])) }
    })
  } catch (err) { console.warn('Overpass radio-stops', err); radioStopsData = [] }
  filterRadioStops()
}
const filterRadioStops = () => {
  const within = radioStopsData.filter(s => s.dist <= radioMetros.value).sort((a, b) => a.dist - b.dist)
  radioStops.value = within
  if (map && map.getSource('radio-stops')) {
    map.getSource('radio-stops').setData({ type: 'FeatureCollection', features: within.map(s => ({ type: 'Feature', properties: { name: s.name, color: s.color, modo: s.modo, lines: s.lines }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })) })
  }
}
const focusStop = (s) => {
  if (!map) return
  map.flyTo({ center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 16) })
  new maplibregl.Popup({ offset: 12 }).setLngLat([s.lng, s.lat]).setHTML(`<b>${s.name}</b><br><span style="color:#5B616B">${s.modo}${s.lines ? ' · ' + s.lines : ''}</span>`).addTo(map)
}
const comoLlegar = (s) => {
  const c = clickedCoords.value
  return c ? `https://www.google.com/maps/dir/?api=1&origin=${c.lat},${c.lng}&destination=${s.lat},${s.lng}&travelmode=transit` : '#'
}
const onRadioChange = async () => {
  renderRadio()
  if (!radioOn.value || !clickedCoords.value) {
    radioStops.value = []
    if (map && map.getSource('radio-stops')) map.getSource('radio-stops').setData({ type: 'FeatureCollection', features: [] })
    return
  }
  const key = `${clickedCoords.value.lat},${clickedCoords.value.lng}`
  if (key !== radioLoadedKey) { radioLoadedKey = key; await loadRadioStops() }
  else filterRadioStops()
}
watch([radioOn, radioMetros, clickedCoords], onRadioChange, { deep: true })

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

// ── Valor de mercado de ZONA (dato REAL de Incasòl, cargado al montar) ──
const valorZona = ref(null) // { renda, any, contratos }

// Deep-links oficiales con la referencia catastral inyectada (regla de verificabilidad)
const deepLinks = computed(() => {
  const rc14 = fincaData.value.refCatastral
  return {
    catastro: 'https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?buscar=S',
    valorRef: 'https://www.sedecatastro.gob.es/Accesos/SECAccvr.aspx',
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

// ═══ Capas públicas — agregador de servicios WMS de utilidad pública ═══
// Catálogo declarativo: cada fuente es un WMS público (HTTPS + CORS verificado).
// Añadir una fuente nueva = añadir una entrada aquí; el resto del código no cambia.
const WMS_SOURCES = [
  {
    id: 'ajbcn-urb',
    label: 'Urbanismo · Ajuntament de Barcelona',
    badge: 'PIU',
    attribution: 'WMS Urbanisme · Ajuntament de Barcelona',
    base: 'https://w133.bcn.cat/WMSURBANISME/service.svc/get',
    version: '1.3.0',
    portal: 'https://ajuntament.barcelona.cat/informaciourbanistica/cerca/es/',
    // Capas curadas: las que de verdad pesan para decidir una compra.
    // Cada una es la capa "grupo" del WMS (ya agrega polígono + código + línea).
    layers: [
      { name: 'Qualificació_urbanística', label: 'Calificación urbanística', hint: 'La clave del suelo: qué puedes o no construir en la parcela.' },
      { name: 'Sector_de_planejament', label: 'Sectores de planeamiento', hint: 'Áreas con plan urbanístico propio.' },
      { name: 'Àmbit_de_planejament_aprovat_definitivament', label: 'Planeamiento aprobado', hint: 'Planes ya en vigor que afectan la zona.' },
      { name: 'Àmbit_de_planejament_en_tràmit', label: 'Planeamiento en trámite', hint: 'Lo que viene: revalorización o restricción futura.' },
      { name: 'Àmbit_de_suspensió_de_llicències', label: 'Suspensión de licencias', hint: 'Zonas donde ahora NO se conceden licencias de obra.' },
      { name: 'Àmbit_de_gestió', label: 'Ámbitos de gestión', hint: 'Reparcelaciones y gestión urbanística en curso.' },
      { name: 'Catàleg_de_patrimoni', label: 'Patrimonio protegido', hint: 'Edificios catalogados: obras limitadas, posibles ayudas.' },
      { name: 'Ordenació_volumètrica', label: 'Ordenación volumétrica', hint: 'Alturas y volúmenes edificables permitidos.' },
      { name: 'Parcel·la', label: 'Parcelario municipal', hint: 'Límites de parcela del Ajuntament.' },
    ],
  },
  {
    id: 'muc-cat',
    label: 'Urbanismo · Mapa Urbanístic de Catalunya',
    badge: 'MUC',
    attribution: 'MUC · Generalitat de Catalunya',
    base: 'https://dtes.gencat.cat/webmap/MUC/service.svc/get',
    version: '1.3.0',
    portal: 'https://territori.gencat.cat/ca/06_territori_i_urbanisme/observatori_territori/mapa_urbanistic_de_catalunya/',
    // El MUC unifica el planeamiento de TODA Cataluña (útil para mirar fuera de BCN).
    // Solo curo la capa completa (verificada sobre BCN); el resto, en "ver todas".
    layers: [
      { name: 'MUC', label: 'Mapa urbanístico (Cataluña)', hint: 'Planeamiento vigente de toda Cataluña, unificado en una capa.' },
    ],
  },
  {
    id: 'aca-inund',
    label: 'Inundabilidad · Agència Catalana de l\'Aigua',
    badge: 'ACA',
    attribution: 'Zones inundables · Agència Catalana de l\'Aigua',
    base: 'https://aplicacions.aca.gencat.cat/geoserver/vishid/wms',
    version: '1.3.0',
    portal: 'https://aca.gencat.cat/ca/laigua/proteccio-i-conservacio/gestio-de-la-inundabilitat/',
    // Láminas de inundación por periodo de retorno (due diligence de compra).
    layers: [
      { name: 'vishid:Zones_inundables_T10', label: 'Inundable · frecuente (T10)', hint: 'Se inunda con episodios de ~10 años. Riesgo alto: evítalo.' },
      { name: 'vishid:Zones_inundables_T100', label: 'Inundable · 100 años (T100)', hint: 'Referencia legal de riesgo. Afecta seguros e hipoteca.' },
      { name: 'vishid:Zones_inundables_T500', label: 'Inundable · excepcional (T500)', hint: 'Episodios extremos de ~500 años. Riesgo bajo pero a conocer.' },
    ],
  },
]

const wmsExpanded = ref({})       // sourceId -> acordeón de fuente abierto
const wmsShowAll = ref({})        // sourceId -> sección "ver todas" abierta
const wmsActive = ref({})         // layerKey -> capa encendida en el mapa
const wmsAllLayers = ref({})      // sourceId -> [{ name, label }] (del GetCapabilities)
const wmsAllStatus = ref({})      // sourceId -> 'loading' | 'ok' | 'error'
const wmsAdded = new Set()        // ids de capas ya creadas en el mapa (crea 1 vez, luego visibility)
const layerKey = (sid, name) => `${sid}::${name}`
const toggleWmsExpand = (sid) => { wmsExpanded.value = { ...wmsExpanded.value, [sid]: !wmsExpanded.value[sid] } }

// URL de tiles WMS para MapLibre (raster). EPSG:3857 va sin invertir ejes en 1.3.0.
function wmsTileUrl(src, layerName) {
  const crs = src.version === '1.3.0' ? 'crs' : 'srs'
  const p = new URLSearchParams({ service: 'WMS', request: 'GetMap', version: src.version, layers: layerName, styles: '', format: 'image/png', transparent: 'true', width: '256', height: '256' })
  return `${src.base}?${p.toString()}&${crs}=EPSG:3857&bbox={bbox-epsg-3857}`
}

// Enciende/apaga una capa: la crea la primera vez, luego solo alterna visibilidad.
function toggleWms(src, layer) {
  if (!map) return
  const key = layerKey(src.id, layer.name)
  const on = !wmsActive.value[key]
  wmsActive.value = { ...wmsActive.value, [key]: on }
  const id = `wms-${src.id}-${layer.name}`
  if (on && !wmsAdded.has(id)) {
    map.addSource(id, { type: 'raster', tiles: [wmsTileUrl(src, layer.name)], tileSize: 256, attribution: src.attribution })
    map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0.78 } })
    wmsAdded.add(id)
  } else if (map.getLayer(id)) {
    map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
}

// "Ver todas": vuelca el catálogo completo del servicio (GetCapabilities), sin las ya curadas.
async function loadAllWms(src) {
  wmsShowAll.value = { ...wmsShowAll.value, [src.id]: !wmsShowAll.value[src.id] }
  if (wmsAllLayers.value[src.id] || !wmsShowAll.value[src.id]) return
  wmsAllStatus.value = { ...wmsAllStatus.value, [src.id]: 'loading' }
  try {
    const url = `${src.base}?service=WMS&request=GetCapabilities&version=${src.version}`
    const xml = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/xml')
    const curated = new Set(src.layers.map(l => l.name))
    const seen = new Set(), all = []
    for (const ly of xml.getElementsByTagName('Layer')) {
      let name = null, title = null
      for (const c of ly.children) {
        if (c.tagName === 'Name' && name === null) name = c.textContent
        if (c.tagName === 'Title' && title === null) title = c.textContent
      }
      if (!name || curated.has(name) || seen.has(name)) continue
      seen.add(name)
      all.push({ name, label: title || name, desc: describeLayer(name) })
    }
    wmsAllLayers.value = { ...wmsAllLayers.value, [src.id]: all }
    wmsAllStatus.value = { ...wmsAllStatus.value, [src.id]: 'ok' }
  } catch (e) {
    console.warn('GetCapabilities', src.id, e)
    wmsAllStatus.value = { ...wmsAllStatus.value, [src.id]: 'error' }
  }
}

// ═══ Movilidad y servicios — capas de datos ABIERTOS (GeoJSON en vivo) ═══
// Catálogo declarativo por categoría. Solo se listan capas validadas y funcionales
// (el operador odia toggles que no hacen nada). Añadir capa = añadir entrada con su loader.
// Carriles bici desde OpenStreetMap (misma vía Overpass que la capa de transporte).
// bbox Barcelona + área cercana. Devuelve LineString GeoJSON.
const CYCLEWAY_QUERY = '[out:json][timeout:60];way[highway=cycleway](41.30,2.05,41.48,2.25);out geom;'
async function loadCarrilBici() {
  const d = await overpassFetch(CYCLEWAY_QUERY)
  const features = (d.elements || [])
    .filter(e => e.type === 'way' && e.geometry)
    .map(w => ({
      type: 'Feature',
      properties: { name: w.tags?.name || '' },
      geometry: { type: 'LineString', coordinates: w.geometry.map(g => [g.lon, g.lat]) },
    }))
  return { type: 'FeatureCollection', features }
}

// ── Entorno de la finca: POI de OSM pre-generados (estáticos duros con fecha) ──
const poiDate = ref('')
async function poiCategory(cat) {
  const d = await loadPoi()
  poiDate.value = d.generated || ''
  return poiFC(d, cat)
}
// Config de una capa de puntos del estático (reutiliza toggleData). El id = categoría en poi.json.
const poiLayer = (id, label, hint, color, minzoom = 13) => ({
  id, label, hint, minzoom,
  load: () => poiCategory(id),
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 17, 6],
    'circle-color': color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.2,
  },
  popup: p => `<b>${p.name || '(sin nombre)'}</b>${p.kind ? `<br><span style="color:#5B616B">${p.kind}</span>` : ''}`,
})

const MOVILIDAD = [
  {
    group: '🚲 Bicicleta',
    layers: [
      {
        id: 'bicing', label: 'Bicing (tiempo real)', hint: 'Estaciones con bicis y anclajes libres ahora mismo.',
        portal: 'https://www.bicing.barcelona/', live: 60000, load: fetchBicing,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 6],
          'circle-color': ['case', ['==', ['get', 'bikes'], 0], '#D24B3E', ['<', ['get', 'bikes'], 3], '#D98A1F', '#1F9D5B'],
          'circle-stroke-color': '#fff', 'circle-stroke-width': 1.4,
        },
        popup: p => `<b>${p.name}</b><br><span style="color:#5B616B">🚲 ${p.bikes} bicis${p.ebikes != null ? ` (${p.ebikes} eléctr.)` : ''} · 🅿️ ${p.docks} anclajes</span>`,
      },
      {
        id: 'carril-bici', label: 'Carriles bici', hint: 'Red ciclista segregada (OpenStreetMap).',
        portal: 'https://www.openstreetmap.org', layerType: 'line', load: loadCarrilBici,
        paint: {
          'line-color': '#1F9D5B',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.4, 16, 3.2],
          'line-opacity': 0.85,
        },
      },
    ],
  },
  {
    group: '🏥 Salud y educación',
    layers: [
      poiLayer('salud', 'Salud', 'Hospitales, CAP y farmacias.', '#D24B3E'),
      poiLayer('educacion', 'Educación', 'Colegios, institutos, universidades y guarderías.', '#2D5BD0'),
    ],
  },
  {
    group: '🛒 Comercio y día a día',
    layers: [
      poiLayer('comercio', 'Comercio y mercados', 'Supermercados y mercados municipales.', '#E87200', 14),
      poiLayer('aparcamientos', 'Aparcamientos', 'Aparcamientos de coche, moto y bici.', '#6B7689', 15),
    ],
  },
  {
    group: '🌳 Verde y cultura',
    layers: [
      poiLayer('verde', 'Zonas verdes', 'Parques y jardines.', '#1F9D5B', 13),
      poiLayer('cultura', 'Cultura y deporte', 'Bibliotecas, museos, cines, teatros, polideportivos y centros cívicos.', '#8B5CF6'),
    ],
  },
  {
    group: '🌡️ Clima',
    layers: [
      {
        id: 'temperatura', label: 'Temperatura (tiempo real)', hint: 'Estaciones de Meteocat con la temperatura actual (°C).',
        portal: 'https://www.meteo.cat/', live: 600000, load: fetchTemperatura, minzoom: 0,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 8, 14, 12],
          'circle-color': ['interpolate', ['linear'], ['get', 'temp'], 0, '#2C7BB6', 10, '#00A6CA', 18, '#FFED6F', 26, '#F17C4A', 34, '#D7191C'],
          'circle-stroke-color': '#fff', 'circle-stroke-width': 1.4, 'circle-opacity': 0.92,
        },
        symbol: { field: ['concat', ['to-string', ['round', ['get', 'temp']]], '°'], size: 10, color: '#1B2740' },
        popup: p => `<b>${p.name}</b><br><span style="color:#5B616B">🌡️ ${p.temp} °C · ${p.alt} m</span>`,
      },
    ],
  },
]

const dataActive = ref({})   // layerId -> encendida
const dataStatus = ref({})   // layerId -> 'loading'|'ok'|'error'
const dataTimers = {}        // layerId -> intervalo de refresco (capas en vivo)

// Enciende/apaga una capa de datos: la carga la 1ª vez (lazy), luego alterna visibilidad.
async function toggleData(cfg) {
  if (!map) return
  const on = !dataActive.value[cfg.id]
  dataActive.value = { ...dataActive.value, [cfg.id]: on }
  const id = `data-${cfg.id}`
  const layerIds = cfg.symbol ? [id, `${id}-label`] : [id]
  if (!on) {
    layerIds.forEach(l => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', 'none'))
    if (dataTimers[cfg.id]) { clearInterval(dataTimers[cfg.id]); delete dataTimers[cfg.id] }
    return
  }
  if (map.getSource(id)) {
    layerIds.forEach(l => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', 'visible'))
  } else {
    dataStatus.value = { ...dataStatus.value, [cfg.id]: 'loading' }
    try {
      const gj = await cfg.load()
      map.addSource(id, { type: 'geojson', data: gj })
      map.addLayer({ id, type: cfg.layerType || 'circle', source: id, minzoom: cfg.minzoom || 0, paint: cfg.paint })
      if (cfg.symbol) {
        map.addLayer({
          id: `${id}-label`, type: 'symbol', source: id, minzoom: cfg.minzoom || 0,
          layout: { 'text-field': cfg.symbol.field, 'text-size': cfg.symbol.size || 10, 'text-allow-overlap': false },
          paint: { 'text-color': cfg.symbol.color || '#1B2740', 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
        })
      }
      overlayClickLayers.push(id) // su clic muestra popup, no selecciona finca
      if (cfg.popup) {
        map.on('click', id, (e) => {
          new maplibregl.Popup({ offset: 12 }).setLngLat(e.lngLat).setHTML(cfg.popup(e.features[0].properties)).addTo(map)
        })
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '' })
      }
      dataStatus.value = { ...dataStatus.value, [cfg.id]: 'ok' }
    } catch (e) {
      console.warn('capa de datos', cfg.id, e)
      dataStatus.value = { ...dataStatus.value, [cfg.id]: 'error' }
      dataActive.value = { ...dataActive.value, [cfg.id]: false }
      return
    }
  }
  // Refresco en vivo mientras la capa esté activa (bicing = 60 s)
  if (cfg.live && !dataTimers[cfg.id]) {
    dataTimers[cfg.id] = setInterval(async () => {
      try { const gj = await cfg.load(); if (map.getSource(id)) map.getSource(id).setData(gj) } catch { /* red intermitente: reintenta al próximo tick */ }
    }, cfg.live)
  }
}

// ═══ Transporte público — explorador parada → línea → recorrido (GTFS TMB) ═══
const transitOn = ref(false)
const transitStatus = ref('')       // 'loading'|'ok'|'error'
let transitData = null              // JSON pre-procesado (no reactivo: es grande)
const selectedStop = ref(null)      // { name, sub?, src, chips:[{id,short,color,long}] }
const activeRouteIds = ref([])      // recorridos GTFS activos (multi-selección)

// ¿El modo Overpass tiene una selección curada (subset) o muestra todas sus líneas?
const isCurated = (src) => {
  const sel = transportSelected.value[src] || []
  const all = transportLines.value[src] || []
  return sel.length > 0 && sel.length < all.length
}
// Chip encendido: GTFS por recorrido activo; Overpass por membresía (solo si hay curado)
function isChipOn(chip) {
  const src = selectedStop.value?.src
  if (!src || src === 'gtfs') return activeRouteIds.value.includes(chip.id)
  return isCurated(src) && (transportSelected.value[src] || []).includes(chip.id)
}
// ¿Hay algo que "quitar"? (muestra el botón)
const stopHasSelection = computed(() => {
  const src = selectedStop.value?.src
  if (!src) return false
  return src === 'gtfs' ? activeRouteIds.value.length > 0 : isCurated(src)
})
// Chips ya anotados con `on` para el componente StopExplorer (presentacional).
const stopChipsView = computed(() => (selectedStop.value?.chips || []).map(c => ({ ...c, on: isChipOn(c) })))

async function toggleTransit() {
  if (!map) return
  const on = !transitOn.value
  transitOn.value = on
  if (!on) {
    if (map.getLayer('transit-stops')) map.setLayoutProperty('transit-stops', 'visibility', 'none')
    clearRoute(); selectedStop.value = null
    return
  }
  if (map.getSource('transit-stops')) { map.setLayoutProperty('transit-stops', 'visibility', 'visible'); return }
  transitStatus.value = 'loading'
  try {
    transitData = await loadTransit()
    map.addSource('transit-stops', { type: 'geojson', data: stopsGeoJSON(transitData) })
    map.addLayer({
      id: 'transit-stops', type: 'circle', source: 'transit-stops', minzoom: 12,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 5],
        'circle-color': '#2D5BD0', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1,
      },
    })
    overlayClickLayers.push('transit-stops')
    map.on('click', 'transit-stops', (e) => {
      const id = e.features[0].properties.id
      const s = transitData.stops.find(x => x.id === id)
      if (!s) return
      selectedStop.value = { name: s.name, src: 'gtfs', chips: s.routes.map(rid => routeChip(transitData, rid)) }
    })
    map.on('mouseenter', 'transit-stops', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'transit-stops', () => { map.getCanvas().style.cursor = '' })
    transitStatus.value = 'ok'
  } catch (e) { console.warn('transit', e); transitStatus.value = 'error'; transitOn.value = false }
}

function ensureRouteLayers() {
  if (map.getSource('transit-route-line')) return
  map.addSource('transit-route-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'transit-route-line', type: 'line', source: 'transit-route-line',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    // Color por feature: cada recorrido viaja con el color real de su línea (multi-selección)
    paint: { 'line-color': ['coalesce', ['get', 'color'], '#2D5BD0'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 6], 'line-opacity': 0.9 },
  })
  map.addSource('transit-route-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'transit-route-stops', type: 'circle', source: 'transit-route-stops',
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 6], 'circle-color': '#fff', 'circle-stroke-color': ['coalesce', ['get', 'color'], '#2D5BD0'], 'circle-stroke-width': 2.5 },
  })
  overlayClickLayers.push('transit-route-stops')
  map.on('click', 'transit-route-stops', (e) => {
    new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat).setHTML(`<b>${e.features[0].properties.name}</b>`).addTo(map)
  })
  map.on('mouseenter', 'transit-route-stops', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'transit-route-stops', () => { map.getCanvas().style.cursor = '' })
}

// Redibuja TODOS los recorridos GTFS activos (multi-selección), cada uno con su color
function renderRoutes() {
  ensureRouteLayers()
  const lineFeats = []
  const stopFeats = []
  for (const rid of activeRouteIds.value) {
    const g = routeGeoJSON(transitData, rid)
    if (!g) continue
    g.lines.features.forEach(f => { f.properties = { ...(f.properties || {}), color: g.color }; lineFeats.push(f) })
    g.stops.features.forEach(f => { f.properties = { ...(f.properties || {}), color: g.color }; stopFeats.push(f) })
  }
  map.getSource('transit-route-line').setData({ type: 'FeatureCollection', features: lineFeats })
  map.getSource('transit-route-stops').setData({ type: 'FeatureCollection', features: stopFeats })
}

// Toggle de un recorrido GTFS: agregar/quitar del conjunto activo
function chooseRoute(routeId) {
  if (!map || !transitData) return
  const cur = activeRouteIds.value
  activeRouteIds.value = cur.includes(routeId) ? cur.filter(r => r !== routeId) : [...cur, routeId]
  renderRoutes()
}

function clearRoute() {
  activeRouteIds.value = []
  if (map?.getSource('transit-route-line')) map.getSource('transit-route-line').setData({ type: 'FeatureCollection', features: [] })
  if (map?.getSource('transit-route-stops')) map.getSource('transit-route-stops').setData({ type: 'FeatureCollection', features: [] })
}

// Chip del explorador (multi-selección en ambos mundos):
// GTFS acumula recorridos; Overpass cura el filtro del modo línea a línea.
// Primer tap sobre un modo sin curar = solo esa línea; quitar la última = vuelven todas.
function pickStopLine(chip) {
  const src = selectedStop.value?.src
  if (!src || src === 'gtfs') { chooseRoute(chip.id); return }
  const all = (transportLines.value[src] || []).map(l => l.ref)
  const cur = transportSelected.value[src] || []
  let next
  if (!isCurated(src)) next = [chip.id]
  else if (cur.includes(chip.id)) { next = cur.filter(r => r !== chip.id); if (!next.length) next = all }
  else next = [...cur, chip.id]
  transportSelected.value = { ...transportSelected.value, [src]: next }
  applyLineFilter(src)
}

// "Quitar recorrido": GTFS borra los trazos; Overpass restaura todas las líneas del modo
function stopClear() {
  const src = selectedStop.value?.src
  if (src && src !== 'gtfs') {
    transportSelected.value = { ...transportSelected.value, [src]: (transportLines.value[src] || []).map(l => l.ref) }
    applyLineFilter(src)
    return
  }
  clearRoute()
}

// Cards del sidebar: expansión INDEPENDIENTE (se pueden mezclar capas de varias:
// metro + distritos, etc.). En móvil el sheet abre con todo colapsado (incremental).
const cardOpen = ref(isMobile.value ? {} : { info: true }) // id -> abierta
function toggleCard(id) { cardOpen.value = { ...cardOpen.value, [id]: !cardOpen.value[id] } }
watch(sidebarOpen, (open) => { if (open && isMobile.value) { cardOpen.value = {}; sheetFull.value = false } })
// Etiqueta contextual de la card Información: sigue el drill-down del mapa
const infoCtx = computed(() => {
  const c = mapContext.value
  if (c.level === 'distrito') return c.distritoName || 'Distrito'
  if (c.level === 'barrio') return c.barrioName || 'Barrio'
  if (c.level === 'seccion') return c.seccionCode ? `Sección ${c.seccionCode}` : 'Sección censal'
  if (c.level === 'finca') return selectedAddress.value || 'Finca'
  return 'Barcelona'
})

let map = null
let searchMarker = null
const overlayClickLayers = [] // capas cuyo clic abre popup y NO debe seleccionar finca

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

  // ── Herramienta de medición de distancias ──
  let measuring = false
  const measurePoints = []
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
  const stopLayerIds = [] // capas de paradas (para no confundir su clic con seleccionar finca)
  async function loadTransport(cfg, visible) {
    const srcId = `tr-${cfg.key}`
    const modeLayers = [`${srcId}-line`, `${srcId}-stops`, `${srcId}-labels`]
    if (map.getSource(srcId)) {
      modeLayers.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none') })
      return
    }
    if (!visible) return
    transportStatus.value = { ...transportStatus.value, [cfg.key]: 'loading' }
    try {
      // Una sola consulta: relaciones (líneas) con geometría + sus nodos de parada con tags
      const q = `[out:json][timeout:120];relation${cfg.filter}(${TRANSPORT_BBOX})->.routes;.routes out geom;node(r.routes);out;`
      const data = await overpassFetch(q)
      const elements = data.elements || []

      // Líneas + acumular qué líneas pasan por cada nodo-parada
      const stopLines = {} // nodeId -> Set de etiquetas de línea
      const linesMap = {}  // ref de línea -> colour (para los chips)
      const lineFeatures = elements
        .filter(el => el.type === 'relation' && el.members)
        .map(rel => {
          const lineId = rel.tags?.ref || rel.tags?.name || ''
          if (lineId && !(lineId in linesMap)) linesMap[lineId] = rel.tags?.colour || cfg.color
          rel.members
            .filter(m => m.type === 'node' && /stop|platform/.test(m.role || ''))
            .forEach(m => { (stopLines[m.ref] ||= new Set()).add(lineId) })
          const lines = rel.members.filter(m => m.type === 'way' && m.geometry).map(m => m.geometry.map(g => [g.lon, g.lat]))
          return { type: 'Feature', properties: { ref: lineId, colour: rel.tags?.colour || null }, geometry: { type: 'MultiLineString', coordinates: lines } }
        })
        .filter(f => f.geometry.coordinates.length)

      // Paradas con nombre + líneas que pasan (deduplicadas por nombre, uniendo líneas)
      const byName = {}
      elements
        .filter(el => el.type === 'node' && el.tags?.name)
        .forEach(n => {
          const lset = stopLines[n.id] ? [...stopLines[n.id]] : (n.tags.route_ref ? n.tags.route_ref.split(/[;,]/) : [])
          if (!byName[n.tags.name]) byName[n.tags.name] = { coord: [n.lon, n.lat], lines: new Set() }
          lset.map(l => l.trim()).filter(Boolean).forEach(l => byName[n.tags.name].lines.add(l))
        })
      const stopFeatures = Object.entries(byName).map(([name, o]) => ({
        type: 'Feature',
        properties: { name, lines: [...o.lines].sort().join(', '), linesArr: [...o.lines], modo: cfg.label },
        geometry: { type: 'Point', coordinates: o.coord },
      }))

      map.addSource(srcId, { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } })
      map.addLayer({
        id: `${srcId}-line`, type: 'line', source: srcId,
        layout: { 'line-join': 'round', 'line-cap': 'round', visibility: visible ? 'visible' : 'none' },
        paint: { 'line-color': ['coalesce', ['get', 'colour'], cfg.color], 'line-width': cfg.key === 'bus' ? 1.2 : 3, 'line-opacity': cfg.key === 'bus' ? 0.5 : 0.85 },
      })

      map.addSource(`${srcId}-stops`, { type: 'geojson', data: { type: 'FeatureCollection', features: stopFeatures } })
      map.addLayer({
        id: `${srcId}-stops`, type: 'circle', source: `${srcId}-stops`,
        minzoom: cfg.key === 'bus' ? 15 : 13,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: { 'circle-radius': cfg.key === 'bus' ? 3 : 4.5, 'circle-color': '#fff', 'circle-stroke-color': cfg.color, 'circle-stroke-width': 2 },
      })
      map.addLayer({
        id: `${srcId}-labels`, type: 'symbol', source: `${srcId}-stops`,
        minzoom: cfg.key === 'bus' ? 16 : 14,
        layout: { visibility: visible ? 'visible' : 'none', 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#1B2740', 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
      })
      stopLayerIds.push(`${srcId}-stops`)

      // Clic en la parada → explorador unificado: chips de sus líneas, elegir una
      // deja SOLO su recorrido en el mapa (misma UX que las paradas GTFS)
      map.on('click', `${srcId}-stops`, (e) => {
        const p = e.features[0].properties
        let refs = []
        try { refs = JSON.parse(p.linesArr || '[]') } catch { refs = (p.lines || '').split(/,\s*/).filter(Boolean) }
        if (!refs.length && p.lines) refs = String(p.lines).split(/,\s*/).filter(Boolean)
        const catalog = transportLines.value[cfg.key] || []
        const chips = refs
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map(ref => ({ id: ref, short: ref, long: `${cfg.label} ${ref}`, color: catalog.find(l => l.ref === ref)?.colour || cfg.color }))
        selectedStop.value = { name: p.name, sub: p.modo, src: cfg.key, chips }
      })
      map.on('mouseenter', `${srcId}-stops`, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', `${srcId}-stops`, () => { map.getCanvas().style.cursor = '' })

      // Listado de líneas para los chips + selección inicial (todas visibles)
      const lineList = Object.entries(linesMap)
        .map(([ref, colour]) => ({ ref, colour }))
        .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }))
      transportLines.value = { ...transportLines.value, [cfg.key]: lineList }
      transportSelected.value = { ...transportSelected.value, [cfg.key]: Object.keys(linesMap) }

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
          else if (g.type === 'MultiPolygon') g.coordinates.forEach(poly => holes.push(poly[0]))
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
    map.on('click', 'radio-stops', (e) => {
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
    // Si el clic cae sobre una parada de transporte, deja que su popup lo maneje
    const guardLayers = [...stopLayerIds, ...overlayClickLayers].filter(id => map.getLayer(id))
    if (guardLayers.length && map.queryRenderedFeatures(e.point, { layers: guardLayers }).length) return
    // Solo permitimos clavar el pin si ya estamos a nivel de calle/finca (Zoom >= 16)
    if (map.getZoom() >= 16) {
      const lat = e.lngLat.lat;
      const lng = e.lngLat.lng;
      clickedCoords.value = { lat, lng };

      // Situación urbanística (PIU) — en paralelo al Catastro, sin bloquearlo
      afectaciones.value = { estado: 'cargando' };
      fetchAfectaciones(lng, lat)
        .then(a => { afectaciones.value = { estado: 'ok', ...a }; })
        .catch(err => { console.warn('PIU afectaciones', err); afectaciones.value = { estado: 'error' }; });

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
    <TheTopbar v-model:query="searchQuery" @search="buscarDireccion" />
    
    <main class="main-content">
      
      <!-- PANEL LATERAL (IZQUIERDA) -->
      <aside class="sidebar" :class="{ open: sidebarOpen, full: sheetFull }">
        <button class="sheet-handle" @click="sidebarOpen = false" @touchstart.passive="sheetTouchStart" @touchmove.passive="sheetTouchMove" @touchend="(e) => sheetTouchEnd(e, () => (sidebarOpen = false), true)" title="Cerrar" aria-label="Cerrar panel"><span></span></button>
        <button class="panel-close" @click="sidebarOpen = false" title="Cerrar">✕</button>

        <!-- INFORMACIÓN — dossier contextual que sigue el nivel de zoom (ciudad→distrito→barrio→sección→finca) -->
        <SectionCard ico="📍" title="Información" :ctx="infoCtx" :open="!!cardOpen['info']" @toggle="toggleCard('info')">
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
                <!-- Transporte dentro del radio (Fase B2) -->
                <div v-if="radioStops.length" class="ficha-block">
                  <div class="ficha-block-head">
                    <span class="ficha-block-title">Transporte en tu radio</span>
                    <span class="ficha-source">{{ radioLabel }} · {{ radioStops.length }} paradas</span>
                  </div>
                  <div class="radio-stop" v-for="(s, i) in radioStops.slice(0, 40)" :key="i">
                    <button class="radio-stop-main" type="button" @click="focusStop(s)">
                      <span class="radio-stop-dot" :style="{ background: s.color }"></span>
                      <span class="radio-stop-name">{{ s.name }}<small v-if="s.lines"> · {{ s.lines }}</small></span>
                      <span class="radio-stop-dist">{{ s.dist }} m</span>
                    </button>
                    <a class="radio-stop-go" :href="comoLlegar(s)" target="_blank" rel="noopener" title="Cómo llegar (transporte público)">↗</a>
                  </div>
                  <p v-if="radioStops.length > 40" class="ficha-note-sm">… y {{ radioStops.length - 40 }} más dentro del radio.</p>
                </div>

                <!-- Situación urbanística REAL de la parcela (PIU · GetFeatureInfo en vivo) -->
                <div class="ficha-block">
                  <div class="ficha-block-head">
                    <span class="ficha-block-title">Situación urbanística</span>
                    <span class="ficha-source">FUENTE · PIU · Ajuntament</span>
                  </div>

                  <div v-if="afectaciones.estado === 'cargando'" class="ficha-grid">
                    <div v-for="n in 4" :key="n" class="ficha-cell"><span class="skeleton"></span></div>
                  </div>

                  <div v-else-if="afectaciones.estado === 'error'" class="ficha-msg ficha-msg-err">
                    No se pudo consultar el PIU. Reintenta el clic.
                  </div>

                  <template v-else-if="afectaciones.estado === 'ok'">
                    <!-- Calificación: la clave que manda -->
                    <div v-if="afectaciones.qualificacio" class="piu-clau">
                      <div class="piu-clau-tag">{{ afectaciones.qualificacio.clau || '—' }}</div>
                      <div class="piu-clau-body">
                        <span class="piu-clau-nom">{{ afectaciones.qualificacio.nom || 'Calificación urbanística' }}</span>
                        <span v-if="classific(afectaciones.qualificacio.classific)" class="piu-clau-sub">{{ classific(afectaciones.qualificacio.classific) }}</span>
                      </div>
                    </div>
                    <div v-else class="ficha-msg">Sin calificación en este punto. Prueba sobre el centro de la parcela.</div>

                    <!-- Detalle del planeamiento -->
                    <div v-if="afectaciones.qualificacio" class="piu-meta">
                      <div v-if="afectaciones.qualificacio.pla" class="piu-meta-row"><span>Plan</span><b>{{ afectaciones.qualificacio.pla }}</b></div>
                      <div v-if="afectaciones.qualificacio.familia" class="piu-meta-row"><span>Familia</span><b>{{ afectaciones.qualificacio.familia }}</b></div>
                      <div v-if="afectaciones.qualificacio.sector" class="piu-meta-row"><span>Sector</span><b>{{ afectaciones.qualificacio.sector }}</b></div>
                    </div>

                    <!-- Veredicto automático si la clave es de sistema (riesgo) -->
                    <div v-if="claveSistema" class="ver" :class="'ver-' + claveSistema.tone" style="margin-top:9px">
                      <span class="ver-dot"></span>
                      <div class="ver-body">
                        <span class="ver-titulo">{{ claveSistema.titulo }}</span>
                        <span class="ver-desc">{{ claveSistema.desc }}</span>
                      </div>
                    </div>

                    <!-- Suspensión de licencias: bandera roja real -->
                    <div v-if="afectaciones.suspensions.length" class="piu-afec piu-afec-red">
                      <span class="piu-afec-h">⛔ Suspensión de licencias ({{ afectaciones.suspensions.length }})</span>
                      <span v-for="(s, i) in afectaciones.suspensions" :key="i" class="piu-afec-item">{{ s.desc || s.codi }}</span>
                    </div>

                    <!-- Planeamiento en trámite: lo que viene -->
                    <div v-if="afectaciones.tramits.length" class="piu-afec piu-afec-amber">
                      <span class="piu-afec-h">⏳ Planeamiento en trámite ({{ afectaciones.tramits.length }})</span>
                      <span v-for="(s, i) in afectaciones.tramits" :key="i" class="piu-afec-item">{{ s.desc || s.codi }}</span>
                    </div>

                    <!-- Planeamiento aprobado que afecta -->
                    <div v-if="afectaciones.aprovats.length" class="piu-afec">
                      <span class="piu-afec-h">📋 Planeamiento aprobado ({{ afectaciones.aprovats.length }})</span>
                      <span v-for="(s, i) in afectaciones.aprovats" :key="i" class="piu-afec-item">{{ s.desc || s.codi }}</span>
                    </div>
                  </template>

                  <!-- Contraste en la fuente oficial -->
                  <a class="ficha-cta" :href="deepLinks.piu" target="_blank" rel="noopener">
                    Ver la ficha completa en el PIU oficial →
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

                <!-- Valor de mercado: dato REAL de zona + los dos puntos de referencia -->
                <div class="ficha-block">
                  <div class="ficha-block-head">
                    <span class="ficha-block-title">Valor de mercado</span>
                    <span class="ficha-source">FUENTE · Incasòl</span>
                  </div>
                  <div class="ficha-mercado">
                    <div class="ficha-yield">
                      <span class="ficha-yield-k">Alquiler medio · Barcelona</span>
                      <span class="ficha-yield-v"><template v-if="valorZona">{{ valorZona.renda.toLocaleString('es-ES') }}<small> €/mes</small></template><template v-else>—</template></span>
                      <span v-if="valorZona" class="ficha-yield-foot">{{ valorZona.any }} · {{ valorZona.contratos.toLocaleString('es-ES') }} contratos depositados</span>
                    </div>
                  </div>
                  <!-- Punto de referencia 1: valor por finca (portal oficial, con identificación) -->
                  <a class="ficha-doc" :href="deepLinks.valorRef" target="_blank" rel="noopener">
                    <span class="ficha-doc-main">
                      <span class="ficha-doc-t">Valor de Referencia de esta finca</span>
                      <span class="ficha-doc-d">Base del impuesto ITP · Sede del Catastro (requiere identificarse)</span>
                    </span>
                    <span class="ficha-badge">consultar 🔗</span>
                  </a>
                  <!-- Punto de referencia 2: precios por barrio (contrastar) -->
                  <a class="ficha-doc" :href="zonaLinks.incasolLloguer" target="_blank" rel="noopener">
                    <span class="ficha-doc-main">
                      <span class="ficha-doc-t">Alquiler por barrio (Incasòl)</span>
                      <span class="ficha-doc-d">Fianzas depositadas, detalle por distrito y barrio</span>
                    </span>
                    <span class="ficha-badge">abrir 🔗</span>
                  </a>
                  <div class="ficha-note-sm">Alquiler medio de la ciudad (dato real, no del inmueble). El precio de venta (€/m²) y el detalle por barrio entran cuando reviva Open Data BCN.</div>
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
        </SectionCard>

        <!-- CAPAS PÚBLICAS — agregador WMS (persistente, sobre las fichas contextuales) -->
        <SectionCard ico="🗂️" title="Capas del mapa" :open="!!cardOpen['capas']" body-class="capas-body" @toggle="toggleCard('capas')">
            <p class="capas-intro">Superpón capas oficiales sobre el mapa. Cada fuente enlaza a su portal para contrastar el dato.</p>

            <!-- Parcelas del Catastro — antes en el panel derecho; es una capa más del mapa -->
            <label class="capas-layer">
              <input type="checkbox" :checked="fincasOn" @change="toggleFincas()">
              <span class="capas-layer-body">
                <span class="capas-layer-t">Parcelas (Catastro)</span>
                <span class="capas-layer-h">Dibuja los límites de parcela para seleccionar una finca (zoom cercano).</span>
              </span>
            </label>
            <div v-for="src in WMS_SOURCES" :key="src.id" class="capas-src">
              <button class="capas-src-head" @click="toggleWmsExpand(src.id)">
                <span class="capas-chev side" :class="{ open: wmsExpanded[src.id] }">▸</span>
                <span class="capas-src-t">{{ src.label }}</span>
                <span v-if="src.badge" class="capas-badge">{{ src.badge }}</span>
              </button>
              <div v-show="wmsExpanded[src.id]" class="capas-src-body">
                <a v-if="src.portal" class="capas-portal" :href="src.portal" target="_blank" rel="noopener">Portal oficial ↗</a>
                <label v-for="l in src.layers" :key="l.name" class="capas-layer">
                  <input type="checkbox" :checked="!!wmsActive[layerKey(src.id, l.name)]" @change="toggleWms(src, l)">
                  <span class="capas-layer-body">
                    <span class="capas-layer-t">{{ l.label }}</span>
                    <span class="capas-layer-h">{{ l.hint }}</span>
                  </span>
                </label>

                <!-- Ver todas: vuelca el catálogo completo del servicio -->
                <button class="capas-all-toggle" @click="loadAllWms(src)">
                  <span class="capas-chev side" :class="{ open: wmsShowAll[src.id] }">▸</span>
                  Ver todas las capas
                  <span v-if="wmsAllLayers[src.id]" class="capas-count">{{ wmsAllLayers[src.id].length + src.layers.length }}</span>
                </button>
                <div v-show="wmsShowAll[src.id]" class="capas-all">
                  <span v-if="wmsAllStatus[src.id] === 'loading'" class="capas-status">cargando catálogo…</span>
                  <span v-else-if="wmsAllStatus[src.id] === 'error'" class="capas-status err">no se pudo cargar el catálogo</span>
                  <label v-for="l in (wmsAllLayers[src.id] || [])" :key="l.name" class="capas-layer slim">
                    <input type="checkbox" :checked="!!wmsActive[layerKey(src.id, l.name)]" @change="toggleWms(src, l)">
                    <span class="capas-layer-body">
                      <span class="capas-layer-t">{{ l.label }}</span>
                      <span v-if="l.desc" class="capas-layer-h">{{ l.desc }}</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
        </SectionCard>

        <!-- MOVILIDAD Y SERVICIOS — capas de datos abiertos en vivo -->
        <SectionCard ico="🚌" title="Movilidad y servicios" :open="!!cardOpen['mov']" body-class="capas-body" @toggle="toggleCard('mov')">
            <p class="capas-intro">Datos abiertos oficiales, en vivo. Se cargan solo al activarlos.</p>

            <!-- Transporte público: explorador parada → línea → recorrido (GTFS TMB) -->
            <div class="mov-group">
              <span class="mov-group-t">🚇 Transporte público</span>
              <label class="capas-layer">
                <input type="checkbox" :checked="transitOn" @change="toggleTransit">
                <span class="capas-layer-body">
                  <span class="capas-layer-t">
                    Paradas de metro, bus y Rodalies
                    <span v-if="transitStatus === 'loading'" class="mov-st">cargando…</span>
                    <span v-else-if="transitStatus === 'error'" class="mov-st err">error</span>
                    <span v-else-if="transitOn" class="mov-st live">● activo</span>
                  </span>
                  <span class="capas-layer-h">Haz clic en una parada y elige una línea para ver su recorrido.</span>
                </span>
              </label>

              <!-- Recorridos por modo (líneas reales OSM/Overpass) — unificado aquí, antes en el panel derecho -->
              <div class="mov-lineas">
                <div v-for="t in TRANSPORTES" :key="t.key" class="tr-mode">
                  <label class="ctrl">
                    <input type="checkbox" :id="'tr-' + t.key" :value="t.key">
                    <span class="tr-swatch" :style="{ background: t.color }"></span>
                    <span>{{ t.label }}</span>
                    <span v-if="transportStatus[t.key] === 'loading'" class="tr-status">cargando…</span>
                    <span v-else-if="transportStatus[t.key] === 'error'" class="tr-status tr-err">error</span>
                  </label>
                  <div v-if="transportLines[t.key] && transportLines[t.key].length" class="tr-lines">
                    <!-- Control masivo: todas/ninguna + contador; el bus además expande su lista -->
                    <div class="tr-toolbar">
                      <button type="button" class="tr-mini" @click="setAllLines(t.key, true)">Todas</button>
                      <button type="button" class="tr-mini" @click="setAllLines(t.key, false)">Ninguna</button>
                      <span class="tr-count">{{ (transportSelected[t.key] || []).length }}/{{ transportLines[t.key].length }}</span>
                      <button v-if="t.key === 'bus'" type="button" class="tr-mini tr-expand" @click="busExpanded = !busExpanded" :aria-expanded="busExpanded">
                        {{ busExpanded ? 'Ocultar lista' : 'Ver todas' }}
                      </button>
                    </div>
                    <input v-if="t.key === 'bus'" v-model="busSearch" class="tr-search" type="text" placeholder="Buscar línea de bus…">
                    <div class="tr-chips">
                      <button v-for="l in chipsFor(t.key)" :key="l.ref" type="button"
                        class="tr-chip" :class="{ off: !(transportSelected[t.key] || []).includes(l.ref) }"
                        :style="{ '--c': l.colour || t.color }"
                        @click="toggleLine(t.key, l.ref)">{{ l.ref }}</button>
                      <span v-if="t.key === 'bus' && !busSearch && !busExpanded" class="tr-hint-inline">escribe para filtrar, o toca «Ver todas»</span>
                    </div>
                  </div>
                </div>
                <p class="capas-layer-h" style="padding-left:2px">Recorridos reales de OpenStreetMap. Activa un modo y elige qué líneas mostrar.</p>
              </div>
            </div>

            <div v-for="grp in MOVILIDAD" :key="grp.group" class="mov-group">
              <span class="mov-group-t">{{ grp.group }}</span>
              <label v-for="l in grp.layers" :key="l.id" class="capas-layer">
                <input type="checkbox" :checked="!!dataActive[l.id]" @change="toggleData(l)">
                <span class="capas-layer-body">
                  <span class="capas-layer-t">
                    {{ l.label }}
                    <span v-if="dataStatus[l.id] === 'loading'" class="mov-st">cargando…</span>
                    <span v-else-if="dataStatus[l.id] === 'error'" class="mov-st err">error</span>
                    <span v-else-if="dataActive[l.id]" class="mov-st live">● en vivo</span>
                  </span>
                  <span class="capas-layer-h">{{ l.hint }}</span>
                  <a v-if="l.portal" class="capas-portal" :href="l.portal" target="_blank" rel="noopener" @click.stop>Fuente oficial ↗</a>
                </span>
              </label>
            </div>
            <p v-if="poiDate" class="capas-foot">🌍 Entorno vía OpenStreetMap · datos de {{ poiDate }}</p>
        </SectionCard>

        <!-- ZONAS ADMINISTRATIVAS — límites de distritos y barrios -->
        <ZonasCard :open="!!cardOpen['zonas']" @toggle="toggleCard('zonas')" />

      </aside>

      <!-- MAPA Y SUS CONTROLES (DERECHA) -->
      <div class="map-section" :class="{ 'utils-collapsed': !utilsOpen, 'sheet-open': sidebarOpen || controlsOpen || !!selectedStop }">
        <div id="map" class="map-container"></div>

        <!-- FABs sobre el mapa (utilidades/tema + reabrir paneles) -->
        <MapFabs />

        <!-- Explorador de parada: líneas que pasan → elegir una dibuja su recorrido -->
        <StopExplorer
          :stop="selectedStop" :chips="stopChipsView" :has-selection="stopHasSelection"
          @close="selectedStop = null; clearRoute()" @pick="pickStopLine" @clear="stopClear" />

        <!-- Controles flotantes del mapa (Abajo Derecha) -->
        <MapControls
          v-model:radio-on="radioOn" v-model:radio-metros="radioMetros"
          :radio-label="radioLabel" :clicked-coords="clickedCoords" :measure-total="measureTotal" />
      </div>
      
    </main>
  </div>
</template>

<style>
/* ═══ BCN Radar · Sistema visual v3 — "Mediterrani" ═══
   Modernisme mediterráneo · roig BCN suau + secundario mar · serifa Spectral · esquinas de ola */
:root {
  /* ── Tema CLARO (por defecto) ── */
  --bg: #E7ECEC;         /* bruma marina: fondo / huecos */
  --surface: #FCFDFD;    /* paneles */
  --surface-2: #EFF3F3;  /* superficies elevadas / inputs / celdas */
  --surface-3: #E3EAE9;  /* hover */
  --border: #DEE7E7;     /* hairlines */
  --border-2: #CBD8D7;
  --text-hi: #22303A;    /* titulares (tinta azulada) */
  --text: #4E626E;       /* cuerpo */
  --text-lo: #64757F;    /* secundario */
  --text-mut: #8C9BA4;   /* muted */
  --accent: #BC4B41;     /* roig BCN suau (ambos temas) */
  --accent-ink: #A23A31; /* rojo legible sobre claro */
  --carto: #2F6E8F;      /* azul mar mediterráneo: datos, enlaces, secundario */
  --green: #3E8F73;
  --amber: #BE9140;
  --gold: #C29A4E;       /* dorado modernista: badges, detalles */
  --red: #C06A4C;        /* terracota: alertas cálidas */
  --display: 'Spectral', Georgia, 'Times New Roman', serif;
  --sans: 'Figtree', system-ui, sans-serif;
  --serif: 'Cormorant Garamond', Georgia, serif; /* itálicas decorativas */
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
  /* firma: esquinas de ola (radios suaves modernistas) */
  --r-card: 14px;   /* cards de sección */
  --r-inner: 10px;  /* celdas, inputs, botones */
  --r-pill: 999px;  /* píldoras / badges */
  --chaflan: 8px;   /* legado (mapa) */
  --float-bg: rgba(252,253,253,.92); /* paneles flotantes sobre el mapa */
}
/* ── Tema OSCURO (chrome + mapa) ── */
html[data-theme="dark"] {
  --float-bg: rgba(16,32,40,.92);
  --bg: #0C161C;
  --surface: #14232C;
  --surface-2: #1B2E38;
  --surface-3: #253945;
  --border: #273A44;
  --border-2: #354B56;
  --text-hi: #EAF1EF;
  --text: #BFCECC;
  --text-lo: #8598A0;
  --text-mut: #5E727B;
  --accent: #CB6155;     /* roig suave, algo más luminoso sobre fondo profundo */
  --accent-ink: #E08072;
  --carto: #63A0C0;
  --green: #58B091;
  --amber: #D3AE5E;
  --gold: #CFA85F;
  --red: #CE8367;
}
.cerdanya { border-radius: var(--r-card); }

/* ── Firma "esquinas de ola": redondeo suave de todo el chrome (mapa aparte) ── */
.map-floating-controls, .capas-src, .ficha-grid, .ficha-reg, .ficha-check,
.ver, .piu-clau, .piu-afec, .callout, .ficha-msg { border-radius: var(--r-card); }
.ficha-mini, .ficha-doc, .ficha-link, .ficha-cta, .ficha-ref-value, .ficha-source,
.src-chip, .ficha-badge, .ficha-grouptag, .capas-count, .stop-clear, .tr-search,
.measure-clear, .panel-close, .empty-state .export-btn { border-radius: var(--r-inner); }
.stop-chip, .tr-chip, .tr-mini, .mov-st, .clave-tag { border-radius: var(--r-pill); }
.ficha-grid { overflow: hidden; }

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: var(--sans); height: 100vh; width: 100vw; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
::selection { background: var(--accent); color: #fff; }
#app { height: 100%; }
.app-container { display: flex; flex-direction: column; height: 100vh; }

/* ═══ Barra superior ═══ */

.main-content { display: flex; flex: 1; overflow: hidden; }
.map-section { flex: 1; position: relative; height: 100%; background: var(--bg); }
.map-container { width: 100%; height: 100%; z-index: 1; }

/* ── Paneles ocultables + botones flotantes (base: escritorio se comporta como antes) ── */
.panel-close { display: flex; position: absolute; top: 8px; right: 8px; z-index: 30; width: 28px; height: 28px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-lo); cursor: pointer; font-size: 12px; align-items: center; justify-content: center; }
.panel-close:hover { background: var(--surface-3); color: var(--accent); }
.fab { display: flex; position: absolute; z-index: 1100; width: 46px; height: 46px; border: 1px solid var(--border-2); background: var(--float-bg); backdrop-filter: blur(8px); color: var(--text-hi); cursor: pointer; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(0,0,0,.28); border-radius: var(--r-card); }
.fab:hover { border-color: var(--accent); }
.fab-info { top: 14px; left: 14px; }
.fab-map { top: 14px; right: 60px; }
.fab-round { display: none; } /* botones redondos solo-móvil (speed-dial, tema) */
.sheet-handle { display: none; } /* asa de bottom sheet, solo móvil */

/* Escritorio: los paneles colapsados desaparecen (en móvil se deslizan fuera con transform) */
@media (min-width: 681px) {
  .sidebar:not(.open), .map-floating-controls:not(.open) { display: none; }
}

/* ═══ Controles flotantes del mapa ═══ */
.map-floating-controls { position: absolute; bottom: 22px; right: 16px; background: var(--float-bg); backdrop-filter: blur(8px); padding: 14px 15px; box-shadow: 0 12px 34px -12px rgba(0,0,0,.6); z-index: 1000; width: 210px; border: 1px solid var(--border); }
.map-floating-controls h4 { margin: 0 0 10px; font: 700 8px/1 var(--sans); color: var(--text-mut); text-transform: uppercase; letter-spacing: .16em; }
.control-group { display: flex; flex-direction: column; gap: 9px; }
.ctrl { display: flex; align-items: center; gap: 9px; font: 500 12px/1 var(--sans); color: var(--text); cursor: pointer; }
.ctrl input { accent-color: var(--accent); width: 14px; height: 14px; }
.divider { border: 0; border-top: 1px solid var(--border); margin: 13px 0; }
.ctrl-hint { font: 500 9px/1.45 var(--sans); color: var(--text-mut); margin: 8px 0 0; }
.measure-readout { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; }
.measure-total { font: 700 13px/1 var(--mono); color: var(--carto); }
.measure-clear { font: 600 9px/1 var(--sans); color: var(--text-lo); background: var(--surface-2); border: 1px solid var(--border); padding: 5px 8px; cursor: pointer; }
.measure-clear:hover { background: var(--surface-3); }
.tr-swatch { width: 14px; height: 3px; border-radius: 2px; flex: none; }
.tr-status { font: 600 8px/1 var(--mono); color: var(--text-mut); margin-left: auto; }
.tr-status.tr-err { color: var(--red); }
.tr-mode { margin-bottom: 9px; }
.tr-lines { margin: 6px 0 0 23px; }
.tr-search { width: 100%; box-sizing: border-box; font: 500 10px/1 var(--sans); color: var(--text-hi); padding: 5px 7px; border: 1px solid var(--border); background: var(--surface-2); margin-bottom: 6px; }
.tr-toolbar { display: flex; align-items: center; gap: 5px; margin: 2px 0 7px; }
.tr-mini { font: 600 8.5px/1 var(--sans); letter-spacing: .03em; text-transform: uppercase; color: var(--text); background: var(--surface-2); border: 1px solid var(--border-2); border-radius: 999px; padding: 4px 9px; cursor: pointer; }
.tr-mini:hover { border-color: var(--accent); color: var(--accent); }
.tr-expand { margin-left: auto; }
.tr-count { font: 600 9px/1 var(--mono); color: var(--text-mut); }
.tr-chips { display: flex; flex-wrap: wrap; gap: 4px; max-height: 116px; overflow-y: auto; }
.tr-chips:has(.tr-chip:nth-child(30)) { max-height: 170px; } /* lista larga (bus expandido): más aire */
.tr-chip { font: 700 9px/1 var(--mono); color: #fff; background: var(--c); border: 1px solid var(--c); border-radius: 4px; padding: 4px 5px; cursor: pointer; }
.tr-chip.off { background: transparent; color: var(--text-mut); border-color: var(--border-2); }
.tr-hint-inline { font: 500 9px/1.4 var(--sans); color: var(--text-mut); }
.radio-ctl { margin: 7px 0 0 23px; }
.radio-row { display: flex; align-items: center; gap: 9px; }
.radio-slider { flex: 1; accent-color: var(--accent); }
.radio-val { font: 700 11px/1 var(--mono); color: var(--carto); min-width: 48px; text-align: right; }

.radio-stop { display: flex; align-items: center; gap: 6px; }
.radio-stop-main { flex: 1; display: flex; align-items: center; gap: 8px; background: none; border: 0; padding: 6px 0; cursor: pointer; text-align: left; min-width: 0; }
.radio-stop-dot { width: 9px; height: 9px; border-radius: 99px; flex: none; }
.radio-stop-name { flex: 1; font: 600 11px/1.2 var(--sans); color: var(--text-hi); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.radio-stop-name small { font-weight: 500; color: var(--text-mut); }
.radio-stop-dist { font: 600 9px/1 var(--mono); color: var(--text-lo); flex: none; }
.radio-stop-go { flex: none; font-size: 13px; color: var(--carto); text-decoration: none; padding: 2px 5px; }
.radio-stop-go:hover { background: var(--surface-3); }
.compass-rose { cursor: pointer; padding: 2px; }
.compass-rose .compass-dial { transform-origin: 24px 24px; transition: transform .1s linear; }

/* ═══ Panel lateral ═══ */
.sidebar { width: 416px; flex: none; background: var(--surface); border-right: 1px solid var(--border); padding: 0; overflow-y: auto; z-index: 10; }
/* Escritorio: panel lateral como carta flotante modernista sobre el mapa.
   El panel es un CONTENEDOR (fondo bruma) con padding; cada sección flota como card. */
@media (min-width: 681px) {
  .main-content { position: relative; }
  .sidebar {
    position: absolute; top: 16px; left: 16px; width: 400px;
    height: auto; max-height: calc(100% - 32px);   /* abraza el contenido, tope con margen inferior */
    border-right: 0; border: 1px solid var(--border); border-radius: 20px;
    background: var(--bg); padding: 12px;
    box-shadow: 0 18px 46px -20px rgba(34,48,58,.42);
    overflow: hidden auto;
  }
  .sidebar::-webkit-scrollbar { width: 8px; }

  /* Cards de sección (exploración): sobre el fondo bruma, superficie clara para que resalten */
  .sidebar .capas-panel { background: var(--surface); }

  /* Dossier: se disuelve el contenedor "Información" y cada bloque flota como card independiente */
  .sidebar .capas-panel:has(.context-panel) { background: transparent; border: 0; border-radius: 0; overflow: visible; margin-bottom: 0; }
  .sidebar .capas-panel:has(.context-panel) > .capas-head { border-radius: 13px; margin-bottom: 10px; }
  .sidebar .capas-panel:has(.context-panel) .capas-body { padding: 0; }
  .context-panel { display: flex; flex-direction: column; gap: 10px; }
  .context-panel > .ficha-header,
  .context-panel > .ficha-block { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card); margin: 0; }
  .context-panel > .ficha-header { padding: 16px; }
  .context-panel > .ficha-block { padding: 15px 16px; }
  .context-panel > .ficha-grouptag { align-self: flex-start; margin: 4px 0 0; }
}
.sidebar::-webkit-scrollbar { width: 9px; }
.sidebar::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 8px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }

.panel { padding: 20px; }
.panel-head { margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.ficha-empty-head { padding: 20px 20px 0; }
.panel-crumb { font: 600 9px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--accent-ink); margin-bottom: 11px; }
.panel-title { font: 700 22px/1.08 var(--display); letter-spacing: .01em; color: var(--text-hi); margin: 0; }
.panel-sub { font: 500 11px/1.5 var(--sans); color: var(--text-lo); margin: 8px 0 0; }

.card { background: var(--surface-2); border: 1px solid var(--border); padding: 15px 16px; margin-bottom: 14px; border-radius: var(--r-card); }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.card-title { font: 600 12px/1 var(--sans); letter-spacing: .03em; color: var(--text-hi); }
.src-chip { font: 500 9px/1 var(--mono); color: var(--text-lo); background: var(--surface-3); border: 1px solid var(--border); padding: 4px 8px; }
.rows { display: flex; flex-direction: column; }
.row { display: flex; align-items: baseline; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--border); }
.row:last-child { border-bottom: none; }
.row-k { font: 500 12px/1 var(--sans); color: var(--text-lo); }
.row-v { font: 600 14px/1 var(--mono); color: var(--text-hi); }
.row-v small { font: 500 10px/1 var(--sans); color: var(--text-mut); }
.row-v.pos { color: var(--green); } .row-v.neg { color: var(--red); }
.callout { margin-top: 13px; padding: 11px 13px; background: rgba(224,162,60,.1); border: 1px solid rgba(224,162,60,.3); font: 500 11px/1.5 var(--sans); color: #E7C079; }
.callout strong { color: var(--amber); }

.empty-state { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding: 20px; }
.empty-pin { width: 42px; height: 42px; flex: none; background: var(--accent-soft, rgba(188,75,65,.14)); border: 1px solid rgba(188,75,65,.3); display: flex; align-items: center; justify-content: center; border-radius: var(--r-inner); }
.empty-state p { font: 500 12px/1.6 var(--sans); color: var(--text-lo); margin: 0; }

.action-buttons { display: flex; flex-direction: column; gap: 9px; padding: 18px 20px 24px; }
.export-btn { height: 44px; border: none; background: var(--accent); color: #fff; font: 600 12px/1 var(--sans); letter-spacing: .04em; text-transform: uppercase; cursor: pointer; transition: filter .15s; border-radius: var(--r-inner); }
.export-btn:hover { filter: brightness(1.12); }

.zoom-indicator-box { background: var(--float-bg); padding: 7px 11px; box-shadow: 0 2px 10px rgba(0,0,0,.4); font: 600 10px/1 var(--mono); color: var(--text); border: 1px solid var(--border); }
.zone-tooltip { background: transparent; color: var(--text-hi); border: none; font-family: var(--sans); font-weight: 700; font-size: 12px; padding: 0; box-shadow: none; text-shadow: 1.5px 1.5px 0 rgba(0,0,0,.85), -1.5px -1.5px 0 rgba(0,0,0,.85), 1.5px -1.5px 0 rgba(0,0,0,.85), -1.5px 1.5px 0 rgba(0,0,0,.85); }
.zone-tooltip::before { display: none !important; }

/* ═══ Ficha de la finca ═══ */
.ficha-header { padding: 20px 20px 18px; border-bottom: 1px solid var(--border); }
.ficha-crumb { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font: 500 10px/1.3 var(--sans); color: var(--text-mut); margin-bottom: 14px; }
.ficha-crumb-hi { color: var(--accent-ink); font-weight: 600; }
.ficha-crumb-sep { color: var(--border-2); }
.ficha-crumb-mono { font-family: var(--mono); font-size: 9px; }
.ficha-address { font: 700 21px/1.14 var(--display); letter-spacing: .01em; color: var(--text-hi); margin: 0 0 12px; }
.ficha-head-row { display: flex; gap: 14px; align-items: flex-start; }
.ficha-head-main { flex: 1; min-width: 0; }
.ficha-thumb { width: 74px; height: 74px; flex: none; object-fit: cover; border: 1px solid var(--border-2); background: var(--surface-2); border-radius: var(--r-inner); }
.ficha-ref { display: flex; align-items: center; gap: 8px; }
.ficha-ref-label { font: 600 8px/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--text-mut); }
.ficha-ref-value { font: 500 11px/1 var(--mono); color: var(--text); background: var(--surface-2); border: 1px solid var(--border); padding: 3px 6px; }

.ficha-lectura { display: flex; flex-direction: column; gap: 8px; }
.ver { display: flex; gap: 10px; padding: 11px 13px; border: 1px solid; }
.ver-dot { width: 8px; height: 8px; border-radius: 99px; flex: none; margin-top: 4px; }
.ver-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ver-titulo { font: 600 12px/1.3 var(--sans); color: var(--text-hi); }
.ver-desc { font: 500 10px/1.5 var(--sans); color: var(--text-lo); }
.ver-red { background: rgba(235,92,77,.1); border-color: rgba(235,92,77,.32); } .ver-red .ver-dot { background: var(--red); }
.ver-amber { background: rgba(224,162,60,.1); border-color: rgba(224,162,60,.32); } .ver-amber .ver-dot { background: var(--amber); }
.ver-green { background: rgba(53,192,138,.1); border-color: rgba(53,192,138,.32); } .ver-green .ver-dot { background: var(--green); }
.ver-blue { background: rgba(91,147,242,.1); border-color: rgba(91,147,242,.32); } .ver-blue .ver-dot { background: var(--carto); }

.ficha-mercado { display: flex; gap: 10px; }
.ficha-yield { flex: 1.1; background: linear-gradient(150deg, var(--carto), color-mix(in srgb, var(--carto) 78%, #1a4a63)); padding: 14px 15px; display: flex; flex-direction: column; gap: 8px; border-radius: var(--r-card); }
.ficha-yield-k { font: 600 9px/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.75); }
.ficha-yield-v { font: 700 30px/1 var(--mono); color: #fff; }
.ficha-yield-v small { font-size: 15px; color: rgba(255,255,255,.8); margin-left: 2px; }
.ficha-yield-foot { font: 500 8.5px/1.35 var(--sans); color: rgba(255,255,255,.78); margin-top: 2px; }
.ficha-mercado-side { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.ficha-mini { border: 1px solid var(--border); background: var(--surface-2); padding: 9px 11px; }
.ficha-mini-k { display: block; font: 600 8px/1 var(--sans); letter-spacing: .08em; text-transform: uppercase; color: var(--text-mut); margin-bottom: 5px; }
.ficha-mini-v { font: 600 14px/1 var(--mono); color: var(--text-hi); }
.ficha-mini-v small { font-size: 9px; color: var(--text-mut); }

.ficha-block { padding: 18px 20px; border-bottom: 1px solid var(--border); }
.ficha-block-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; }
.ficha-block-title { font: 700 11px/1 var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--text-hi); }
.ficha-source { font: 500 9px/1 var(--mono); color: var(--text-lo); background: var(--surface-2); border: 1px solid var(--border); padding: 4px 8px; }
.ficha-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); overflow: hidden; }
.ficha-cell { background: var(--surface-2); padding: 11px 12px; display: flex; flex-direction: column; gap: 7px; min-height: 56px; }
.ficha-k { font: 600 9px/1 var(--sans); letter-spacing: .07em; text-transform: uppercase; color: var(--text-mut); }
.ficha-v { font: 600 18px/1 var(--mono); color: var(--text-hi); }
.ficha-v small { font-size: 11px; color: var(--text-mut); }
.ficha-v-sm { font: 600 13px/1.1 var(--sans); }
.ficha-na { color: var(--text-mut); }
.ficha-sub { font: 500 9px/1 var(--sans); color: var(--text-mut); }
.ficha-msg { font: 500 12px/1.5 var(--sans); color: var(--text-lo); padding: 12px 14px; background: var(--surface-2); border: 1px solid var(--border); }
.ficha-msg-err { color: var(--accent-ink); background: rgba(225,37,27,.1); border-color: rgba(225,37,27,.3); }

.skeleton { display: block; height: 18px; width: 72%; border-radius: 3px; background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%); background-size: 200% 100%; animation: sk 1.2s ease-in-out infinite; }
@keyframes sk { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.ficha-reg { background: var(--surface-2); border: 1px solid var(--border); padding: 12px 13px; margin-bottom: 12px; }
.ficha-reg-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.ficha-reg-k { font: 600 8px/1 var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--text-mut); width: 76px; flex: none; }
.ficha-reg-rc { font: 500 11px/1.3 var(--mono); color: var(--text-hi); word-break: break-all; flex: 1; }
.ficha-copy { flex: none; border: none; background: none; cursor: pointer; color: var(--text-mut); font-size: 13px; padding: 2px; line-height: 1; transition: color .15s; }
.ficha-copy:hover { color: var(--carto); }
.ficha-verify { display: inline-flex; align-items: center; gap: 4px; margin-top: 3px; font: 600 10px/1 var(--sans); color: var(--carto); text-decoration: none; }
.ficha-verify:hover { text-decoration: underline; }
.ficha-verify-sm { font: 600 9px/1 var(--sans); color: var(--carto); text-decoration: none; }
.ficha-verify-sm:hover { text-decoration: underline; }

.clave-legend { display: flex; flex-direction: column; gap: 7px; margin-top: 11px; }
.clave-row { display: flex; gap: 9px; align-items: baseline; font: 500 10px/1.45 var(--sans); color: var(--text-lo); }
.clave-tag { flex: none; min-width: 48px; text-align: center; font: 600 9px/1 var(--mono); letter-spacing: .02em; padding: 4px 6px; border-radius: 4px; }
.clave-row.danger .clave-tag { color: #FF8378; background: rgba(235,92,77,.12); border: 1px solid rgba(235,92,77,.32); }
.clave-row.ok .clave-tag { color: #5FD6A6; background: rgba(53,192,138,.12); border: 1px solid rgba(53,192,138,.32); }

.ficha-cta { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 13px; height: 38px; background: var(--surface-3); border: 1px solid var(--border-2); color: var(--text-hi); text-decoration: none; font: 600 11px/1 var(--sans); transition: border-color .15s, background .15s; }
.ficha-cta:hover { border-color: var(--accent); background: var(--surface-2); }
.ficha-note { font: 500 11px/1.5 var(--sans); color: var(--text-lo); }
.ficha-note-sm { font: 500 10px/1.5 var(--sans); color: var(--text-mut); margin: 0 0 9px; }
.ficha-block > :last-child { margin-bottom: 0; }

.ficha-doc { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 13px; border: 1px solid var(--border); margin-bottom: 8px; text-decoration: none; background: var(--surface-2); transition: border-color .15s; }
.ficha-doc:hover { border-color: var(--carto); }
.ficha-doc-main { display: flex; flex-direction: column; gap: 3px; }
.ficha-doc-t { font: 600 12px/1.2 var(--sans); color: var(--text-hi); }
.ficha-doc-d { font: 500 9px/1.2 var(--sans); color: var(--text-mut); }
.ficha-badge { flex: none; font: 600 9px/1 var(--mono); color: var(--text-lo); background: var(--surface-3); border: 1px solid var(--border); padding: 5px 8px; white-space: nowrap; }
.ficha-grouptag { font: 700 9px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--text-hi); background: var(--surface-3); border: 1px solid var(--border-2); display: inline-block; padding: 6px 10px; margin: 22px 20px 0; }
.ficha-grouptag + .ficha-block { padding-top: 11px; }
.ficha-gasto-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); font: 500 11px/1 var(--sans); color: var(--text); }
.ficha-gasto-row:last-of-type { border-bottom: none; }
.ficha-check { background: var(--surface-2); border: 1px solid var(--border); padding: 11px 13px; margin-bottom: 8px; }
.ficha-check-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.ficha-check-t { font: 600 11px/1.35 var(--sans); color: var(--text-hi); }
.ficha-check-d { font: 500 9px/1.45 var(--sans); color: var(--text-mut); margin: 5px 0 0; }
.ficha-link { display: flex; flex-direction: column; gap: 3px; padding: 11px 13px; border: 1px solid var(--border); margin-bottom: 8px; text-decoration: none; background: var(--surface-2); transition: border-color .15s; }
.ficha-link:hover { border-color: var(--carto); }
.ficha-link-t { font: 600 11px/1.2 var(--sans); color: var(--carto); }
.ficha-link-d { font: 500 9px/1.3 var(--sans); color: var(--text-mut); }

/* ═══ Agregador de capas ═══ */
.capas-panel { border: 1px solid var(--border); background: var(--surface-2); margin-bottom: 14px; overflow: hidden; border-radius: var(--r-card); }
.capas-head { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; background: var(--surface-3); border: 0; border-left: 3px solid var(--accent); cursor: pointer; }
.capas-head-t { display: inline-flex; align-items: center; gap: 9px; font: 700 11px/1 var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--text-hi); }
/* Icono de sección: cuadrado pastel modernista */
.capas-ico { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; flex: none; border-radius: 8px; font-size: 14px; line-height: 1; }
/* Acento de color por sección (Información/Capas/Movilidad/Zonas) */
.capas-panel:nth-of-type(1) .capas-head { border-left-color: var(--accent); }
.capas-panel:nth-of-type(2) .capas-head { border-left-color: var(--gold); }
.capas-panel:nth-of-type(3) .capas-head { border-left-color: var(--green); }
.capas-panel:nth-of-type(4) .capas-head { border-left-color: var(--carto); }
.capas-panel:nth-of-type(1) .capas-ico { background: color-mix(in srgb, var(--accent) 15%, transparent); }
.capas-panel:nth-of-type(2) .capas-ico { background: color-mix(in srgb, var(--gold) 18%, transparent); }
.capas-panel:nth-of-type(3) .capas-ico { background: color-mix(in srgb, var(--green) 16%, transparent); }
.capas-panel:nth-of-type(4) .capas-ico { background: color-mix(in srgb, var(--carto) 15%, transparent); }
.capas-ctx { font: 500 10px/1 var(--sans); color: var(--text-mut); text-transform: none; letter-spacing: .02em; margin-left: 7px; }
.capas-chev { font-size: 10px; color: var(--text-lo); transition: transform .18s; }
.capas-chev.open { transform: rotate(180deg); }
.capas-chev.side { display: inline-block; }
.capas-chev.side.open { transform: rotate(90deg); }
.capas-body { padding: 11px 12px 13px; }
.capas-intro { font: 500 9.5px/1.45 var(--sans); color: var(--text-mut); margin: 0 0 11px; }
.capas-src { border: 1px solid var(--border); margin-bottom: 8px; overflow: hidden; }
.capas-src-head { width: 100%; display: flex; align-items: center; gap: 7px; padding: 9px 11px; background: var(--surface); border: 0; cursor: pointer; text-align: left; }
.capas-src-head:hover { background: var(--surface-3); }
.capas-src-t { font: 700 10.5px/1.25 var(--sans); color: var(--text-hi); flex: 1; }
.capas-badge { font: 700 8px/1 var(--mono); color: #fff; background: var(--gold); padding: 4px 8px; letter-spacing: .04em; border-radius: var(--r-pill); }
.capas-src-body { padding: 4px 11px 11px; border-top: 1px solid var(--border); }
.capas-portal { display: inline-block; font: 600 9px/1 var(--sans); color: var(--carto); text-decoration: none; margin: 9px 0 7px; }
.capas-portal:hover { text-decoration: underline; }
.capas-layer { display: flex; gap: 8px; align-items: flex-start; padding: 7px 0; cursor: pointer; border-top: 1px solid var(--border); }
.capas-layer input { margin-top: 2px; accent-color: var(--accent); flex-shrink: 0; }
.capas-layer-body { display: flex; flex-direction: column; gap: 1px; }
.capas-layer-t { font: 600 10px/1.3 var(--sans); color: var(--text-hi); }
.capas-layer-h { font: 500 8.5px/1.4 var(--sans); color: var(--text-mut); }
.capas-layer.slim { padding: 5px 0; }
.capas-layer.slim .capas-layer-t { font-weight: 500; color: var(--text-lo); }
.capas-all-toggle { display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 9px; padding: 8px 0 0; background: 0; border: 0; border-top: 1px solid var(--border); cursor: pointer; font: 600 9.5px/1 var(--sans); color: var(--text-lo); }
.capas-count { margin-left: auto; font: 700 8px/1 var(--mono); color: var(--text-lo); background: var(--surface-3); padding: 2px 6px; }
.capas-all { padding-top: 2px; }
.capas-status { display: block; font: 500 9px/1.4 var(--sans); color: var(--text-mut); padding: 7px 0; }
.capas-status.err { color: var(--red); }

/* ═══ Situación urbanística (PIU) ═══ */
.piu-clau { display: flex; align-items: center; gap: 11px; padding: 11px 13px; background: var(--surface-2); border: 1px solid var(--border-2); }
.piu-clau-tag { flex-shrink: 0; min-width: 48px; text-align: center; font: 800 17px/1 var(--mono); color: #fff; background: var(--accent); padding: 10px 8px; border-radius: var(--r-inner); }
.piu-clau-body { display: flex; flex-direction: column; gap: 2px; }
.piu-clau-nom { font: 700 11px/1.3 var(--sans); color: var(--text-hi); }
.piu-clau-sub { font: 600 9px/1.2 var(--sans); color: var(--text-lo); }
.piu-meta { display: flex; flex-direction: column; gap: 1px; margin-top: 9px; }
.piu-meta-row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 2px; border-bottom: 1px solid var(--border); font: 500 10px/1.3 var(--sans); color: var(--text-mut); }
.piu-meta-row b { font-weight: 700; color: var(--text-hi); font-family: var(--mono); font-size: 10px; }
.piu-afec { display: flex; flex-direction: column; gap: 4px; margin-top: 9px; padding: 9px 11px; background: var(--surface); border: 1px solid var(--border); }
.piu-afec-red { background: rgba(235,92,77,.1); border-color: rgba(235,92,77,.3); }
.piu-afec-amber { background: rgba(224,162,60,.1); border-color: rgba(224,162,60,.3); }
.piu-afec-h { font: 700 10px/1.2 var(--sans); color: var(--text-hi); }
.piu-afec-red .piu-afec-h { color: #FF8378; }
.piu-afec-amber .piu-afec-h { color: #E7C079; }
.piu-afec-item { font: 500 9.5px/1.4 var(--sans); color: var(--text-lo); padding-left: 2px; }

/* ═══ Movilidad ═══ */
.mov-group { margin-bottom: 6px; }
.mov-group-t { display: block; font: 700 9px/1 var(--sans); color: var(--text-mut); text-transform: uppercase; letter-spacing: .08em; margin: 9px 0 3px; }
.mov-st { font: 700 8px/1 var(--sans); padding: 2px 5px; border-radius: 3px; margin-left: 5px; }
.mov-st.live { color: var(--green); background: rgba(53,192,138,.14); }
.mov-st.err { color: var(--red); background: rgba(235,92,77,.14); }
.mov-group .capas-portal { margin: 4px 0 0; }
.mov-lineas { display: flex; flex-direction: column; gap: 8px; padding: 6px 2px 4px; }
.mov-lineas .ctrl { font-size: 11.5px; }
.capas-foot { font: 500 8.5px/1.4 var(--sans); color: var(--text-mut); margin: 10px 0 0; padding-top: 9px; border-top: 1px solid var(--border); }
.renta-legend { display: flex; align-items: center; gap: 6px; margin-top: 6px; font: 600 8px/1 var(--sans); color: var(--text-mut); }
.renta-scale { width: 66px; height: 8px; border-radius: 2px; background: linear-gradient(90deg, #B5392C, #E0A23C, #F2D024, #8DC63F, #1F9D5B); flex: none; }
.renta-any { font-family: var(--mono); }

/* ═══ Explorador de parada ═══ */
.stop-explorer { position: absolute; top: 16px; left: 16px; z-index: 5; width: 306px; max-width: calc(100% - 32px); background: var(--float-bg); backdrop-filter: blur(8px); border: 1px solid var(--border-2); box-shadow: 0 12px 30px rgba(0,0,0,.5); padding: 14px 15px; border-radius: var(--r-card); }
.stop-explorer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.stop-explorer-k { display: block; font: 700 8px/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--accent-ink); }
.stop-explorer-name { display: block; font: 700 13px/1.25 var(--sans); color: var(--text-hi); margin-top: 3px; }
.stop-explorer-x { flex-shrink: 0; width: 24px; height: 24px; border: 0; background: var(--surface-2); color: var(--text-lo); cursor: pointer; font-size: 12px; }
.stop-explorer-x:hover { background: var(--surface-3); }
.stop-explorer-hint { display: block; font: 500 9.5px/1.4 var(--sans); color: var(--text-mut); margin: 9px 0 8px; }
.stop-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.stop-chip { font: 700 11px/1 var(--mono); color: #fff; background: var(--c); border: 2px solid var(--c); border-radius: 4px; padding: 6px 9px; cursor: pointer; opacity: .5; transition: opacity .12s, transform .12s; }
.stop-chip:hover { opacity: .85; }
.stop-chip.on { opacity: 1; transform: scale(1.06); box-shadow: 0 2px 10px rgba(0,0,0,.4); }
.stop-clear { margin-top: 10px; width: 100%; font: 600 10px/1 var(--sans); color: var(--text-lo); background: var(--surface-2); border: 1px solid var(--border); padding: 8px; cursor: pointer; }
.stop-clear:hover { background: var(--surface-3); }

/* ═══ MÓVIL: mapa a pantalla completa; sidebar y controles como paneles deslizables ═══ */
@media (max-width: 680px) {
  /* App full-screen: el documento NO scrollea; solo el interior del sheet. Mata el
     rubber-band incómodo al interactuar con los componentes. */
  html, body { height: 100dvh; overflow: hidden; overscroll-behavior: none; }
  .app-container { height: 100dvh; }
  .fab { display: flex; }
  .panel-close { display: flex; }
  /* ── Bottom sheets como cards flotantes (patrón Google Maps + lenguaje de la cápsula):
     margen a los lados y abajo, 4 esquinas redondeadas; nunca alcanzan el buscador ── */
  .sidebar, .map-floating-controls {
    position: fixed; left: 8px; right: 8px; bottom: 8px; top: auto;
    width: auto; max-width: none; height: auto;
    border-radius: 18px; border: 1px solid var(--border-2);
    box-shadow: 0 -12px 34px rgba(0,0,0,.30); z-index: 1150;
    overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
    transform: translateY(110%); transition: transform .3s cubic-bezier(.3,.9,.3,1); will-change: transform;
  }
  /* Alturas de anclaje medidas en dvh (viewport REAL del móvil, sin contar la barra del
     navegador) → el sheet nunca se cuela bajo el borde visible. Reservamos ~96px arriba
     para la cápsula de búsqueda flotante. */
  .sidebar { max-height: calc(100dvh - 96px - env(safe-area-inset-top)); }
  /* Estado expandido (arrastre hacia arriba): ocupa toda la altura disponible */
  .sidebar.full { height: calc(100dvh - 96px - env(safe-area-inset-top)); }
  .map-floating-controls { max-height: min(60dvh, calc(100dvh - 96px - env(safe-area-inset-top))); padding-top: 0; }
  .sidebar.open, .map-floating-controls.open { transform: translateY(0); }

  /* Con un sheet abierto, las utilidades del mapa no aplican: fade out limpio */
  .sheet-open .fab-round, .sheet-open .maplibregl-ctrl-top-right,
  .sheet-open .maplibregl-ctrl-bottom-right, .sheet-open .maplibregl-ctrl-bottom-left {
    opacity: 0; pointer-events: none; transition: opacity .2s ease;
  }
  .fab-round, .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left {
    transition: opacity .2s ease;
  }

  /* Asa del sheet: tap o deslizar hacia abajo = cerrar */
  .sheet-handle {
    display: flex; position: sticky; top: 0; z-index: 40; width: 100%;
    padding: 9px 0 7px; align-items: center; justify-content: center;
    background: var(--surface); border: 0; cursor: pointer;
  }
  .sheet-handle span { width: 38px; height: 4px; border-radius: 999px; background: var(--border-2); }

  /* Sin ✕ en móvil: el asa (tap o deslizar) ya cierra el sheet */
  .panel-close { display: none; }

  /* ── Secciones del sheet como CARDS: borde, radio y retícula de padding única (16px)
     para que cabecera y contenido queden alineados abierto o cerrado ── */
  .sidebar {
    padding: 0 10px calc(14px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4);
  }
  .map-floating-controls {
    background: color-mix(in srgb, var(--float-bg) 84%, transparent);
    -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4);
  }
  .sheet-handle { background: transparent; }
  .capas-panel { border: 1px solid var(--border-2); border-radius: 14px; margin: 8px 0 0; background: color-mix(in srgb, var(--surface) 88%, transparent); }
  .capas-head { padding: 13px 16px; border-radius: 13px 13px 0 0; background: color-mix(in srgb, var(--surface-3) 82%, transparent); }
  .capas-body { padding: 12px 16px 14px; }
  .context-panel .ficha-header { padding: 16px 16px 14px; }
  .context-panel .ficha-block { padding: 15px 16px; }
  .context-panel > :last-child, .capas-panel > div > .context-panel:last-child { border-bottom: 0; }

  /* Contenidos curvados: los bloques internos siguen el lenguaje redondeado del sheet */
  .ver, .clave-legend, .capas-src, .radio-ctl { border-radius: 12px; }
  .ficha-cta, .ficha-doc, .tr-search, .search-box input { border-radius: 10px; }
  .ficha-source, .capas-badge, .ficha-badge, .capas-portal { border-radius: 6px; }
  .ficha-grid { border-radius: 12px; }
  /* Explorador de parada como card inferior (zona del pulgar), alineado al lenguaje
     de los sheets; los botones del mapa se desvanecen mientras está abierto */
  .stop-explorer {
    top: auto; bottom: 8px; left: 8px; right: 8px; width: auto; max-width: none;
    border-radius: 16px; clip-path: none; z-index: 1120;
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--float-bg) 88%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
    box-shadow: 0 -10px 30px rgba(0,0,0,.26);
  }

  /* ── Geografía de la UI móvil: buscador flota arriba; utilidades abajo ── */
  /* FABs bajo la cápsula de búsqueda (52px + 10px de margen + aire) */
  .fab-info { top: calc(72px + env(safe-area-inset-top)); left: 10px; }
  .fab-map { top: calc(72px + env(safe-area-inset-top)); right: 10px; }

  /* Botones redondos solo-móvil: speed-dial de utilidades y tema día/noche */
  .fab-round {
    display: flex; position: absolute; z-index: 1100; width: 42px; height: 42px;
    align-items: center; justify-content: center; border-radius: 13px;
    border: 1px solid var(--border-2); background: var(--float-bg); color: var(--text-hi);
    -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
    box-shadow: 0 4px 14px rgba(0,0,0,.22); cursor: pointer; font-size: 15px; line-height: 1;
  }
  .fab-utils { bottom: 34px; left: 8px; }
  .fab-utils svg { transition: transform .25s ease; }
  .fab-utils.open svg { transform: rotate(180deg); }
  .fab-theme { bottom: 42px; right: 8px; }

  /* Utilidades de mapa (navegación, fullscreen, GPS) → una sola tarjeta vertical
     abajo-izquierda, encima del speed-dial; la rosa de los vientos queda suelta debajo */
  .maplibregl-ctrl-top-right {
    top: auto; right: auto; bottom: 86px; left: 8px;
    display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start;
    --map-btn: clamp(38px, 9.5vw, 46px); /* botones cuadrados que autoescalan con el ancho */
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl { margin: 0; float: none; }

  /* Colapso speed-dial: cerrados se deslizan hacia abajo y desvanecen; al abrir
     suben en cascada desde el botón (el de más abajo primero) */
  .maplibregl-ctrl-top-right .maplibregl-ctrl { transition: transform .28s ease, opacity .22s ease, visibility .28s; }
  .maplibregl-ctrl-top-right .maplibregl-ctrl:nth-child(1) { transition-delay: .12s; }
  .maplibregl-ctrl-top-right .maplibregl-ctrl:nth-child(2) { transition-delay: .08s; }
  .maplibregl-ctrl-top-right .maplibregl-ctrl:nth-child(3) { transition-delay: .04s; }
  .maplibregl-ctrl-top-right .maplibregl-ctrl:nth-child(4) { transition-delay: 0s; }
  .utils-collapsed .maplibregl-ctrl-top-right .maplibregl-ctrl {
    opacity: 0; transform: translateY(18px); visibility: hidden; pointer-events: none; transition-delay: 0s;
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl-group:not(.compass-rose) {
    background: var(--float-bg);
    -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
    border: 1px solid var(--border-2); border-top: 0; border-radius: 0; box-shadow: none;
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl-group:not(.compass-rose):first-child {
    border-top: 1px solid var(--border-2); border-radius: 12px 12px 0 0;
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl-group:has(+ .compass-rose) {
    border-radius: 0 0 12px 12px;
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl-group button {
    width: var(--map-btn); height: var(--map-btn); border-radius: 0;
  }
  /* En tema oscuro los iconos nativos (SVG negros) se invierten para seguir visibles */
  html[data-theme="dark"] .maplibregl-ctrl-top-right .maplibregl-ctrl-group:not(.compass-rose) button .maplibregl-ctrl-icon {
    filter: invert(.88) hue-rotate(180deg);
  }
  .compass-rose { margin-top: 8px !important; border-radius: 50%; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,.22); }

  /* Zoom + atribución: chips en fila, pegados, abajo-derecha */
  .maplibregl-ctrl-bottom-right {
    display: flex; flex-direction: row; align-items: center; justify-content: flex-end;
    gap: 4px; padding: 0 8px 8px 0;
  }
  .maplibregl-ctrl-bottom-right .maplibregl-ctrl { margin: 0; float: none; }
  .zoom-indicator-box { padding: 0 9px; height: 24px; display: flex; align-items: center; font-size: 9px; border-radius: 10px; }
  .maplibregl-ctrl-attrib { font-size: 9px; border-radius: 10px; }

  .maplibregl-ctrl-bottom-left { z-index: 5; }
}
</style>
