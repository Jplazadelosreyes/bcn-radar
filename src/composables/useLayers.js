// ═══════════════════════════════════════════════════════════════════════════════
//  useLayers — agregador de capas WMS públicas (urbanismo Ajuntament, MUC, ACA).
//  Catálogo declarativo + estado + acciones que crean/alternan capas raster en el mapa.
//  Añadir una fuente = añadir una entrada a WMS_SOURCES; el resto no cambia.
// ═══════════════════════════════════════════════════════════════════════════════
import { ref } from 'vue'
import { useMapStore } from './useMapStore.js'
import { describeLayer } from '../services/layer-info.js'

export const WMS_SOURCES = [
  {
    id: 'ajbcn-urb',
    label: 'Urbanismo · Ajuntament de Barcelona',
    badge: 'PIU',
    attribution: 'WMS Urbanisme · Ajuntament de Barcelona',
    base: 'https://w133.bcn.cat/WMSURBANISME/service.svc/get',
    version: '1.3.0',
    portal: 'https://ajuntament.barcelona.cat/informaciourbanistica/cerca/es/',
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
    layers: [
      { name: 'MUC', label: 'Mapa urbanístico (Cataluña)', hint: 'Planeamiento vigente de toda Cataluña, unificado en una capa.' },
    ],
  },
  {
    id: 'aca-inund',
    label: "Inundabilidad · Agència Catalana de l'Aigua",
    badge: 'ACA',
    attribution: "Zones inundables · Agència Catalana de l'Aigua",
    base: 'https://aplicacions.aca.gencat.cat/geoserver/vishid/wms',
    version: '1.3.0',
    portal: 'https://aca.gencat.cat/ca/laigua/proteccio-i-conservacio/gestio-de-la-inundabilitat/',
    layers: [
      { name: 'vishid:Zones_inundables_T10', label: 'Inundable · frecuente (T10)', hint: 'Se inunda con episodios de ~10 años. Riesgo alto: evítalo.' },
      { name: 'vishid:Zones_inundables_T100', label: 'Inundable · 100 años (T100)', hint: 'Referencia legal de riesgo. Afecta seguros e hipoteca.' },
      { name: 'vishid:Zones_inundables_T500', label: 'Inundable · excepcional (T500)', hint: 'Episodios extremos de ~500 años. Riesgo bajo pero a conocer.' },
    ],
  },
]

/** @type {import('vue').Ref<Record<string, boolean>>} */
const wmsExpanded = ref({}) // sourceId -> acordeón de fuente abierto
/** @type {import('vue').Ref<Record<string, boolean>>} */
const wmsShowAll = ref({}) // sourceId -> sección "ver todas" abierta
/** @type {import('vue').Ref<Record<string, boolean>>} */
const wmsActive = ref({}) // layerKey -> capa encendida en el mapa
/** @type {import('vue').Ref<Record<string, Array<{ name: string; label: string; desc?: string }>>>} */
const wmsAllLayers = ref({}) // sourceId -> capas del GetCapabilities
/** @type {import('vue').Ref<Record<string, 'loading' | 'ok' | 'error'>>} */
const wmsAllStatus = ref({})
const wmsAdded = new Set() // ids ya creados en el mapa (crea 1 vez, luego visibility)

const fincasOn = ref(false) // parcelas del Catastro (capa raster)

export const layerKey = (sid, name) => `${sid}::${name}`

// URL de tiles WMS para MapLibre (raster). EPSG:3857 sin invertir ejes en 1.3.0.
function wmsTileUrl(src, layerName) {
  const crs = src.version === '1.3.0' ? 'crs' : 'srs'
  const p = new URLSearchParams({ service: 'WMS', request: 'GetMap', version: src.version, layers: layerName, styles: '', format: 'image/png', transparent: 'true', width: '256', height: '256' })
  return `${src.base}?${p.toString()}&${crs}=EPSG:3857&bbox={bbox-epsg-3857}`
}

export function useLayers() {
  const { map: mapRef } = useMapStore()

  const toggleWmsExpand = (sid) => { wmsExpanded.value = { ...wmsExpanded.value, [sid]: !wmsExpanded.value[sid] } }

  // Parcelas del Catastro: alterna la capa raster y acerca a nivel calle.
  function toggleFincas() {
    const map = mapRef.value
    if (!map) return
    fincasOn.value = !fincasOn.value
    if (map.getLayer('catastro')) map.setLayoutProperty('catastro', 'visibility', fincasOn.value ? 'visible' : 'none')
    if (fincasOn.value && map.getZoom() < 17) map.easeTo({ zoom: 17 })
  }

  // Enciende/apaga una capa: la crea la primera vez, luego solo alterna visibilidad.
  function toggleWms(src, layer) {
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
  async function loadAllWms(src) {
    wmsShowAll.value = { ...wmsShowAll.value, [src.id]: !wmsShowAll.value[src.id] }
    if (wmsAllLayers.value[src.id] || !wmsShowAll.value[src.id]) return
    wmsAllStatus.value = { ...wmsAllStatus.value, [src.id]: 'loading' }
    try {
      const url = `${src.base}?service=WMS&request=GetCapabilities&version=${src.version}`
      const xml = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/xml')
      const curated = new Set(src.layers.map((l) => l.name))
      const seen = new Set()
      const all = []
      for (const ly of xml.getElementsByTagName('Layer')) {
        let name = null
        let title = null
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

  return {
    WMS_SOURCES, layerKey,
    fincasOn, toggleFincas,
    wmsExpanded, wmsShowAll, wmsActive, wmsAllLayers, wmsAllStatus,
    toggleWmsExpand, toggleWms, loadAllWms,
  }
}
