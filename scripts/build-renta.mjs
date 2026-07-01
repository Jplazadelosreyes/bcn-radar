// Pre-genera public/data/renta.json — renta media por sección censal (Open Data BCN,
// Atles de renda, dato del INE). Clave "distrito-sección" para cruzar con el GeoJSON
// de secciones (que trae DISTRICTE + SEC_CENS). Ejecutar: node scripts/build-renta.mjs
import { writeFileSync, mkdirSync } from 'fs'
const API = 'https://opendata-ajuntament.barcelona.cat/data/api/3/action/'
async function api(path, params) {
  const u = API + path + '?' + new URLSearchParams(params)
  const r = await fetch(u, { headers: { 'User-Agent': 'bcn-radar' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()).result
}
const pkg = await api('package_show', { id: 'atles-renda-mitjana' })
// recurso más reciente con datastore (nombre tipo "2023_atles_renda_mitjana.csv")
const res = pkg.resources.filter(r => r.datastore_active).sort((a, b) => (b.name || '').localeCompare(a.name || ''))[0]
const any = (res.name.match(/\d{4}/) || ['?'])[0]
const ds = await api('datastore_search', { resource_id: res.id, limit: 2000 })
const data = {}
for (const r of ds.records) {
  const d = +r.Codi_Districte, s = +r.Seccio_Censal
  const renta = +String(r['Mitjana_Renda_€'] ?? '').replace(/[^\d]/g, '')
  if (!d || !s || !renta) continue
  data[`${d}-${s}`] = renta
}
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/data/renta.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), any, source: 'Atles de renda · Open Data BCN (INE)', data }))
console.log('renta.json:', Object.keys(data).length, 'secciones · año', any)
