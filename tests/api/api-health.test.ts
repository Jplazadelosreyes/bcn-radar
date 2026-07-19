// ═══════════════════════════════════════════════════════════════════════════════
//  🩺  SALUD DE LAS APIs PÚBLICAS — ¿siguen vigentes todas las fuentes?
// ═══════════════════════════════════════════════════════════════════════════════
//
//  BCN Radar no tiene backend: depende de ~30 endpoints públicos (Catastro, PIU,
//  Overpass, Socrata, GBFS…). Cualquiera puede cambiar de URL, de contrato o morir
//  en silencio. Esta suite hace UNA petición real y mínima a cada uno (catálogo en
//  checks.ts), valida que la respuesta siga teniendo la forma que la app espera, y
//  escribe el informe fechado en docs/API_STATUS.md.
//
//  CÓMO CORRERLA:   npm run test:apis
//  (Va aparte del `npm run test` de CI a propósito: un servicio público saturado
//   no debe bloquear un deploy. La vigila el workflow api-health.yml, programado.)
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, test, expect, afterAll } from 'vitest'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHECKS, TIMEOUT_MS, UA } from './checks'

interface Resultado {
  idx: number; grupo: string; nombre: string; uso: string; url: string
  ok: boolean; status: number; ms: number; nota: string
}
const resultados: Resultado[] = []

describe('Salud de las APIs públicas', () => {
  CHECKS.forEach((c, idx) => {
    test.concurrent(`${c.grupo} · ${c.nombre}`, async () => {
      const r: Resultado = { idx, grupo: c.grupo, nombre: c.nombre, uso: c.uso, url: c.url, ok: false, status: 0, ms: 0, nota: '' }
      resultados.push(r)
      const t0 = Date.now()
      try {
        const ctrl = new AbortController()
        const techo = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
        let res: Response
        try {
          res = await fetch(c.url, { ...c.init, headers: { ...UA, ...(c.init?.headers as Record<string, string>) }, signal: ctrl.signal })
        } finally {
          clearTimeout(techo)
        }
        r.status = res.status
        const body = await res.text()
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        r.nota = c.valida(res, body)
        r.ok = true
      } catch (e) {
        r.nota = e instanceof Error ? (e.name === 'AbortError' ? `sin respuesta en ${TIMEOUT_MS / 1000}s` : e.message) : String(e)
      }
      r.ms = Date.now() - t0
      expect(r.ok, `${c.nombre} → ${r.nota}\n  ${c.url}`).toBe(true)
    })
  })

  // El informe se escribe SIEMPRE, pasen o fallen los tests: documentar el estado
  // (incluida la caída) es el objetivo de la suite.
  afterAll(() => {
    const filas = [...resultados].sort((a, b) => a.idx - b.idx)
    const vivos = filas.filter((r) => r.ok).length
    const fecha = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
    const md = [
      '# Estado de las APIs públicas · BCN Radar',
      '',
      `> Generado por \`npm run test:apis\` — **${fecha}** · **${vivos}/${filas.length}** integraciones respondiendo.`,
      '>',
      '> La app no tiene backend: todo lo de esta tabla se consulta en vivo desde el navegador.',
      '> Si una fila está en ❌, ese bloque de la app lo dirá en pantalla en vez de inventar el dato.',
      '',
      '| | Fuente | Comprobación | Qué alimenta | HTTP | Latencia | Nota |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...filas.map((r) =>
        `| ${r.ok ? '✅' : '❌'} | ${r.grupo} | ${r.nombre} | ${r.uso} | ${r.status || '—'} | ${r.ms} ms | ${r.nota.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`,
      ),
      '',
      '**Cómo leerlo:** cada fila es una petición real mínima (un punto del Eixample, una RC',
      'validada, una tesela) con el mismo contrato que usa el código de `src/services/`. La',
      'latencia es de la máquina que ejecutó la suite. Para regenerar: `npm run test:apis`.',
      '',
    ].join('\n')
    const destino = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../docs/API_STATUS.md')
    writeFileSync(destino, md)
    console.log(`\n🩺 ${vivos}/${filas.length} APIs vivas → docs/API_STATUS.md`)
  })
})
