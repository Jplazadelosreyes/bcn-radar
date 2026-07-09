// ═══════════════════════════════════════════════════════════════════════════════
//  useRadio — radio de exploración desde la finca: dibuja un círculo y lista las paradas
//  de transporte dentro de él (Overpass). Singleton. Reacciona a radioOn/radioMetros y a
//  la finca seleccionada (clickedCoords de useFinca).
//
//  `any` acotado: frontera con las tags crudas de Overpass y el handle de MapLibre.
/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, computed, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMapStore } from './useMapStore'
import { useFinca } from './useFinca'
import { overpassFetch, haversine } from '../services/overpass.js'
import { stopPopup } from '../services/map-popups.js'

// Parada de transporte cercana a la finca (dentro del radio).
export interface RadioStop {
  name: string
  lng: number
  lat: number
  modo: string
  color: string
  lines: string
  dist: number
}

const { map } = useMapStore()
const { clickedCoords } = useFinca()

const radioOn = ref(false)
const radioMetros = ref(500)
const radioLabel = computed(() => (radioMetros.value >= 1000 ? (radioMetros.value / 1000).toFixed(1) + ' km' : radioMetros.value + ' m'))

const RADIO_MAX = 2100
const STOP_COLORS: Record<string, string> = { metro: '#E2231A', train: '#1A8A4A', bus: '#0067B1', tram: '#E87200' }
const radioStops = ref<RadioStop[]>([]) // paradas dentro del radio actual (para el dossier)
let radioStopsData: RadioStop[] = [] // todas las traídas (~2 km), filtradas en cliente
let radioLoadedKey: string | null = null // centro ya consultado, para no re-pedir al mover el slider

// Polígono de círculo (64 lados) a partir de centro [lng,lat] y radio en metros.
const circlePolygon = (center: [number, number], meters: number) => {
  const [lng, lat] = center
  const earth = 6378137
  const dLat = (meters / earth) * (180 / Math.PI)
  const dLng = (meters / (earth * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI)
  const pts: [number, number][] = []
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI
    pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] } }
}

const renderRadio = () => {
  const m = map.value
  if (!m || !m.getSource('radio')) return
  const c = clickedCoords.value
  if (!radioOn.value || !c) {
    m.getSource('radio').setData({ type: 'FeatureCollection', features: [] })
    return
  }
  m.getSource('radio').setData(circlePolygon([c.lng, c.lat], radioMetros.value))
}

const modeFromTags = (t: any): string => {
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
    radioStopsData = (data.elements || []).filter((n: any) => n.tags?.name).map((n: any) => {
      const modo = modeFromTags(n.tags)
      return { name: n.tags.name, lng: n.lon, lat: n.lat, modo, color: STOP_COLORS[modo] || '#5B616B', lines: n.tags.route_ref || '', dist: Math.round(haversine([c.lng, c.lat], [n.lon, n.lat])) }
    })
  } catch (err) {
    console.warn('Overpass radio-stops', err)
    radioStopsData = []
  }
  filterRadioStops()
}

const filterRadioStops = () => {
  const within = radioStopsData.filter((s) => s.dist <= radioMetros.value).sort((a, b) => a.dist - b.dist)
  radioStops.value = within
  const m = map.value
  if (m && m.getSource('radio-stops')) {
    m.getSource('radio-stops').setData({ type: 'FeatureCollection', features: within.map((s) => ({ type: 'Feature', properties: { name: s.name, color: s.color, modo: s.modo, lines: s.lines }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })) })
  }
}

const focusStop = (s: RadioStop) => {
  const m = map.value
  if (!m) return
  m.flyTo({ center: [s.lng, s.lat], zoom: Math.max(m.getZoom(), 16) })
  new maplibregl.Popup({ offset: 12 }).setLngLat([s.lng, s.lat]).setHTML(stopPopup(s)).addTo(m)
}

const comoLlegar = (s: RadioStop) => {
  const c = clickedCoords.value
  return c ? `https://www.google.com/maps/dir/?api=1&origin=${c.lat},${c.lng}&destination=${s.lat},${s.lng}&travelmode=transit` : '#'
}

const onRadioChange = async () => {
  renderRadio()
  if (!radioOn.value || !clickedCoords.value) {
    radioStops.value = []
    const m = map.value
    if (m && m.getSource('radio-stops')) m.getSource('radio-stops').setData({ type: 'FeatureCollection', features: [] })
    return
  }
  const key = `${clickedCoords.value.lat},${clickedCoords.value.lng}`
  if (key !== radioLoadedKey) {
    radioLoadedKey = key
    await loadRadioStops()
  } else {
    filterRadioStops()
  }
}

watch([radioOn, radioMetros, clickedCoords], onRadioChange, { deep: true })

export function useRadio() {
  return { radioOn, radioMetros, radioLabel, radioStops, focusStop, comoLlegar }
}
