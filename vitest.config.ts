import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

// Tests unitarios (Vitest) reutilizando la config de Vite (alias @, plugin vue).
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      // tests/api/ va aparte (vitest.api.config.ts): pega a la red real y no debe
      // ni frenar el TDD local ni bloquear el CI cuando un servicio público tose.
      exclude: [...configDefaults.exclude, 'e2e/**', 'tests/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
