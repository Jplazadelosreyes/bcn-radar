import { describe, it, expect, beforeEach } from 'vitest'
import { useFinca } from '../useFinca.js'

// Los veredictos cruzan un DATO REAL del Catastro con REGULACIÓN (ITE, LPH, uso). Estado singleton.
const { fincaData, veredictos, antiguedad, supUtilEstimada } = useFinca()

const base = {
  estado: 'ok' as const,
  refCatastral: '123',
  rcInmueble: '123',
  ano: 2010,
  superficie: 100,
  uso: 'Residencial',
  coefParticipacion: null,
  nInmuebles: 1,
  plantas: 5,
}

describe('useFinca · veredictos', () => {
  beforeEach(() => {
    fincaData.value = { ...base }
  })

  it('sin datos (estado != ok) no genera veredictos', () => {
    fincaData.value = { ...base, estado: 'vacio' }
    expect(veredictos.value).toEqual([])
  })

  it('edificio >45 años → ITE obligatoria (amber)', () => {
    fincaData.value = { ...base, ano: 1970 }
    const ite = veredictos.value.find((v) => /ITE/.test(v.titulo))
    expect(ite?.tone).toBe('amber')
  })

  it('edificio ≤45 años → verde (sin ITE)', () => {
    fincaData.value = { ...base, ano: 2010 }
    const edad = veredictos.value.find((v) => /años/.test(v.titulo))
    expect(edad?.tone).toBe('green')
  })

  it('uso no residencial → aviso rojo', () => {
    fincaData.value = { ...base, uso: 'Industrial' }
    const uso = veredictos.value.find((v) => /no residencial/i.test(v.titulo))
    expect(uso?.tone).toBe('red')
  })

  it('plurifamiliar con coeficiente válido → cuota en la comunidad', () => {
    fincaData.value = { ...base, nInmuebles: 8, coefParticipacion: 12 }
    expect(veredictos.value.some((v) => /cuota en la comunidad/i.test(v.titulo))).toBe(true)
  })

  it('antiguedad y superficie útil estimada se derivan bien', () => {
    fincaData.value = { ...base, ano: new Date().getFullYear() - 30, superficie: 100 }
    expect(antiguedad.value).toBe(30)
    expect(supUtilEstimada.value).toBe(85) // ~85% de la construida
  })
})
