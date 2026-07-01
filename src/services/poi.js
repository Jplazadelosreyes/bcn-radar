// Entorno de la finca — POI de OSM pre-generados (estáticos duros).
// Se generan con scripts/build-poi.mjs → public/data/poi.json (con fecha).
// Formato compacto por punto: [lon, lat, name, kind].

let cache = null
export async function loadPoi() {
  if (cache) return cache
  const res = await fetch(`${import.meta.env.BASE_URL}data/poi.json`)
  if (!res.ok) throw new Error(`poi.json HTTP ${res.status}`)
  cache = await res.json()
  return cache
}

export function poiFC(data, cat) {
  return {
    type: 'FeatureCollection',
    features: (data.categories[cat] || []).map(([lon, lat, n, k]) => ({
      type: 'Feature',
      properties: { name: n, kind: k },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    })),
  }
}
