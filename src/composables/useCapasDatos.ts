// ═══════════════════════════════════════════════════════════════════════════════
//  useCapasDatos — capas de datos abiertos (Bicing, carriles bici, POI de salud/educación/
//  comercio/verde/cultura, temperatura). Enciende/apaga cada capa: la carga la 1ª vez (lazy),
//  luego alterna visibilidad; las capas `live` se refrescan con un timer. Singleton.
//
//  Dominio independiente del transporte y su explorador: no comparte estado con las líneas
//  ni con la parada seleccionada. El catálogo declarativo vive en config/capas-datos.
//
//  `any` a nivel de archivo: LÍMITE con las expresiones imperativas de MapLibre.
/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMapStore } from './useMapStore'
import { MOVILIDAD, poiDate, type MovLayer } from '../config/capas-datos'

// Etiqueta corta para el chip (sin el paréntesis "(tiempo real)" etc.)
const chipLabel = (s: string) => s.replace(/\s*\(.*?\)\s*/g, '').trim()

type LoadStatus = 'loading' | 'ok' | 'error'

const dataActive = ref<Record<string, boolean>>({})
const dataStatus = ref<Record<string, LoadStatus>>({})
const dataTimers: Record<string, ReturnType<typeof setInterval>> = {} // layerId -> refresco (vivo)

export function useCapasDatos() {
  const { map: mapRef, overlayClickLayers } = useMapStore()

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
            layout: { 'text-field': cfg.symbol.field, 'text-font': ['Noto Sans Regular'], 'text-size': cfg.symbol.size || 10, 'text-allow-overlap': false },
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

  // Capas de datos actualmente encendidas → chips activos (para la barra superior).
  const activeChips = computed(() =>
    MOVILIDAD.flatMap((g) => g.layers)
      .filter((l) => dataActive.value[l.id])
      .map((l) => ({ id: `data:${l.id}`, label: chipLabel(l.label), off: () => toggleData(l) })),
  )

  return { MOVILIDAD, poiDate, dataActive, dataStatus, toggleData, activeChips }
}
