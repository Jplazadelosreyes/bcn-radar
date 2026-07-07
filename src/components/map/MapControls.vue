<script setup>
// Panel flotante "Eines" (abajo-derecha): mapa base · vista 3D · herramientas (medir · radio).
// Basemap y 3D vienen del store useMapTools (sin props). Radio y medir aún son estado
// compartido en App.vue → llegan por props/emits hasta que migren a store (deuda anotada).
import { useMapTools } from '../../composables/useMapTools.js'
import { usePanels } from '../../composables/usePanels.js'

defineProps({
  radioLabel: { type: String, default: '' },
  clickedCoords: { type: Object, default: null },
  measureTotal: { type: [String, Number], default: null },
  // Handlers de arrastre del asa del sheet (compartidos; futuro composable useSheetDrag)
  onSheetStart: { type: Function, default: () => {} },
  onSheetMove: { type: Function, default: () => {} },
  onSheetEnd: { type: Function, default: () => {} },
})
const radioOn = defineModel('radioOn', { type: Boolean, default: false })
const radioMetros = defineModel('radioMetros', { type: Number, default: 500 })

const { basemap, edificios3d, relieve3d, setBasemap, toggleEdificios3d, toggleRelieve3d } = useMapTools()
const { controlsOpen } = usePanels()
</script>

<template>
  <div class="map-floating-controls" :class="{ open: controlsOpen }">
    <button class="sheet-handle" @click="controlsOpen = false" @touchstart.passive="onSheetStart" @touchmove.passive="onSheetMove" @touchend="(e) => onSheetEnd(e, () => (controlsOpen = false))" title="Cerrar" aria-label="Cerrar panel"><span></span></button>
    <button class="panel-close" @click="controlsOpen = false" title="Cerrar">✕</button>
    <div class="control-section">
      <h4>Mapa base</h4>
      <div class="control-group">
        <label class="ctrl"><input type="radio" name="mapStyle" :checked="basemap==='calle'" @change="setBasemap('calle')"><span>Callejero</span></label>
        <label class="ctrl"><input type="radio" name="mapStyle" :checked="basemap==='satelite'" @change="setBasemap('satelite')"><span>Satélite</span></label>
        <label class="ctrl"><input type="radio" name="mapStyle" :checked="basemap==='orto-icgc'" @change="setBasemap('orto-icgc')"><span>Ortofoto ICGC</span></label>
        <label class="ctrl"><input type="radio" name="mapStyle" :checked="basemap==='relieve'" @change="setBasemap('relieve')"><span>Relieve (altura)</span></label>
      </div>
    </div>

    <hr class="divider">

    <div class="control-section">
      <h4>Vista 3D</h4>
      <div class="control-group">
        <label class="ctrl"><input type="checkbox" :checked="relieve3d" @change="toggleRelieve3d()"><span>Relieve 3D (altura real)</span></label>
        <label class="ctrl"><input type="checkbox" :checked="edificios3d" @change="toggleEdificios3d()"><span>Edificios 3D</span></label>
      </div>
      <p class="ctrl-hint">Activa los dos y verás Barcelona en volumen: montañas y edificios. Arrastra con clic derecho (o Ctrl+arrastrar) para rotar e inclinar.</p>
    </div>

    <hr class="divider">

    <div class="control-section">
      <h4>Herramientas</h4>
      <div class="control-group">
        <label class="ctrl"><input type="checkbox" id="check-measure" value="measure"><span>Medir distancia</span></label>
      </div>
      <div v-if="measureTotal" class="measure-readout">
        <span class="measure-total">{{ measureTotal }}</span>
        <button id="btn-measure-clear" class="measure-clear" type="button">Limpiar</button>
      </div>
      <p class="ctrl-hint">Haz clic en el mapa para marcar puntos; la distancia se suma tramo a tramo.</p>

      <div class="control-group" style="margin-top:11px">
        <label class="ctrl"><input type="checkbox" v-model="radioOn"><span>Radio desde la finca</span></label>
      </div>
      <div v-if="radioOn" class="radio-ctl">
        <template v-if="clickedCoords">
          <div class="radio-row">
            <input type="range" min="100" max="2000" step="50" v-model.number="radioMetros" class="radio-slider">
            <span class="radio-val">{{ radioLabel }}</span>
          </div>
        </template>
        <p v-else class="ctrl-hint">Selecciona una finca en el mapa para fijar el centro del radio.</p>
      </div>
    </div>
  </div>
</template>
