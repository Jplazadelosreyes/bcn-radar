// Helpers compartidos de OpenStreetMap / Overpass + geo (transporte, radio, carriles bici).

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const PER_TRY_MS = 25000 // techo por mirror: uno colgado no puede bloquear al resto
const HEDGE_MS = 7000    // si el anterior no ha contestado aún, se lanza el siguiente en paralelo

// Pide a los mirrors públicos de Overpass y devuelve la PRIMERA respuesta válida.
//
// Antes se probaban en serie y sin timeout: si un mirror aceptaba la conexión pero no
// respondía (le pasa al de kumi.systems), `fetch` esperaba indefinidamente y la capa no
// llegaba a cargar nunca — el bug del metro.
//
// Ahora cada intento tiene su propio techo de tiempo y los mirrors se lanzan ESCALONADOS
// (petición "hedged"): si el primero contesta rápido —lo normal— los demás ni se lanzan;
// si tarda más de HEDGE_MS, entra el siguiente en paralelo y gana el que llegue antes. Los
// que quedan vivos se cancelan. Así un mirror caído cuesta HEDGE_MS, no la carga entera.
export async function overpassFetch(q) {
  const body = 'data=' + encodeURIComponent(q)
  const abortables = []

  const intento = async (url, esperaMs) => {
    if (esperaMs) await new Promise((r) => setTimeout(r, esperaMs))
    const ctrl = new AbortController()
    abortables.push(ctrl)
    const techo = setTimeout(() => ctrl.abort(), PER_TRY_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).host}`)
      return await res.json()
    } finally {
      clearTimeout(techo)
    }
  }

  try {
    return await Promise.any(OVERPASS_ENDPOINTS.map((url, i) => intento(url, i * HEDGE_MS)))
  } catch (e) {
    // Promise.any agrupa los fallos: se resume para que el error sea diagnosticable.
    const causas = e?.errors?.map((x) => x?.message || String(x)).join(' · ')
    throw new Error(`Overpass sin respuesta${causas ? ` (${causas})` : ''}`)
  } finally {
    abortables.forEach((c) => c.abort()) // cancela los mirrors que sigan en vuelo
  }
}

// Distancia en metros entre dos puntos [lng, lat].
export const haversine = (a, b) => {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
