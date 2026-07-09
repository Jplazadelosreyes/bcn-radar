<script setup lang="ts">
// NIVEL 1: DISTRITO — foto media + accesos a la estadística oficial del distrito.
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
      <div class="ficha-crumb"><span class="ficha-crumb-hi">Barcelona</span><span class="ficha-crumb-sep">›</span>distrito</div>
      <h2 class="ficha-address">{{ mapContext.distritoName || 'Selecciona un distrito' }}</h2>
      <p class="ficha-note-sm" style="margin-top:7px">Compara este distrito con la media de la ciudad. Haz clic en un barrio para bajar de nivel.</p>
    </div>

    <div class="ficha-block">
      <div class="ficha-block-head">
        <span class="ficha-block-title">Qué mirar en un distrito</span>
      </div>
      <Veredicto tone="blue" titulo="Precio medio y liquidez"
        desc="El distrito da la foto agregada: precio €/m² frente a la media de la ciudad y cuánta oferta se mueve. Sirve para descartar zonas, no para decidir un piso concreto." />
    </div>

    <div class="ficha-block">
      <div class="ficha-block-head">
        <span class="ficha-block-title">Fuentes oficiales</span>
        <span class="ficha-source">Ajuntament · Generalitat</span>
      </div>
      <FichaDoc :href="zonaLinks.portalDades" titulo="Barcelona Dades"
        desc="Estadística por distrito y barrio · Ajuntament" badge="abrir 🔗" />
      <FichaDoc :href="zonaLinks.incasolLloguer" titulo="Alquiler medio oficial (INCASÒL)"
        desc="Fianzas depositadas, por distrito y barrio" />
      <FichaDoc :href="zonaLinks.idescatEmex" titulo="Barcelona en cifras (Idescat)"
        desc="Población, renta y actividad económica" badge="abrir 🔗" />
    </div>
  </div>
</template>
