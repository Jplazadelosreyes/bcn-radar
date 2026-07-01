// Zonas administrativas de Barcelona (distritos y barrios) como capa de mapa.
// Polígonos oficiales (derivados de CartoBCN / Ajuntament) vía martgnz/bcn-geodata.
const URLS = {
  districtes: 'https://raw.githubusercontent.com/martgnz/bcn-geodata/master/districtes/districtes.geojson',
  barris: 'https://raw.githubusercontent.com/martgnz/bcn-geodata/master/barris/barris.geojson',
  seccions: 'https://raw.githubusercontent.com/martgnz/bcn-geodata/master/seccio-censal/seccio-censal.geojson',
}
const cache = {}
export async function loadZones(level) {
  if (cache[level]) return cache[level]
  const res = await fetch(URLS[level])
  if (!res.ok) throw new Error(`zonas ${level} HTTP ${res.status}`)
  cache[level] = await res.json()
  return cache[level]
}
