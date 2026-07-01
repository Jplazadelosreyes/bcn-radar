// Pre-genera los datos de entorno (POI de OSM) como estáticos duros.
// Consulta Overpass UNA vez por categoría (con reintentos ante 429 y pausas),
// y escribe public/data/poi.json con la fecha de actualización.
// Ejecutar:  node scripts/build-poi.mjs
import { writeFileSync, mkdirSync } from 'fs'

const BBOX = '41.30,2.05,41.48,2.25' // S,W,N,E
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Overpass con reintentos: rota mirrors y espera ante 429/5xx
async function overpass(query, tries = 6) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    const url = ENDPOINTS[i % ENDPOINTS.length]
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) })
      if (r.status === 429 || r.status >= 500) { lastErr = new Error(`HTTP ${r.status}`); await sleep(15000); continue }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    } catch (e) { lastErr = e; await sleep(8000) }
  }
  throw lastErr
}

const Q = body => `[out:json][timeout:90];(${body.split(';').filter(Boolean).map(f => `${f}(${BBOX})`).join(';')};);out center;`

// [id, filtro(s) separados por ;]
const CATS = {
  salud: 'nwr[amenity~"^(hospital|clinic|pharmacy|doctors)$"]',
  educacion: 'nwr[amenity~"^(school|kindergarten|university|college)$"]',
  comercio: 'nwr[shop~"^(supermarket|convenience)$"];nwr[amenity=marketplace]',
  aparcamientos: 'nwr[amenity~"^(parking|bicycle_parking|motorcycle_parking)$"]',
  verde: 'nwr[leisure~"^(park|garden)$"]',
  cultura: 'nwr[amenity~"^(library|theatre|cinema|arts_centre|community_centre)$"];nwr[tourism=museum];nwr[leisure~"^(sports_centre|fitness_centre)$"]',
}

const r6 = n => Math.round(n * 1e6) / 1e6
const out = { generated: new Date().toISOString().slice(0, 10), source: 'OpenStreetMap (Overpass)', categories: {} }

for (const [cat, filter] of Object.entries(CATS)) {
  process.stdout.write(`  ${cat}… `)
  const d = await overpass(Q(filter))
  const pts = []
  for (const el of d.elements || []) {
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon
    if (lat == null || lon == null) continue
    const t = el.tags || {}
    pts.push([r6(lon), r6(lat), t.name || '', t.amenity || t.shop || t.leisure || t.tourism || ''])
  }
  out.categories[cat] = pts
  console.log(`${pts.length} puntos`)
  await sleep(12000) // respeta el rate-limit de Overpass entre categorías
}

mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/data/poi.json', import.meta.url), JSON.stringify(out))
console.log('poi.json escrito · actualizado', out.generated)
