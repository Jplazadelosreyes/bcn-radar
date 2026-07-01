<script setup>
// Barra superior: marca + búsqueda + interruptor de tema. Autocontenida y responsive.
import { useTheme } from '../composables/useTheme.js'

const { theme, toggleTheme } = useTheme()
defineProps({ query: { type: String, default: '' } })
const emit = defineEmits(['update:query', 'search'])
</script>

<template>
  <header class="topbar">
    <div class="topbar-brand">
      <div class="topbar-logo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 12 18.5 5.5"></path></svg>
      </div>
      <div class="topbar-titles">
        <span class="topbar-name">BCN Radar</span>
        <span class="topbar-tag">Escáner de propiedad · Barcelona</span>
      </div>
    </div>

    <div class="topbar-right">
      <div class="search-box">
        <span class="search-ic">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
        </span>
        <input
          :value="query"
          @input="emit('update:query', $event.target.value)"
          @keyup.enter="emit('search')"
          type="text"
          placeholder="Ej: Carrer de València, 285"
        />
        <button @click="emit('search')">Buscar</button>
      </div>
      <button class="theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'">
        <span v-if="theme === 'dark'">☀</span><span v-else>☾</span>
      </button>
    </div>
  </header>
</template>

<style>
/* Topbar — usa los tokens globales (:root en App). No scoped: clases únicas de la barra. */
.topbar { background: var(--bg); color: var(--text-hi); height: 54px; flex: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid var(--border); }
.topbar-brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
.topbar-logo { width: 26px; height: 26px; background: var(--accent); display: flex; align-items: center; justify-content: center; flex: none; clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px); }
.topbar-titles { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.topbar-name { font: 700 15px/1 var(--display); letter-spacing: .06em; text-transform: uppercase; color: var(--text-hi); white-space: nowrap; }
.topbar-tag { font: 500 11px/1 var(--sans); color: var(--text-mut); white-space: nowrap; }

.topbar-right { display: flex; align-items: center; gap: 12px; min-width: 0; }
.search-box { display: flex; align-items: center; gap: 8px; }
.search-box .search-ic { position: absolute; margin-left: 12px; pointer-events: none; display: flex; align-items: center; color: var(--text-mut); }
.search-box input { height: 34px; width: 300px; padding: 0 12px 0 34px; border: 1px solid var(--border-2); background: var(--surface-2); color: var(--text-hi); font: 500 12px/1 var(--sans); border-radius: 0; }
.search-box input::placeholder { color: var(--text-mut); }
.search-box input:focus { outline: none; border-color: var(--carto); }
.search-box button { height: 34px; padding: 0 15px; border: none; background: var(--accent); color: #fff; font: 600 11px/1 var(--sans); letter-spacing: .04em; text-transform: uppercase; cursor: pointer; transition: filter .15s; white-space: nowrap; }
.search-box button:hover { filter: brightness(1.12); }
.theme-toggle { width: 34px; height: 34px; flex: none; border: 1px solid var(--border-2); background: var(--surface-2); color: var(--text); font-size: 15px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s, border-color .15s; }
.theme-toggle:hover { background: var(--surface-3); border-color: var(--accent); }

/* ── Móvil: la marca se compacta y la búsqueda se hace flexible ── */
@media (max-width: 680px) {
  .topbar { padding: 0 10px; gap: 8px; }
  .topbar-tag { display: none; }
  .topbar-right { flex: 1; min-width: 0; }
  .search-box { flex: 1; min-width: 0; }
  .search-box input { width: 100%; min-width: 0; }
  .search-box button { padding: 0 11px; }
}
@media (max-width: 420px) {
  .topbar-name { font-size: 13px; }
  .search-box button span, .search-box button { font-size: 10px; }
}
</style>
