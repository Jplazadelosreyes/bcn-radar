// ── PIU · Situación urbanística de la parcela (WMS GetFeatureInfo del Ajuntament) ──
// Mismo servicio que pinta las capas, usado en modo consulta: un punto → las
// afectaciones urbanísticas oficiales que lo tocan (calificación, sector, ámbitos,
// suspensiones). HTTPS + CORS verificados. No inventa: devuelve lo que dice el DGU.

const WMS = 'https://w133.bcn.cat/WMSURBANISME/service.svc/get'
const R = 20037508.34
const lon2x = l => l * R / 180
const lat2y = l => Math.log(Math.tan((90 + l) * Math.PI / 360)) * R / Math.PI

// Una consulta GetFeatureInfo sobre una capa → lista de features (cada uno, pares campo→valor).
async function getFeatureInfo(layerName, lng, lat) {
  const x = lon2x(lng), y = lat2y(lat), d = 25 // bbox ~50 m centrado en el punto
  const bbox = `${(x - d).toFixed(1)},${(y - d).toFixed(1)},${(x + d).toFixed(1)},${(y + d).toFixed(1)}`
  const L = encodeURIComponent(layerName)
  const url = `${WMS}?service=WMS&request=GetFeatureInfo&version=1.3.0&layers=${L}&query_layers=${L}&info_format=text/html&crs=EPSG:3857&bbox=${bbox}&width=256&height=256&i=128&j=128`
  const html = await (await fetch(url)).text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const features = []
  doc.querySelectorAll('table.mainTb').forEach(tb => {
    const obj = {}
    tb.querySelectorAll('tr').forEach(tr => {
      const th = tr.querySelector('td.featureTh')
      const td = tr.querySelector('td.featureTd')
      if (th && td) obj[th.textContent.trim()] = td.textContent.trim()
    })
    if (Object.keys(obj).length) features.push(obj)
  })
  return features
}

// Heurística: de un feature de ámbito/sector saca un código y una descripción legibles.
const pick = (f, keys) => { for (const k of keys) if (f[k] && f[k] !== '--') return f[k]; return null }
const codeOf = f => pick(f, ['CODI_PLA', 'CODI', 'CODI_SECT', 'CLAU'])
const descOf = f => pick(f, ['NOM_CLAU', 'NOM', 'DESCRIPCIO', 'DESCRIPCIO_PLA', 'TIPUS', 'DETALL'])

// Capas-grupo que componen la "Situación urbanística de la parcela" del PIU.
const TEMAS = {
  sectors: 'Sector_de_planejament',
  aprovats: 'Àmbit_de_planejament_aprovat_definitivament',
  tramits: 'Àmbit_de_planejament_en_tràmit',
  suspensions: 'Àmbit_de_suspensió_de_llicències',
}

// Consulta todas las afectaciones de un punto en paralelo.
export async function fetchAfectaciones(lng, lat) {
  const [qf, ...rest] = await Promise.all([
    getFeatureInfo('Qualificació_urbanística', lng, lat),
    getFeatureInfo(TEMAS.sectors, lng, lat),
    getFeatureInfo(TEMAS.aprovats, lng, lat),
    getFeatureInfo(TEMAS.tramits, lng, lat),
    getFeatureInfo(TEMAS.suspensions, lng, lat),
  ])
  const [sectors, aprovats, tramits, suspensions] = rest

  const q = qf[0] || null
  const qualificacio = q ? {
    clau: q.CLAU || null,
    nom: q.NOM_CLAU || null,
    classific: q.CLASSIFIC || null,   // SUC / SUNC / SNU
    grup: q.GRUP || null,
    familia: q.FAMILIA || null,
    pla: q.CODI_PLA || null,
    sector: q.CODI_SECT && q.CODI_SECT !== '--' ? q.CODI_SECT : null,
    tipus: q.TIPUS_ORD || null,
  } : null

  const toItems = arr => arr.map(f => ({ codi: codeOf(f), desc: descOf(f), raw: f }))
                          .filter(x => x.codi || x.desc)

  return {
    qualificacio,
    sectors: toItems(sectors),
    aprovats: toItems(aprovats),
    tramits: toItems(tramits),
    suspensions: toItems(suspensions),
  }
}

// Texto legible de la clasificación del suelo (lo que más confunde al comprador).
export function classificLabel(c) {
  const map = {
    SUC: 'Suelo urbano consolidado',
    SUNC: 'Suelo urbano no consolidado',
    SNU: 'Suelo no urbanizable',
    SUD: 'Suelo urbanizable delimitado',
  }
  return c ? (map[c] || c) : null
}
