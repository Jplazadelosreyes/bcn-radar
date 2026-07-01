// Valor de mercado por zona — alquiler medio real (Incasòl · Generalitat, open data, sin key).
// Nivel ciudad por ahora (por barrio requiere Open Data BCN). El valor por finca no es
// abierto: se enlaza a la Sede del Catastro (Valor de Referencia).
const ALQUILER = 'https://analisi.transparenciacatalunya.cat/resource/qww9-bvhh.json'

export async function fetchAlquilerBarcelona() {
  const url = `${ALQUILER}?nom_territori=Barcelona&$order=any DESC&$limit=6`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Incasòl HTTP ${res.status}`)
  const rows = await res.json()
  if (!rows.length) return null
  // el registro anual (gener-desembre) o, si no, el de más contratos del año más reciente
  const anual = rows.find(r => /gener-desembre/i.test(r.periode || '')) || rows.sort((a, b) => (+b.habitatges) - (+a.habitatges))[0]
  return { renda: Math.round(+anual.renda), any: anual.any, contratos: +anual.habitatges }
}
