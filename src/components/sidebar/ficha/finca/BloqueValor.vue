<script setup lang="ts">
// Bloque "Valor de mercado": alquiler medio REAL de la ciudad (Incasòl) + dos puntos de
// referencia contrastables (Valor de Referencia de la finca y alquiler por barrio).
import { useFinca } from '../../../../composables/useFinca'
import FichaDoc from '../FichaDoc.vue'

const { valorZona, deepLinks, zonaLinks } = useFinca()
</script>

<template>
  <div class="ficha-block">
    <div class="ficha-block-head">
      <span class="ficha-block-title">Valor de mercado</span>
      <span class="ficha-source">FUENTE · Incasòl</span>
    </div>
    <div class="ficha-mercado">
      <div class="ficha-yield">
        <span class="ficha-yield-k">Alquiler medio · Barcelona</span>
        <span class="ficha-yield-v"><template v-if="valorZona">{{ valorZona.renda.toLocaleString('es-ES') }}<small> €/mes</small></template><template v-else>—</template></span>
        <span v-if="valorZona" class="ficha-yield-foot">{{ valorZona.any }} · {{ valorZona.contratos.toLocaleString('es-ES') }} contratos depositados</span>
      </div>
    </div>
    <!-- Punto de referencia 1: valor por finca (portal oficial, con identificación) -->
    <FichaDoc :href="deepLinks.valorRef" titulo="Valor de Referencia de esta finca"
      desc="Base del impuesto ITP · Sede del Catastro (requiere identificarse)" />
    <!-- Punto de referencia 2: precios por barrio (contrastar) -->
    <FichaDoc :href="zonaLinks.incasolLloguer" titulo="Alquiler por barrio (Incasòl)"
      desc="Fianzas depositadas, detalle por distrito y barrio" badge="abrir 🔗" />
    <div class="ficha-note-sm">Alquiler medio de la ciudad (dato real, no del inmueble). El precio de venta (€/m²) y el detalle por barrio entran cuando reviva Open Data BCN.</div>
  </div>
</template>
