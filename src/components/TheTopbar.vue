<script setup>
// Barra superior: marca + búsqueda + interruptor de tema. Autocontenida y responsive.
// En escritorio es una barra sólida; en móvil se convierte en cápsula flotante glass
// sobre el mapa (el mapa es el protagonista, la UI flota encima).
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
        <span class="topbar-name"><span class="brand-l">BCN</span> <span class="brand-l">Radar</span></span>
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
        <button class="search-go" @click="emit('search')" aria-label="Buscar dirección">
          <svg class="go-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
          <span class="go-txt">Buscar</span>
        </button>
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
.topbar-logo { width: 28px; height: 28px; background: var(--accent); display: flex; align-items: center; justify-content: center; flex: none; border-radius: 9px; }
.topbar-titles { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.topbar-name { font: 700 19px/1 var(--display); letter-spacing: .005em; text-transform: none; color: var(--text-hi); white-space: nowrap; }
.topbar-tag { font: 500 11px/1 var(--sans); color: var(--text-mut); white-space: nowrap; }

.topbar-right { display: flex; align-items: center; gap: 12px; min-width: 0; }
.search-box { display: flex; align-items: center; gap: 8px; position: relative; }
.search-box .search-ic { position: absolute; margin-left: 12px; pointer-events: none; display: flex; align-items: center; color: var(--text-mut); }
.search-box input { height: 36px; width: 300px; padding: 0 14px 0 36px; border: 1px solid var(--border-2); background: var(--surface-2); color: var(--text-hi); font: 500 12px/1 var(--sans); border-radius: 999px; }
.search-box input::placeholder { color: var(--text-mut); }
.search-box input:focus { outline: none; border-color: var(--carto); }
.search-go { height: 36px; padding: 0 17px; border: none; background: var(--accent); color: #fff; font: 600 11px/1 var(--sans); letter-spacing: .04em; text-transform: none; cursor: pointer; transition: filter .15s; white-space: nowrap; display: flex; align-items: center; justify-content: center; border-radius: 999px; }
.search-go:hover { filter: brightness(1.08); }
.search-go .go-ic { display: none; }
.theme-toggle { width: 36px; height: 36px; flex: none; border: 1px solid var(--border-2); background: var(--surface-2); color: var(--text); font-size: 15px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s, border-color .15s; border-radius: 999px; }
.theme-toggle:hover { background: var(--surface-3); border-color: var(--accent); }

/* ── Móvil: cápsula flotante glass sobre el mapa ── */
@media (max-width: 680px) {
  .topbar {
    position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 10px; right: 10px;
    z-index: 1200; height: 52px; padding: 0 7px 0 7px; gap: 7px;
    background: color-mix(in srgb, var(--surface) 74%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5);
    border: 1px solid var(--border-2); border-bottom: 1px solid var(--border-2);
    box-shadow: 0 10px 30px rgba(0,0,0,.22);
    border-radius: 18px;
  }
  .topbar-brand { gap: 7px; }
  .topbar-tag { display: none; }
  /* Marca apilada en 2 líneas, mínima */
  .topbar-name { display: flex; flex-direction: column; gap: 2px; font-size: 8.5px; letter-spacing: .16em; line-height: 1; }
  .topbar-right { flex: 1; min-width: 0; gap: 7px; }
  .search-box { flex: 1; min-width: 0; }
  .search-box .search-ic { display: none; }
  .search-box input { width: 100%; min-width: 0; height: 38px; padding: 0 44px 0 12px; background: color-mix(in srgb, var(--surface-2) 82%, transparent); }
  /* Botón buscar DENTRO del input: cuadrado rojo con lupa */
  .search-go { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; padding: 0; border-radius: 999px; }
  .search-go .go-txt { display: none; }
  .search-go .go-ic { display: block; }
  /* El toggle de tema en móvil vive abajo a la derecha (botón flotante de App) */
  .theme-toggle { display: none; }
}
</style>
