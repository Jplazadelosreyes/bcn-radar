// Temperatura en vivo — estaciones XEMA de Meteocat (Generalitat, open data, sin key).
// Cruza la ubicación fija de cada estación con su última lectura de temperatura (var 32).
const STATIONS = 'https://analisi.transparenciacatalunya.cat/resource/yqwd-vj5e.json?$limit=600'
const READINGS = 'https://analisi.transparenciacatalunya.cat/resource/nzvn-apee.json?codi_variable=32&$order=data_lectura%20DESC&$limit=900'

let stationsCache = null
export async function fetchTemperatura() {
  if (!stationsCache) {
    const st = await (await fetch(STATIONS)).json()
    stationsCache = {}
    for (const s of st) stationsCache[s.codi_estacio] = { lat: +s.latitud, lon: +s.longitud, name: s.nom_estacio, alt: +s.altitud }
  }
  const readings = await (await fetch(READINGS)).json()
  const latest = {} // por el orden DESC, la primera lectura de cada estación es la más reciente
  for (const r of readings) if (!(r.codi_estacio in latest)) latest[r.codi_estacio] = +r.valor_lectura
  const features = []
  for (const [codi, temp] of Object.entries(latest)) {
    const s = stationsCache[codi]
    if (!s || isNaN(s.lat) || isNaN(temp)) continue
    features.push({ type: 'Feature', properties: { name: s.name, temp: Math.round(temp * 10) / 10, alt: s.alt }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })
  }
  return { type: 'FeatureCollection', features }
}
