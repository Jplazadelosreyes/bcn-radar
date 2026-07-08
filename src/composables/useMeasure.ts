// ═══════════════════════════════════════════════════════════════════════════════
//  useMeasure — herramienta de medición de distancias sobre el mapa. Singleton.
//  El setup del mapa añade la fuente/capa 'measure'; aquí vive el estado + los cálculos.
//  El click-handler del mapa añade puntos vía addPoint mientras `measuring` está activo.
// ═══════════════════════════════════════════════════════════════════════════════
import { ref } from 'vue'
import type { LngLat } from 'maplibre-gl'
import { useMapStore } from './useMapStore'
import { haversine } from '../services/overpass.js'

const measureTotal = ref<string | null>(null) // distancia acumulada, formateada
const measuring = ref(false)
const points: [number, number][] = [] // [[lng, lat], ...]

export function useMeasure() {
  const { map: mapRef } = useMapStore()

  const render = () => {
    const map = mapRef.value
    // features GeoJSON mixtas (puntos + línea) para la fuente 'measure' del mapa
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feats: any[] = points.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p } }))
    if (points.length >= 2) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: points } })
    const src = map?.getSource('measure')
    if (src) src.setData({ type: 'FeatureCollection', features: feats })
    let total = 0
    for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i])
    measureTotal.value = points.length < 2 ? null : total >= 1000 ? `${(total / 1000).toFixed(2)} km` : `${Math.round(total)} m`
  }

  const clear = () => { points.length = 0; render() }

  const setMeasuring = (on: boolean) => {
    measuring.value = on
    const map = mapRef.value
    if (map) map.getCanvas().style.cursor = on ? 'crosshair' : ''
    if (!on) clear()
  }

  // Lo llama el click-handler del mapa (mientras `measuring`): añade un vértice.
  const addPoint = (lngLat: LngLat) => {
    points.push([lngLat.lng, lngLat.lat])
    render()
  }

  return { measureTotal, measuring, setMeasuring, clear, addPoint }
}
