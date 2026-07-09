<script setup lang="ts">
// GRUPO 2 · Privado / due diligence: lo que no es dato público y aporta el vendedor —
// gastos ordinarios (a solicitar), checklist del comprador y enlaces de interés de la finca.
import { useFinca } from '../../../../composables/useFinca'

const { deepLinks, checklistComprador } = useFinca()
</script>

<template>
  <div>
    <div class="ficha-grouptag">Privado · a solicitar al propietario</div>

    <div class="ficha-block">
      <div class="ficha-block-head"><span class="ficha-block-title">Gastos ordinarios</span></div>
      <div class="ficha-gasto-row"><span>IBI (anual)</span><span class="ficha-na">a solicitar</span></div>
      <div class="ficha-gasto-row"><span>Comunidad (mes)</span><span class="ficha-na">a solicitar</span></div>
      <div class="ficha-gasto-row"><span>Tasa de basuras</span><span class="ficha-na">a solicitar</span></div>
      <div class="ficha-note-sm">No los inventamos: dependen del inmueble y los aporta el vendedor.</div>
    </div>

    <!-- Checklist del comprador -->
    <div class="ficha-block">
      <div class="ficha-block-head"><span class="ficha-block-title">Checklist del comprador</span></div>
      <p class="ficha-note-sm">Papeles a exigir al propietario antes de firmar arras o ir a notaría:</p>
      <div class="ficha-check" v-for="(d, i) in checklistComprador" :key="i">
        <div class="ficha-check-head">
          <span class="ficha-check-t">{{ d.icono }} {{ d.titulo }}</span>
          <a v-if="d.url" class="ficha-verify-sm" :href="d.url" target="_blank" rel="noopener">🔗</a>
        </div>
        <p class="ficha-check-d">{{ d.desc }}</p>
      </div>
    </div>

    <!-- Enlaces de interés -->
    <div class="ficha-block">
      <div class="ficha-block-head"><span class="ficha-block-title">Enlaces de la finca</span></div>
      <a class="ficha-link" :href="deepLinks.indiceAlquiler" target="_blank" rel="noopener">
        <span class="ficha-link-t">📈 Índice de referencia de alquiler</span>
        <span class="ficha-link-d">Tope legal de la renta para esta zona (Ley de Vivienda).</span>
      </a>
      <a class="ficha-link" :href="deepLinks.hutb" target="_blank" rel="noopener">
        <span class="ficha-link-t">🧳 Licencias turísticas (HUTB)</span>
        <span class="ficha-link-d">Comprueba si hay viviendas de uso turístico cerca.</span>
      </a>
    </div>
  </div>
</template>
