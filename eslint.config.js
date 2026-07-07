import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// ESLint 9 (flat config). Reglas recomendadas de Vue 3 + TypeScript; el formato lo
// delega a Prettier (skipFormatting desactiva reglas de estilo que chocarían).
export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,vue,js,mjs}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/node_modules/**', '**/public/**', '**/data/**', '**/scripts/**'],
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    name: 'app/migracion-ts',
    rules: {
      // Migración a TS en curso: App.vue y algunos componentes siguen en JS mientras se
      // componentizan. Reactivar (quitar esta línea) cuando todo el árbol esté en <script lang="ts">.
      'vue/block-lang': 'off',
    },
  },
)
