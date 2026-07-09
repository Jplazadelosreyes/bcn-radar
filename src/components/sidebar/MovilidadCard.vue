<script setup lang="ts">
// Sección "Movilidad y servicios": card contenedora que compone dos sub-secciones, cada una
// con su responsabilidad y su store — transporte público (TransporteSection) y capas de datos
// abiertos (CapasDatosSection).
import SectionCard from './SectionCard.vue'
import TransporteSection from './movilidad/TransporteSection.vue'
import CapasDatosSection from './movilidad/CapasDatosSection.vue'

defineProps<{ open: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <SectionCard ico="🚌" title="Movilidad y servicios" :open="open" body-class="capas-body" @toggle="$emit('toggle')">
    <p class="capas-intro">Datos abiertos oficiales, en vivo. Se cargan solo al activarlos.</p>
    <TransporteSection />
    <CapasDatosSection />
  </SectionCard>
</template>
