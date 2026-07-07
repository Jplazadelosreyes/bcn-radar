import { describe, it, expect } from 'vitest'
import { MAP_COLORS, MAP_OPTIONS } from '../map-theme.js'

describe('map-theme', () => {
  it('define paletas completas de día y noche', () => {
    expect(MAP_COLORS.day).toBeTruthy()
    expect(MAP_COLORS.night).toBeTruthy()
  })

  it('día y noche exponen exactamente los mismos roles de color', () => {
    const dayKeys = Object.keys(MAP_COLORS.day).sort()
    const nightKeys = Object.keys(MAP_COLORS.night).sort()
    expect(nightKeys).toEqual(dayKeys)
  })

  it('todos los colores son hex válidos', () => {
    const hex = /^#[0-9A-Fa-f]{6}$/
    for (const mode of ['day', 'night'] as const) {
      for (const [role, value] of Object.entries(MAP_COLORS[mode])) {
        expect(hex.test(value), `${mode}.${role} = ${value}`).toBe(true)
      }
    }
  })

  it('el mapa 2D (sin 3D) está activo por defecto', () => {
    expect(MAP_OPTIONS.flat2D).toBe(true)
  })
})
