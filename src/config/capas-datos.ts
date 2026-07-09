// Catálogo declarativo de las capas de datos abiertos (Bicing, carriles bici, POI de salud/
// educación/comercio/verde/cultura, temperatura). El operador cura los grupos y capas aquí:
// orden, color, zoom mínimo, portal de la fuente y frecuencia de refresco en vivo.
//
// Semi-declarativo a propósito: cada capa lleva su `load()` (loader del servicio) porque el
// dato no es estático — se descarga en vivo. Los loaders y el estado de metadatos (poiDate)
// viven aquí junto al catálogo; la LÓGICA de pintado sobre el mapa se queda en useCapasDatos.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref } from 'vue'
import { overpassFetch } from '../services/overpass.js'
import { loadPoi, poiFC } from '../services/poi.js'
import { fetchBicing } from '../services/movilidad.js'
import { fetchTemperatura } from '../services/meteo.js'

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

// Fecha de generación del dataset POI (metadato mostrado en la UI). Lo escribe poiCategory
// al cargar y lo re-expone useCapasDatos en su return.
export const poiDate = ref('')

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
