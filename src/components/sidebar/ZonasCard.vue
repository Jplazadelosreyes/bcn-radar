<script setup lang="ts">
// Sección "Zonas administrativas": distritos / barrios / secciones + coropleta de renta.
// Estado y lógica de mapa en el store useZones; el estado abierto/cerrado lo controla el padre.
import SectionCard from './SectionCard.vue'
import { useZones } from '../../composables/useZones.js'

defineProps<{ open: boolean }>()
defineEmits<{ toggle: [] }>()

const { zoneOn, zoneStatus, rentaOn, rentaStatus, rentaAny, toggleZone, toggleRenta } = useZones()
</script>

<template>
  <SectionCard ico="🗺️" title="Zonas administrativas" :open="open" body-class="capas-body" @toggle="$emit('toggle')">
    <p class="capas-intro">Límites oficiales de Barcelona (Ajuntament · CartoBCN).</p>
    <label class="capas-layer">
      <input type="checkbox" :checked="!!zoneOn.districtes" @change="toggleZone('districtes')" />
      <span class="capas-layer-body">
        <span class="capas-layer-t"
          >Distritos
          <span v-if="zoneStatus.districtes === 'loading'" class="mov-st">cargando…</span>
          <span v-else-if="zoneStatus.districtes === 'error'" class="mov-st err">error</span>
        </span>
        <span class="capas-layer-h">Los 10 distritos de la ciudad.</span>
      </span>
    </label>
    <label class="capas-layer">
      <input type="checkbox" :checked="!!zoneOn.barris" @change="toggleZone('barris')" />
      <span class="capas-layer-body">
        <span class="capas-layer-t"
          >Barrios
          <span v-if="zoneStatus.barris === 'loading'" class="mov-st">cargando…</span>
          <span v-else-if="zoneStatus.barris === 'error'" class="mov-st err">error</span>
        </span>
        <span class="capas-layer-h">Los 73 barrios.</span>
      </span>
    </label>
    <label class="capas-layer">
      <input type="checkbox" :checked="!!zoneOn.seccions" @change="toggleZone('seccions')" />
      <span class="capas-layer-body">
        <span class="capas-layer-t"
          >Secciones censales
          <span v-if="zoneStatus.seccions === 'loading'" class="mov-st">cargando…</span>
          <span v-else-if="zoneStatus.seccions === 'error'" class="mov-st err">error</span>
        </span>
        <span class="capas-layer-h"
          >1.068 secciones — la unidad del INE para renta y demografía (código al hacer zoom).</span
        >
      </span>
    </label>
    <label class="capas-layer">
      <input type="checkbox" :checked="rentaOn" @change="toggleRenta()" />
      <span class="capas-layer-body">
        <span class="capas-layer-t"
          >Renta media (mapa de calor)
          <span v-if="rentaStatus === 'loading'" class="mov-st">cargando…</span>
          <span v-else-if="rentaStatus === 'error'" class="mov-st err">error</span>
        </span>
        <span class="capas-layer-h">Colorea cada sección por su renta. Clic para ver el importe.</span>
        <span v-if="rentaOn" class="renta-legend"
          ><span class="renta-scale"></span><span>menos&nbsp;renta&nbsp;→&nbsp;más</span
          ><span v-if="rentaAny" class="renta-any">· {{ rentaAny }}</span></span
        >
      </span>
    </label>
  </SectionCard>
</template>
