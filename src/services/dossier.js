// ═══════════════════════════════════════════════════════════════════════════════
//  Dossier PDF — proveedores de las IMÁGENES del informe de finca. Sin backend:
//  las tres estáticas salen de los mismos WMS/export públicos que ya vigila la
//  suite de salud (docs/API_STATUS.md), y la cuarta es un snapshot del propio
//  canvas de MapLibre. Aquí solo se construyen URLs y datos; el layout vive en
//  DossierPrint.vue.
// ═══════════════════════════════════════════════════════════════════════════════
import { overpassFetch, haversine } from './overpass.js'

// Proyección EPSG:3857 (las mismas fórmulas que piu.js)
const R = 20037508.34
const lon2x = (l) => (l * R) / 180
const lat2y = (l) => (Math.log(Math.tan(((90 + l) * Math.PI) / 360)) * R) / Math.PI
const bbox3857 = (lng, lat, d) => {
  const x = lon2x(lng), y = lat2y(lat)
  return `${(x - d).toFixed(1)},${(y - d).toFixed(1)},${(x + d).toFixed(1)},${(y + d).toFixed(1)}`
}

// Las tres imágenes estáticas del dossier, centradas en la finca.
export function dossierImages(lng, lat) {
  return {
    // Ortofoto de portada (mismo endpoint que la miniatura del dossier, en grande)
    aerea: `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${lng - 0.0013},${lat - 0.0008},${lng + 0.0013},${lat + 0.0008}&bboxSR=4326&imageSR=4326&size=800,492&format=jpg&f=image`,
    // Croquis parcelario oficial (WMS Catastro, fondo blanco)
    croquis: `https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx?service=WMS&request=GetMap&version=1.1.1&layers=Catastro&styles=&format=image/png&transparent=false&srs=EPSG:3857&bbox=${bbox3857(lng, lat, 110)}&width=700&height=700`,
    // Calificación urbanística con sus claves de color (WMS Urbanisme · Ajuntament)
    piu: `https://w133.bcn.cat/WMSURBANISME/service.svc/get?service=WMS&request=GetMap&version=1.3.0&layers=${encodeURIComponent('Qualificació_urbanística')}&styles=&format=image/png&transparent=false&crs=EPSG:3857&bbox=${bbox3857(lng, lat, 300)}&width=800&height=800`,
  }
}

// Snapshot del canvas de MapLibre SIN preserveDrawingBuffer: se captura dentro del
// mismo frame que pinta (triggerRepaint + once('render')), así el buffer aún existe.
export function snapshotMap(map) {
  if (!map) return Promise.resolve(null)
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 3000)
    map.once('render', () => {
      clearTimeout(timeout)
      try { resolve(map.getCanvas().toDataURL('image/jpeg', 0.85)) } catch { resolve(null) }
    })
    map.triggerRepaint()
  })
}

// Precarga una imagen y responde si llegó (para no imprimir con huecos a medias).
export const preload = (url) =>
  new Promise((resolve) => {
    const img = new Image()
    const timeout = setTimeout(() => resolve(false), 12000)
    img.onload = () => { clearTimeout(timeout); resolve(true) }
    img.onerror = () => { clearTimeout(timeout); resolve(false) }
    img.src = url
  })

// Paradas de transporte cercanas SOLO para el dossier (independiente del radio de
// exploración de la UI: el PDF debe salir completo aunque el radio nunca se activara).
const MODO = (t) => {
  if (t.station === 'subway') return 'metro'
  if (t.railway === 'tram_stop') return 'tram'
  if (t.railway === 'station' || t.railway === 'halt') return 'tren'
  return 'bus'
}
const MODO_COLOR = { metro: '#E2231A', tren: '#1A8A4A', bus: '#0067B1', tram: '#E87200' }

export async function fetchParadasDossier(lng, lat, radio = 600) {
  const q = `[out:json][timeout:25];(node[highway=bus_stop](around:${radio},${lat},${lng});node[railway=station](around:${radio},${lat},${lng});node[railway=halt](around:${radio},${lat},${lng});node[railway=tram_stop](around:${radio},${lat},${lng});node[station=subway](around:${radio},${lat},${lng}););out;`
  try {
    const data = await overpassFetch(q)
    return (data.elements || [])
      .filter((n) => n.tags?.name)
      .map((n) => {
        const modo = MODO(n.tags)
        return { name: n.tags.name, modo, color: MODO_COLOR[modo], lines: n.tags.route_ref || '', dist: Math.round(haversine([lng, lat], [n.lon, n.lat])) }
      })
      .sort((a, b) => a.dist - b.dist)
  } catch {
    return [] // sin Overpass, el dossier sale igual: la página lo dice en vez de inventar
  }
}
