// Servicio de geocoding (Nominatim · OpenStreetMap). Gratuito, sin key; se acota a Barcelona.
// Único punto de acceso a Nominatim — lo consumen el buscador (useSearch) y la selección de
// finca al clic (useFincaPicker). Devuelve datos planos; no toca el mapa.
const BASE = 'https://nominatim.openstreetmap.org'

// Dirección → primer resultado { lat, lng, displayName }, o null si no hay coincidencia.
export async function geocodeAddress(query) {
  const url = `${BASE}/search?format=json&q=${encodeURIComponent(query + ', Barcelona')}`
  const results = await (await fetch(url)).json()
  if (!results || !results.length) return null
  const { lat, lon, display_name } = results[0]
  return { lat: Number(lat), lng: Number(lon), displayName: display_name }
}

// Coordenadas → datos de dirección de Nominatim (incluye .address y .display_name), o null
// si el punto no resuelve a una dirección.
export async function reverseGeocode(lat, lng) {
  const url = `${BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
  const data = await (await fetch(url)).json()
  return data && data.address ? data : null
}

// Etiqueta corta y legible para una sugerencia (calle + número · barrio/zona).
function shortLabel(r) {
  const a = r.address || {}
  const via = a.road || a.pedestrian || a.neighbourhood || a.suburb || r.name || ''
  const num = a.house_number ? ` ${a.house_number}` : ''
  const zona = a.suburb || a.city_district || a.town || a.village || a.city || ''
  const base = `${via}${num}`.trim()
  return base ? (zona && zona !== via ? `${base} · ${zona}` : base) : r.display_name
}

// Autocompletado: varias direcciones para un texto PARCIAL, acotado a España/Barcelona.
// Devuelve [] con menos de 3 caracteres (no molesta a Nominatim). Cada ítem trae coords,
// etiqueta corta (para el input) y la larga (display_name, para el popup).
export async function suggestAddresses(query, limit = 6) {
  const q = query.trim()
  if (q.length < 3) return []
  const url = `${BASE}/search?format=json&addressdetails=1&limit=${limit}&countrycodes=es&q=${encodeURIComponent(q + ', Barcelona')}`
  const results = await (await fetch(url)).json()
  // Nominatim devuelve a veces varios objetos OSM para la misma dirección (vía + portal);
  // con la etiqueta corta ya colapsados, el desplegable mostraba entradas idénticas.
  const seen = new Set()
  return (results || [])
    .map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lon),
      short: shortLabel(r),
      label: r.display_name,
    }))
    .filter((s) => (seen.has(s.short) ? false : (seen.add(s.short), true)))
}
