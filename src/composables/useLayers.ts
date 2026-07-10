// ═══════════════════════════════════════════════════════════════════════════════
//  useLayers — agregador de capas WMS públicas (urbanismo Ajuntament, MUC, ACA).
//  Estado + acciones que crean/alternan capas raster en el mapa. El catálogo declarativo de
//  fuentes vive en config/capas-wms (añadir una fuente = editar ese archivo).
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, computed } from 'vue'
import { useMapStore } from './useMapStore'
import { describeLayer } from '../services/layer-info.js'
import { WMS_SOURCES, type WmsSource, type WmsLayer } from '../config/capas-wms'

interface WmsAllLayer {
  name: string
  label: string
  desc?: string
}
const wmsExpanded = ref<Record<string, boolean>>({}) // sourceId -> acordeón de fuente abierto
const wmsShowAll = ref<Record<string, boolean>>({}) // sourceId -> sección "ver todas" abierta
const wmsActive = ref<Record<string, boolean>>({}) // layerKey -> capa encendida en el mapa
const wmsAllLayers = ref<Record<string, WmsAllLayer[]>>({}) // sourceId -> capas de GetCapabilities
const wmsAllStatus = ref<Record<string, 'loading' | 'ok' | 'error'>>({})
const wmsAdded = new Set<string>() // ids ya creados en el mapa (crea 1 vez, luego visibility)

const fincasOn = ref(false) // parcelas del Catastro (capa raster)

export const layerKey = (sid: string, name: string) => `${sid}::${name}`

// URL de tiles WMS para MapLibre (raster). EPSG:3857 sin invertir ejes en 1.3.0.
function wmsTileUrl(src: WmsSource, layerName: string) {
  const crs = src.version === '1.3.0' ? 'crs' : 'srs'
  const p = new URLSearchParams({ service: 'WMS', request: 'GetMap', version: src.version, layers: layerName, styles: '', format: 'image/png', transparent: 'true', width: '256', height: '256' })
  return `${src.base}?${p.toString()}&${crs}=EPSG:3857&bbox={bbox-epsg-3857}`
}

export function useLayers() {
  const { map: mapRef } = useMapStore()

  const toggleWmsExpand = (sid: string) => { wmsExpanded.value = { ...wmsExpanded.value, [sid]: !wmsExpanded.value[sid] } }

  // Parcelas del Catastro: alterna la capa raster y acerca a nivel calle.
  function toggleFincas() {
    const map = mapRef.value
    if (!map) return
    fincasOn.value = !fincasOn.value
    if (map.getLayer('catastro')) map.setLayoutProperty('catastro', 'visibility', fincasOn.value ? 'visible' : 'none')
    if (fincasOn.value && map.getZoom() < 17) map.easeTo({ zoom: 17 })
  }

  // Enciende/apaga una capa: la crea la primera vez, luego solo alterna visibilidad.
  function toggleWms(src: WmsSource, layer: WmsLayer) {
    const map = mapRef.value
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

  // "Ver todas": vuelca el catálogo completo del servicio (GetCapabilities), sin las curadas.
  async function loadAllWms(src: WmsSource) {
    wmsShowAll.value = { ...wmsShowAll.value, [src.id]: !wmsShowAll.value[src.id] }
    if (wmsAllLayers.value[src.id] || !wmsShowAll.value[src.id]) return
    wmsAllStatus.value = { ...wmsAllStatus.value, [src.id]: 'loading' }
    try {
      const url = `${src.base}?service=WMS&request=GetCapabilities&version=${src.version}`
      const xml = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/xml')
      const curated = new Set(src.layers.map((l) => l.name))
      const seen = new Set<string>()
      const all: WmsAllLayer[] = []
      for (const ly of xml.getElementsByTagName('Layer')) {
        let name: string | null = null
        let title: string | null = null
        for (const c of ly.children) {
          if (c.tagName === 'Name' && name === null) name = c.textContent
          if (c.tagName === 'Title' && title === null) title = c.textContent
        }
        if (!name || curated.has(name) || seen.has(name)) continue
        seen.add(name)
        all.push({ name, label: title || name, desc: describeLayer(name) as string })
      }
      wmsAllLayers.value = { ...wmsAllLayers.value, [src.id]: all }
      wmsAllStatus.value = { ...wmsAllStatus.value, [src.id]: 'ok' }
    } catch (e) {
      console.warn('GetCapabilities', src.id, e)
      wmsAllStatus.value = { ...wmsAllStatus.value, [src.id]: 'error' }
    }
  }

  // Parcelas + capas WMS encendidas → chips activos (para la barra superior).
  const activeChips = computed(() => {
    const chips: { id: string; label: string; off: () => void }[] = []
    if (fincasOn.value) chips.push({ id: 'fincas', label: 'Parcelas', off: () => toggleFincas() })
    for (const src of WMS_SOURCES) {
      for (const l of src.layers) {
        if (wmsActive.value[layerKey(src.id, l.name)]) chips.push({ id: layerKey(src.id, l.name), label: l.label, off: () => toggleWms(src, l) })
      }
    }
    return chips
  })

  return {
    WMS_SOURCES, layerKey,
    fincasOn, toggleFincas,
    wmsExpanded, wmsShowAll, wmsActive, wmsAllLayers, wmsAllStatus,
    toggleWmsExpand, toggleWms, loadAllWms, activeChips,
  }
}
