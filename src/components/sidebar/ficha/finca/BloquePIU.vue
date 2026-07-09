<script setup lang="ts">
// Bloque "Situación urbanística" (PIU · GetFeatureInfo en vivo): calificación de la parcela,
// detalle de planeamiento, veredicto automático por clave de sistema y afectaciones reales.
import { useFinca } from '../../../../composables/useFinca'
import FichaVeredicto from '../FichaVeredicto.vue'

const { afectaciones, classific, claveSistema, deepLinks } = useFinca()
</script>

<template>
  <div class="ficha-block">
    <div class="ficha-block-head">
      <span class="ficha-block-title">Situación urbanística</span>
      <span class="ficha-source">FUENTE · PIU · Ajuntament</span>
    </div>

    <div v-if="afectaciones.estado === 'cargando'" class="ficha-grid">
      <div v-for="n in 4" :key="n" class="ficha-cell"><span class="skeleton"></span></div>
    </div>

    <div v-else-if="afectaciones.estado === 'error'" class="ficha-msg ficha-msg-err">
      No se pudo consultar el PIU. Reintenta el clic.
    </div>

    <template v-else-if="afectaciones.estado === 'ok'">
      <!-- Calificación: la clave que manda -->
      <div v-if="afectaciones.qualificacio" class="piu-clau">
        <div class="piu-clau-tag">{{ afectaciones.qualificacio.clau || '—' }}</div>
        <div class="piu-clau-body">
          <span class="piu-clau-nom">{{ afectaciones.qualificacio.nom || 'Calificación urbanística' }}</span>
          <span v-if="classific(afectaciones.qualificacio.classific)" class="piu-clau-sub">{{ classific(afectaciones.qualificacio.classific) }}</span>
        </div>
      </div>
      <div v-else class="ficha-msg">Sin calificación en este punto. Prueba sobre el centro de la parcela.</div>

      <!-- Detalle del planeamiento -->
      <div v-if="afectaciones.qualificacio" class="piu-meta">
        <div v-if="afectaciones.qualificacio.pla" class="piu-meta-row"><span>Plan</span><b>{{ afectaciones.qualificacio.pla }}</b></div>
        <div v-if="afectaciones.qualificacio.familia" class="piu-meta-row"><span>Familia</span><b>{{ afectaciones.qualificacio.familia }}</b></div>
        <div v-if="afectaciones.qualificacio.sector" class="piu-meta-row"><span>Sector</span><b>{{ afectaciones.qualificacio.sector }}</b></div>
      </div>

      <!-- Veredicto automático si la clave es de sistema (riesgo) -->
      <FichaVeredicto v-if="claveSistema" :tone="claveSistema.tone" :titulo="claveSistema.titulo" :desc="claveSistema.desc" style="margin-top:9px" />

      <!-- Suspensión de licencias: bandera roja real -->
      <div v-if="afectaciones.suspensions.length" class="piu-afec piu-afec-red">
        <span class="piu-afec-h">⛔ Suspensión de licencias ({{ afectaciones.suspensions.length }})</span>
        <span v-for="(s, i) in afectaciones.suspensions" :key="i" class="piu-afec-item">{{ s.desc || s.codi }}</span>
      </div>

      <!-- Planeamiento en trámite: lo que viene -->
      <div v-if="afectaciones.tramits.length" class="piu-afec piu-afec-amber">
        <span class="piu-afec-h">⏳ Planeamiento en trámite ({{ afectaciones.tramits.length }})</span>
        <span v-for="(s, i) in afectaciones.tramits" :key="i" class="piu-afec-item">{{ s.desc || s.codi }}</span>
      </div>

      <!-- Planeamiento aprobado que afecta -->
      <div v-if="afectaciones.aprovats.length" class="piu-afec">
        <span class="piu-afec-h">📋 Planeamiento aprobado ({{ afectaciones.aprovats.length }})</span>
        <span v-for="(s, i) in afectaciones.aprovats" :key="i" class="piu-afec-item">{{ s.desc || s.codi }}</span>
      </div>
    </template>

    <!-- Contraste en la fuente oficial -->
    <a class="ficha-cta" :href="deepLinks.piu" target="_blank" rel="noopener">
      Ver la ficha completa en el PIU oficial →
    </a>
  </div>
</template>
