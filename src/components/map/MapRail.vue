<script setup lang="ts">
// Rail de navegación (escritorio), estilo Google Maps: columna estrecha fija a la izquierda
// con la marca arriba y las 4 secciones como iconos. El icono activo se marca con borde y su
// panel se expande a la derecha (lo renderiza App.vue). Una sección abierta a la vez.
import { usePanels } from '../../composables/usePanels'
import { useTheme } from '../../composables/useTheme'

const { activeSection, toggleSection } = usePanels()
const { theme, toggleTheme } = useTheme()

// Secciones del rail (id debe coincidir con el que consume App.vue para mostrar el panel).
const secciones = [
  { id: 'info', ico: '📍', label: 'Info' },
  { id: 'capas', ico: '🗂️', label: 'Capas' },
  { id: 'mov', ico: '🚌', label: 'Movilidad' },
  { id: 'zonas', ico: '🗺️', label: 'Zonas' },
]
</script>

<template>
  <nav class="map-rail" aria-label="Secciones">
    <div class="map-rail-brand" title="BCN Radar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 12 18.5 5.5"></path></svg>
    </div>
    <button
      v-for="s in secciones" :key="s.id"
      class="map-rail-btn" :class="{ active: activeSection === s.id }"
      @click="toggleSection(s.id)"
      :aria-pressed="activeSection === s.id" :title="s.label"
    >
      <span class="map-rail-ico">{{ s.ico }}</span>
      <span class="map-rail-label">{{ s.label }}</span>
    </button>

    <!-- Tema día/noche: botón independiente al fondo del rail -->
    <button class="map-rail-theme" @click="toggleTheme" :title="theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'">
      <span v-if="theme === 'dark'">☀</span><span v-else>☾</span>
    </button>
  </nav>
</template>

<style>
/* Rail vertical fijo a la izquierda, sobre el mapa. Solo escritorio (en móvil se oculta). */
.map-rail {
  position: absolute; top: 0; left: 0; bottom: 0; z-index: 950;
  width: 66px; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 6px;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-right: 1px solid var(--glass-brd-soft);
  box-shadow: var(--shadow-md);
}
.map-rail-brand {
  width: 36px; height: 36px; flex: none; margin-bottom: 8px;
  background: var(--accent); border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
}
.map-rail-btn {
  width: 54px; padding: 8px 2px 6px; border: 1px solid transparent; border-radius: 13px;
  background: none; color: var(--text-lo); cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  transition: background .15s, border-color .15s, color .15s;
}
.map-rail-btn:hover { background: color-mix(in srgb, var(--surface-3) 60%, transparent); color: var(--text-hi); }
.map-rail-ico { font-size: 19px; line-height: 1; }
.map-rail-label { font: 600 9px/1 var(--sans); letter-spacing: .01em; }
/* Seleccionado: borde de acento + fondo suave (la "marca de borde" pedida) */
.map-rail-btn.active {
  border-color: var(--accent); color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

/* Tema al fondo del rail (empujado abajo con margin-top auto) */
.map-rail-theme {
  margin-top: auto; width: 42px; height: 42px; flex: none;
  border: 1px solid var(--glass-brd-soft); border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--surface-3) 50%, transparent);
  color: var(--text-hi); font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color .15s;
}
.map-rail-theme:hover { border-color: var(--accent); }

@media (max-width: 680px) { .map-rail { display: none; } }
</style>
