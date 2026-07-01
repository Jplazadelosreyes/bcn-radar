// Renta media por sección censal (coropleta) — une renta.json con el GeoJSON de secciones.
import { loadZones } from './zones.js'

let cache = null
export async function loadRentaGeoJSON() {
  if (cache) return cache
  const base = import.meta.env.BASE_URL
  const [zonas, renta] = await Promise.all([
    loadZones('seccions'),
    fetch(`${base}data/renta.json`).then(r => { if (!r.ok) throw new Error(`renta.json HTTP ${r.status}`); return r.json() }),
  ])
  const features = zonas.features.map(f => {
    const p = f.properties
    const key = `${+p.DISTRICTE}-${+p.SEC_CENS}`
    return { ...f, properties: { ...p, renta: renta.data[key] ?? null } }
  })
  cache = { geojson: { type: 'FeatureCollection', features }, any: renta.any }
  return cache
}
