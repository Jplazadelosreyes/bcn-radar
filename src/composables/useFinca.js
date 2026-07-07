// ═══════════════════════════════════════════════════════════════════════════════
//  useFinca — estado de la finca seleccionada: datos catastrales, situación urbanística
//  (PIU), valor de zona y todo lo DERIVADO que consume el dossier (veredictos, enlaces
//  oficiales, checklist). Singleton. La lógica de fetch (al clic/buscar) escribe estos
//  refs desde el setup del mapa; aquí vive el estado + la interpretación.
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, computed } from 'vue'
import { classificLabel } from '../services/piu.js'

/**
 * @typedef {Object} FincaData
 * @property {'vacio'|'cargando'|'ok'|'sin-parcela'|'error'} estado
 * @property {string|null} refCatastral
 * @property {string|null} rcInmueble
 * @property {number|null} ano
 * @property {number|null} superficie
 * @property {string|null} uso
 * @property {number|null} coefParticipacion
 * @property {number|null} nInmuebles
 * @property {number|null} plantas
 */

/** @type {import('vue').Ref<FincaData>} */
const fincaData = ref({
  estado: 'vacio',
  refCatastral: null,
  rcInmueble: null,
  ano: null,
  superficie: null,
  uso: null,
  coefParticipacion: null,
  nInmuebles: null,
  plantas: null,
})

/** @type {import('vue').Ref<{ lat: number; lng: number } | null>} */
const clickedCoords = ref(null) // coords del último clic (miniatura satélite + centro del radio)

const afectaciones = ref({ estado: 'vacio' }) // PIU · GetFeatureInfo: 'vacio'|'cargando'|'ok'|'error'
const valorZona = ref(null) // valor de mercado de zona (Incasòl): { renda, any, contratos }

const classific = classificLabel

// ¿La clave urbanística es de sistema (5 viario / 7 equipamiento)? → riesgo de afectación
const claveSistema = computed(() => {
  const c = afectaciones.value?.qualificacio?.clau || ''
  if (/^5/.test(c)) return { tone: 'red', titulo: `Clave ${c} · Sistema viario`, desc: 'Suelo reservado para vial. Riesgo de expropiación total o parcial. Verifica el alcance antes de comprometerte.' }
  if (/^7/.test(c)) return { tone: 'red', titulo: `Clave ${c} · Equipamientos`, desc: 'Suelo reservado para equipamiento público (colegio, sanitario, etc.). Riesgo de afectación.' }
  if (/^6/.test(c)) return { tone: 'amber', titulo: `Clave ${c} · Espacios libres`, desc: 'Suelo de zona verde / espacio libre. Edificabilidad muy limitada.' }
  return null
})

// Miniatura satélite real (ortofoto ESRI) centrada en la parcela seleccionada
const satelliteThumb = computed(() => {
  if (!clickedCoords.value) return null
  const { lat, lng } = clickedCoords.value
  const d = 0.0006 // ~60 m de margen
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`
  return `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=160,160&format=jpg&f=image`
})

const antiguedad = computed(() => (fincaData.value.ano ? new Date().getFullYear() - fincaData.value.ano : null))
const supUtilEstimada = computed(() => (fincaData.value.superficie ? Math.round(fincaData.value.superficie * 0.85) : null))

// ── Lectura crítica: cruza un DATO REAL del Catastro con REGULACIÓN real (ITE, LPH, uso) ──
const veredictos = computed(() => {
  if (fincaData.value.estado !== 'ok') return []
  const f = fincaData.value
  const v = []
  if (antiguedad.value != null) {
    if (antiguedad.value > 45) {
      v.push({ tone: 'amber', titulo: `Edificio de ${antiguedad.value} años · ITE obligatoria`, desc: 'En Cataluña los edificios de más de 45 años deben pasar la Inspección Técnica (ITE). Exige el Certificado de Aptitud vigente; sin él, riesgo de derramas estructurales.' })
    } else {
      v.push({ tone: 'green', titulo: `Edificio de ${antiguedad.value} años`, desc: 'Por debajo del umbral de ITE obligatoria (45 años).' })
    }
  }
  if (f.uso) {
    if (/resid|vivienda/i.test(f.uso)) {
      v.push({ tone: 'green', titulo: 'Uso residencial', desc: 'Apto para vivienda y financiación hipotecaria estándar.' })
    } else {
      v.push({ tone: 'red', titulo: `Uso catastral: ${f.uso} (no residencial)`, desc: 'Verifica que tenga cédula de habitabilidad para vivienda antes de plantear vivir, empadronarte o hipotecarlo como hogar.' })
    }
  }
  if (f.coefParticipacion > 0 && f.coefParticipacion <= 100 && f.nInmuebles > 1) {
    const derrama = Math.round((100000 * f.coefParticipacion) / 100)
    v.push({ tone: 'blue', titulo: `Tu cuota en la comunidad: ${f.coefParticipacion}%`, desc: `Es tu parte en gastos comunes y derramas. Una derrama de 100.000 € de la finca = ~${derrama.toLocaleString('es-ES')} € para ti.` })
  }
  if (f.nInmuebles > 1) {
    v.push({ tone: 'blue', titulo: `Finca plurifamiliar · ${f.nInmuebles} inmuebles`, desc: 'Hay comunidad de propietarios activa. Pide actas y el estado de derramas aprobadas (Art. 9 LPH) antes de firmar.' })
  }
  return v
})

// Deep-links oficiales con la referencia catastral inyectada (regla de verificabilidad)
const deepLinks = computed(() => {
  const rc14 = fincaData.value.refCatastral
  return {
    catastro: 'https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?buscar=S',
    valorRef: 'https://www.sedecatastro.gob.es/Accesos/SECAccvr.aspx',
    piu: rc14 ? `https://ajuntament.barcelona.cat/informaciourbanistica/cerca/es/fitxa/${rc14}/--/--/pa/` : '#',
    cedula: 'https://agenciahabitatge.gencat.cat/es/temas/rehabilitacion-y-calidad-de-la-edificacion/control-de-calidad-de-la-vivienda/buscador-de-cedulas',
    cee: 'https://certificacioenergetica.gencat.cat/icaen-visor/AppJava/views/portada.xhtml',
    indiceAlquiler: 'https://agenciahabitatge.gencat.cat/indexlloguer/',
    hutb: 'https://meet.barcelona.cat/habitatgesturistics/es',
  }
})

// Enlaces oficiales a nivel ciudad (hechos legales reales, no estimaciones)
const ciudadLinks = {
  indiceAlquiler: 'https://agenciahabitatge.gencat.cat/indexlloguer/',
  serpavi: 'https://serpavi.mivau.gob.es/',
  itpAtc: 'https://atc.gencat.cat/es/tributs/itpajd/tpo/tarifes-tipus/',
  avalIco: 'https://www.ico.es/en/linea-avales-hipoteca-primera-vivienda',
  openData: 'https://opendata-ajuntament.barcelona.cat/es',
}

// Enlaces oficiales por zona (fuentes públicas reales, sin cifras inventadas)
const zonaLinks = {
  portalDades: 'https://portaldades.ajuntament.barcelona.cat/ca/',
  incasolLloguer: 'https://habitatge.gencat.cat/ca/dades/indicadors_estadistiques/estadistiques_de_construccio_i_mercat_immobiliari/mercat_de_lloguer/lloguers-barcelona-per-districtes-i-barris/',
  idescatEmex: 'https://www.idescat.cat/emex/?id=080193',
  lloguerBarris: 'https://opendata-ajuntament.barcelona.cat/data/ca/dataset/h2mallo-a',
  ineAtlasRenta: 'https://www.ine.es/experimental/atlas/experimental_atlas.htm',
  hutb: 'https://meet.barcelona.cat/habitatgesturistics/es',
}

// Copiar al portapapeles (referencias catastrales)
const copiar = (texto) => {
  if (texto && navigator.clipboard) navigator.clipboard.writeText(texto)
}

// Checklist del comprador (contenido estático didáctico)
const checklistComprador = [
  { icono: '📄', titulo: 'Nota Simple (Registro de la Propiedad)', desc: 'Comprueba titularidad real, hipotecas vigentes, embargos o usufructos.', url: 'https://sede.registradores.org/site/propiedad' },
  { icono: '🏗️', titulo: 'ITE y Certificado de Aptitud', desc: 'Obligatorio si el edificio tiene >45 años. Te salva de vicios estructurales y derramas.', url: null },
  { icono: '📜', titulo: 'Cédula de Habitabilidad y CEE', desc: 'La cédula garantiza mínimos de habitabilidad. Ambos obligatorios para arras y notaría.', url: null },
  { icono: '🏛️', titulo: 'Certificado de Deudas de la Comunidad', desc: 'Emitido por el Administrador. Evita heredar deudas o derramas aprobadas (Art. 9 LPH).', url: null },
  { icono: '🧾', titulo: 'Último recibo de IBI y Basuras', desc: 'Asegura que los impuestos municipales están al día; el año en curso se prorratea.', url: null },
  { icono: '⚡', titulo: 'Últimas facturas de suministros', desc: 'Evita cortes; si la luz lleva meses de baja, exigirán un nuevo Boletín (CIE).', url: 'https://www.edistribucion.com/' },
]

export function useFinca() {
  return {
    fincaData, clickedCoords, afectaciones, valorZona, classific,
    claveSistema, satelliteThumb, antiguedad, supUtilEstimada, veredictos, deepLinks,
    ciudadLinks, zonaLinks, copiar, checklistComprador,
  }
}
