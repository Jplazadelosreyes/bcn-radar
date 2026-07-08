// ═══════════════════════════════════════════════════════════════════════════════
//  Store del mapa (composable singleton) — estado compartido del mapa entre
//  componentes. La app no dispersa el estado en App.vue: lo expone aquí para que
//  MapCanvas, MapFabs, Sidebar, etc. lo consuman.
//
//  El estado vive a nivel de módulo → una sola instancia para toda la app.
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, shallowRef, type ShallowRef, type Ref } from 'vue'
import type { Marker } from 'maplibre-gl'

// Instancia única de MapLibre. `any` a propósito: éste es el LÍMITE con la API
// imperativa de MapLibre (expresiones de estilo, feature-state, capas dinámicas).
// Tiparlo estrictamente obligaría a castear cada expresión de pintado; el patrón
// idiomático Vue+MapLibre es tratar el handle como opaco en la capa de integración.
// shallowRef porque el objeto `map` es enorme y no debe volverse reactivo en profundidad.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const map: ShallowRef<any> = shallowRef(null)

// Contexto de drill-down por zoom: ciudad → distrito → barrio → sección → finca.
// Lo lee la ficha de Información para decidir qué nivel mostrar.
export type DrillLevel = 'ciudad' | 'distrito' | 'barrio' | 'seccion' | 'finca'
export interface MapContext {
  level: DrillLevel
  distritoName: string | null
  barrioName: string | null
  seccionCode: string | null
}
const mapContext: Ref<MapContext> = ref({
  level: 'ciudad',
  distritoName: null,
  barrioName: null,
  seccionCode: null,
})

// Capas cuyo clic abre un popup (overlays) o son paradas de transporte: el click-handler
// del mapa las consulta para NO seleccionar finca encima. Las llenan los stores de capas.
const overlayClickLayers: string[] = []
const stopLayerIds: string[] = []

// Marcador único de la finca/dirección actual (lo comparten búsqueda y click en el mapa).
const marker: { current: Marker | null } = { current: null }

export function useMapStore() {
  return { map, mapContext, overlayClickLayers, stopLayerIds, marker }
}
