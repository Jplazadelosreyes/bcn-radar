// ═══════════════════════════════════════════════════════════════════════════════
//  useExploradorParadas — explorador de parada unificado (GTFS TMB + modos Overpass). Carga
//  las paradas GTFS y engancha su clic; al tocar una parada (de cualquier fuente) abre sus
//  líneas como chips; elegir un chip dibuja el recorrido (GTFS, multi-selección con color real)
//  o cura el filtro de líneas del modo (Overpass). Singleton.
//
//  Lee/escribe el estado compartido en transporteState y usa applyLineFilter de
//  useTransporteModos. `any` a nivel de archivo: LÍMITE con MapLibre + GTFS crudo.
/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMapStore } from './useMapStore'
import { loadTransit, stopsGeoJSON, routeGeoJSON, routeChip } from '../services/transit.js'
import { titlePopup } from '../services/map-popups.js'
import { useTransporteModos } from './useTransporteModos'
import {
  transportLines, transportSelected, selectedStop, isCurated, type StopChip,
} from './transporteState'

const transitOn = ref(false)
const transitStatus = ref('') // 'loading'|'ok'|'error'
let transitData: any = null // JSON pre-procesado (no reactivo: es grande)
const activeRouteIds = ref<string[]>([]) // recorridos GTFS activos (multi-selección)

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

export function useExploradorParadas() {
  const { map: mapRef, overlayClickLayers } = useMapStore()
  const { applyLineFilter } = useTransporteModos()

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
      new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat).setHTML(titlePopup(e.features[0].properties.name)).addTo(map)
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

  return {
    transitOn, transitStatus, selectedStop, stopHasSelection, stopChipsView,
    toggleTransit, pickStopLine, clearRoute, stopClear,
  }
}
