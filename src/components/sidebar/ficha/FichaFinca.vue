<script setup lang="ts">
// NIVEL 4: FINCA (CATASTRO) — orquestador del dossier de la parcela. Cabecera + estado vacío
// + montaje de los bloques (cada uno en ./finca/, consume useFinca por su cuenta) + acciones.
// La lógica de fetch la dispara el setup del mapa y escribe los stores; esto es presentacional.
import { useMapStore } from '../../../composables/useMapStore'
import { useFinca } from '../../../composables/useFinca'
import { useRadio } from '../../../composables/useRadio'
import BloqueCatastro from './finca/BloqueCatastro.vue'
import BloqueTransporte from './finca/BloqueTransporte.vue'
import BloquePIU from './finca/BloquePIU.vue'
import BloqueCumplimiento from './finca/BloqueCumplimiento.vue'
import BloqueLectura from './finca/BloqueLectura.vue'
import BloqueValor from './finca/BloqueValor.vue'
import BloquePrivado from './finca/BloquePrivado.vue'

const { mapContext } = useMapStore()
const { fincaData, selectedAddress, satelliteThumb, veredictos } = useFinca()
const { radioStops } = useRadio()

// Exportar informe (stub de portafolio: en producción generaría el PDF con branding).
const exportReport = () => {
  alert('Generando Informe Oficial en PDF...\nEn el producto final, esto enviará un email al reclutador con el branding de la empresa.')
}
</script>

<template>
  <div class="context-panel">
    <div v-if="selectedAddress" class="ficha-header">
      <div class="ficha-crumb">
        <span v-if="mapContext.barrioName" class="ficha-crumb-hi">{{ mapContext.barrioName }}</span>
        <template v-if="mapContext.distritoName"><span class="ficha-crumb-sep">›</span>{{ mapContext.distritoName }}</template>
        <template v-if="mapContext.seccionCode"><span class="ficha-crumb-sep">›</span><span class="ficha-crumb-mono">{{ mapContext.seccionCode }}</span></template>
        <template v-if="!mapContext.barrioName">Barcelona · Catastro en vivo</template>
      </div>
      <div class="ficha-head-row">
        <div class="ficha-head-main">
          <h2 class="ficha-address">{{ selectedAddress }}</h2>
          <div v-if="fincaData.refCatastral" class="ficha-ref">
            <span class="ficha-ref-label">Ref. parcela</span>
            <span class="ficha-ref-value">{{ fincaData.refCatastral }}</span>
          </div>
        </div>
        <img v-if="satelliteThumb" :src="satelliteThumb" class="ficha-thumb" alt="Vista satélite de la parcela" />
      </div>
    </div>
    <div v-else class="panel-head ficha-empty-head">
      <div class="panel-crumb">Nivel finca</div>
      <h2 class="panel-title">Explorador de fincas</h2>
    </div>

    <div v-if="!selectedAddress" class="empty-state">
      <div class="empty-pin">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2D5BD0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"></path><circle cx="12" cy="9" r="2.4"></circle></svg>
      </div>
      <p>Haz clic en cualquier parcela del mapa para cargar los datos en vivo del Catastro y las afectaciones urbanísticas (PIU).</p>
    </div>

    <div v-else>
      <!-- ===== GRUPO 1: DATOS OFICIALES (CONTRASTABLES) ===== -->
      <BloqueCatastro />

      <!-- Resto del dossier solo si hay datos catastrales -->
      <template v-if="fincaData.estado === 'ok'">
        <BloqueTransporte v-if="radioStops.length" />
        <BloquePIU />
        <BloqueCumplimiento />
        <BloqueLectura v-if="veredictos.length" />
        <BloqueValor />
        <BloquePrivado />
      </template>

      <!-- Acciones -->
      <div class="action-buttons">
        <button class="export-btn" @click="exportReport">Generar informe (PDF)</button>
      </div>
    </div>
  </div>
</template>
