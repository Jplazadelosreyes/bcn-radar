<script setup lang="ts">
import { watch } from 'vue'
import { usePanels } from './composables/usePanels'
import { useSheetDrag } from './composables/useSheetDrag'
import { useExploradorParadas } from './composables/useExploradorParadas'
import MapCanvas from './components/map/MapCanvas.vue'
import MapRail from './components/map/MapRail.vue'
import SearchBox from './components/map/SearchBox.vue'
import ActiveLayerChips from './components/map/ActiveLayerChips.vue'
import MapFabs from './components/map/MapFabs.vue'
import MapLayersBar from './components/map/MapLayersBar.vue'
import StopExplorer from './components/map/StopExplorer.vue'
import MapControls from './components/map/MapControls.vue'
import InfoDossier from './components/sidebar/InfoDossier.vue'
import CapasCard from './components/sidebar/CapasCard.vue'
import MovilidadCard from './components/sidebar/MovilidadCard.vue'
import ZonasCard from './components/sidebar/ZonasCard.vue'

// Navegación por rail (escritorio) / bottom sheet (móvil). Una sección abierta a la vez;
// el mapa es el protagonista y el panel flota sobre él (modelo Google Maps).
const { controlsOpen, utilsOpen, activeSection, toggleSection, sidebarOpen } = usePanels()

// Arrastre del asa del bottom sheet (móvil). Snap de 3 estados como el sheet de Google:
// arrastrar arriba = expandir; abajo desde expandido = volver a compacto (NO cerrar); abajo
// desde compacto = cerrar. El callback se dispara al bajar desde expandido: solo devuelve el
// contenido al principio (useSheetDrag ya quita el estado 'full' → compacto). Antes cerraba,
// y por eso el gesto se saltaba el estado intermedio.
const { sheetFull, start: sheetTouchStart, move: sheetTouchMove, end: sheetTouchEnd } = useSheetDrag(() => {
  document.querySelector('.sidebar')?.scrollTo({ top: 0, behavior: 'smooth' })
})

// Explorador de parada (store useExploradorParadas): lo consume el StopExplorer del área del mapa.
const { selectedStop, stopChipsView, stopHasSelection, pickStopLine, clearRoute, stopClear } = useExploradorParadas()

// El panel del sidebar está abierto cuando hay una sección activa.
watch(activeSection, (s) => { if (!s) { sidebarOpen.value = false; sheetFull.value = false } else { sidebarOpen.value = true } })
function closePanel() { activeSection.value = null }
</script>

<template>
  <div class="app-container">
    <main class="main-content">
      <!-- ESCENARIO: el mapa a pantalla completa; todo lo demás flota encima -->
      <div class="map-section" :class="{ 'utils-collapsed': !utilsOpen, 'sheet-open': !!activeSection || controlsOpen || !!selectedStop }">
        <MapCanvas />

        <!-- Buscador flotante (sin barra superior) -->
        <SearchBox />

        <!-- Chips de capas ACTIVAS (arriba, estilo filtros de Google Maps) -->
        <ActiveLayerChips />

        <!-- Rail de secciones (escritorio izquierda · móvil barra inferior) -->
        <MapRail />

        <!-- PANEL DE LA SECCIÓN ACTIVA (flota junto al rail / bottom sheet en móvil) -->
        <aside v-show="activeSection" class="sidebar" :class="{ open: !!activeSection, full: sheetFull }">
          <button class="sheet-handle" @click="closePanel" @touchstart.passive="sheetTouchStart" @touchmove.passive="sheetTouchMove" @touchend="(e) => sheetTouchEnd(e, closePanel, true)" title="Cerrar" aria-label="Cerrar panel"><span></span></button>
          <button class="panel-close" @click="closePanel" title="Cerrar">✕</button>

          <InfoDossier v-if="activeSection === 'info'" :open="true" @toggle="toggleSection('info')" />
          <CapasCard v-else-if="activeSection === 'capas'" :open="true" @toggle="toggleSection('capas')" />
          <MovilidadCard v-else-if="activeSection === 'mov'" :open="true" @toggle="toggleSection('mov')" />
          <ZonasCard v-else-if="activeSection === 'zonas'" :open="true" @toggle="toggleSection('zonas')" />
        </aside>

        <!-- FABs sobre el mapa (utilidades/tema + reabrir controles) -->
        <MapFabs />

        <!-- Barra de capas (abajo-izquierda, estilo Google): mapa base + vista -->
        <MapLayersBar />

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
