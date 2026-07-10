<script setup lang="ts">
// Buscador flotante sobre el mapa (estilo Google Maps): cápsula glass con lupa dentro y
// autocompletado de direcciones. Sin botón "Buscar" — Enter o clic en una sugerencia. Lógica
// en useSearch. El desplegable se cierra al perder el foco (con un pequeño retraso para que
// el clic en una sugerencia llegue antes).
import { useSearch } from '../../composables/useSearch'

const { searchQuery, suggestions, buscar, pickSuggestion, clearSuggestions } = useSearch()

function onBlur() { setTimeout(clearSuggestions, 150) }
</script>

<template>
  <div class="search-float">
    <div class="search-float-bar">
      <button class="search-float-ic" @click="buscar" aria-label="Buscar dirección">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
      </button>
      <input
        v-model="searchQuery"
        @keyup.enter="buscar"
        @blur="onBlur"
        type="text"
        placeholder="Buscar una dirección de Barcelona"
        aria-label="Buscar dirección"
      />
    </div>

    <!-- Autocompletado: lista de direcciones sugeridas -->
    <ul v-if="suggestions.length" class="search-suggest">
      <li v-for="(s, i) in suggestions" :key="i" @mousedown.prevent="pickSuggestion(s)">
        <span class="search-suggest-pin">📍</span>
        <span class="search-suggest-txt">{{ s.short }}</span>
      </li>
    </ul>
  </div>
</template>

<style>
/* Columna izquierda flotante: buscador + (debajo) el panel de sección. Alineados en `left`. */
.search-float {
  position: absolute; top: 14px; left: 82px; z-index: 900;
  width: min(400px, calc(100vw - 110px));
}
.search-float-bar {
  display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 14px;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-brd-soft); border-top-color: var(--glass-brd);
  border-radius: var(--r-pill); box-shadow: var(--shadow-float);
}
.search-float-ic { display: flex; padding: 0; border: 0; background: none; color: var(--text-mut); cursor: pointer; flex: none; }
.search-float-ic:hover { color: var(--accent); }
.search-float input { flex: 1; min-width: 0; height: 100%; border: 0; background: none; color: var(--text-hi); font: 500 13px/1 var(--sans); }
.search-float input::placeholder { color: var(--text-mut); }
.search-float input:focus { outline: none; }

/* Desplegable de sugerencias */
.search-suggest {
  list-style: none; margin: 6px 0 0; padding: 6px; max-height: 300px; overflow-y: auto;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-brd-soft); border-radius: var(--r-card); box-shadow: var(--shadow-float);
}
.search-suggest li {
  display: flex; align-items: center; gap: 9px; padding: 9px 11px; border-radius: var(--r-inner);
  font: 500 12.5px/1.3 var(--sans); color: var(--text-hi); cursor: pointer;
}
.search-suggest li:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.search-suggest-pin { flex: none; font-size: 13px; opacity: .8; }
.search-suggest-txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Móvil: ocupa el ancho, sin rail que la desplace */
@media (max-width: 680px) {
  .search-float { left: 10px; top: calc(10px + env(safe-area-inset-top)); width: calc(100% - 20px); }
}
</style>
