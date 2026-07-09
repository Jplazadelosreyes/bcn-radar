<script setup lang="ts">
// Átomo del dossier: bloque de "veredicto" con punto de color, título y descripción.
// Se repite en todos los niveles (marco legal de ciudad, claves de sistema, lectura crítica).
// El tono (blue/amber/green/red) tiñe el punto y el borde vía la clase `ver-<tone>` (CSS global).
import type { VerTone } from '../../../composables/useFinca'
defineProps<{
  tone: VerTone
  titulo: string
  desc: string
}>()
</script>

<template>
  <div class="ver" :class="'ver-' + tone">
    <span class="ver-dot"></span>
    <div class="ver-body">
      <span class="ver-titulo">{{ titulo }}</span>
      <span class="ver-desc">{{ desc }}</span>
    </div>
  </div>
</template>
