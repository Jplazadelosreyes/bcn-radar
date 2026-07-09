<script setup lang="ts">
// NIVEL 3: SECCIÓN CENSAL — micro-entorno: renta, demografía y presión turística.
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
      <div class="ficha-crumb"><span class="ficha-crumb-hi">{{ mapContext.barrioName || 'Barcelona' }}</span><span class="ficha-crumb-sep">›</span>sección censal</div>
      <h2 class="ficha-address ficha-crumb-mono" style="font-size:20px">{{ mapContext.seccionCode || 'Selecciona una sección' }}</h2>
      <p class="ficha-note-sm" style="margin-top:7px">El micro-entorno: renta, demografía y presión turística de unas pocas manzanas. Haz clic en cualquier calle para ver la finca.</p>
    </div>

    <div class="ficha-block">
      <div class="ficha-block-head">
        <span class="ficha-block-title">Qué mide una sección</span>
      </div>
      <Veredicto tone="blue" titulo="Renta y perfil del hogar"
        desc="La sección censal es la unidad más fina con datos de renta del INE. Te da el poder adquisitivo real del vecindario inmediato, no la media del barrio." />
    </div>

    <div class="ficha-block">
      <div class="ficha-block-head">
        <span class="ficha-block-title">Fuentes oficiales de la sección</span>
        <span class="ficha-source">INE · Ajuntament</span>
      </div>
      <FichaDoc :href="zonaLinks.ineAtlasRenta" titulo="Atlas de renta (INE)"
        desc="Renta media por persona y hogar, por sección" badge="abrir 🔗" />
      <FichaDoc :href="zonaLinks.hutb" titulo="Pisos turísticos (HUT)"
        desc="Licencias activas en estas manzanas" />
      <FichaDoc :href="zonaLinks.portalDades" titulo="Padrón y demografía"
        desc="Densidad poblacional · Barcelona Dades" badge="abrir 🔗" />
    </div>
  </div>
</template>
