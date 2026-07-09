<script setup lang="ts">
// Sub-sección "Transporte público" de Movilidad: explorador de parada (GTFS, useExploradorParadas)
// + líneas reales por modo con control masivo y chips (Overpass, useTransporteModos).
import { useTransporteModos } from '../../../composables/useTransporteModos'
import { useExploradorParadas } from '../../../composables/useExploradorParadas'

const {
  TRANSPORTES,
  transportStatus, transportLines, transportSelected, busSearch, busExpanded,
  chipsFor, setAllLines, toggleLine, loadTransport,
} = useTransporteModos()

const { transitOn, transitStatus, toggleTransit } = useExploradorParadas()
</script>

<template>
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

    <!-- Recorridos por modo (líneas reales OSM/Overpass) -->
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
</template>
