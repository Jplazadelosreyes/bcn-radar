<script setup lang="ts">
// Sub-sección "Capas de datos abiertos" de Movilidad: Bicing, carriles bici, POI (salud/
// educación/comercio/verde/cultura) y temperatura. Catálogo declarativo en config/capas-datos,
// lógica en useCapasDatos. Cada capa se carga solo al activarla (lazy) y se refresca si es `live`.
import { useCapasDatos } from '../../../composables/useCapasDatos'

const { MOVILIDAD, dataActive, dataStatus, poiDate, toggleData } = useCapasDatos()
</script>

<template>
  <div>
    <div v-for="grp in MOVILIDAD" :key="grp.group" class="mov-group">
      <span class="mov-group-t">{{ grp.group }}</span>
      <label v-for="l in grp.layers" :key="l.id" class="capas-layer">
        <input type="checkbox" :checked="!!dataActive[l.id]" @change="toggleData(l)">
        <span class="capas-layer-body">
          <span class="capas-layer-t">
            {{ l.label }}
            <span v-if="dataStatus[l.id] === 'loading'" class="mov-st">cargando…</span>
            <span v-else-if="dataStatus[l.id] === 'error'" class="mov-st err">error</span>
            <span v-else-if="dataActive[l.id]" class="mov-st live">● en vivo</span>
          </span>
          <span class="capas-layer-h">{{ l.hint }}</span>
          <a v-if="l.portal" class="capas-portal" :href="l.portal" target="_blank" rel="noopener" @click.stop>Fuente oficial ↗</a>
        </span>
      </label>
    </div>
    <p v-if="poiDate" class="capas-foot">🌍 Entorno vía OpenStreetMap · datos de {{ poiDate }}</p>
  </div>
</template>
