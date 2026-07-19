// ═══════════════════════════════════════════════════════════════════════════════
//  🩺  CATÁLOGO de comprobaciones de las APIs públicas — dato puro, sin runner.
//  Una entrada por endpoint vivo que consume la app. El runner (api-health.test.ts)
//  las ejecuta y escribe docs/API_STATUS.md.
//
//  CÓMO AÑADIR UNA API: un objeto más en CHECKS. `valida` recibe la respuesta y
//  devuelve una nota legible, o lanza si el contrato ya no se cumple.
// ═══════════════════════════════════════════════════════════════════════════════
export const TIMEOUT_MS = 15000
// Nominatim exige identificarse; al resto de servicios públicos, cortesía básica.
export const UA = { 'User-Agent': 'BCN-Radar-healthcheck/1.0 (+https://github.com/Jplazadelosreyes/bcn-radar)' }

// Punto de muestra: Casa Milà (Passeig de Gràcia 92) — Eixample denso: seguro que
// hay parcela catastral, calificación urbanística y paradas de transporte alrededor.
const P = { lng: 2.16195, lat: 41.39527 }
// RC de una finca real, la misma validada a mano en data/API_CATALOG.md (Av. Diagonal).
const RC14 = '4649603DF3844H'

// ── Proyección EPSG:3857 y teselas — mismas fórmulas que usa la app (piu.js) ──
const R = 20037508.34
const lon2x = (l: number) => (l * R) / 180
const lat2y = (l: number) => (Math.log(Math.tan(((90 + l) * Math.PI) / 360)) * R) / Math.PI
const bbox3857 = (d: number) =>
  `${(lon2x(P.lng) - d).toFixed(1)},${(lat2y(P.lat) - d).toFixed(1)},${(lon2x(P.lng) + d).toFixed(1)},${(lat2y(P.lat) + d).toFixed(1)}`
const tileXY = (z: number) => {
  const n = 2 ** z
  const x = Math.floor(((P.lng + 180) / 360) * n)
  const rad = (P.lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)
  return { x, y }
}

// ── Validadores reutilizables ──
const esImagen = (res: Response) => {
  const ct = res.headers.get('content-type') || ''
  if (!ct.startsWith('image/')) throw new Error(`esperaba imagen, llegó "${ct}"`)
  return ct
}
const esGeoJSON = (body: string) => {
  const j = JSON.parse(body)
  if (j.type !== 'FeatureCollection' || !j.features?.length) throw new Error('no es un FeatureCollection con features')
  return `${j.features.length} features`
}
const esCapabilities = (body: string) => {
  if (!/WMS_Capabilities|WMT_MS_Capabilities/.test(body)) throw new Error('la respuesta no es un GetCapabilities WMS')
  const capas = (body.match(/<Layer/g) || []).length
  return `${capas} nodos <Layer>`
}

export interface Check {
  grupo: string
  nombre: string
  uso: string // qué alimenta dentro de la app
  url: string
  init?: RequestInit
  valida: (res: Response, body: string) => string
}

const OVC = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC'
const SOCRATA = 'https://analisi.transparenciacatalunya.cat/resource'
const GBFS = 'https://barcelona.publicbikesystem.net/ube/gbfs/v1/en'
const GEODATA = 'https://raw.githubusercontent.com/martgnz/bcn-geodata/master'
const overpassQL = '[out:json][timeout:10];node(around:300,' + P.lat + ',' + P.lng + ')["highway"="bus_stop"];out 1;'
const overpassInit: RequestInit = {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'data=' + encodeURIComponent(overpassQL),
}
const validaOverpass = (_res: Response, body: string) => {
  const j = JSON.parse(body)
  if (!Array.isArray(j.elements)) throw new Error('sin array elements')
  return `${j.elements.length} elementos`
}
const validaGbfs = (_res: Response, body: string) => {
  const j = JSON.parse(body)
  if (!j.data?.stations?.length) throw new Error('sin data.stations')
  return `${j.data.stations.length} estaciones`
}

export const CHECKS: Check[] = [
  // ── Catastro (Dirección General del Catastro · OVC) ──
  {
    grupo: 'Catastro', nombre: 'Consulta_RCCOOR (coords → referencia)',
    uso: 'Primer paso del clic en finca: coordenadas → RC de 14',
    url: `${OVC}/OVCCoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=${P.lng}&Coordenada_Y=${P.lat}`,
    valida: (_r, body) => {
      const pc1 = body.match(/<pc1>([^<]+)<\/pc1>/)?.[1]
      if (!pc1) throw new Error('sin <pc1> en la respuesta (¿cambió el XML?)')
      return `RC ${pc1}…`
    },
  },
  {
    grupo: 'Catastro', nombre: 'Consulta_DNPRC (referencia → datos)',
    uso: 'Año, superficie, uso y nº de inmuebles del dossier',
    url: `${OVC}/OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=${RC14}`,
    valida: (_r, body) => {
      if (!/<(lrcdnp|bico)/.test(body)) throw new Error('sin <lrcdnp> ni <bico> (¿cambió el XML?)')
      const n = (body.match(/<rcdnp>/g) || []).length
      return n ? `edificio con ${n} inmuebles` : 'inmueble único'
    },
  },
  {
    grupo: 'Catastro', nombre: 'WMS parcelario (GetMap)',
    uso: 'Capa "Catastro" del selector de mapas base',
    url: `https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx?service=WMS&request=GetMap&version=1.1.1&layers=Catastro&styles=&format=image/png&transparent=true&srs=EPSG:3857&bbox=${bbox3857(600)}&width=256&height=256`,
    valida: esImagen,
  },

  // ── Geocoding (Nominatim · OpenStreetMap) ──
  {
    grupo: 'Nominatim', nombre: 'search (dirección → coords)',
    uso: 'El buscador de direcciones y su autocompletado',
    url: 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&q=' + encodeURIComponent('Passeig de Gràcia 92, Barcelona'),
    valida: (_r, body) => {
      const j = JSON.parse(body)
      if (!j?.[0]?.lat) throw new Error('sin resultados con lat/lon')
      return j[0].display_name.split(',').slice(0, 2).join(',')
    },
  },
  {
    grupo: 'Nominatim', nombre: 'reverse (coords → dirección)',
    uso: 'La dirección postal que encabeza el dossier de finca',
    url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${P.lat}&lon=${P.lng}&zoom=18&addressdetails=1`,
    valida: (_r, body) => {
      const j = JSON.parse(body)
      if (!j?.address) throw new Error('sin objeto address')
      return `${j.address.road || '?'} ${j.address.house_number || ''}`.trim()
    },
  },

  // ── Overpass (recorridos de metro/bus/FGC, paradas, radio de servicios) ──
  // Los tres mirrors se prueban POR SEPARADO: la app los usa en petición hedged
  // (overpass.js) y saber cuál está caído es exactamente el objetivo de esta suite.
  {
    grupo: 'Overpass', nombre: 'mirror overpass-api.de',
    uso: 'Mirror principal de la petición hedged', url: 'https://overpass-api.de/api/interpreter',
    init: overpassInit, valida: validaOverpass,
  },
  {
    grupo: 'Overpass', nombre: 'mirror overpass.kumi.systems',
    uso: 'Mirror 2 (históricamente el que se cuelga)', url: 'https://overpass.kumi.systems/api/interpreter',
    init: overpassInit, valida: validaOverpass,
  },
  {
    grupo: 'Overpass', nombre: 'mirror maps.mail.ru',
    uso: 'Mirror 3 de respaldo', url: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    init: overpassInit, valida: validaOverpass,
  },

  // ── Urbanismo · PIU (Ajuntament de Barcelona) ──
  {
    grupo: 'PIU · Ajuntament', nombre: 'WMS GetCapabilities',
    uso: 'Descubrimiento de capas urbanísticas en useLayers',
    url: 'https://w133.bcn.cat/WMSURBANISME/service.svc/get?service=WMS&request=GetCapabilities&version=1.3.0',
    valida: (_r, body) => esCapabilities(body),
  },
  {
    grupo: 'PIU · Ajuntament', nombre: 'GetFeatureInfo (Qualificació urbanística)',
    uso: 'La situación urbanística del dossier: clave, clasificación, afectaciones',
    url: (() => {
      const L = encodeURIComponent('Qualificació_urbanística')
      return `https://w133.bcn.cat/WMSURBANISME/service.svc/get?service=WMS&request=GetFeatureInfo&version=1.3.0&layers=${L}&query_layers=${L}&info_format=text/html&crs=EPSG:3857&bbox=${bbox3857(25)}&width=256&height=256&i=128&j=128`
    })(),
    valida: (_r, body) => {
      // piu.js parsea tablas .mainTb con celdas featureTh/featureTd
      if (!body.includes('mainTb')) throw new Error('sin tabla .mainTb (¿cambió el HTML del DGU?)')
      const clau = body.match(/CLAU<\/td>\s*<td[^>]*>([^<]+)/)?.[1]?.trim()
      return clau ? `clave ${clau}` : 'con features'
    },
  },

  // ── Urbanismo · MUC (Generalitat de Catalunya) ──
  {
    grupo: 'MUC · Generalitat', nombre: 'WMS GetCapabilities',
    uso: 'Descubrimiento de capas del Mapa Urbanístic de Catalunya',
    url: 'https://dtes.gencat.cat/webmap/MUC/service.svc/get?service=WMS&request=GetCapabilities&version=1.3.0',
    valida: (_r, body) => esCapabilities(body),
  },
  {
    grupo: 'MUC · Generalitat', nombre: 'WMS GetMap (capa MUC)',
    uso: 'Render de la capa de planeamiento de Cataluña',
    url: `https://dtes.gencat.cat/webmap/MUC/service.svc/get?service=WMS&request=GetMap&version=1.3.0&layers=MUC&styles=&format=image/png&transparent=true&crs=EPSG:3857&bbox=${bbox3857(600)}&width=256&height=256`,
    valida: esImagen,
  },

  // ── Inundabilidad · ACA (Agència Catalana de l'Aigua) ──
  {
    grupo: 'ACA', nombre: 'WMS GetCapabilities',
    uso: 'Descubrimiento de capas de inundabilidad',
    url: 'https://aplicacions.aca.gencat.cat/geoserver/vishid/wms?service=WMS&request=GetCapabilities&version=1.3.0',
    valida: (_r, body) => esCapabilities(body),
  },
  {
    grupo: 'ACA', nombre: 'WMS GetMap (Zones inundables T100)',
    uso: 'La capa de riesgo de inundación de referencia legal',
    url: `https://aplicacions.aca.gencat.cat/geoserver/vishid/wms?service=WMS&request=GetMap&version=1.3.0&layers=${encodeURIComponent('vishid:Zones_inundables_T100')}&styles=&format=image/png&transparent=true&crs=EPSG:3857&bbox=${bbox3857(600)}&width=256&height=256`,
    valida: esImagen,
  },

  // ── Open Data Generalitat (Socrata) ──
  {
    grupo: 'Socrata', nombre: 'Incasòl · alquiler (qww9-bvhh)',
    uso: 'Alquiler medio real por fianzas (bloque Valor)',
    url: `${SOCRATA}/qww9-bvhh.json?nom_territori=Barcelona&$order=any DESC&$limit=1`,
    valida: (_r, body) => {
      const j = JSON.parse(body)
      if (!j?.[0]?.renda) throw new Error('sin campo renda')
      return `${Math.round(+j[0].renda)} €/mes (${j[0].any})`
    },
  },
  {
    grupo: 'Socrata', nombre: 'Meteocat · estaciones XEMA (yqwd-vj5e)',
    uso: 'Ubicación de las estaciones de la capa de temperatura',
    url: `${SOCRATA}/yqwd-vj5e.json?$limit=1`,
    valida: (_r, body) => {
      const j = JSON.parse(body)
      if (!j?.[0]?.codi_estacio) throw new Error('sin codi_estacio')
      return `estación ${j[0].codi_estacio} (${j[0].nom_estacio})`
    },
  },
  {
    grupo: 'Socrata', nombre: 'Meteocat · lecturas (nzvn-apee)',
    uso: 'Temperatura en vivo (variable 32)',
    url: `${SOCRATA}/nzvn-apee.json?codi_variable=32&$order=data_lectura DESC&$limit=1`,
    valida: (_r, body) => {
      const j = JSON.parse(body)
      if (!j?.[0]?.valor_lectura) throw new Error('sin valor_lectura')
      return `${j[0].valor_lectura} °C · ${j[0].data_lectura}`
    },
  },

  // ── Bicing (GBFS estándar, sin key) ──
  {
    grupo: 'Bicing · GBFS', nombre: 'station_information',
    uso: 'Nombre y capacidad de cada estación', url: `${GBFS}/station_information`, valida: validaGbfs,
  },
  {
    grupo: 'Bicing · GBFS', nombre: 'station_status',
    uso: 'Bicis y anclajes libres en vivo (refresco 60 s)', url: `${GBFS}/station_status`, valida: validaGbfs,
  },

  // ── Límites administrativos (bcn-geodata · CartoBCN) ──
  {
    grupo: 'bcn-geodata', nombre: 'districtes.geojson',
    uso: 'Capa de distritos y sus fichas', url: `${GEODATA}/districtes/districtes.geojson`, valida: (_r, b) => esGeoJSON(b),
  },
  {
    grupo: 'bcn-geodata', nombre: 'barris.geojson',
    uso: 'Capa de barrios y sus fichas', url: `${GEODATA}/barris/barris.geojson`, valida: (_r, b) => esGeoJSON(b),
  },
  {
    grupo: 'bcn-geodata', nombre: 'seccio-censal.geojson',
    uso: 'Secciones censales + coropleta de renta', url: `${GEODATA}/seccio-censal/seccio-censal.geojson`, valida: (_r, b) => esGeoJSON(b),
  },
  {
    grupo: 'bcn-geodata', nombre: 'terme-municipal.geojson',
    uso: 'El contorno del municipio (máscara y zoom inicial)', url: `${GEODATA}/terme-municipal/terme-municipal.geojson`, valida: (_r, b) => esGeoJSON(b),
  },

  // ── Mapas base y teselas ──
  {
    grupo: 'Basemaps', nombre: 'OpenFreeMap · estilo Liberty',
    uso: 'El estilo vectorial del mapa (el que retiñe map-theme.js)',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    valida: (_r, body) => {
      const j = JSON.parse(body)
      if (!j.layers?.length) throw new Error('estilo sin capas')
      return `${j.layers.length} capas de estilo`
    },
  },
  {
    grupo: 'Basemaps', nombre: 'ICGC · ortofoto (WMS GetMap)',
    uso: 'Mapa base "Orto ICGC"',
    url: `https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms/service?service=WMS&request=GetMap&version=1.3.0&layers=ortofoto_color_vigent&styles=&format=image/png&transparent=false&crs=EPSG:3857&bbox=${bbox3857(1200)}&width=256&height=256`,
    valida: esImagen,
  },
  {
    grupo: 'Basemaps', nombre: 'ArcGIS · World Imagery (tesela)',
    uso: 'Mapa base "Satélite"',
    url: (() => { const { x, y } = tileXY(14); return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/${y}/${x}` })(),
    valida: esImagen,
  },
  {
    grupo: 'Basemaps', nombre: 'ArcGIS · export (miniatura de finca)',
    uso: 'La foto aérea 160×160 que abre el dossier',
    url: `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${P.lng - 0.0006},${P.lat - 0.00045},${P.lng + 0.0006},${P.lat + 0.00045}&bboxSR=4326&imageSR=4326&size=160,160&format=jpg&f=image`,
    valida: esImagen,
  },
  {
    grupo: 'Basemaps', nombre: 'OpenTopoMap (tesela)',
    uso: 'Mapa base "Topo"',
    url: (() => { const { x, y } = tileXY(14); return `https://a.tile.opentopomap.org/14/${x}/${y}.png` })(),
    valida: esImagen,
  },
  {
    grupo: 'Basemaps', nombre: 'Terrarium DEM (tesela de elevación)',
    uso: 'El relieve real del modo 3D',
    url: (() => { const { x, y } = tileXY(12); return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/${x}/${y}.png` })(),
    valida: esImagen,
  },
]

