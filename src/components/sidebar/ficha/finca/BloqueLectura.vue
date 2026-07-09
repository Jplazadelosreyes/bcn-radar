<script setup lang="ts">
// Bloque "Lectura crítica": la síntesis de qué significan los datos para el comprador
// (veredictos derivados en useFinca). El padre solo lo monta si hay veredictos.
import { useFinca } from '../../../../composables/useFinca'
import FichaVeredicto from '../FichaVeredicto.vue'

const { veredictos } = useFinca()
</script>

<template>
  <div class="ficha-block">
    <div class="ficha-block-head">
      <span class="ficha-block-title">Lectura crítica</span>
      <span class="ficha-source">BCN Radar</span>
    </div>
    <div class="ficha-lectura">
      <FichaVeredicto v-for="(ver, i) in veredictos" :key="i" :tone="ver.tone" :titulo="ver.titulo" :desc="ver.desc" />
    </div>
  </div>
</template>
