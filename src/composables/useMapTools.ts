// ═══════════════════════════════════════════════════════════════════════════════
//  Store de herramientas del mapa (composable singleton) — estado + acciones de los
//  controles del panel "Eines": mapa base y vista 3D. Fase 2 del refactor: saca esta
//  lógica de App.vue para que MapControls.vue la consuma sin props.
//  (radio y medir se sumarán aquí en los siguientes incrementos.)
// ═══════════════════════════════════════════════════════════════════════════════
import { ref } from 'vue'
import { useMapStore } from './useMapStore'

type Basemap = 'calle' | 'satelite' | 'orto-icgc' | 'relieve'
const basemap = ref<Basemap>('calle')
const edificios3d = ref(false)
const relieve3d = ref(false)

export function useMapTools() {
  const { map } = useMapStore()

  // Mapa base: alterna la visibilidad de las capas raster (satélite/orto/relieve);
  // 'calle' = ninguna → se ve el vectorial recoloreado por el tema.
  function setBasemap(val: Basemap) {
    basemap.value = val
    const m = map.value
    if (!m) return
    const bases: Record<string, string> = { satelite: 'satellite', 'orto-icgc': 'icgc-orto', relieve: 'topo' }
    for (const [v, id] of Object.entries(bases)) {
      if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', val === v ? 'visible' : 'none')
    }
  }

  // Edificios 3D (extrusión) + inclinación de cámara.
  function toggleEdificios3d() {
    edificios3d.value = !edificios3d.value
    const m = map.value
    if (!m) return
    if (m.getLayer('3d-buildings')) m.setLayoutProperty('3d-buildings', 'visibility', edificios3d.value ? 'visible' : 'none')
    if (edificios3d.value) {
      m.easeTo({ pitch: Math.max(m.getPitch(), 55), duration: 600 })
      if (m.getZoom() < 15) m.easeTo({ zoom: 15.5, pitch: 55 })
    } else if (!relieve3d.value) {
      m.easeTo({ pitch: 0, duration: 600 })
    }
  }

  // Relieve 3D (terreno real desde el DEM) + inclinación.
  function toggleRelieve3d() {
    relieve3d.value = !relieve3d.value
    const m = map.value
    if (!m) return
    if (relieve3d.value) {
      m.setTerrain({ source: 'dem', exaggeration: 1.5 })
      m.easeTo({ pitch: Math.max(m.getPitch(), 60), duration: 900 })
    } else {
      m.setTerrain(null)
      if (!edificios3d.value) m.easeTo({ pitch: 0, duration: 700 })
    }
  }

  return { basemap, edificios3d, relieve3d, setBasemap, toggleEdificios3d, toggleRelieve3d }
}
