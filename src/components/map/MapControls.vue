<script setup lang="ts">
// Panel flotante "Eines" (abajo-derecha): mapa base · vista 3D · herramientas (medir · radio).
// Todo el estado viene de sus stores (useMapTools/useRadio/useFinca/useMeasure/usePanels) → SIN props.
import { useMapTools } from '../../composables/useMapTools'
import { usePanels } from '../../composables/usePanels'
import { useSheetDrag } from '../../composables/useSheetDrag'
import { useRadio } from '../../composables/useRadio'
import { useFinca } from '../../composables/useFinca'
import { useMeasure } from '../../composables/useMeasure'

const { basemap, edificios3d, relieve3d, setBasemap, toggleEdificios3d, toggleRelieve3d } = useMapTools()
const { controlsOpen } = usePanels()
const { start: sheetTouchStart, move: sheetTouchMove, end: sheetTouchEnd } = useSheetDrag()
const { radioOn, radioMetros, radioLabel } = useRadio()
const { clickedCoords } = useFinca()
const { measureTotal, measuring, setMeasuring, clear: clearMeasure } = useMeasure()
</script>

<template>
  <div class="map-floating-controls" :class="{ open: controlsOpen }">
    <button class="sheet-handle" @click="controlsOpen = false" @touchstart.passive="sheetTouchStart" @touchmove.passive="sheetTouchMove" @touchend="(e) => sheetTouchEnd(e, () => (controlsOpen = false))" title="Cerrar" aria-label="Cerrar panel"><span></span></button>
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
        <label class="ctrl"><input type="checkbox" :checked="measuring" @change="setMeasuring(($event.target as HTMLInputElement).checked)"><span>Medir distancia</span></label>
      </div>
      <div v-if="measureTotal" class="measure-readout">
        <span class="measure-total">{{ measureTotal }}</span>
        <button class="measure-clear" type="button" @click="clearMeasure()">Limpiar</button>
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
