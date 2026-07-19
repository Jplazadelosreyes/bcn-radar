<script setup lang="ts">
// ═══ Dossier PDF de la finca — vista de IMPRESIÓN ═══
// Se monta al pulsar "Dossier PDF": precarga las imágenes reales (aérea, croquis,
// PIU), captura el mapa, genera el QR de vuelta a la finca y lanza window.print()
// → el usuario elige "Guardar como PDF". En pantalla nunca se ve (print.css).
// Reutiliza useFinca tal cual: el PDF y el dossier en pantalla son la misma verdad.
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import QRCode from 'qrcode'
import { useFinca } from '../../composables/useFinca'
import { useMapStore } from '../../composables/useMapStore'
import { dossierImages, snapshotMap, preload, fetchParadasDossier } from '../../services/dossier.js'

const emit = defineEmits<{ done: [] }>()
const { fincaData, clickedCoords, selectedAddress, afectaciones, valorZona, classific, claveSistema, antiguedad, supUtilEstimada, veredictos, deepLinks, checklistComprador } = useFinca()
const { map, mapContext } = useMapStore()

const imgs = ref<{ aerea: string | null; croquis: string | null; piu: string | null }>({ aerea: null, croquis: null, piu: null })
const qr = ref<string | null>(null)
const mapShot = ref<string | null>(null)
interface Parada { name: string; modo: string; color: string; lines: string; dist: number }
const paradas = ref<Parada[]>([])
const fecha = new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// El QR devuelve a ESTA finca en el mapa vivo (deep-link que resuelve MapCanvas)
const qrUrl = () => {
  const c = clickedCoords.value
  return c ? `${location.origin}${location.pathname}#finca=${c.lat.toFixed(6)},${c.lng.toFixed(6)}` : location.href
}

const alPrint = () => emit('done')

onMounted(async () => {
  const c = clickedCoords.value
  if (!c) { emit('done'); return }
  const urls = dossierImages(c.lng, c.lat)
  // Todo en paralelo; lo que no llegue a tiempo se imprime como hueco honesto
  const [okA, okC, okP, shot, stops, qrData] = await Promise.all([
    preload(urls.aerea), preload(urls.croquis), preload(urls.piu),
    snapshotMap(map.value),
    fetchParadasDossier(c.lng, c.lat),
    QRCode.toDataURL(qrUrl(), { margin: 0, width: 240, color: { dark: '#22303A' } }).catch(() => null),
  ])
  imgs.value = { aerea: okA ? urls.aerea : null, croquis: okC ? urls.croquis : null, piu: okP ? urls.piu : null }
  mapShot.value = shot
  paradas.value = stops.slice(0, 8)
  qr.value = qrData
  await nextTick()
  window.addEventListener('afterprint', alPrint, { once: true })
  window.print()
})
onBeforeUnmount(() => window.removeEventListener('afterprint', alPrint))

const afect = (k: string): { codi: string | null; desc: string | null }[] => afectaciones.value?.[k] || []
const sinAfectaciones = () => ['sectors', 'aprovats', 'tramits', 'suspensions'].every((k) => afect(k).length === 0)
</script>

<template>
  <!-- Teleport a body: al imprimir se oculta #app entero, y el dossier debe ser su
       HERMANO, no su descendiente, para sobrevivir a ese display:none. -->
  <Teleport to="body">
  <div class="dossier-print">
    <!-- ═══ 1 · PORTADA ═══ -->
    <section class="dp-page">
      <div class="dp-eyebrow">BCN Radar · Dossier de finca</div>
      <h1 class="dp-title">{{ selectedAddress }}</h1>
      <div class="dp-sub">
        <template v-if="mapContext.barrioName">{{ mapContext.barrioName }} · </template>
        <template v-if="mapContext.distritoName">{{ mapContext.distritoName }} · </template>Barcelona
      </div>
      <figure class="dp-fig" style="margin-top: 10pt">
        <img v-if="imgs.aerea" :src="imgs.aerea" alt="Ortofoto de la parcela" />
        <div v-else class="dp-fig-falta">Ortofoto no disponible al generar el dossier</div>
        <figcaption class="dp-cap">Ortofoto vigente centrada en la parcela · ESRI World Imagery</figcaption>
      </figure>
      <div v-if="fincaData.rcInmueble || fincaData.refCatastral" class="dp-rcchip">
        <i>REF. CATASTRAL</i> {{ fincaData.rcInmueble || fincaData.refCatastral }}
      </div>
      <div class="dp-portada-pie">
        <div style="flex: 1">
          <div class="dp-h2" style="border: 0; padding: 0; margin: 0 0 3pt">Qué contiene</div>
          <div style="font-size: 9pt">Catastro y superficies · situación urbanística y afectaciones · lectura crítica ·
            transporte a pie · referencias de valor · checklist antes de firmar.
            <b style="color: #22303A">Cero cifras inventadas:</b> cada bloque enlaza a su fuente oficial.</div>
        </div>
        <figure v-if="qr" class="dp-fig" style="text-align: center; flex: none">
          <img :src="qr" class="dp-qr" alt="QR: abrir esta finca en el mapa vivo" style="border: 0" />
          <figcaption class="dp-cap">Abrir esta finca<br />en el mapa vivo</figcaption>
        </figure>
      </div>
      <div class="dp-foot"><span>Generado el {{ fecha }}</span><span>bcn-radar · pág. 1 / 4</span></div>
    </section>

    <!-- ═══ 2 · CATASTRO + LECTURA CRÍTICA ═══ -->
    <section class="dp-page">
      <h2 class="dp-h2">1 · Lo que dice el Catastro</h2>
      <div class="dp-cols2">
        <div>
          <div class="dp-kv">
            <div><b>Año</b><span>{{ fincaData.ano ?? '—' }}</span></div>
            <div><b>Antigüedad</b><span>{{ antiguedad != null ? antiguedad + ' años' : '—' }}</span></div>
            <div><b>Uso</b><span>{{ fincaData.uso ?? '—' }}</span></div>
            <div><b>Sup. construida</b><span>{{ fincaData.superficie ? fincaData.superficie + ' m²' : '—' }}</span></div>
            <div><b>Sup. útil est.</b><span>{{ supUtilEstimada ? supUtilEstimada + ' m²' : '—' }}</span></div>
            <div><b>Coef. particip.</b><span>{{ fincaData.coefParticipacion != null ? fincaData.coefParticipacion + ' %' : '—' }}</span></div>
            <div><b>Inmuebles</b><span>{{ fincaData.nInmuebles ?? '—' }}</span></div>
            <div><b>Plantas</b><span>{{ fincaData.plantas ?? '—' }}</span></div>
            <div><b>Ref. parcela</b><span class="dp-kv-mono">{{ fincaData.refCatastral ?? '—' }}</span></div>
          </div>
          <div class="dp-cap">Consulta_DNPRC · Sede Electrónica del Catastro · <a :href="deepLinks.catastro">verificar en origen ↗</a></div>
        </div>
        <figure class="dp-fig">
          <img v-if="imgs.croquis" :src="imgs.croquis" alt="Croquis parcelario del Catastro" />
          <div v-else class="dp-fig-falta">Croquis no disponible</div>
          <figcaption class="dp-cap">Croquis parcelario · WMS Catastro</figcaption>
        </figure>
      </div>
      <h2 class="dp-h2" style="margin-top: 12pt">2 · Lectura crítica</h2>
      <div v-if="claveSistema" class="dp-verd" :class="'dp-v-' + claveSistema.tone">
        <div><b>{{ claveSistema.titulo }}</b><small>{{ claveSistema.desc }}</small></div>
      </div>
      <div v-for="v in veredictos" :key="v.titulo" class="dp-verd" :class="'dp-v-' + v.tone">
        <div><b>{{ v.titulo }}</b><small>{{ v.desc }}</small></div>
      </div>
      <div class="dp-foot"><span>Datos consultados en vivo · {{ fecha }}</span><span>pág. 2 / 4</span></div>
    </section>

    <!-- ═══ 3 · SITUACIÓN URBANÍSTICA ═══ -->
    <section class="dp-page">
      <h2 class="dp-h2">3 · Qué permite el planeamiento</h2>
      <figure class="dp-fig">
        <img v-if="imgs.piu" :src="imgs.piu" alt="Calificación urbanística de la manzana" style="max-height: 105mm; object-fit: cover" />
        <div v-else class="dp-fig-falta">Mapa de calificación no disponible</div>
        <figcaption class="dp-cap">Calificación urbanística sobre la manzana · WMS Urbanisme · Ajuntament de Barcelona</figcaption>
      </figure>
      <div class="dp-kv" style="grid-template-columns: 1fr 1fr; margin-top: 9pt">
        <div><b>Clave</b><span>{{ afectaciones.qualificacio?.clau ?? '—' }}<template v-if="afectaciones.qualificacio?.nom"> · {{ afectaciones.qualificacio.nom }}</template></span></div>
        <div><b>Clasificación</b><span>{{ afectaciones.qualificacio?.classific ?? '—' }}<template v-if="classific(afectaciones.qualificacio?.classific)"> · {{ classific(afectaciones.qualificacio?.classific) }}</template></span></div>
      </div>
      <div v-if="sinAfectaciones()" class="dp-verd dp-v-green" style="margin-top: 9pt">
        <div><b>Sin afectaciones activas</b><small>No consta en sectores de planeamiento, ámbitos en trámite ni suspensiones de licencias a fecha del dossier.</small></div>
      </div>
      <template v-else>
        <div v-for="s in afect('suspensions')" :key="'su' + (s.codi || s.desc)" class="dp-verd dp-v-red">
          <div><b>Suspensión de licencias{{ s.codi ? ' · ' + s.codi : '' }}</b><small>{{ s.desc }}</small></div>
        </div>
        <div v-for="s in afect('tramits')" :key="'tr' + (s.codi || s.desc)" class="dp-verd dp-v-amber">
          <div><b>Planeamiento en trámite{{ s.codi ? ' · ' + s.codi : '' }}</b><small>{{ s.desc }}</small></div>
        </div>
        <div v-for="s in afect('aprovats')" :key="'ap' + (s.codi || s.desc)" class="dp-verd dp-v-blue">
          <div><b>Planeamiento aprobado{{ s.codi ? ' · ' + s.codi : '' }}</b><small>{{ s.desc }}</small></div>
        </div>
        <div v-for="s in afect('sectors')" :key="'se' + (s.codi || s.desc)" class="dp-verd dp-v-blue">
          <div><b>Sector de planeamiento{{ s.codi ? ' · ' + s.codi : '' }}</b><small>{{ s.desc }}</small></div>
        </div>
      </template>
      <div class="dp-cap" style="margin-top: 8pt">Ficha oficial de la parcela: <a :href="deepLinks.piu">ajuntament.barcelona.cat/informaciourbanistica ↗</a></div>
      <div class="dp-foot"><span>PIU · GetFeatureInfo en vivo</span><span>pág. 3 / 4</span></div>
    </section>

    <!-- ═══ 4 · TRANSPORTE + VALOR + CHECKLIST ═══ -->
    <section class="dp-page">
      <h2 class="dp-h2">4 · A pie desde el portal</h2>
      <div class="dp-cols2">
        <figure class="dp-fig">
          <img v-if="mapShot" :src="mapShot" alt="Vista del mapa en el momento de la consulta" style="max-height: 78mm; object-fit: cover" />
          <div v-else class="dp-fig-falta">Vista del mapa no disponible</div>
          <figcaption class="dp-cap">Vista del mapa al generar el dossier · OpenFreeMap / OSM</figcaption>
        </figure>
        <div>
          <template v-if="paradas.length">
            <div v-for="p in paradas" :key="p.name + p.dist" class="dp-stop">
              <i :style="{ background: p.color }"></i>
              <span><b>{{ p.name }}</b><template v-if="p.lines"> · {{ p.lines }}</template></span>
              <span class="dp-dist">{{ p.dist }} m</span>
            </div>
            <div class="dp-cap">Paradas a ≤600 m · OpenStreetMap (Overpass)</div>
          </template>
          <div v-else class="dp-fig-falta">Paradas no disponibles al generar (Overpass sin respuesta)</div>
          <div v-if="valorZona" style="margin-top: 10pt; border-top: 1.5pt solid #22303A; padding-top: 6pt">
            <b style="font: 600 11pt/1.2 'Spectral', Georgia, serif; color: #22303A">Valor de zona</b>
            <div style="font-variant-numeric: tabular-nums; margin-top: 3pt; font-size: 9.5pt">
              Alquiler medio real (fianzas Incasòl, {{ valorZona.any }}): <b style="color: #22303A">{{ valorZona.renda.toLocaleString('es-ES') }} €/mes</b>
            </div>
            <div class="dp-cap">Nivel ciudad · analisi.transparenciacatalunya.cat</div>
          </div>
        </div>
      </div>
      <h2 class="dp-h2" style="margin-top: 12pt">5 · Antes de firmar</h2>
      <div style="columns: 2; column-gap: 12pt">
        <div v-for="c in checklistComprador" :key="c.titulo" class="dp-check">
          <div><b>{{ c.titulo }}</b> · {{ c.desc }}</div>
        </div>
      </div>
      <div class="dp-foot"><span>Fuentes oficiales enlazadas en cada bloque</span><span>pág. 4 / 4</span></div>
    </section>
  </div>
  </Teleport>
</template>
