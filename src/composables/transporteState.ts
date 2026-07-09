// Estado compartido entre los dos dominios del transporte: los modos por línea (Overpass,
// useTransporteModos) y el explorador de parada unificado (GTFS + Overpass, useExploradorParadas).
// Se aísla aquí para que ninguno de los dos composables sea "dueño" del otro: ambos importan
// estas piezas a nivel de módulo (singleton).
import { ref } from 'vue'

// ── Tipos de dominio ──
export interface TransportLine {
  ref: string
  colour: string
}
export interface StopChip {
  id: string
  short: string
  long?: string
  color: string
  on?: boolean
}
export interface SelectedStop {
  name: string
  sub?: string
  src: string // 'gtfs' | key de modo Overpass
  chips: StopChip[]
}
export type LoadStatus = 'loading' | 'ok' | 'error'

// Catálogo de líneas por modo (lo llena loadTransport) y selección visible (la mueven tanto
// los controles de modo como el explorador). La parada abierta es unificada (GTFS u Overpass).
export const transportLines = ref<Record<string, TransportLine[]>>({}) // key -> [{ ref, colour }]
export const transportSelected = ref<Record<string, string[]>>({}) // key -> [refs visibles]
export const selectedStop = ref<SelectedStop | null>(null)

// ¿El modo Overpass tiene una selección curada (subset) o muestra todas sus líneas?
export const isCurated = (src: string): boolean => {
  const sel = transportSelected.value[src] || []
  const all = transportLines.value[src] || []
  return sel.length > 0 && sel.length < all.length
}
