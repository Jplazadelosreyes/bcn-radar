<script setup lang="ts">
// NIVEL 2: BARRIO — donde se decide la compra: mercado, rentabilidad y entorno con fuente.
import { useMapStore } from '../../../composables/useMapStore'
import { useFinca } from '../../../composables/useFinca'
import Veredicto from './FichaVeredicto.vue'
import FichaDoc from './FichaDoc.vue'

const { mapContext } = useMapStore()
const { zonaLinks } = useFinca()
</script>

<template>
  <div class="context-panel">
    <div class="ficha-header">
      <div class="ficha-crumb"><span class="ficha-crumb-hi">{{ mapContext.distritoName || 'Barcelona' }}</span><span class="ficha-crumb-sep">›</span>barrio</div>
      <h2 class="ficha-address">{{ mapContext.barrioName || 'Selecciona un barrio' }}</h2>
      <p class="ficha-note-sm" style="margin-top:7px">El barrio es donde se decide la compra: mercado, entorno y servicios. Haz clic para ver las secciones censales.</p>
    </div>

    <div class="ficha-block">
      <div class="ficha-block-head">
        <span class="ficha-block-title">Rentabilidad · cómo calcularla</span>
      </div>
      <Veredicto tone="blue" titulo="Yield bruto = alquiler anual ÷ precio de compra"
        desc="Cruza el alquiler medio y el precio de venta del barrio (fuentes abajo). El resultado te dice si conviene comprar para vivir o para alquilar (buy-to-let)." />
    </div>

    <div class="ficha-block">
      <div class="ficha-block-head">
        <span class="ficha-block-title">Fuentes oficiales del barrio</span>
        <span class="ficha-source">Open Data · Generalitat</span>
      </div>
      <FichaDoc :href="zonaLinks.lloguerBarris" titulo="Precio de alquiler por barrios"
        desc="Estimación mensual · Open Data BCN" badge="abrir 🔗" />
      <FichaDoc :href="zonaLinks.incasolLloguer" titulo="Alquiler medio oficial (INCASÒL)"
        desc="Fianzas depositadas, por barrio" />
      <FichaDoc :href="zonaLinks.hutb" titulo="Pisos turísticos (HUT)"
        desc="Densidad de licencias activas en la zona" />
    </div>
  </div>
</template>
