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
