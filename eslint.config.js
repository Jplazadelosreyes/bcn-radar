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
    name: 'app/typescript-obligatorio',
    rules: {
      // Todo el árbol está en TypeScript: exige <script lang="ts"> en cada SFC.
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
    },
  },
  {
    name: 'app/anti-monolito',
    rules: {
      // Salvaguarda: que ningún archivo vuelva a acumular responsabilidades como el viejo
      // App.vue (2.694 líneas). Si un archivo pasa de 300 líneas de CÓDIGO (sin contar
      // comentarios ni blancos), hay que partirlo en componentes/composables/config.
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
)
