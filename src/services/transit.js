// Transporte público (GTFS TMB pre-procesado). Carga perezosa de public/data/transit.json.
// Da: todas las paradas como puntos, y por línea su recorrido + paradas.

let cache = null
export async function loadTransit() {
  if (cache) return cache
  const res = await fetch(`${import.meta.env.BASE_URL}data/transit.json`)
  if (!res.ok) throw new Error(`transit.json HTTP ${res.status}`)
  cache = await res.json()
  return cache
}

// Todas las paradas servidas como GeoJSON de puntos.
export function stopsGeoJSON(data) {
  return {
    type: 'FeatureCollection',
    features: data.stops.map(s => ({
      type: 'Feature',
      properties: { id: s.id, name: s.name, nroutes: s.routes.length },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    })),
  }
}

// Recorrido (ambos sentidos) + paradas de una línea concreta.
export function routeGeoJSON(data, routeId) {
  const r = data.routes[routeId]
  if (!r) return null
  const color = r.color ? `#${r.color}` : '#2D5BD0'
  const lines = {
    type: 'FeatureCollection',
    features: (r.dirs || []).filter(d => d.shape?.length).map(d => ({
      type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: d.shape },
    })),
  }
  const byId = Object.fromEntries(data.stops.map(s => [s.id, s]))
  const seen = new Set()
  const stopFeatures = []
  for (const d of r.dirs || []) {
    for (const id of d.stops || []) {
      if (seen.has(id)) continue
      seen.add(id)
      const s = byId[id]
      if (s) stopFeatures.push({ type: 'Feature', properties: { name: s.name }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })
    }
  }
  return { route: r, color, lines, stops: { type: 'FeatureCollection', features: stopFeatures } }
}

// Metadatos de una línea para los chips (nombre corto + color).
export function routeChip(data, routeId) {
  const r = data.routes[routeId]
  return r ? { id: routeId, short: r.short || routeId, long: r.long || '', color: r.color ? `#${r.color}` : '#5B616B', type: r.type } : { id: routeId, short: routeId, color: '#5B616B' }
}
