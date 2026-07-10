// usePanels — estado compartido de los paneles de UI (singleton de módulo).
// Principio: potencia incremental. El mapa es el protagonista; todos los paneles
// parten colapsados en su forma mínima y se abren a demanda. En móvil, además,
// los paneles se excluyen entre sí (no caben dos abiertos a la vez).
import { ref, watch } from 'vue'

// Viewport reactivo: si el usuario rota el teléfono o cambia el ancho, nos enteramos
const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 680px)') : null
const isMobile = ref(mq ? mq.matches : false)
if (mq) mq.addEventListener('change', (e) => { isMobile.value = e.matches })

const sidebarOpen = ref(false)   // panel izquierdo (móvil: bottom sheet)
const controlsOpen = ref(false)  // panel de controles del mapa
const utilsOpen = ref(false)     // speed-dial de utilidades del mapa (móvil)

// Rail (escritorio): sección activa del panel lateral. Una sola abierta a la vez;
// null = solo el rail de iconos, sin panel. La elige el rail y también el clic en finca
// (abre 'info' solo). 'info' | 'capas' | 'mov' | 'zonas'
const activeSection = ref<string | null>(null)
function toggleSection(id: string) { activeSection.value = activeSection.value === id ? null : id }
function openSection(id: string) { activeSection.value = id; sidebarOpen.value = true }

function toggleUtils() { utilsOpen.value = !utilsOpen.value }

function openSidebar() {
  sidebarOpen.value = true
  if (isMobile.value) controlsOpen.value = false
}
function openControls() {
  controlsOpen.value = true
  if (isMobile.value) sidebarOpen.value = false
}

// Al entrar a viewport móvil (rotación, redimensión), recolapsar todo:
// dos paneles abiertos se superponen y tapan el mapa
watch(isMobile, (m) => { if (m) { sidebarOpen.value = false; controlsOpen.value = false; utilsOpen.value = false } })

export function usePanels() {
  return { isMobile, sidebarOpen, controlsOpen, utilsOpen, activeSection, toggleSection, openSection, openSidebar, openControls, toggleUtils }
}
