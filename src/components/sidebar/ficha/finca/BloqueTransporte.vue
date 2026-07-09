<script setup lang="ts">
// Bloque "Transporte en tu radio": paradas dentro del radio de la finca (useRadio).
// El padre solo lo monta si hay paradas; aquí asumimos radioStops.length > 0.
import { useRadio } from '../../../../composables/useRadio'

const { radioLabel, radioStops, focusStop, comoLlegar } = useRadio()
</script>

<template>
  <div class="ficha-block">
    <div class="ficha-block-head">
      <span class="ficha-block-title">Transporte en tu radio</span>
      <span class="ficha-source">{{ radioLabel }} · {{ radioStops.length }} paradas</span>
    </div>
    <div class="radio-stop" v-for="(s, i) in radioStops.slice(0, 40)" :key="i">
      <button class="radio-stop-main" type="button" @click="focusStop(s)">
        <span class="radio-stop-dot" :style="{ background: s.color }"></span>
        <span class="radio-stop-name">{{ s.name }}<small v-if="s.lines"> · {{ s.lines }}</small></span>
        <span class="radio-stop-dist">{{ s.dist }} m</span>
      </button>
      <a class="radio-stop-go" :href="comoLlegar(s)" target="_blank" rel="noopener" title="Cómo llegar (transporte público)">↗</a>
    </div>
    <p v-if="radioStops.length > 40" class="ficha-note-sm">… y {{ radioStops.length - 40 }} más dentro del radio.</p>
  </div>
</template>
