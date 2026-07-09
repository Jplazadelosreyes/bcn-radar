import { describe, it, expect, beforeEach } from 'vitest'
import { useTransporteModos } from '../useTransporteModos'

// chipsFor decide qué líneas se pintan como chips: todos los modos muestran su lista completa,
// salvo BUS (son ~200), que solo aparece al buscar o al expandir la lista. Estado singleton.
const { chipsFor, transportLines, busSearch, busExpanded } = useTransporteModos()

describe('useTransporteModos · chipsFor', () => {
  beforeEach(() => {
    transportLines.value = {
      metro: [{ ref: 'L1', colour: '#f00' }, { ref: 'L2', colour: '#0f0' }],
      bus: [{ ref: 'H6', colour: '#00f' }, { ref: 'V15', colour: '#ff0' }, { ref: 'D20', colour: '#0ff' }],
    }
    busSearch.value = ''
    busExpanded.value = false
  })

  it('modo no-bus devuelve todas sus líneas', () => {
    expect(chipsFor('metro').map((l) => l.ref)).toEqual(['L1', 'L2'])
  })

  it('bus sin búsqueda ni expandir → lista vacía (son demasiadas)', () => {
    expect(chipsFor('bus')).toEqual([])
  })

  it('bus expandido → todas las líneas de bus', () => {
    busExpanded.value = true
    expect(chipsFor('bus').map((l) => l.ref)).toEqual(['H6', 'V15', 'D20'])
  })

  it('bus con búsqueda filtra por ref, sin distinguir mayúsculas', () => {
    busSearch.value = 'v15'
    expect(chipsFor('bus').map((l) => l.ref)).toEqual(['V15'])
  })

  it('modo sin datos → lista vacía', () => {
    expect(chipsFor('tram')).toEqual([])
  })
})
