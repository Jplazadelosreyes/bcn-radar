import { describe, it, expect, beforeEach } from 'vitest'
import { transportLines, transportSelected, isCurated } from '../transporteState'

// isCurated decide si un modo Overpass muestra un SUBSET curado de sus líneas (true) o todas
// (false). De ello depende cómo el explorador interpreta los chips de una parada. Estado singleton.
describe('transporteState · isCurated', () => {
  beforeEach(() => {
    transportLines.value = { metro: [{ ref: 'L1', colour: '#f00' }, { ref: 'L2', colour: '#0f0' }, { ref: 'L3', colour: '#00f' }] }
    transportSelected.value = {}
  })

  it('sin selección → no está curado', () => {
    transportSelected.value = { metro: [] }
    expect(isCurated('metro')).toBe(false)
  })

  it('todas las líneas seleccionadas → no está curado', () => {
    transportSelected.value = { metro: ['L1', 'L2', 'L3'] }
    expect(isCurated('metro')).toBe(false)
  })

  it('subconjunto seleccionado → está curado', () => {
    transportSelected.value = { metro: ['L1'] }
    expect(isCurated('metro')).toBe(true)
  })

  it('modo desconocido → no está curado', () => {
    expect(isCurated('inexistente')).toBe(false)
  })
})
