<script setup lang="ts">
// Bloque Catastro del dossier de finca: referencias registrales (parcela/inmueble) + KPIs
// físicos. Gestiona sus propios estados de carga (cargando/ok/sin-parcela/error).
import { useFinca } from '../../../../composables/useFinca'

const { fincaData, antiguedad, supUtilEstimada, deepLinks, copiar } = useFinca()
</script>

<template>
  <div class="ficha-block">
    <div class="ficha-block-head">
      <span class="ficha-block-title">Catastro</span>
      <span class="ficha-source">FUENTE · Catastro</span>
    </div>

    <div v-if="fincaData.estado === 'cargando'" class="ficha-grid">
      <div v-for="n in 6" :key="n" class="ficha-cell"><span class="skeleton"></span></div>
    </div>

    <template v-else-if="fincaData.estado === 'ok'">
      <!-- Referencias registrales: la llave maestra -->
      <div class="ficha-reg">
        <div class="ficha-reg-row">
          <span class="ficha-reg-k">Parcela (14)</span>
          <span class="ficha-reg-rc">{{ fincaData.refCatastral }}</span>
          <button class="ficha-copy" @click="copiar(fincaData.refCatastral)" title="Copiar parcela">⧉</button>
        </div>
        <div v-if="fincaData.rcInmueble" class="ficha-reg-row">
          <span class="ficha-reg-k">Inmueble (20)</span>
          <span class="ficha-reg-rc">{{ fincaData.rcInmueble }}</span>
          <button class="ficha-copy" @click="copiar(fincaData.rcInmueble)" title="Copiar inmueble">⧉</button>
        </div>
        <a class="ficha-verify" :href="deepLinks.catastro" target="_blank" rel="noopener">🔗 Verificar en Sede del Catastro</a>
      </div>

      <!-- KPIs físicos -->
      <div class="ficha-grid">
        <div class="ficha-cell">
          <span class="ficha-k">Año constr.</span>
          <span class="ficha-v">{{ fincaData.ano ?? '—' }}</span>
          <span v-if="antiguedad" class="ficha-sub">{{ antiguedad }} años</span>
        </div>
        <div class="ficha-cell">
          <span class="ficha-k">Sup. constr.</span>
          <span class="ficha-v"><template v-if="fincaData.superficie">{{ fincaData.superficie }}<small> m²</small></template><template v-else>—</template></span>
          <span v-if="fincaData.superficie" class="ficha-sub">{{ (fincaData.nInmuebles ?? 0) > 1 ? 'unidad ref.' : 'construida' }}</span>
        </div>
        <div class="ficha-cell">
          <span class="ficha-k">Sup. útil est.</span>
          <span class="ficha-v"><template v-if="supUtilEstimada">{{ supUtilEstimada }}<small> m²</small></template><template v-else>—</template></span>
          <span v-if="supUtilEstimada" class="ficha-sub">estimada</span>
        </div>
        <div class="ficha-cell">
          <span class="ficha-k">Plantas</span>
          <span class="ficha-v">{{ fincaData.plantas ?? '—' }}</span>
        </div>
        <div class="ficha-cell">
          <span class="ficha-k">Inmuebles</span>
          <span class="ficha-v">{{ fincaData.nInmuebles ?? '—' }}</span>
          <span v-if="fincaData.nInmuebles" class="ficha-sub">en la finca</span>
        </div>
        <div class="ficha-cell">
          <span class="ficha-k">Uso princ.</span>
          <span class="ficha-v ficha-v-sm">{{ fincaData.uso ?? '—' }}</span>
        </div>
      </div>
    </template>

    <div v-else-if="fincaData.estado === 'sin-parcela'" class="ficha-msg">
      Sin parcela catastral en este punto. Prueba sobre un edificio.
    </div>
    <div v-else-if="fincaData.estado === 'error'" class="ficha-msg ficha-msg-err">
      No se pudo consultar el Catastro. Reintenta el clic.
    </div>
  </div>
</template>
