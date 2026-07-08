<script setup lang="ts">
// Sección "Movilidad y servicios": explorador de parada (GTFS), líneas por modo (Overpass)
// y capas de datos abiertos (Bicing, POI, temperatura). Lógica en el store useMovilidad.
import SectionCard from './SectionCard.vue'
import { useMovilidad } from '../../composables/useMovilidad'

defineProps<{ open: boolean }>()
defineEmits<{ toggle: [] }>()

const {
  TRANSPORTES, MOVILIDAD,
  transportStatus, transportLines, transportSelected, busSearch, busExpanded,
  chipsFor, setAllLines, toggleLine,
  dataActive, dataStatus, poiDate, toggleData,
  transitOn, transitStatus, toggleTransit, loadTransport,
} = useMovilidad()
</script>

<template>
  <SectionCard ico="🚌" title="Movilidad y servicios" :open="open" body-class="capas-body" @toggle="$emit('toggle')">
            <p class="capas-intro">Datos abiertos oficiales, en vivo. Se cargan solo al activarlos.</p>

            <!-- Transporte público: explorador parada → línea → recorrido (GTFS TMB) -->
            <div class="mov-group">
              <span class="mov-group-t">🚇 Transporte público</span>
              <label class="capas-layer">
                <input type="checkbox" :checked="transitOn" @change="toggleTransit">
                <span class="capas-layer-body">
                  <span class="capas-layer-t">
                    Paradas de metro, bus y Rodalies
                    <span v-if="transitStatus === 'loading'" class="mov-st">cargando…</span>
                    <span v-else-if="transitStatus === 'error'" class="mov-st err">error</span>
                    <span v-else-if="transitOn" class="mov-st live">● activo</span>
                  </span>
                  <span class="capas-layer-h">Haz clic en una parada y elige una línea para ver su recorrido.</span>
                </span>
              </label>

              <!-- Recorridos por modo (líneas reales OSM/Overpass) — unificado aquí, antes en el panel derecho -->
              <div class="mov-lineas">
                <div v-for="t in TRANSPORTES" :key="t.key" class="tr-mode">
                  <label class="ctrl">
                    <input type="checkbox" @change="loadTransport(t, ($event.target as HTMLInputElement).checked)">
                    <span class="tr-swatch" :style="{ background: t.color }"></span>
                    <span>{{ t.label }}</span>
                    <span v-if="transportStatus[t.key] === 'loading'" class="tr-status">cargando…</span>
                    <span v-else-if="transportStatus[t.key] === 'error'" class="tr-status tr-err">error</span>
                  </label>
                  <div v-if="transportLines[t.key] && transportLines[t.key].length" class="tr-lines">
                    <!-- Control masivo: todas/ninguna + contador; el bus además expande su lista -->
                    <div class="tr-toolbar">
                      <button type="button" class="tr-mini" @click="setAllLines(t.key, true)">Todas</button>
                      <button type="button" class="tr-mini" @click="setAllLines(t.key, false)">Ninguna</button>
                      <span class="tr-count">{{ (transportSelected[t.key] || []).length }}/{{ transportLines[t.key].length }}</span>
                      <button v-if="t.key === 'bus'" type="button" class="tr-mini tr-expand" @click="busExpanded = !busExpanded" :aria-expanded="busExpanded">
                        {{ busExpanded ? 'Ocultar lista' : 'Ver todas' }}
                      </button>
                    </div>
                    <input v-if="t.key === 'bus'" v-model="busSearch" class="tr-search" type="text" placeholder="Buscar línea de bus…">
                    <div class="tr-chips">
                      <button v-for="l in chipsFor(t.key)" :key="l.ref" type="button"
                        class="tr-chip" :class="{ off: !(transportSelected[t.key] || []).includes(l.ref) }"
                        :style="{ '--c': l.colour || t.color }"
                        @click="toggleLine(t.key, l.ref)">{{ l.ref }}</button>
                      <span v-if="t.key === 'bus' && !busSearch && !busExpanded" class="tr-hint-inline">escribe para filtrar, o toca «Ver todas»</span>
                    </div>
                  </div>
                </div>
                <p class="capas-layer-h" style="padding-left:2px">Recorridos reales de OpenStreetMap. Activa un modo y elige qué líneas mostrar.</p>
              </div>
            </div>

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
  </SectionCard>
</template>
