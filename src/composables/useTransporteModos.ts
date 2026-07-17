// ═══════════════════════════════════════════════════════════════════════════════
//  useTransporteModos — líneas de transporte por modo (metro/bus/rodalies/tram) desde
//  OpenStreetMap/Overpass: carga la relación con geometría + paradas, publica el catálogo de
//  líneas y controla qué líneas se ven (chips, todas/ninguna, filtro por línea). Singleton.
//
//  El estado de líneas y la parada seleccionada viven en transporteState (compartido con el
//  explorador). `any` a nivel de archivo: LÍMITE con MapLibre + las features crudas de Overpass.
/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, computed } from 'vue'
import { useMapStore } from './useMapStore'
import { overpassFetch } from '../services/overpass.js'
import { TRANSPORTES, TRANSPORT_BBOX, type TransporteModo } from '../config/transportes'
import {
  transportLines, transportSelected, selectedStop,
  type TransportLine, type StopChip, type LoadStatus,
} from './transporteState'

const transportStatus = ref<Record<string, LoadStatus>>({})
const transportVisible = ref<Record<string, boolean>>({}) // key -> modo visible en el mapa (para el chip)
const busSearch = ref('')
const busExpanded = ref(false) // lista completa de buses desplegada

// Chips a renderizar por modo (bus: al buscar o la lista completa si se expande).
const chipsFor = (key: string): TransportLine[] => {
  const all = transportLines.value[key] || []
  if (key !== 'bus') return all
  const q = busSearch.value.trim().toLowerCase()
  if (q) return all.filter((l) => (l.ref || '').toLowerCase().includes(q)).slice(0, 200)
  return busExpanded.value ? all : []
}

export function useTransporteModos() {
  const { map: mapRef, stopLayerIds } = useMapStore()

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

  // Líneas por modo (Overpass): relaciones con geometría + nodos de parada.
  async function loadTransport(cfg: TransporteModo, visible: boolean) {
    const map = mapRef.value
    if (!map) return
    const srcId = `tr-${cfg.key}`
    const modeLayers = [`${srcId}-line`, `${srcId}-stops`, `${srcId}-labels`]
    if (map.getSource(srcId)) {
      modeLayers.forEach((id) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none') })
      transportVisible.value = { ...transportVisible.value, [cfg.key]: visible }
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
        layout: { visibility: visible ? 'visible' : 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top', 'text-optional': true },
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
      transportVisible.value = { ...transportVisible.value, [cfg.key]: true }
    } catch (err) {
      console.warn('Overpass transporte', cfg.key, err)
      transportStatus.value = { ...transportStatus.value, [cfg.key]: 'error' }
    }
  }

  // Modos de transporte visibles → chips activos (etiqueta corta: "Rodalies / Renfe" → "Rodalies").
  const activeChips = computed(() =>
    TRANSPORTES.filter((t) => transportVisible.value[t.key])
      .map((t) => ({ id: `tr:${t.key}`, label: t.label.split(' / ')[0], off: () => loadTransport(t, false) })),
  )

  return {
    TRANSPORTES,
    transportStatus, transportLines, transportSelected, transportVisible, busSearch, busExpanded,
    chipsFor, setAllLines, toggleLine, loadTransport, applyLineFilter, activeChips,
  }
}
