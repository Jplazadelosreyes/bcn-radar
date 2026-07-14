<script setup lang="ts">
// Barra de capas (abajo-izquierda, patrón Google Maps). Colapsada es una tarjeta con la
// miniatura del mapa base activo; al abrirse despliega los 4 mapas base y los interruptores
// de vista. Es el acceso RÁPIDO a lo que más se toca; "Más" abre el panel de herramientas.
//
// Las miniaturas de satélite y ortofoto son tiles REALES de las mismas fuentes que sirven el
// mapa, recortadas al mismo encuadre (el Eixample) para que se comparen entre sí. Callejero y
// relieve son vectoriales y no tienen tile de imagen, así que se dibujan en SVG.
import { ref, computed } from 'vue'
import { useMapTools } from '../../composables/useMapTools'
import { usePanels } from '../../composables/usePanels'

const { basemap, edificios3d, relieve3d, setBasemap, toggleEdificios3d, toggleRelieve3d } = useMapTools()
const { openControls } = usePanels()

const open = ref(false)

const TILE_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/6119/8290'
const TILE_ORTO = 'https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms/service?service=WMS&request=GetMap&version=1.3.0&layers=ortofoto_color_vigent&styles=&format=image/png&transparent=false&crs=EPSG:3857&bbox=239704.75,5068080.5,242150.73,5070526.5&width=128&height=128'

const BASES = [
  { id: 'calle', label: 'Callejero', img: '' },
  { id: 'satelite', label: 'Satélite', img: TILE_SAT },
  { id: 'orto-icgc', label: 'Ortofoto', img: TILE_ORTO },
  { id: 'relieve', label: 'Relieve', img: '' },
] as const

const actual = computed(() => BASES.find((b) => b.id === basemap.value) ?? BASES[0])
</script>

<template>
  <div class="layers-bar" :class="{ open }" @mouseleave="open = false">
    <!-- Tarjeta siempre visible: miniatura del mapa base actual -->
    <button class="lb-card lb-toggle" @click="open = !open" @mouseenter="open = true" :aria-expanded="open" title="Capas del mapa">
      <span class="lb-thumb">
        <img v-if="actual.img" :src="actual.img" alt="" loading="lazy">
        <svg v-else-if="actual.id === 'relieve'" viewBox="0 0 64 64" class="lb-svg"><rect width="64" height="64" fill="#E7EEDC"/><g fill="none" stroke="#BFA478" stroke-width="1.5"><path d="M2 50c9-3 13-11 21-11s13 7 21 5 12-7 18-7"/><path d="M6 58c8-4 12-15 22-15s15 10 24 7"/><path d="M16 43c4-4 7-8 12-8s8 4 12 4"/><path d="M24 36c3-3 5-5 8-5s5 2 7 3"/></g><path d="M0 0h64v64H0z" fill="none"/></svg>
        <svg v-else viewBox="0 0 64 64" class="lb-svg"><rect width="64" height="64" fill="#EFE9DE"/><g stroke="#fff" stroke-width="2.6" transform="rotate(45 32 32)"><path d="M-24 4h112M-24 20h112M-24 36h112M-24 52h112M-24 68h112"/><path d="M4-24v112M20-24v112M36-24v112M52-24v112M68-24v112"/></g><path d="M-6 46 70 12" stroke="#E4C275" stroke-width="4"/></svg>
      </span>
      <span class="lb-card-t">Capas</span>
    </button>

    <!-- Desplegable: mapas base + vista -->
    <div v-show="open" class="lb-panel">
      <div class="lb-group">
        <span class="lb-group-t">Mapa base</span>
        <div class="lb-row">
          <button
            v-for="b in BASES" :key="b.id"
            class="lb-card lb-base" :class="{ on: basemap === b.id }"
            @click="setBasemap(b.id)" :title="`Mapa base: ${b.label}`"
          >
            <span class="lb-thumb">
              <img v-if="b.img" :src="b.img" alt="" loading="lazy">
              <svg v-else-if="b.id === 'relieve'" viewBox="0 0 64 64" class="lb-svg"><rect width="64" height="64" fill="#E7EEDC"/><g fill="none" stroke="#BFA478" stroke-width="1.5"><path d="M2 50c9-3 13-11 21-11s13 7 21 5 12-7 18-7"/><path d="M6 58c8-4 12-15 22-15s15 10 24 7"/><path d="M16 43c4-4 7-8 12-8s8 4 12 4"/><path d="M24 36c3-3 5-5 8-5s5 2 7 3"/></g></svg>
              <svg v-else viewBox="0 0 64 64" class="lb-svg"><rect width="64" height="64" fill="#EFE9DE"/><g stroke="#fff" stroke-width="2.6" transform="rotate(45 32 32)"><path d="M-24 4h112M-24 20h112M-24 36h112M-24 52h112M-24 68h112"/><path d="M4-24v112M20-24v112M36-24v112M52-24v112M68-24v112"/></g><path d="M-6 46 70 12" stroke="#E4C275" stroke-width="4"/></svg>
            </span>
            <span class="lb-card-t">{{ b.label }}</span>
          </button>
        </div>
      </div>

      <div class="lb-sep"></div>

      <div class="lb-group">
        <span class="lb-group-t">Vista</span>
        <div class="lb-row">
          <button class="lb-chip" :class="{ on: relieve3d }" @click="toggleRelieve3d()" title="Terreno en 3D con la altura real">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m3 19 6-11 4 7 3-4 5 8z"/></svg>
            <span>Relieve 3D</span>
          </button>
          <button class="lb-chip" :class="{ on: edificios3d }" @click="toggleEdificios3d()" title="Edificios en volumen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 21V9l6-4 6 4v12"/><path d="M16 21V13l4-2.5V21"/><path d="M8 21v-4h4v4"/></svg>
            <span>Edificios 3D</span>
          </button>
          <button class="lb-chip" @click="openControls()" title="Herramientas: medir distancia y radio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>
            <span>Más</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* left:82 = ancho del rail (66) + aire. Misma columna que el buscador y el panel lateral. */
.layers-bar { position: absolute; bottom: 20px; left: 82px; z-index: 1050; display: flex; align-items: flex-end; gap: 10px; }

/* Tarjeta con miniatura (mapa base) */
.lb-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px; flex: none;
  padding: 6px 6px 7px; cursor: pointer; border-radius: 12px;
  border: 1px solid var(--edge); background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow: inset 0 1px 0 var(--edge-hi), var(--shadow-md);
  transition: border-color var(--dur) var(--ease), transform var(--dur-fast) var(--ease);
}
.lb-card:hover { border-color: var(--carto); transform: translateY(-2px); }
.lb-card:active { transform: translateY(0); }
.lb-card-t { font: 600 var(--fs-xs)/1 var(--sans); color: var(--text-lo); }
.lb-card:hover .lb-card-t { color: var(--text-hi); }

.lb-thumb { display: block; width: 54px; height: 40px; border-radius: 7px; overflow: hidden; background: var(--surface-3); }
.lb-thumb img, .lb-svg { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Mapa base seleccionado: anillo azul, como el "activo" del resto de la app */
.lb-base.on { border-color: var(--carto); box-shadow: 0 0 0 1px var(--carto), var(--shadow-md); }
.lb-base.on .lb-card-t { color: var(--carto); font-weight: 700; }

/* Panel desplegable */
.lb-panel {
  display: flex; align-items: stretch; gap: 14px; padding: 11px 14px 12px;
  border-radius: 14px; border: 1px solid var(--edge);
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow: inset 0 1px 0 var(--edge-hi), var(--shadow-float);
}
.lb-group { display: flex; flex-direction: column; gap: 8px; }
.lb-group-t { font: 700 var(--fs-label)/1 var(--sans); letter-spacing: var(--tk-label); text-transform: uppercase; color: var(--text-mut); }
.lb-row { display: flex; align-items: flex-end; gap: 8px; }
.lb-sep { width: 1px; background: var(--edge); flex: none; }

/* Interruptores de vista */
.lb-chip {
  display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 13px; cursor: pointer;
  border: 1px solid var(--edge); border-radius: var(--r-pill); background: var(--surface-2);
  color: var(--text); font: 600 var(--fs-sm)/1 var(--sans); white-space: nowrap;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.lb-chip svg { width: 15px; height: 15px; flex: none; }
.lb-chip:hover { border-color: var(--carto); color: var(--carto); }
.lb-chip:active { background: var(--surface-3); }
.lb-chip.on { background: color-mix(in srgb, var(--carto) 14%, transparent); border-color: var(--carto); color: var(--carto); }

/* Móvil: pospuesto (se resuelve con el resto del layout móvil) */
@media (max-width: 680px) { .layers-bar { display: none; } }
</style>
