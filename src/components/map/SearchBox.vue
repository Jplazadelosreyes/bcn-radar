<script setup lang="ts">
// Buscador flotante sobre el mapa (estilo Google Maps): cápsula glass con lupa dentro.
// Sin botón "Buscar" — se busca con Enter o tocando la lupa. Lógica en useSearch.
import { useSearch } from '../../composables/useSearch'

const { searchQuery, buscar } = useSearch()
</script>

<template>
  <div class="search-float">
    <button class="search-float-ic" @click="buscar" aria-label="Buscar dirección">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
    </button>
    <input
      v-model="searchQuery"
      @keyup.enter="buscar"
      type="text"
      placeholder="Buscar una dirección de Barcelona"
      aria-label="Buscar dirección"
    />
  </div>
</template>

<style>
/* Buscador flotante: cápsula glass, arriba, a la derecha del rail. Usa los tokens de material. */
.search-float {
  position: absolute; top: 14px; left: 74px; z-index: 900;
  display: flex; align-items: center; gap: 8px;
  width: min(420px, calc(100% - 90px));
  height: 46px; padding: 0 14px;
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

/* Móvil: ocupa el ancho, sin rail que la desplace */
@media (max-width: 680px) {
  .search-float { left: 10px; top: calc(10px + env(safe-area-inset-top)); width: calc(100% - 20px); height: 44px; }
}
</style>
