// usePanels — estado compartido de los paneles de UI (singleton de módulo).
// Principio: potencia incremental. El mapa es el protagonista; todos los paneles
// parten colapsados en su forma mínima y se abren a demanda. En móvil, además,
// los paneles se excluyen entre sí (no caben dos abiertos a la vez).
import { ref, watch } from 'vue'

// Viewport reactivo: si el usuario rota el teléfono o cambia el ancho, nos enteramos
const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 680px)') : null
const isMobile = ref(mq ? mq.matches : false)
if (mq) mq.addEventListener('change', (e) => { isMobile.value = e.matches })

const controlsOpen = ref(false)  // panel de herramientas del mapa (medir · radio · 3D)
const utilsOpen = ref(false)     // speed-dial de utilidades del mapa (móvil)

// Sección activa del panel principal. Una sola a la vez; null = SOLO EL MAPA (estado inicial).
// La eligen el rail (escritorio) / la barra inferior (móvil) y el clic en finca (abre 'info').
// 'info' | 'capas' | 'mov' | 'zonas'
const activeSection = ref<string | null>(null)

// ── Exclusión mutua: solo UN panel abierto ────────────────────────────────────────────
// El panel de sección y el de herramientas ocupan el mismo sitio (columna izquierda en
// escritorio, bottom sheet en móvil): con los dos abiertos se superponen. Se excluyen.
//
// Antes esto se intentaba sobre `sidebarOpen`, pero ese ref no lo leía NADIE: el panel se
// muestra con `v-show="activeSection"`. La exclusión no hacía nada y los dos paneles se
// abrían a la vez. Ahora se opera sobre el estado que de verdad gobierna la vista.
function openSection(id: string) { activeSection.value = id; controlsOpen.value = false }
function toggleSection(id: string) {
  const siguiente = activeSection.value === id ? null : id
  activeSection.value = siguiente
  if (siguiente) controlsOpen.value = false
}
function openControls() { controlsOpen.value = true; activeSection.value = null }

function toggleUtils() { utilsOpen.value = !utilsOpen.value }

// Al entrar a viewport móvil (rotación, redimensión), volver al mapa limpio.
watch(isMobile, (m) => { if (m) { activeSection.value = null; controlsOpen.value = false; utilsOpen.value = false } })

export function usePanels() {
  return { isMobile, controlsOpen, utilsOpen, activeSection, toggleSection, openSection, openControls, toggleUtils }
}
