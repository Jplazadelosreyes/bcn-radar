// ── Movilidad y servicios · fuentes ABIERTAS oficiales (GeoJSON/JSON 4326 + CORS) ──
// Nada de backends privados con token: solo datos abiertos y estables.
// Cada loader devuelve un FeatureCollection listo para MapLibre.

// Bicing en tiempo real (estándar GBFS, sin API key). Cruza la info fija de la
// estación (nombre, capacidad) con su estado en vivo (bicis/anclajes libres).
const GBFS = 'https://barcelona.publicbikesystem.net/ube/gbfs/v1/en'

export async function fetchBicing() {
  const [info, status] = await Promise.all([
    fetch(`${GBFS}/station_information`).then(r => r.json()),
    fetch(`${GBFS}/station_status`).then(r => r.json()),
  ])
  const byId = {}
  for (const s of status.data.stations) byId[s.station_id] = s
  const features = info.data.stations.map(s => {
    const st = byId[s.station_id] || {}
    // bicis eléctricas vs mecánicas si el feed las desglosa
    const types = st.num_bikes_available_types || {}
    const ebikes = types.ebike ?? types.electric ?? null
    return {
      type: 'Feature',
      properties: {
        name: s.name,
        bikes: st.num_bikes_available ?? 0,
        docks: st.num_docks_available ?? 0,
        ebikes,
        capacity: s.capacity ?? null,
        renting: st.is_renting ?? 1,
      },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    }
  })
  return { type: 'FeatureCollection', features }
}
