<script setup lang="ts">
// Botones flotantes sobre el mapa: speed-dial de utilidades + tema (móvil) y los
// botones para reabrir los paneles (info / capas) cuando están cerrados.
// Estado 100% desde los composables singleton → sin props.
import { usePanels } from '../../composables/usePanels'
import { useTheme } from '../../composables/useTheme'

const { isMobile, controlsOpen, utilsOpen, activeSection, openSection, openControls, toggleUtils } = usePanels()
const { theme, toggleTheme } = useTheme()
</script>

<template>
  <!-- Móvil: speed-dial de utilidades (expande la columna hacia arriba) y tema -->
  <button class="fab-round fab-utils" :class="{ open: utilsOpen }" @click="toggleUtils()" :title="utilsOpen ? 'Ocultar utilidades del mapa' : 'Utilidades del mapa'" :aria-expanded="utilsOpen">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
  </button>
  <button class="fab-round fab-theme" @click="toggleTheme" :title="theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'">
    <span v-if="theme === 'dark'">☀</span><span v-else>☾</span>
  </button>

  <!-- Menú de secciones: SOLO móvil (en escritorio lo reemplaza el rail lateral) -->
  <button v-if="isMobile && !activeSection" class="fab fab-info" @click="openSection('info')" title="Información y capas">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
  </button>
  <button v-if="!controlsOpen" class="fab fab-map" @click="openControls()" title="Capas y controles del mapa">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
  </button>
</template>
