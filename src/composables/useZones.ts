// ═══════════════════════════════════════════════════════════════════════════════
//  useZones — capa de zonas administrativas (distritos / barrios / secciones) + la
//  coropleta de renta media. Estado + acciones que manipulan el mapa. Singleton.
//
//  `any` acotado: frontera con MapLibre (expresiones de estilo, feature-state, features).
/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMapStore } from './useMapStore'
import { loadZones } from '../services/zones.js'
import { loadRentaGeoJSON } from '../services/renta.js'
import { titlePopup, rentaPopup } from '../services/map-popups.js'

const zoneOn = ref<Record<string, boolean>>({}) // level -> visible
const zoneStatus = ref<Record<string, 'loading' | 'error' | 'ok'>>({}) // level -> estado
const zoneSel: Record<string, string | number | null> = {} // source -> zona seleccionada (feature-state)

const rentaOn = ref(false)
const rentaStatus = ref('')
const rentaAny = ref('')

const ZONE_STYLE: Record<string, any> = {
  districtes: { color: '#8B1E3F', width: 3.6, dash: [1, 0], size: 13, upper: 'uppercase', spacing: 0.08, labelMinzoom: 0 },
  barris: { color: '#2D5BD0', width: 2.2, dash: [4, 2], size: 10, upper: 'none', spacing: 0, labelMinzoom: 12 },
  seccions: { color: '#6B7689', width: 1.1, dash: [3, 2], size: 8, upper: 'none', spacing: 0, labelMinzoom: 15 },
}

export function useZones() {
  const { map: mapRef, overlayClickLayers } = useMapStore()

  async function toggleZone(level: string) {
    const map = mapRef.value
    if (!map) return
    const on = !zoneOn.value[level]
    zoneOn.value = { ...zoneOn.value, [level]: on }
    const src = `zone-${level}`
    const ids = [`${src}-fill`, `${src}-line`, `${src}-label`]
    if (!on) {
      ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', 'none'))
      return
    }
    if (map.getSource(src)) {
      ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', 'visible'))
      return
    }
    zoneStatus.value = { ...zoneStatus.value, [level]: 'loading' }
    try {
      const gj = await loadZones(level)
      const ST = ZONE_STYLE[level]
      // Las secciones no tienen nombre: se etiquetan por código distrito-sección
      const labelField = level === 'seccions' ? ['concat', ['get', 'DISTRICTE'], '-', ['get', 'SEC_CENS']] : ['get', 'NOM']
      map.addSource(src, { type: 'geojson', data: gj, generateId: true, attribution: 'Límites: Ajuntament de Barcelona (CartoBCN)' })
      map.addLayer({
        id: `${src}-fill`, type: 'fill', source: src,
        paint: { 'fill-color': ST.color, 'fill-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 0.18, 0] },
      })
      map.addLayer({
        id: `${src}-line`, type: 'line', source: src,
        paint: { 'line-color': ST.color, 'line-width': ST.width, 'line-opacity': 0.92, 'line-dasharray': ST.dash },
      })
      map.addLayer({
        id: `${src}-label`, type: 'symbol', source: src, minzoom: ST.labelMinzoom,
        layout: { 'text-field': labelField, 'text-font': ['Noto Sans Regular'], 'text-size': ST.size, 'text-transform': ST.upper, 'text-letter-spacing': ST.spacing, 'text-allow-overlap': false },
        paint: { 'text-color': ST.color, 'text-halo-color': '#fff', 'text-halo-width': 1.8 },
      })
      // Clic en una zona → la selecciona (resalta) y muestra su nombre; volver a clicar deselecciona
      map.on('click', `${src}-fill`, (e: any) => {
        const f = e.features[0]
        const prev = zoneSel[src]
        if (prev != null) map.setFeatureState({ source: src, id: prev }, { sel: false })
        if (prev === f.id) {
          zoneSel[src] = null
          return
        }
        map.setFeatureState({ source: src, id: f.id }, { sel: true })
        zoneSel[src] = f.id
        const p = f.properties
        const name = level === 'seccions' ? `Sección censal ${p.DISTRICTE}-${p.SEC_CENS}` : p.NOM
        new maplibregl.Popup({ offset: 6 }).setLngLat(e.lngLat).setHTML(titlePopup(name)).addTo(map)
      })
      map.on('mouseenter', `${src}-fill`, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', `${src}-fill`, () => { map.getCanvas().style.cursor = '' })
      zoneStatus.value = { ...zoneStatus.value, [level]: 'ok' }
    } catch (e) {
      console.warn('zonas', e)
      zoneStatus.value = { ...zoneStatus.value, [level]: 'error' }
      zoneOn.value = { ...zoneOn.value, [level]: false }
    }
  }

  async function toggleRenta() {
    const map = mapRef.value
    if (!map) return
    const on = !rentaOn.value
    rentaOn.value = on
    const ids = ['renta-fill', 'renta-line']
    if (!on) {
      ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', 'none'))
      return
    }
    if (map.getSource('renta')) {
      ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', 'visible'))
      return
    }
    rentaStatus.value = 'loading'
    try {
      const { geojson, any } = await loadRentaGeoJSON()
      rentaAny.value = any
      map.addSource('renta', { type: 'geojson', data: geojson })
      map.addLayer({
        id: 'renta-fill', type: 'fill', source: 'renta',
        paint: {
          'fill-color': ['case', ['==', ['get', 'renta'], null], 'rgba(0,0,0,0)',
            ['interpolate', ['linear'], ['get', 'renta'], 13000, '#B5392C', 20000, '#E0A23C', 27000, '#F2D024', 35000, '#8DC63F', 48000, '#1F9D5B']],
          'fill-opacity': 0.55,
        },
      })
      map.addLayer({ id: 'renta-line', type: 'line', source: 'renta', paint: { 'line-color': '#ffffff', 'line-width': 0.4, 'line-opacity': 0.35 } })
      overlayClickLayers.push('renta-fill')
      map.on('click', 'renta-fill', (e: any) => {
        const p = e.features[0].properties
        if (p.renta == null) return
        new maplibregl.Popup({ offset: 6 }).setLngLat(e.lngLat).setHTML(rentaPopup(p)).addTo(map)
      })
      map.on('mouseenter', 'renta-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'renta-fill', () => { map.getCanvas().style.cursor = '' })
      rentaStatus.value = 'ok'
    } catch (e) {
      console.warn('renta', e)
      rentaStatus.value = 'error'
      rentaOn.value = false
    }
  }

  // Zonas encendidas → chips activos (para la barra superior).
  const ZONE_LABEL: Record<string, string> = { districtes: 'Distritos', barris: 'Barrios', seccions: 'Secciones' }
  const activeChips = computed(() => {
    const chips: { id: string; label: string; off: () => void }[] = []
    for (const k of Object.keys(ZONE_LABEL)) if (zoneOn.value[k]) chips.push({ id: `zone:${k}`, label: ZONE_LABEL[k], off: () => toggleZone(k) })
    if (rentaOn.value) chips.push({ id: 'renta', label: 'Renta', off: () => toggleRenta() })
    return chips
  })

  return { zoneOn, zoneStatus, rentaOn, rentaStatus, rentaAny, toggleZone, toggleRenta, activeChips }
}
