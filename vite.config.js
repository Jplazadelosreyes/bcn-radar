import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: el mismo build sirve en la subcarpeta de GitHub Pages
  // (/bcn-radar/) y en la raíz de cualquier otro host.
  base: './',
  // Puerto PROPIO de bcn-radar. Zerty Hub vive en el 5173 (el que Vite toma por defecto), así
  // que aquí nos apartamos del rango habitual. strictPort corta si está ocupado en vez de
  // saltar en silencio a otro puerto: es mejor un error claro que buscar la app a ciegas.
  server: { port: 5190, strictPort: true },
  preview: { port: 5191, strictPort: true },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
