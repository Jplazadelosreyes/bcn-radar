<script setup>
import { ref, watch } from 'vue'
import { usePanels } from './composables/usePanels.js'
import { useSheetDrag } from './composables/useSheetDrag.js'
import { useMovilidad } from './composables/useMovilidad.js'
import TheTopbar from './components/TheTopbar.vue'
import MapCanvas from './components/map/MapCanvas.vue'
import MapFabs from './components/map/MapFabs.vue'
import StopExplorer from './components/map/StopExplorer.vue'
import MapControls from './components/map/MapControls.vue'
import InfoDossier from './components/sidebar/InfoDossier.vue'
import CapasCard from './components/sidebar/CapasCard.vue'
import MovilidadCard from './components/sidebar/MovilidadCard.vue'
import ZonasCard from './components/sidebar/ZonasCard.vue'

// Paneles ocultables (composable singleton): todos parten colapsados, potencia incremental
const { isMobile, sidebarOpen, controlsOpen, utilsOpen } = usePanels()

// Bottom sheets (móvil) con arrastre real en el asa y snap de 3 estados:
// compacto ⇄ expandido (arrastrar arriba) ⇄ cerrado (arrastrar abajo desde compacto).
// Bajar estando expandido colapsa además todas las cards (vuelta al estado mínimo).
// Arrastre del asa de los sheets (composable compartido). El sidebar colapsa las cards
// al bajar desde expandido; los controles no lo necesitan (importan useSheetDrag sin callback).
const { sheetFull, start: sheetTouchStart, move: sheetTouchMove, end: sheetTouchEnd } = useSheetDrag(() => { cardOpen.value = {} })

// Explorador de parada (store useMovilidad): lo consume el StopExplorer del área del mapa.
const { selectedStop, stopChipsView, stopHasSelection, pickStopLine, clearRoute, stopClear } = useMovilidad()

// Cards del sidebar: expansión INDEPENDIENTE (se pueden mezclar capas de varias:
// metro + distritos, etc.). En móvil el sheet abre con todo colapsado (incremental).
const cardOpen = ref(isMobile.value ? {} : { info: true }) // id -> abierta
function toggleCard(id) { cardOpen.value = { ...cardOpen.value, [id]: !cardOpen.value[id] } }
watch(sidebarOpen, (open) => { if (open && isMobile.value) { cardOpen.value = {}; sheetFull.value = false } })
</script>

<template>
  <div class="app-container">
    <TheTopbar />
    
    <main class="main-content">
      
      <!-- PANEL LATERAL (IZQUIERDA) -->
      <aside class="sidebar" :class="{ open: sidebarOpen, full: sheetFull }">
        <button class="sheet-handle" @click="sidebarOpen = false" @touchstart.passive="sheetTouchStart" @touchmove.passive="sheetTouchMove" @touchend="(e) => sheetTouchEnd(e, () => (sidebarOpen = false), true)" title="Cerrar" aria-label="Cerrar panel"><span></span></button>
        <button class="panel-close" @click="sidebarOpen = false" title="Cerrar">✕</button>

        <!-- INFORMACIÓN — dossier contextual que sigue el nivel de zoom (ciudad→distrito→barrio→sección→finca) -->
        <InfoDossier :open="!!cardOpen['info']" @toggle="toggleCard('info')" />

        <!-- CAPAS PÚBLICAS — agregador WMS (persistente, sobre las fichas contextuales) -->
        <CapasCard :open="!!cardOpen['capas']" @toggle="toggleCard('capas')" />

        <!-- MOVILIDAD Y SERVICIOS — capas de datos abiertos en vivo -->
        <MovilidadCard :open="!!cardOpen['mov']" @toggle="toggleCard('mov')" />

        <!-- ZONAS ADMINISTRATIVAS — límites de distritos y barrios -->
        <ZonasCard :open="!!cardOpen['zonas']" @toggle="toggleCard('zonas')" />

      </aside>

      <!-- MAPA Y SUS CONTROLES (DERECHA) -->
      <div class="map-section" :class="{ 'utils-collapsed': !utilsOpen, 'sheet-open': sidebarOpen || controlsOpen || !!selectedStop }">
        <MapCanvas />

        <!-- FABs sobre el mapa (utilidades/tema + reabrir paneles) -->
        <MapFabs />

        <!-- Explorador de parada: líneas que pasan → elegir una dibuja su recorrido -->
        <StopExplorer
          :stop="selectedStop" :chips="stopChipsView" :has-selection="stopHasSelection"
          @close="selectedStop = null; clearRoute()" @pick="pickStopLine" @clear="stopClear" />

        <!-- Controles flotantes del mapa (Abajo Derecha) -->
        <MapControls />
      </div>
      
    </main>
  </div>
</template>
