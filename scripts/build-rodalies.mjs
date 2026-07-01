// Pre-procesa el GTFS nacional de Renfe Cercanías → public/data/rodalies.json,
// filtrando SOLO el núcleo de Cataluña (bbox) para quedarnos con Rodalies.
// Mismo formato que transit.json ({routes, stops}); ids con prefijo "rod:".
// Ejecutar tras descomprimir el GTFS en /tmp/renfe:  node scripts/build-rodalies.mjs
import { createReadStream, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createInterface } from 'readline'

const GTFS = '/tmp/renfe'
// bbox Cataluña (lon/lat): filtra estaciones catalanas
const [LON0, LAT0, LON1, LAT1] = [0.1, 40.5, 3.4, 42.95]

function parseLine(line) {
  const out = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = '' } else cur += c }
  }
  out.push(cur); return out
}
const T = s => (s ?? '').trim()
function readCsv(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  const header = parseLine(lines[0]).map(T)
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const v = parseLine(lines[i]); const o = {}
    for (let j = 0; j < header.length; j++) o[header[j]] = T(v[j])
    rows.push(o)
  }
  return rows
}
async function streamCsv(path, onRow) {
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  let header = null
  for await (const line of rl) {
    if (!line) continue
    const v = parseLine(line)
    if (!header) { header = v.map(T); continue }
    const o = {}; for (let i = 0; i < header.length; i++) o[header[i]] = T(v[i])
    onRow(o)
  }
}
const r5 = n => Math.round(parseFloat(n) * 1e5) / 1e5

console.time('build-rodalies')

// 1) stops en bbox Cataluña
const stopsCat = {} // stop_id -> {name,lat,lon}
for (const s of readCsv(`${GTFS}/stops.txt`)) {
  const lat = +s.stop_lat, lon = +s.stop_lon
  if (lon >= LON0 && lon <= LON1 && lat >= LAT0 && lat <= LAT1) stopsCat[s.stop_id] = { name: s.stop_name, lat: r5(s.stop_lat), lon: r5(s.stop_lon) }
}
console.log('paradas en Cataluña:', Object.keys(stopsCat).length)

// 2) rutas y trips
const routes = {}
for (const r of readCsv(`${GTFS}/routes.txt`)) {
  routes[r.route_id] = { short: r.route_short_name, long: r.route_long_name, type: +r.route_type || 2, color: r.route_color || '', text: r.route_text_color || '' }
}
const trips = {}
for (const t of readCsv(`${GTFS}/trips.txt`)) trips[t.trip_id] = { route: t.route_id, dir: t.direction_id || '0', shape: t.shape_id }

// 3) pasada 1 sobre stop_times: nº de paradas catalanas por trip → elegir representativo por ruta+sentido
const tripCatCount = {}
await streamCsv(`${GTFS}/stop_times.txt`, row => {
  if (stopsCat[row.stop_id]) tripCatCount[row.trip_id] = (tripCatCount[row.trip_id] || 0) + 1
})
const repByRouteDir = {} // route|dir -> {trip, count}
for (const [tid, count] of Object.entries(tripCatCount)) {
  const tr = trips[tid]; if (!tr) continue
  const k = `${tr.route}|${tr.dir}`
  if (!repByRouteDir[k] || count > repByRouteDir[k].count) repByRouteDir[k] = { trip: tid, count }
}
const repTrips = new Set(Object.values(repByRouteDir).map(x => x.trip))
console.log('rutas·sentido en Cataluña:', Object.keys(repByRouteDir).length)

// 4) pasada 2: paradas ordenadas de los trips representativos (solo las catalanas)
const repTripStops = {}
await streamCsv(`${GTFS}/stop_times.txt`, row => {
  if (repTrips.has(row.trip_id) && stopsCat[row.stop_id]) (repTripStops[row.trip_id] ||= []).push({ seq: +row.stop_sequence, stop: row.stop_id })
})

// 5) shapes de los representativos
const neededShapes = new Set()
for (const tid of repTrips) { const sh = trips[tid].shape; if (sh) neededShapes.add(sh) }
const shapePts = {}
await streamCsv(`${GTFS}/shapes.txt`, row => {
  if (!neededShapes.has(row.shape_id)) return
  ;(shapePts[row.shape_id] ||= []).push({ seq: +row.shape_pt_sequence, lon: r5(row.shape_pt_lon), lat: r5(row.shape_pt_lat) })
})

// 6) salida (ids con prefijo rod:)
const RID = id => 'rod:' + id
const routesOut = {}, stopUsed = {}
for (const [k, rep] of Object.entries(repByRouteDir)) {
  const [routeId, dir] = k.split('|')
  const tr = trips[rep.trip]
  // recorta el shape al tramo catalán (bbox) para no arrastrar toda España
  const shape = (shapePts[tr.shape] || []).sort((a, b) => a.seq - b.seq)
    .filter(p => p.lon >= LON0 && p.lon <= LON1 && p.lat >= LAT0 && p.lat <= LAT1).map(p => [p.lon, p.lat])
  const stops = (repTripStops[rep.trip] || []).sort((a, b) => a.seq - b.seq).map(s => { stopUsed[s.stop] = 1; return RID(s.stop) })
  const r = routes[routeId] || { short: routeId, long: '', type: 2 }
  ;(routesOut[RID(routeId)] ||= { ...r, dirs: [] }).dirs.push({ dir: +dir, shape, stops })
}
const stopsOut = []
for (const id of Object.keys(stopUsed)) {
  const s = stopsCat[id]; if (!s) continue
  // qué rutas rod: pasan por esta parada
  const rs = []
  for (const [rid, r] of Object.entries(routesOut)) if (r.dirs.some(d => d.stops.includes(RID(id)))) rs.push(rid)
  stopsOut.push({ id: RID(id), name: s.name, lat: s.lat, lon: s.lon, routes: rs })
}

mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/data/rodalies.json', import.meta.url), JSON.stringify({ routes: routesOut, stops: stopsOut }))
console.timeEnd('build-rodalies')
console.log('rutas:', Object.keys(routesOut).length, '· paradas:', stopsOut.length)
