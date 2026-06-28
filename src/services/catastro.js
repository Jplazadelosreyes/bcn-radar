/**
 * Servicio de consulta al Catastro (Sede Electrónica · OVC).
 * Endpoint Consulta_DNPRC validado con CORS abierto (Access-Control-Allow-Origin: *),
 * así que se llama directo desde el navegador, sin proxy.
 *
 * Dos niveles de dato según la longitud de la referencia catastral (RC):
 *   - RC de 14 (pc1+pc2): la PARCELA/FINCA → lista de inmuebles (estructura <lrcdnp>).
 *   - RC de 20 (pc1+pc2+car+cc1+cc2): un INMUEBLE concreto → año/superficie/uso (estructura <bico>).
 *
 * El front obtiene el RC de 14 desde las coordenadas (OVCCoordenadas), así que `fetchFinca`
 * consulta el edificio y, para datos físicos, hace una segunda llamada a una unidad representativa.
 * Devuelve también el RC de 20 (inmueble) y el coeficiente de participación, que son la "llave
 * maestra" para los deep-links a Urbanismo / Cédula / CEE.
 */

const DNPRC = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC';

const txt = (el, tag) => el?.getElementsByTagName(tag)[0]?.textContent?.trim() || null;
const num = (el, tag) => {
  const v = txt(el, tag);
  return v != null ? parseInt(v, 10) : null;
};
// El coeficiente de participación viene como fracción con coma ("0,041500") → porcentaje
const pctFromCpt = (v) => {
  if (!v) return null;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100 * 100) / 100 : null;
};
// Reconstruye el RC de 20 desde un nodo <rc>
const rc20FromNode = (rcNode) => {
  if (!rcNode) return null;
  const part = (tag) => rcNode.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
  const rc = part('pc1') + part('pc2') + part('car') + part('cc1') + part('cc2');
  return rc.length === 20 ? rc : null;
};

async function fetchDoc(rc) {
  const url = `${DNPRC}?Provincia=&Municipio=&RC=${encodeURIComponent(rc)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Catastro HTTP ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
  if (doc.getElementsByTagName('err').length > 0) {
    throw new Error(`Catastro: ${txt(doc, 'des') || 'referencia no encontrada'}`);
  }
  return doc;
}

/** RC de 20 → datos físicos de la unidad. */
export async function fetchUnidad(rc20) {
  const debi = (await fetchDoc(rc20)).getElementsByTagName('debi')[0];
  return {
    rcInmueble: rc20,
    ano: num(debi, 'ant'),
    superficie: num(debi, 'sfc'),
    uso: txt(debi, 'luso'),
    coefParticipacion: pctFromCpt(txt(debi, 'cpt')),
  };
}

function parseRcdnp(node) {
  const loint = node.getElementsByTagName('loint')[0];
  return {
    rc20: rc20FromNode(node.getElementsByTagName('rc')[0]),
    planta: txt(loint, 'pt'),
    puerta: txt(loint, 'pu'),
  };
}

/**
 * Consulta la finca a partir de cualquier RC (>=14). Devuelve el edificio + una unidad
 * representativa. Maneja ambas estructuras: <lrcdnp> (varios inmuebles) y <bico> (uno solo).
 */
export async function fetchFinca(rcRaw) {
  const clean = (rcRaw || '').replace(/\s+/g, '');
  if (clean.length < 14) throw new Error('Referencia catastral inválida');
  const rc14 = clean.slice(0, 14);
  const doc = await fetchDoc(rc14);

  const rcdnps = Array.from(doc.getElementsByTagName('rcdnp'));

  // Caso edificio: lista de inmuebles
  if (rcdnps.length > 0) {
    const unidades = rcdnps.map(parseRcdnp);
    const plantas = new Set(unidades.map((u) => u.planta).filter(Boolean)).size || null;

    let u = { rcInmueble: null, ano: null, superficie: null, uso: null, coefParticipacion: null };
    const rep = unidades.find((x) => x.rc20);
    if (rep) {
      try { u = await fetchUnidad(rep.rc20); } catch { u.rcInmueble = rep.rc20; }
    }
    return {
      rc14, nivel: 'edificio', nInmuebles: unidades.length, plantas,
      rcInmueble: u.rcInmueble, ano: u.ano, superficie: u.superficie,
      uso: u.uso, coefParticipacion: u.coefParticipacion,
    };
  }

  // Caso inmueble único: estructura <bico>
  const bi = doc.getElementsByTagName('bi')[0];
  const debi = doc.getElementsByTagName('debi')[0];
  return {
    rc14, nivel: 'inmueble', nInmuebles: 1, plantas: null,
    rcInmueble: rc20FromNode(bi?.getElementsByTagName('rc')[0]),
    ano: num(debi, 'ant'),
    superficie: num(debi, 'sfc'),
    uso: txt(debi, 'luso'),
    coefParticipacion: pctFromCpt(txt(debi, 'cpt')),
  };
}
