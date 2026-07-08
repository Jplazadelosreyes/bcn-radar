// ═══════════════════════════════════════════════════════════════════════════════
//  Store del mapa (composable singleton) — estado compartido del mapa entre
//  componentes. Fase 1 del refactor: la app deja de tener el estado disperso en
//  App.vue y lo expone aquí para que MapCanvas, MapFabs, Sidebar, etc. lo consuman.
//
//  El estado vive a nivel de módulo → una sola instancia para toda la app.
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, shallowRef } from 'vue'

// Instancia única de MapLibre. La registra App.vue (por ahora) al crear el mapa;
// en fases siguientes la creación se moverá a MapCanvas.vue. shallowRef porque el
// objeto `map` es enorme y no queremos que Vue lo haga reactivo en profundidad.
const map = shallowRef(null)

// Contexto de drill-down por zoom: ciudad → distrito → barrio → sección → finca.
// Lo lee la ficha de Información para decidir qué nivel mostrar.
const mapContext = ref({
  level: 'ciudad', // 'ciudad' | 'distrito' | 'barrio' | 'seccion' | 'finca'
  distritoName: null,
  barrioName: null,
  seccionCode: null,
})

// Capas cuyo clic abre un popup (overlays) o son paradas de transporte: el click-handler
// del mapa las consulta para NO seleccionar finca encima. Las llenan los stores de capas.
const overlayClickLayers = []
const stopLayerIds = []

// Marcador único de la finca/dirección actual (lo comparten búsqueda y click en el mapa).
const marker = { current: null }

export function useMapStore() {
  return { map, mapContext, overlayClickLayers, stopLayerIds, marker }
}
