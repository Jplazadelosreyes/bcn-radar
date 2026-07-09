<script setup lang="ts">
// NIVEL 0: CIUDAD — marco legal real de toda Barcelona (hub de fuentes oficiales).
// Contenido estático + enlaces de ciudad (useFinca). No depende de una parcela seleccionada.
import { useFinca } from '../../../composables/useFinca'
import Veredicto from './FichaVeredicto.vue'
import FichaDoc from './FichaDoc.vue'

const { ciudadLinks } = useFinca()
</script>

<template>
  <div class="context-panel">
    <div class="ficha-header">
      <div class="ficha-crumb">Barcelona · marco legal de ciudad</div>
      <h2 class="ficha-address">Barcelona</h2>
      <p class="ficha-note-sm" style="margin-top:7px">Reglas que aplican a toda la ciudad. Haz clic en un distrito para bajar de nivel.</p>
    </div>

    <!-- Alquiler: zona tensionada -->
    <div class="ficha-block">
      <div class="ficha-block-head">
        <span class="ficha-block-title">Régimen de alquiler</span>
        <span class="ficha-source">Ley Vivienda · Generalitat</span>
      </div>
      <Veredicto tone="amber" titulo="Toda Barcelona es zona tensionada"
        desc="El alquiler de vivienda habitual está topado por el índice de referencia. Si compras para alquilar, calcula el máximo legal antes de cerrar números." />
      <a class="ficha-cta" :href="ciudadLinks.indiceAlquiler" target="_blank" rel="noopener">Índice de alquiler · Generalitat →</a>
      <FichaDoc :href="ciudadLinks.serpavi" titulo="Sistema estatal de referencia (SERPAVI)"
        desc="Calcula el alquiler máximo permitido" />
    </div>

    <!-- Comprar: ITP -->
    <div class="ficha-block">
      <div class="ficha-block-head">
        <span class="ficha-block-title">Comprar · Impuesto ITP</span>
        <span class="ficha-source">ATC · Generalitat</span>
      </div>
      <Veredicto tone="blue" titulo="ITP: 10 % hasta 600.000 €"
        desc="Por encima de 600.000 € se aplica una tarifa progresiva. Se calcula sobre el precio de compra o el Valor de Referencia de Catastro, el que sea mayor." />
      <div class="clave-legend">
        <div class="clave-row ok"><span class="clave-tag">5 %</span><span>Vivienda habitual de joven ≤35, familia numerosa, monoparental o con discapacidad.</span></div>
        <div class="clave-row ok"><span class="clave-tag">7 %</span><span>Vivienda habitual de protección oficial (VPO).</span></div>
      </div>
      <a class="ficha-cta" :href="ciudadLinks.itpAtc" target="_blank" rel="noopener">Tarifas oficiales ITP · ATC →</a>
    </div>

    <!-- Financiación: Aval ICO -->
    <div class="ficha-block">
      <div class="ficha-block-head">
        <span class="ficha-block-title">Financiación · Aval ICO</span>
        <span class="ficha-source">ICO · Mº Vivienda</span>
      </div>
      <Veredicto tone="green" titulo="Aval del Estado de hasta el 20 %"
        desc="Para menores de 35 o con menores a cargo en su primera vivienda: el aval cubre la entrada y permite hipoteca de hasta el 100 % (25 % si el CEE es D o superior)." />
      <Veredicto tone="amber" titulo="En pausa durante 2026"
        desc="La firma de nuevos avales está temporalmente parada a la espera de la addenda de prórroga (vigente hasta 2027). Confírmalo con tu banco." />
      <a class="ficha-cta" :href="ciudadLinks.avalIco" target="_blank" rel="noopener">Línea de avales ICO →</a>
    </div>

    <!-- Hub de fuentes abiertas -->
    <div class="ficha-block">
      <div class="ficha-block-head"><span class="ficha-block-title">Fuentes abiertas de ciudad</span></div>
      <FichaDoc :href="ciudadLinks.openData" titulo="Open Data BCN"
        desc="Portal de datos abiertos del Ajuntament" badge="abrir 🔗" />
      <p class="ficha-note-sm">Baja a un distrito o barrio para ver datos de mercado y entorno con su fuente.</p>
    </div>
  </div>
</template>
