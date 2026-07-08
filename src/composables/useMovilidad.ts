// ═══════════════════════════════════════════════════════════════════════════════
//  useMovilidad — transporte y servicios: líneas por modo (Overpass), explorador de
//  parada unificado (GTFS + Overpass) con recorridos, y capas de datos abiertos (Bicing,
//  carriles bici, POI, temperatura). Singleton. Patrón: estado/config a nivel de módulo;
//  las funciones que tocan el mapa viven dentro de useMovilidad() y toman `map` local.
//
//  `any` a nivel de archivo: éste es el LÍMITE con dos APIs sin esquema tipado — las
//  expresiones imperativas de MapLibre y las features crudas de Overpass/GTFS. El dominio
//  (chips, paradas, líneas, capas) SÍ está tipado abajo; los `any` se acotan a esas fronteras.
/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMapStore } from './useMapStore'
import { overpassFetch } from '../services/overpass.js'
import { loadPoi, poiFC } from '../services/poi.js'
import { fetchBicing } from '../services/movilidad.js'
import { fetchTemperatura } from '../services/meteo.js'
import { loadTransit, stopsGeoJSON, routeGeoJSON, routeChip } from '../services/transit.js'

// ── Tipos de dominio ──
export interface TransportLine {
  ref: string
  colour: string
}
export interface StopChip {
  id: string
  short: string
  long?: string
  color: string
  on?: boolean
}
export interface SelectedStop {
  name: string
  sub?: string
  src: string // 'gtfs' | key de modo Overpass
  chips: StopChip[]
}
type LoadStatus = 'loading' | 'ok' | 'error'

// Modos de transporte (recorridos reales desde OpenStreetMap / Overpass).
export const TRANSPORTES = [
  { key: 'metro', label: 'Metro', color: '#E2231A', filter: '["route"="subway"]' },
  { key: 'rodalies', label: 'Rodalies / Renfe', color: '#1A8A4A', filter: '["route"="train"]' },
  { key: 'bus', label: 'Bus', color: '#0067B1', filter: '["route"="bus"]' },
  { key: 'tram', label: 'FGC / Tranvía', color: '#E87200', filter: '["route"~"tram|light_rail"]' },
]
const TRANSPORT_BBOX = '41.27,2.00,41.50,2.30' // S,W,N,E (BCN + área cercana)

const transportStatus = ref<Record<string, LoadStatus>>({})
const transportLines = ref<Record<string, TransportLine[]>>({}) // key -> [{ ref, colour }]
const transportSelected = ref<Record<string, string[]>>({}) // key -> [refs visibles]
const busSearch = ref('')
const busExpanded = ref(false) // lista completa de buses desplegada

// ── Explorador de parada (GTFS TMB) ──
const transitOn = ref(false)
const transitStatus = ref('') // 'loading'|'ok'|'error'
let transitData: any = null // JSON pre-procesado (no reactivo: es grande)
const selectedStop = ref<SelectedStop | null>(null)
const activeRouteIds = ref<string[]>([]) // recorridos GTFS activos (multi-selección)

// ── Capas de datos abiertos ──
const dataActive = ref<Record<string, boolean>>({})
const dataStatus = ref<Record<string, LoadStatus>>({})
const dataTimers: Record<string, ReturnType<typeof setInterval>> = {} // layerId -> refresco (vivo)
const poiDate = ref('')

// Chips a renderizar por modo (bus: al buscar o la lista completa si se expande).
const chipsFor = (key: string): TransportLine[] => {
  const all = transportLines.value[key] || []
  if (key !== 'bus') return all
  const q = busSearch.value.trim().toLowerCase()
  if (q) return all.filter((l) => (l.ref || '').toLowerCase().includes(q)).slice(0, 200)
  return busExpanded.value ? all : []
}

// ¿El modo Overpass tiene una selección curada (subset) o muestra todas sus líneas?
const isCurated = (src: string): boolean => {
  const sel = transportSelected.value[src] || []
  const all = transportLines.value[src] || []
  return sel.length > 0 && sel.length < all.length
}
// Chip encendido: GTFS por recorrido activo; Overpass por membresía (solo si hay curado).
function isChipOn(chip: StopChip): boolean {
  const src = selectedStop.value?.src
  if (!src || src === 'gtfs') return activeRouteIds.value.includes(chip.id)
  return isCurated(src) && (transportSelected.value[src] || []).includes(chip.id)
}
const stopHasSelection = computed(() => {
  const src = selectedStop.value?.src
  if (!src) return false
  return src === 'gtfs' ? activeRouteIds.value.length > 0 : isCurated(src)
})
// Chips ya anotados con `on` para StopExplorer (presentacional).
const stopChipsView = computed<StopChip[]>(() =>
  (selectedStop.value?.chips || []).map((c) => ({ ...c, on: isChipOn(c) })),
)

// ── Catálogo declarativo de capas de datos abiertos ──
const CYCLEWAY_QUERY = '[out:json][timeout:60];way[highway=cycleway](41.30,2.05,41.48,2.25);out geom;'
async function loadCarrilBici() {
  const d = await overpassFetch(CYCLEWAY_QUERY)
  const features = (d.elements || [])
    .filter((e: any) => e.type === 'way' && e.geometry)
    .map((w: any) => ({
      type: 'Feature',
      properties: { name: w.tags?.name || '' },
      geometry: { type: 'LineString', coordinates: w.geometry.map((g: any) => [g.lon, g.lat]) },
    }))
  return { type: 'FeatureCollection', features }
}
async function poiCategory(cat: string) {
  const d = await loadPoi()
  poiDate.value = d.generated || ''
  return poiFC(d, cat)
}
const poiLayer = (
  id: string,
  label: string,
  hint: string,
  color: string,
  minzoom = 13,
): MovLayer => ({
  id, label, hint, minzoom,
  load: () => poiCategory(id),
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 17, 6],
    'circle-color': color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.2,
  },
  popup: (p) => `<b>${p.name || '(sin nombre)'}</b>${p.kind ? `<br><span style="color:#5B616B">${p.kind}</span>` : ''}`,
})

export interface MovLayer {
  id: string
  label: string
  hint: string
  portal?: string
  live?: number
  layerType?: string
  minzoom?: number
  load: () => Promise<any>
  paint: any
  symbol?: any
  popup?: (p: any) => string
}
export const MOVILIDAD: Array<{ group: string; layers: MovLayer[] }> = [
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
        popup: (p) => `<b>${p.name}</b><br><span style="color:#5B616B">🚲 ${p.bikes} bicis${p.ebikes != null ? ` (${p.ebikes} eléctr.)` : ''} · 🅿️ ${p.docks} anclajes</span>`,
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
        popup: (p) => `<b>${p.name}</b><br><span style="color:#5B616B">🌡️ ${p.temp} °C · ${p.alt} m</span>`,
      },
    ],
  },
]

export function useMovilidad() {
  const { map: mapRef, overlayClickLayers, stopLayerIds } = useMapStore()

  // Aplica el filtro de líneas seleccionadas a línea + paradas + etiquetas del modo.
  const applyLineFilter = (key: string) => {
    const map = mapRef.value
    if (!map) return
    const sel = transportSelected.value[key] || []
    const ids = [`tr-${key}-line`, `tr-${key}-stops`, `tr-${key}-labels`]
    if (!map.getLayer(ids[0])) return
    if (!sel.length) {
      ids.forEach((id, i) => map.setFilter(id, ['==', ['get', i === 0 ? 'ref' : 'name'], '__none__']))
      return
    }
    map.setFilter(ids[0], ['in', ['get', 'ref'], ['literal', sel]])
    const stopFilter = ['any', ...sel.map((l) => ['in', l, ['get', 'linesArr']])]
    map.setFilter(ids[1], stopFilter)
    map.setFilter(ids[2], stopFilter)
  }

  // Selección masiva: Todas/Ninguna (en bus con búsqueda, solo sobre lo filtrado).
  const setAllLines = (key: string, on: boolean) => {
    const all = transportLines.value[key] || []
    let next: string[]
    if (key === 'bus' && busSearch.value.trim()) {
      const shown = new Set(chipsFor(key).map((l) => l.ref))
      const cur = new Set(transportSelected.value[key] || [])
      shown.forEach((r) => (on ? cur.add(r) : cur.delete(r)))
      next = [...cur]
    } else {
      next = on ? all.map((l) => l.ref) : []
    }
    transportSelected.value = { ...transportSelected.value, [key]: next }
    applyLineFilter(key)
  }
  const toggleLine = (key: string, ref: string) => {
    const cur = transportSelected.value[key] || []
    const next = cur.includes(ref) ? cur.filter((r) => r !== ref) : [...cur, ref]
    transportSelected.value = { ...transportSelected.value, [key]: next }
    applyLineFilter(key)
  }

  // Enciende/apaga una capa de datos: la carga la 1ª vez (lazy), luego alterna visibilidad.
  async function toggleData(cfg: MovLayer) {
    const map = mapRef.value
    if (!map) return
    const on = !dataActive.value[cfg.id]
    dataActive.value = { ...dataActive.value, [cfg.id]: on }
    const id = `data-${cfg.id}`
    const layerIds = cfg.symbol ? [id, `${id}-label`] : [id]
    if (!on) {
      layerIds.forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', 'none'))
      if (dataTimers[cfg.id]) { clearInterval(dataTimers[cfg.id]); delete dataTimers[cfg.id] }
      return
    }
    if (map.getSource(id)) {
      layerIds.forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', 'visible'))
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
          map.on('click', id, (e: any) => {
            new maplibregl.Popup({ offset: 12 }).setLngLat(e.lngLat).setHTML(cfg.popup!(e.features[0].properties)).addTo(map)
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
    if (cfg.live && !dataTimers[cfg.id]) {
      dataTimers[cfg.id] = setInterval(async () => {
        try { const gj = await cfg.load(); if (map.getSource(id)) map.getSource(id).setData(gj) } catch { /* red intermitente */ }
      }, cfg.live)
    }
  }

  // ── Explorador GTFS: paradas → recorridos ──
  function ensureRouteLayers() {
    const map = mapRef.value
    if (map.getSource('transit-route-line')) return
    map.addSource('transit-route-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: 'transit-route-line', type: 'line', source: 'transit-route-line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['coalesce', ['get', 'color'], '#2D5BD0'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 6], 'line-opacity': 0.9 },
    })
    map.addSource('transit-route-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: 'transit-route-stops', type: 'circle', source: 'transit-route-stops',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 6], 'circle-color': '#fff', 'circle-stroke-color': ['coalesce', ['get', 'color'], '#2D5BD0'], 'circle-stroke-width': 2.5 },
    })
    overlayClickLayers.push('transit-route-stops')
    map.on('click', 'transit-route-stops', (e: any) => {
      new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat).setHTML(`<b>${e.features[0].properties.name}</b>`).addTo(map)
    })
    map.on('mouseenter', 'transit-route-stops', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'transit-route-stops', () => { map.getCanvas().style.cursor = '' })
  }

  // Redibuja TODOS los recorridos GTFS activos (multi-selección), cada uno con su color.
  function renderRoutes() {
    const map = mapRef.value
    ensureRouteLayers()
    const lineFeats: any[] = []
    const stopFeats: any[] = []
    for (const rid of activeRouteIds.value) {
      const g = routeGeoJSON(transitData, rid)
      if (!g) continue
      g.lines.features.forEach((f: any) => { f.properties = { ...(f.properties || {}), color: g.color }; lineFeats.push(f) })
      g.stops.features.forEach((f: any) => { f.properties = { ...(f.properties || {}), color: g.color }; stopFeats.push(f) })
    }
    map.getSource('transit-route-line').setData({ type: 'FeatureCollection', features: lineFeats })
    map.getSource('transit-route-stops').setData({ type: 'FeatureCollection', features: stopFeats })
  }

  function chooseRoute(routeId: string) {
    const map = mapRef.value
    if (!map || !transitData) return
    const cur = activeRouteIds.value
    activeRouteIds.value = cur.includes(routeId) ? cur.filter((r) => r !== routeId) : [...cur, routeId]
    renderRoutes()
  }

  function clearRoute() {
    const map = mapRef.value
    activeRouteIds.value = []
    if (map?.getSource('transit-route-line')) map.getSource('transit-route-line').setData({ type: 'FeatureCollection', features: [] })
    if (map?.getSource('transit-route-stops')) map.getSource('transit-route-stops').setData({ type: 'FeatureCollection', features: [] })
  }

  // Chip del explorador: GTFS acumula recorridos; Overpass cura el filtro línea a línea.
  function pickStopLine(chip: StopChip) {
    const src = selectedStop.value?.src
    if (!src || src === 'gtfs') { chooseRoute(chip.id); return }
    const all = (transportLines.value[src] || []).map((l) => l.ref)
    const cur = transportSelected.value[src] || []
    let next: string[]
    if (!isCurated(src)) next = [chip.id]
    else if (cur.includes(chip.id)) { next = cur.filter((r) => r !== chip.id); if (!next.length) next = all }
    else next = [...cur, chip.id]
    transportSelected.value = { ...transportSelected.value, [src]: next }
    applyLineFilter(src)
  }

  function stopClear() {
    const src = selectedStop.value?.src
    if (src && src !== 'gtfs') {
      transportSelected.value = { ...transportSelected.value, [src]: (transportLines.value[src] || []).map((l) => l.ref) }
      applyLineFilter(src)
      return
    }
    clearRoute()
  }

  // Explorador unificado (GTFS): carga las paradas y engancha su clic.
  async function toggleTransit() {
    const map = mapRef.value
    if (!map) return
    const on = !transitOn.value
    transitOn.value = on
    if (!on) {
      if (map.getLayer('transit-stops')) map.setLayoutProperty('transit-stops', 'visibility', 'none')
      clearRoute()
      selectedStop.value = null
      return
    }
    if (map.getSource('transit-stops')) { map.setLayoutProperty('transit-stops', 'visibility', 'visible'); return }
    transitStatus.value = 'loading'
    try {
      transitData = await loadTransit()
      map.addSource('transit-stops', { type: 'geojson', data: stopsGeoJSON(transitData) })
      map.addLayer({
        id: 'transit-stops', type: 'circle', source: 'transit-stops', minzoom: 12,
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 5], 'circle-color': '#2D5BD0', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 },
      })
      overlayClickLayers.push('transit-stops')
      map.on('click', 'transit-stops', (e: any) => {
        const id = e.features[0].properties.id
        const s = transitData.stops.find((x: any) => x.id === id)
        if (!s) return
        selectedStop.value = { name: s.name, src: 'gtfs', chips: s.routes.map((rid: any) => routeChip(transitData, rid)) }
      })
      map.on('mouseenter', 'transit-stops', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'transit-stops', () => { map.getCanvas().style.cursor = '' })
      transitStatus.value = 'ok'
    } catch (e) {
      console.warn('transit', e)
      transitStatus.value = 'error'
      transitOn.value = false
    }
  }

  // Líneas por modo (Overpass): relaciones con geometría + nodos de parada.
  async function loadTransport(cfg: (typeof TRANSPORTES)[number], visible: boolean) {
    const map = mapRef.value
    if (!map) return
    const srcId = `tr-${cfg.key}`
    const modeLayers = [`${srcId}-line`, `${srcId}-stops`, `${srcId}-labels`]
    if (map.getSource(srcId)) {
      modeLayers.forEach((id) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none') })
      return
    }
    if (!visible) return
    transportStatus.value = { ...transportStatus.value, [cfg.key]: 'loading' }
    try {
      const q = `[out:json][timeout:120];relation${cfg.filter}(${TRANSPORT_BBOX})->.routes;.routes out geom;node(r.routes);out;`
      const data = await overpassFetch(q)
      const elements: any[] = data.elements || []
      const stopLines: Record<string, Set<string>> = {} // nodeId -> Set de etiquetas de línea
      const linesMap: Record<string, string> = {} // ref de línea -> colour
      const lineFeatures = elements
        .filter((el) => el.type === 'relation' && el.members)
        .map((rel) => {
          const lineId = rel.tags?.ref || rel.tags?.name || ''
          if (lineId && !(lineId in linesMap)) linesMap[lineId] = rel.tags?.colour || cfg.color
          rel.members
            .filter((m: any) => m.type === 'node' && /stop|platform/.test(m.role || ''))
            .forEach((m: any) => { (stopLines[m.ref] ||= new Set()).add(lineId) })
          const lines = rel.members.filter((m: any) => m.type === 'way' && m.geometry).map((m: any) => m.geometry.map((g: any) => [g.lon, g.lat]))
          return { type: 'Feature', properties: { ref: lineId, colour: rel.tags?.colour || null }, geometry: { type: 'MultiLineString', coordinates: lines } }
        })
        .filter((f) => f.geometry.coordinates.length)
      const byName: Record<string, { coord: number[]; lines: Set<string> }> = {}
      elements
        .filter((el) => el.type === 'node' && el.tags?.name)
        .forEach((n) => {
          const lset: string[] = stopLines[n.id] ? [...stopLines[n.id]] : (n.tags.route_ref ? n.tags.route_ref.split(/[;,]/) : [])
          if (!byName[n.tags.name]) byName[n.tags.name] = { coord: [n.lon, n.lat], lines: new Set() }
          lset.map((l) => l.trim()).filter(Boolean).forEach((l) => byName[n.tags.name].lines.add(l))
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

      map.on('click', `${srcId}-stops`, (e: any) => {
        const p = e.features[0].properties
        let refs: string[] = []
        try { refs = JSON.parse(p.linesArr || '[]') } catch { refs = (p.lines || '').split(/,\s*/).filter(Boolean) }
        if (!refs.length && p.lines) refs = String(p.lines).split(/,\s*/).filter(Boolean)
        const catalog = transportLines.value[cfg.key] || []
        const chips: StopChip[] = refs
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map((ref) => ({ id: ref, short: ref, long: `${cfg.label} ${ref}`, color: catalog.find((l) => l.ref === ref)?.colour || cfg.color }))
        selectedStop.value = { name: p.name, sub: p.modo, src: cfg.key, chips }
      })
      map.on('mouseenter', `${srcId}-stops`, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', `${srcId}-stops`, () => { map.getCanvas().style.cursor = '' })

      const lineList: TransportLine[] = Object.entries(linesMap)
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

  return {
    TRANSPORTES, MOVILIDAD,
    transportStatus, transportLines, transportSelected, busSearch, busExpanded,
    chipsFor, setAllLines, toggleLine,
    dataActive, dataStatus, poiDate, toggleData,
    transitOn, transitStatus, selectedStop, stopHasSelection, stopChipsView,
    toggleTransit, loadTransport, pickStopLine, clearRoute, stopClear,
  }
}
