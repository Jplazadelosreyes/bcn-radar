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
 */

const DNPRC = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC';

const txt = (el, tag) => el?.getElementsByTagName(tag)[0]?.textContent?.trim() || null;
const num = (el, tag) => {
  const v = txt(el, tag);
  return v != null ? parseInt(v, 10) : null;
};

async function fetchDoc(rc) {
  const url = `${DNPRC}?Provincia=&Municipio=&RC=${encodeURIComponent(rc)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Catastro HTTP ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');

  // El Catastro reporta errores en <lerr><err><des>…</des></err></lerr>
  if (doc.getElementsByTagName('err').length > 0) {
    throw new Error(`Catastro: ${txt(doc, 'des') || 'referencia no encontrada'}`);
  }
  return doc;
}

/** RC de 20 → datos físicos de la unidad. */
export async function fetchUnidad(rc20) {
  const debi = (await fetchDoc(rc20)).getElementsByTagName('debi')[0];
  return {
    ano: num(debi, 'ant'),
    superficie: num(debi, 'sfc'),
    uso: txt(debi, 'luso'),
  };
}

function parseRcdnp(node) {
  const rc = node.getElementsByTagName('rc')[0];
  const part = (tag) => rc?.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
  const rc20 = part('pc1') + part('pc2') + part('car') + part('cc1') + part('cc2');
  const loint = node.getElementsByTagName('loint')[0];
  return { rc20, planta: txt(loint, 'pt'), puerta: txt(loint, 'pu') };
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

    let fisicos = { ano: null, superficie: null, uso: null };
    const rep = unidades.find((u) => u.rc20.length === 20);
    if (rep) {
      try { fisicos = await fetchUnidad(rep.rc20); } catch { /* unidad sin datos: seguimos */ }
    }
    return { rc14, nivel: 'edificio', nInmuebles: unidades.length, plantas, ...fisicos };
  }

  // Caso inmueble único: estructura <bico>
  const debi = doc.getElementsByTagName('debi')[0];
  return {
    rc14,
    nivel: 'inmueble',
    nInmuebles: 1,
    plantas: null,
    ano: num(debi, 'ant'),
    superficie: num(debi, 'sfc'),
    uso: txt(debi, 'luso'),
  };
}
