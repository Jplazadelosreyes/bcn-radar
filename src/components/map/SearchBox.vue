<script setup lang="ts">
// Buscador flotante sobre el mapa (estilo Google Maps): cápsula glass con lupa dentro y
// autocompletado de direcciones. Sin botón "Buscar" — Enter o clic en una sugerencia. Lógica
// en useSearch. El desplegable se cierra al perder el foco (con un pequeño retraso para que
// el clic en una sugerencia llegue antes).
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useSearch } from '../../composables/useSearch'

const { searchQuery, suggestions, buscar, pickSuggestion, clearSuggestions } = useSearch()

function onBlur() { setTimeout(clearSuggestions, 150) }

// El desplegable NO debe caer sobre el panel de sección (viven en la misma columna izquierda).
// Se publica su alto real en --suggest-h y el panel se aparta hacia abajo esa distancia.
// Se mide en vez de estimarse porque la lista crece con el nº de sugerencias.
const listaEl = ref<HTMLElement | null>(null)
const publicarAlto = (px: number) => document.documentElement.style.setProperty('--suggest-h', `${px}px`)

watch(suggestions, async () => {
  await nextTick()
  publicarAlto(listaEl.value ? listaEl.value.offsetHeight + 6 : 0) // +6 = aire bajo la lista
}, { deep: true })

onBeforeUnmount(() => publicarAlto(0))
</script>

<template>
  <div class="search-float" :class="{ sugiriendo: suggestions.length > 0 }">
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

    <!-- Autocompletado: continuación del buscador, no una tarjeta aparte -->
    <ul v-if="suggestions.length" ref="listaEl" class="search-suggest">
      <li v-for="(s, i) in suggestions" :key="i" @mousedown.prevent="pickSuggestion(s)">
        <svg class="search-suggest-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6-7-11a7 7 0 1 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
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
  border: 1px solid var(--edge);
  border-radius: var(--r-pill);
  box-shadow: inset 0 1px 0 var(--edge-hi), var(--shadow-float);
  transition: border-radius var(--dur-fast) var(--ease);
}
/* Con sugerencias abiertas, la cápsula y la lista son UNA sola pieza: la cápsula pierde el
   redondeo de abajo y la lista continúa desde su borde (como Google). Antes la lista era una
   tarjeta suelta flotando encima → se leía como "un recuadro sobre el panel". */
.search-float.sugiriendo .search-float-bar { border-radius: 23px 23px 0 0; border-bottom-color: transparent; }
.search-float-ic { display: flex; padding: 0; border: 0; background: none; color: var(--text-mut); cursor: pointer; flex: none; }
.search-float-ic:hover { color: var(--accent); }
.search-float input { flex: 1; min-width: 0; height: 100%; border: 0; background: none; color: var(--text-hi); font: 500 13px/1 var(--sans); }
.search-float input::placeholder { color: var(--text-mut); }
/* El input es una caja desnuda dentro de la cápsula: el anillo de foco iría por dentro y con
   otra forma. Se traslada a la cápsula entera, que es la pieza que el usuario ve. */
.search-float input:focus, .search-float input:focus-visible { outline: none; box-shadow: none; }
.search-float-bar:focus-within { box-shadow: var(--ring), var(--shadow-float); }

/* Sugerencias: pegadas a la cápsula, misma superficie, un solo bloque */
.search-suggest {
  list-style: none; margin: 0; padding: 4px 0 6px; max-height: 300px; overflow-y: auto;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--edge); border-top: 0;
  border-radius: 0 0 var(--r-card) var(--r-card);
  box-shadow: var(--shadow-float);
}
/* Hilo separador entre la cápsula y la lista (no un hueco: siguen siendo la misma pieza) */
.search-suggest::before {
  content: ''; display: block; height: 1px; margin: 0 14px 4px; background: var(--edge);
}
.search-suggest li {
  display: flex; align-items: center; gap: 10px; padding: 9px 14px;
  font: 500 var(--fs-md)/1.3 var(--sans); color: var(--text-hi); cursor: pointer;
}
.search-suggest li:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.search-suggest-pin { flex: none; width: 15px; height: 15px; color: var(--text-mut); }
.search-suggest li:hover .search-suggest-pin { color: var(--accent); }
.search-suggest-txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Móvil: ocupa el ancho, sin rail que la desplace */
@media (max-width: 680px) {
  .search-float { left: 10px; top: calc(10px + env(safe-area-inset-top)); width: calc(100% - 20px); }
}
</style>
