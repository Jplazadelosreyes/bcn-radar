<script setup lang="ts">
// Chips de capas ACTIVAS (barra superior, estilo "filtros activos" de Google Maps). No es un
// menú de todas las capas: solo muestra lo que está encendido ahora mismo, agregando lo que
// reporta cada dominio (Capas WMS/parcelas, Movilidad/datos, Zonas). Un clic en un chip apaga
// esa capa. Se activan desde los paneles del rail; aquí solo se ven y se quitan.
import { computed } from 'vue'
import { useLayers } from '../../composables/useLayers'
import { useCapasDatos } from '../../composables/useCapasDatos'
import { useZones } from '../../composables/useZones'
import { useTransporteModos } from '../../composables/useTransporteModos'

const { activeChips: urbanismo } = useLayers()
const { activeChips: datos } = useCapasDatos()
const { activeChips: zonas } = useZones()
const { activeChips: transporte } = useTransporteModos()

const chips = computed(() => [...urbanismo.value, ...datos.value, ...zonas.value, ...transporte.value])
</script>

<template>
  <div v-if="chips.length" class="active-chips">
    <button
      v-for="c in chips" :key="c.id"
      class="active-chip" @click="c.off()"
      :title="`Quitar «${c.label}» del mapa`"
    >
      <span class="active-chip-dot"></span>
      <span class="active-chip-txt">{{ c.label }}</span>
      <span class="active-chip-x">✕</span>
    </button>
  </div>
</template>

<style>
/* Barra de chips activos: arriba, a la derecha del buscador; scroll horizontal si son muchos. */
.active-chips {
  position: absolute; top: 16px; left: 498px; right: 132px; z-index: 850;
  display: flex; align-items: center; gap: 8px;
  overflow-x: auto; scrollbar-width: none; padding: 2px 0;
}
.active-chips::-webkit-scrollbar { display: none; }
.active-chip {
  display: inline-flex; align-items: center; gap: 7px; flex: none;
  height: 34px; padding: 0 10px 0 11px; cursor: pointer;
  border: 1px solid var(--accent); border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--accent) 14%, var(--glass-bg-strong));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  color: var(--accent-ink); font: 600 12px/1 var(--sans); white-space: nowrap;
  box-shadow: var(--shadow-sm);
}
.active-chip:hover { background: color-mix(in srgb, var(--accent) 22%, var(--glass-bg-strong)); }
.active-chip-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex: none; }
.active-chip-x { font-size: 10px; opacity: .7; }
.active-chip:hover .active-chip-x { opacity: 1; }

/* Móvil: se pospone (lo trabajamos con el resto del layout móvil) */
@media (max-width: 680px) { .active-chips { display: none; } }
</style>
