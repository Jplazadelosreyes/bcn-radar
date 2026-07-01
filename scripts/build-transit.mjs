// Pre-procesa el GTFS de TMB → public/data/transit.json (compacto, para el front).
// Salida: { routes: { id: {short,long,type,color,text,dirs:[{dir,shape,stops}]} },
//           stops:  [ {id,name,lat,lon,routes:[...]} ] }
// Ejecutar tras descomprimir el GTFS en /tmp/gtfs:  node scripts/build-transit.mjs
import { createReadStream, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createInterface } from 'readline'

const GTFS = '/tmp/gtfs'
const OUT = new URL('../public/data/', import.meta.url)

// CSV que respeta comillas
function parseLine(line) {
  const out = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = '' } else cur += c }
  }
  out.push(cur); return out
}
function readCsv(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  const header = parseLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const v = parseLine(lines[i]); const o = {}
    for (let j = 0; j < header.length; j++) o[header[j]] = v[j]
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
    if (!header) { header = v; continue }
    const o = {}; for (let i = 0; i < header.length; i++) o[header[i]] = v[i]
    onRow(o)
  }
}
const r5 = n => Math.round(parseFloat(n) * 1e5) / 1e5

console.time('build-transit')

// 1) rutas
const routes = {}
for (const r of readCsv(`${GTFS}/routes.txt`)) {
  routes[r.route_id] = { short: r.route_short_name, long: r.route_long_name, type: +r.route_type, color: r.route_color || '', text: r.route_text_color || '' }
}

// 2) trips → un trip representativo por (ruta, sentido)
const trips = {}
const repByRouteDir = {}
for (const t of readCsv(`${GTFS}/trips.txt`)) {
  trips[t.trip_id] = { route: t.route_id, dir: t.direction_id || '0', shape: t.shape_id }
  const k = `${t.route_id}|${t.direction_id || '0'}`
  if (!repByRouteDir[k]) repByRouteDir[k] = t.trip_id
}
const repTrips = new Set(Object.values(repByRouteDir))

// 3) stop_times (streaming): líneas por parada + paradas ordenadas de los trips representativos
const stopRoutes = {}
const repTripStops = {}
await streamCsv(`${GTFS}/stop_times.txt`, row => {
  const tr = trips[row.trip_id]; if (!tr) return
  ;(stopRoutes[row.stop_id] ||= new Set()).add(tr.route)
  if (repTrips.has(row.trip_id)) (repTripStops[row.trip_id] ||= []).push({ seq: +row.stop_sequence, stop: row.stop_id })
})

// 4) shapes (solo los de trips representativos)
const neededShapes = new Set()
for (const tid of repTrips) { const sh = trips[tid].shape; if (sh) neededShapes.add(sh) }
const shapePts = {}
await streamCsv(`${GTFS}/shapes.txt`, row => {
  if (!neededShapes.has(row.shape_id)) return
  ;(shapePts[row.shape_id] ||= []).push({ seq: +row.shape_pt_sequence, lon: r5(row.shape_pt_lon), lat: r5(row.shape_pt_lat) })
})

// 5) stops
const stopsRaw = {}
for (const s of readCsv(`${GTFS}/stops.txt`)) {
  stopsRaw[s.stop_id] = { name: s.stop_name, lat: r5(s.stop_lat), lon: r5(s.stop_lon) }
}

// 6) salida de rutas (recorrido + paradas ordenadas por sentido)
const routesOut = {}
for (const [k, tid] of Object.entries(repByRouteDir)) {
  const [routeId, dir] = k.split('|')
  const tr = trips[tid]
  const shape = (shapePts[tr.shape] || []).sort((a, b) => a.seq - b.seq).map(p => [p.lon, p.lat])
  const stops = (repTripStops[tid] || []).sort((a, b) => a.seq - b.seq).map(s => s.stop)
  ;(routesOut[routeId] ||= { ...routes[routeId], dirs: [] }).dirs.push({ dir: +dir, shape, stops })
}

// 7) salida de paradas (solo las servidas, con sus líneas)
const stopsOut = []
for (const [id, set] of Object.entries(stopRoutes)) {
  const s = stopsRaw[id]; if (!s) continue
  stopsOut.push({ id, name: s.name, lat: s.lat, lon: s.lon, routes: [...set] })
}

mkdirSync(OUT, { recursive: true })
const outPath = new URL('transit.json', OUT)
writeFileSync(outPath, JSON.stringify({ routes: routesOut, stops: stopsOut }))
console.timeEnd('build-transit')
console.log('rutas:', Object.keys(routesOut).length, '· paradas servidas:', stopsOut.length)
