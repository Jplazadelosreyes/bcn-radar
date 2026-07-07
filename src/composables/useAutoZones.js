// Contornos automáticos — el mapa responde al nivel de zoom dibujando el límite
// que corresponde: Barcelona entera (ciudad) → distritos → barrios → secciones.
// Es la guía visual del drill-down: cuando la card Información dice "selecciona un
// distrito", el mapa ya muestra cuáles son. Trazo SUAVE, pensado para acompañar sin
// tapar; independiente de los toggles manuales de la card Zonas (comparten el cache
// de zones.js, no las capas).
// SOLO guía visual: sin relleno de captura ni hover — si el usuario trabaja con otra
// capa (metro, bicing…) estos contornos no reaccionan ni interfieren. El hover vive
// en las zonas manuales (card Zonas), y es interacción de escritorio (fase PC).
import { watch } from 'vue'
import { loadZones } from '../services/zones.js'

const LEVEL_ZONE = { distrito: 'districtes', barrio: 'barris', seccion: 'seccions' }

// Misma paleta que las zonas manuales, pero en volumen bajo (la manual siempre gana)
const SOFT = {
  districtes: {
    color: '#8B1E3F', width: 1.6, dash: [1, 0], size: 12, minzoom: 0,
    label: ['get', 'NOM'], upper: 'uppercase', spacing: 0.08,
  },
  barris: {
    color: '#2D5BD0', width: 1.2, dash: [4, 2], size: 10, minzoom: 12,
    label: ['get', 'NOM'], upper: 'none', spacing: 0,
  },
  seccions: {
    color: '#6B7689', width: 0.9, dash: [3, 2], size: 8, minzoom: 15,
    label: ['concat', ['get', 'DISTRICTE'], '-', ['get', 'SEC_CENS']], upper: 'none', spacing: 0,
  },
}

let map = null
const creating = {} // zona -> promesa de creación (evita carreras al cambiar rápido de nivel)

const zoneLayerIds = (z) => [`auto-${z}-line`, `auto-${z}-label`]

function setVis(ids, on) {
  ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'))
}

// Borde municipal de Barcelona: trazo suave en el rojo de la casa
async function ensureCity() {
  if (creating.city) return creating.city
  creating.city = (async () => {
    const geo = await fetch('https://raw.githubusercontent.com/martgnz/bcn-geodata/master/terme-municipal/terme-municipal.geojson').then((r) => r.json())
    const rings = []
    for (const feat of geo.features) {
      const g = feat.geometry
      if (g.type === 'Polygon') rings.push(g.coordinates[0])
      else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => rings.push(poly[0]))
    }
    map.addSource('auto-city', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: rings } } })
    map.addLayer({
      id: 'auto-city-line', type: 'line', source: 'auto-city',
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#E1251B', 'line-width': 1.8, 'line-opacity': 0.45 },
    })
  })()
  return creating.city
}

// Zonas de un nivel: línea suave y etiqueta discreta (sin relleno: no captura eventos)
async function ensureZone(zone) {
  if (creating[zone]) return creating[zone]
  creating[zone] = (async () => {
    const gj = await loadZones(zone)
    const ST = SOFT[zone]
    const src = `auto-${zone}`
    map.addSource(src, { type: 'geojson', data: gj, attribution: 'Límites: Ajuntament de Barcelona (CartoBCN)' })
    map.addLayer({
      id: `${src}-line`, type: 'line', source: src, layout: { visibility: 'none' },
      paint: { 'line-color': ST.color, 'line-dasharray': ST.dash, 'line-width': ST.width, 'line-opacity': 0.5 },
    })
    map.addLayer({
      id: `${src}-label`, type: 'symbol', source: src, minzoom: ST.minzoom, layout: {
        visibility: 'none',
        'text-field': ST.label, 'text-size': ST.size, 'text-transform': ST.upper,
        'text-letter-spacing': ST.spacing, 'text-allow-overlap': false,
      },
      paint: { 'text-color': ST.color, 'text-halo-color': '#fff', 'text-halo-width': 1.8, 'text-opacity': 0.7 },
    })
  })()
  return creating[zone]
}

// Contornos por nivel DESACTIVADOS (6-jul-2026): distraían al trabajar con otras
// capas (recorridos de metro/bus). Queda solo el borde municipal a nivel ciudad;
// distritos/barrios/secciones se activan manualmente en la card Zonas.
const AUTO_ZONE_LEVELS = false

// Nivel → qué contorno se ve (los demás se apagan)
async function apply(level) {
  if (level === 'ciudad') await ensureCity()
  if (map.getLayer('auto-city-line')) setVis(['auto-city-line'], level === 'ciudad')
  if (!AUTO_ZONE_LEVELS) return
  if (LEVEL_ZONE[level]) await ensureZone(LEVEL_ZONE[level])
  for (const z of Object.values(LEVEL_ZONE)) setVis(zoneLayerIds(z), LEVEL_ZONE[level] === z)
}

// Punto de entrada: llamar una vez tras crear el mapa
export function initAutoZones(m, mapContext) {
  map = m
  const run = () => apply(mapContext.value.level).catch((e) => console.warn('auto-zonas', e))
  if (map.loaded()) run(); else map.once('load', run)
  watch(() => mapContext.value.level, run)
}
