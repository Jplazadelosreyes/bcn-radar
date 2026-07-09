<script setup lang="ts">
// Bloque "Cumplimiento": accesos para verificar Cédula de habitabilidad y Certificado
// energético (CEE) con la ref. de inmueble (20).
import { useFinca } from '../../../../composables/useFinca'
import FichaDoc from '../FichaDoc.vue'

const { deepLinks } = useFinca()
</script>

<template>
  <div class="ficha-block">
    <div class="ficha-block-head"><span class="ficha-block-title">Cumplimiento</span></div>
    <FichaDoc :href="deepLinks.cedula" titulo="Cédula de habitabilidad"
      desc="Búscala con la ref. de inmueble (20)" />
    <FichaDoc :href="deepLinks.cee" titulo="Certificado energético (CEE)"
      desc="Búscalo con la ref. de inmueble (20)" />
  </div>
</template>
