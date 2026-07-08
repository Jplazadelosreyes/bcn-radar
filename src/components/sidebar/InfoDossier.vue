<script setup lang="ts">
// Dossier contextual de la finca (Información): sigue el nivel de zoom
// ciudad → distrito → barrio → sección → finca. Consume useFinca (datos + derivados),
// useRadio (paradas cercanas) y mapContext (nivel de drill). Presentacional respecto al
// mapa: la lógica de fetch la dispara el setup del mapa y escribe los stores.
import { computed } from 'vue'
import SectionCard from './SectionCard.vue'
import { useMapStore } from '../../composables/useMapStore'
import { useFinca } from '../../composables/useFinca'
import { useRadio } from '../../composables/useRadio'

defineProps<{ open: boolean }>()
defineEmits<{ toggle: [] }>()

const { mapContext } = useMapStore()
const {
  fincaData, selectedAddress, afectaciones, valorZona, classific, claveSistema, satelliteThumb,
  antiguedad, supUtilEstimada, veredictos, deepLinks, ciudadLinks, zonaLinks,
  copiar, checklistComprador,
} = useFinca()
const { radioLabel, radioStops, focusStop, comoLlegar } = useRadio()

// Etiqueta contextual junto al título (nivel actual del drill).
const infoCtx = computed(() => {
  const c = mapContext.value
  if (c.level === 'distrito') return c.distritoName || 'Distrito'
  if (c.level === 'barrio') return c.barrioName || 'Barrio'
  if (c.level === 'seccion') return c.seccionCode ? `Sección ${c.seccionCode}` : 'Sección censal'
  if (c.level === 'finca') return selectedAddress.value || 'Finca'
  return 'Barcelona'
})

// Exportar informe (stub de portafolio: en producción generaría el PDF con branding).
const exportReport = () => {
  alert('Generando Informe Oficial en PDF...\nEn el producto final, esto enviará un email al reclutador con el branding de la empresa.')
}
</script>

<template>
  <SectionCard ico="📍" title="Información" :ctx="infoCtx" :open="open" @toggle="$emit('toggle')">
          <!-- NIVEL 0: CIUDAD — marco legal real de toda Barcelona (hub de fuentes oficiales) -->
          <div v-if="mapContext.level === 'ciudad'" class="context-panel">
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
              <div class="ver ver-amber">
                <span class="ver-dot"></span>
                <div class="ver-body">
                  <span class="ver-titulo">Toda Barcelona es zona tensionada</span>
                  <span class="ver-desc">El alquiler de vivienda habitual está topado por el índice de referencia. Si compras para alquilar, calcula el máximo legal antes de cerrar números.</span>
                </div>
              </div>
              <a class="ficha-cta" :href="ciudadLinks.indiceAlquiler" target="_blank" rel="noopener">Índice de alquiler · Generalitat →</a>
              <a class="ficha-doc" :href="ciudadLinks.serpavi" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Sistema estatal de referencia (SERPAVI)</span>
                  <span class="ficha-doc-d">Calcula el alquiler máximo permitido</span>
                </span>
                <span class="ficha-badge">consultar 🔗</span>
              </a>
            </div>

            <!-- Comprar: ITP -->
            <div class="ficha-block">
              <div class="ficha-block-head">
                <span class="ficha-block-title">Comprar · Impuesto ITP</span>
                <span class="ficha-source">ATC · Generalitat</span>
              </div>
              <div class="ver ver-blue">
                <span class="ver-dot"></span>
                <div class="ver-body">
                  <span class="ver-titulo">ITP: 10 % hasta 600.000 €</span>
                  <span class="ver-desc">Por encima de 600.000 € se aplica una tarifa progresiva. Se calcula sobre el precio de compra o el Valor de Referencia de Catastro, el que sea mayor.</span>
                </div>
              </div>
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
              <div class="ver ver-green">
                <span class="ver-dot"></span>
                <div class="ver-body">
                  <span class="ver-titulo">Aval del Estado de hasta el 20 %</span>
                  <span class="ver-desc">Para menores de 35 o con menores a cargo en su primera vivienda: el aval cubre la entrada y permite hipoteca de hasta el 100 % (25 % si el CEE es D o superior).</span>
                </div>
              </div>
              <div class="ver ver-amber">
                <span class="ver-dot"></span>
                <div class="ver-body">
                  <span class="ver-titulo">En pausa durante 2026</span>
                  <span class="ver-desc">La firma de nuevos avales está temporalmente parada a la espera de la addenda de prórroga (vigente hasta 2027). Confírmalo con tu banco.</span>
                </div>
              </div>
              <a class="ficha-cta" :href="ciudadLinks.avalIco" target="_blank" rel="noopener">Línea de avales ICO →</a>
            </div>

            <!-- Hub de fuentes abiertas -->
            <div class="ficha-block">
              <div class="ficha-block-head"><span class="ficha-block-title">Fuentes abiertas de ciudad</span></div>
              <a class="ficha-doc" :href="ciudadLinks.openData" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Open Data BCN</span>
                  <span class="ficha-doc-d">Portal de datos abiertos del Ajuntament</span>
                </span>
                <span class="ficha-badge">abrir 🔗</span>
              </a>
              <p class="ficha-note-sm">Baja a un distrito o barrio para ver datos de mercado y entorno con su fuente.</p>
            </div>
          </div>

          <!-- NIVEL 1: DISTRITO — foto media + accesos a la estadística oficial del distrito -->
          <div v-else-if="mapContext.level === 'distrito'" class="context-panel">
            <div class="ficha-header">
              <div class="ficha-crumb"><span class="ficha-crumb-hi">Barcelona</span><span class="ficha-crumb-sep">›</span>distrito</div>
              <h2 class="ficha-address">{{ mapContext.distritoName || 'Selecciona un distrito' }}</h2>
              <p class="ficha-note-sm" style="margin-top:7px">Compara este distrito con la media de la ciudad. Haz clic en un barrio para bajar de nivel.</p>
            </div>

            <div class="ficha-block">
              <div class="ficha-block-head">
                <span class="ficha-block-title">Qué mirar en un distrito</span>
              </div>
              <div class="ver ver-blue">
                <span class="ver-dot"></span>
                <div class="ver-body">
                  <span class="ver-titulo">Precio medio y liquidez</span>
                  <span class="ver-desc">El distrito da la foto agregada: precio €/m² frente a la media de la ciudad y cuánta oferta se mueve. Sirve para descartar zonas, no para decidir un piso concreto.</span>
                </div>
              </div>
            </div>

            <div class="ficha-block">
              <div class="ficha-block-head">
                <span class="ficha-block-title">Fuentes oficiales</span>
                <span class="ficha-source">Ajuntament · Generalitat</span>
              </div>
              <a class="ficha-doc" :href="zonaLinks.portalDades" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Barcelona Dades</span>
                  <span class="ficha-doc-d">Estadística por distrito y barrio · Ajuntament</span>
                </span>
                <span class="ficha-badge">abrir 🔗</span>
              </a>
              <a class="ficha-doc" :href="zonaLinks.incasolLloguer" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Alquiler medio oficial (INCASÒL)</span>
                  <span class="ficha-doc-d">Fianzas depositadas, por distrito y barrio</span>
                </span>
                <span class="ficha-badge">consultar 🔗</span>
              </a>
              <a class="ficha-doc" :href="zonaLinks.idescatEmex" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Barcelona en cifras (Idescat)</span>
                  <span class="ficha-doc-d">Población, renta y actividad económica</span>
                </span>
                <span class="ficha-badge">abrir 🔗</span>
              </a>
            </div>
          </div>

          <!-- NIVEL 2: BARRIO — donde se decide: mercado, rentabilidad y entorno con fuente -->
          <div v-else-if="mapContext.level === 'barrio'" class="context-panel">
            <div class="ficha-header">
              <div class="ficha-crumb"><span class="ficha-crumb-hi">{{ mapContext.distritoName || 'Barcelona' }}</span><span class="ficha-crumb-sep">›</span>barrio</div>
              <h2 class="ficha-address">{{ mapContext.barrioName || 'Selecciona un barrio' }}</h2>
              <p class="ficha-note-sm" style="margin-top:7px">El barrio es donde se decide la compra: mercado, entorno y servicios. Haz clic para ver las secciones censales.</p>
            </div>

            <div class="ficha-block">
              <div class="ficha-block-head">
                <span class="ficha-block-title">Rentabilidad · cómo calcularla</span>
              </div>
              <div class="ver ver-blue">
                <span class="ver-dot"></span>
                <div class="ver-body">
                  <span class="ver-titulo">Yield bruto = alquiler anual ÷ precio de compra</span>
                  <span class="ver-desc">Cruza el alquiler medio y el precio de venta del barrio (fuentes abajo). El resultado te dice si conviene comprar para vivir o para alquilar (buy-to-let).</span>
                </div>
              </div>
            </div>

            <div class="ficha-block">
              <div class="ficha-block-head">
                <span class="ficha-block-title">Fuentes oficiales del barrio</span>
                <span class="ficha-source">Open Data · Generalitat</span>
              </div>
              <a class="ficha-doc" :href="zonaLinks.lloguerBarris" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Precio de alquiler por barrios</span>
                  <span class="ficha-doc-d">Estimación mensual · Open Data BCN</span>
                </span>
                <span class="ficha-badge">abrir 🔗</span>
              </a>
              <a class="ficha-doc" :href="zonaLinks.incasolLloguer" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Alquiler medio oficial (INCASÒL)</span>
                  <span class="ficha-doc-d">Fianzas depositadas, por barrio</span>
                </span>
                <span class="ficha-badge">consultar 🔗</span>
              </a>
              <a class="ficha-doc" :href="zonaLinks.hutb" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Pisos turísticos (HUT)</span>
                  <span class="ficha-doc-d">Densidad de licencias activas en la zona</span>
                </span>
                <span class="ficha-badge">consultar 🔗</span>
              </a>
            </div>
          </div>

          <!-- NIVEL 3: SECCIÓN CENSAL — micro-entorno: renta, demografía y presión turística -->
          <div v-else-if="mapContext.level === 'seccion'" class="context-panel">
            <div class="ficha-header">
              <div class="ficha-crumb"><span class="ficha-crumb-hi">{{ mapContext.barrioName || 'Barcelona' }}</span><span class="ficha-crumb-sep">›</span>sección censal</div>
              <h2 class="ficha-address ficha-crumb-mono" style="font-size:20px">{{ mapContext.seccionCode || 'Selecciona una sección' }}</h2>
              <p class="ficha-note-sm" style="margin-top:7px">El micro-entorno: renta, demografía y presión turística de unas pocas manzanas. Haz clic en cualquier calle para ver la finca.</p>
            </div>

            <div class="ficha-block">
              <div class="ficha-block-head">
                <span class="ficha-block-title">Qué mide una sección</span>
              </div>
              <div class="ver ver-blue">
                <span class="ver-dot"></span>
                <div class="ver-body">
                  <span class="ver-titulo">Renta y perfil del hogar</span>
                  <span class="ver-desc">La sección censal es la unidad más fina con datos de renta del INE. Te da el poder adquisitivo real del vecindario inmediato, no la media del barrio.</span>
                </div>
              </div>
            </div>

            <div class="ficha-block">
              <div class="ficha-block-head">
                <span class="ficha-block-title">Fuentes oficiales de la sección</span>
                <span class="ficha-source">INE · Ajuntament</span>
              </div>
              <a class="ficha-doc" :href="zonaLinks.ineAtlasRenta" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Atlas de renta (INE)</span>
                  <span class="ficha-doc-d">Renta media por persona y hogar, por sección</span>
                </span>
                <span class="ficha-badge">abrir 🔗</span>
              </a>
              <a class="ficha-doc" :href="zonaLinks.hutb" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Pisos turísticos (HUT)</span>
                  <span class="ficha-doc-d">Licencias activas en estas manzanas</span>
                </span>
                <span class="ficha-badge">consultar 🔗</span>
              </a>
              <a class="ficha-doc" :href="zonaLinks.portalDades" target="_blank" rel="noopener">
                <span class="ficha-doc-main">
                  <span class="ficha-doc-t">Padrón y demografía</span>
                  <span class="ficha-doc-d">Densidad poblacional · Barcelona Dades</span>
                </span>
                <span class="ficha-badge">abrir 🔗</span>
              </a>
            </div>
          </div>

          <!-- NIVEL 4: FINCA (CATASTRO) -->
          <div v-else-if="mapContext.level === 'finca'" class="context-panel">
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

              <!-- Resto del dossier solo si hay datos -->
              <template v-if="fincaData.estado === 'ok'">
                <!-- Transporte dentro del radio (Fase B2) -->
                <div v-if="radioStops.length" class="ficha-block">
                  <div class="ficha-block-head">
                    <span class="ficha-block-title">Transporte en tu radio</span>
                    <span class="ficha-source">{{ radioLabel }} · {{ radioStops.length }} paradas</span>
                  </div>
                  <div class="radio-stop" v-for="(s, i) in radioStops.slice(0, 40)" :key="i">
                    <button class="radio-stop-main" type="button" @click="focusStop(s)">
                      <span class="radio-stop-dot" :style="{ background: s.color }"></span>
                      <span class="radio-stop-name">{{ s.name }}<small v-if="s.lines"> · {{ s.lines }}</small></span>
                      <span class="radio-stop-dist">{{ s.dist }} m</span>
                    </button>
                    <a class="radio-stop-go" :href="comoLlegar(s)" target="_blank" rel="noopener" title="Cómo llegar (transporte público)">↗</a>
                  </div>
                  <p v-if="radioStops.length > 40" class="ficha-note-sm">… y {{ radioStops.length - 40 }} más dentro del radio.</p>
                </div>

                <!-- Situación urbanística REAL de la parcela (PIU · GetFeatureInfo en vivo) -->
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
                    <div v-if="claveSistema" class="ver" :class="'ver-' + claveSistema.tone" style="margin-top:9px">
                      <span class="ver-dot"></span>
                      <div class="ver-body">
                        <span class="ver-titulo">{{ claveSistema.titulo }}</span>
                        <span class="ver-desc">{{ claveSistema.desc }}</span>
                      </div>
                    </div>

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

                <!-- Cumplimiento: Cédula y CEE -->
                <div class="ficha-block">
                  <div class="ficha-block-head"><span class="ficha-block-title">Cumplimiento</span></div>
                  <a class="ficha-doc" :href="deepLinks.cedula" target="_blank" rel="noopener">
                    <span class="ficha-doc-main">
                      <span class="ficha-doc-t">Cédula de habitabilidad</span>
                      <span class="ficha-doc-d">Búscala con la ref. de inmueble (20)</span>
                    </span>
                    <span class="ficha-badge">consultar 🔗</span>
                  </a>
                  <a class="ficha-doc" :href="deepLinks.cee" target="_blank" rel="noopener">
                    <span class="ficha-doc-main">
                      <span class="ficha-doc-t">Certificado energético (CEE)</span>
                      <span class="ficha-doc-d">Búscalo con la ref. de inmueble (20)</span>
                    </span>
                    <span class="ficha-badge">consultar 🔗</span>
                  </a>
                </div>

                <!-- Lectura crítica: la síntesis (qué significan los datos para ti) -->
                <div v-if="veredictos.length" class="ficha-block">
                  <div class="ficha-block-head">
                    <span class="ficha-block-title">Lectura crítica</span>
                    <span class="ficha-source">BCN Radar</span>
                  </div>
                  <div class="ficha-lectura">
                    <div v-for="(ver, i) in veredictos" :key="i" class="ver" :class="'ver-' + ver.tone">
                      <span class="ver-dot"></span>
                      <div class="ver-body">
                        <span class="ver-titulo">{{ ver.titulo }}</span>
                        <span class="ver-desc">{{ ver.desc }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Valor de mercado: dato REAL de zona + los dos puntos de referencia -->
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
                  <a class="ficha-doc" :href="deepLinks.valorRef" target="_blank" rel="noopener">
                    <span class="ficha-doc-main">
                      <span class="ficha-doc-t">Valor de Referencia de esta finca</span>
                      <span class="ficha-doc-d">Base del impuesto ITP · Sede del Catastro (requiere identificarse)</span>
                    </span>
                    <span class="ficha-badge">consultar 🔗</span>
                  </a>
                  <!-- Punto de referencia 2: precios por barrio (contrastar) -->
                  <a class="ficha-doc" :href="zonaLinks.incasolLloguer" target="_blank" rel="noopener">
                    <span class="ficha-doc-main">
                      <span class="ficha-doc-t">Alquiler por barrio (Incasòl)</span>
                      <span class="ficha-doc-d">Fianzas depositadas, detalle por distrito y barrio</span>
                    </span>
                    <span class="ficha-badge">abrir 🔗</span>
                  </a>
                  <div class="ficha-note-sm">Alquiler medio de la ciudad (dato real, no del inmueble). El precio de venta (€/m²) y el detalle por barrio entran cuando reviva Open Data BCN.</div>
                </div>

                <!-- ===== GRUPO 2: PRIVADO / DUE DILIGENCE ===== -->
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
              </template>

              <!-- Acciones -->
              <div class="action-buttons">
                <button class="export-btn" @click="exportReport">Generar informe (PDF)</button>
              </div>
            </div>
          </div>
  </SectionCard>
</template>
