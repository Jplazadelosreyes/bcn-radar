import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Suite de salud de APIs (tests/api/) — red REAL contra los servicios públicos.
// Config propia y separada de vitest.config.ts a propósito:
//  · entorno node (sin jsdom): aquí se valida el contrato HTTP, no el DOM.
//  · fuera del `npm run test` de CI: un servicio público saturado no debe
//    bloquear un deploy. Se corre con `npm run test:apis` o desde api-health.yml.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/api/**/*.test.ts'],
    root: fileURLToPath(new URL('./', import.meta.url)),
    testTimeout: 20000, // por encima del techo de 15 s de cada petición
    hookTimeout: 20000,
    maxConcurrency: 4, // paralelo moderado: rapidez sin maltratar infraestructura pública
  },
})
