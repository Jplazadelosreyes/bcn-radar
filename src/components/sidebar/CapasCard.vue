<script setup lang="ts">
// Sección "Capas del mapa": parcelas del Catastro + agregador WMS público
// (urbanismo Ajuntament, MUC, inundabilidad ACA). Lógica en el store useLayers.
import SectionCard from './SectionCard.vue'
import { useLayers } from '../../composables/useLayers'

defineProps<{ open: boolean }>()
defineEmits<{ toggle: [] }>()

const {
  WMS_SOURCES, layerKey, fincasOn, toggleFincas,
  wmsExpanded, wmsShowAll, wmsActive, wmsAllLayers, wmsAllStatus,
  toggleWmsExpand, toggleWms, loadAllWms,
} = useLayers()
</script>

<template>
  <SectionCard ico="🗂️" title="Capas del mapa" :open="open" body-class="capas-body" @toggle="$emit('toggle')">
    <p class="capas-intro">Superpón capas oficiales sobre el mapa. Cada fuente enlaza a su portal para contrastar el dato.</p>

    <!-- Parcelas del Catastro — una capa más del mapa -->
    <label class="capas-layer">
      <input type="checkbox" :checked="fincasOn" @change="toggleFincas()" />
      <span class="capas-layer-body">
        <span class="capas-layer-t">Parcelas (Catastro)</span>
        <span class="capas-layer-h">Dibuja los límites de parcela para seleccionar una finca (zoom cercano).</span>
      </span>
    </label>

    <div v-for="src in WMS_SOURCES" :key="src.id" class="capas-src">
      <button class="capas-src-head" @click="toggleWmsExpand(src.id)">
        <span class="capas-chev side" :class="{ open: wmsExpanded[src.id] }">▸</span>
        <span class="capas-src-t">{{ src.label }}</span>
        <span v-if="src.badge" class="capas-badge">{{ src.badge }}</span>
      </button>
      <div v-show="wmsExpanded[src.id]" class="capas-src-body">
        <a v-if="src.portal" class="capas-portal" :href="src.portal" target="_blank" rel="noopener">Portal oficial ↗</a>
        <label v-for="l in src.layers" :key="l.name" class="capas-layer">
          <input type="checkbox" :checked="!!wmsActive[layerKey(src.id, l.name)]" @change="toggleWms(src, l)" />
          <span class="capas-layer-body">
            <span class="capas-layer-t">{{ l.label }}</span>
            <span class="capas-layer-h">{{ l.hint }}</span>
          </span>
        </label>

        <!-- Ver todas: vuelca el catálogo completo del servicio -->
        <button class="capas-all-toggle" @click="loadAllWms(src)">
          <span class="capas-chev side" :class="{ open: wmsShowAll[src.id] }">▸</span>
          Ver todas las capas
          <span v-if="wmsAllLayers[src.id]" class="capas-count">{{ wmsAllLayers[src.id].length + src.layers.length }}</span>
        </button>
        <div v-show="wmsShowAll[src.id]" class="capas-all">
          <span v-if="wmsAllStatus[src.id] === 'loading'" class="capas-status">cargando catálogo…</span>
          <span v-else-if="wmsAllStatus[src.id] === 'error'" class="capas-status err">no se pudo cargar el catálogo</span>
          <label v-for="l in (wmsAllLayers[src.id] || [])" :key="l.name" class="capas-layer slim">
            <input type="checkbox" :checked="!!wmsActive[layerKey(src.id, l.name)]" @change="toggleWms(src, l)" />
            <span class="capas-layer-body">
              <span class="capas-layer-t">{{ l.label }}</span>
              <span v-if="l.desc" class="capas-layer-h">{{ l.desc }}</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  </SectionCard>
</template>
