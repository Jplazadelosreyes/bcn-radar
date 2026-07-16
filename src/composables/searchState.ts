// ═══════════════════════════════════════════════════════════════════════════════
//  searchState — estado del buscador (texto + sugerencias) y el autocompletado.
//
//  Vive aparte de useSearch por la misma razón que transporteState: lo comparten dos
//  dominios que no deben ser dueños el uno del otro. useSearch (buscar) lo lee y escribe;
//  useFincaPicker (clic en el mapa) solo necesita rellenar el texto. Si el estado viviera
//  en useSearch, useFincaPicker → useSearch → useFincaPicker sería un ciclo de imports.
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, watch } from 'vue'
import { suggestAddresses } from '../services/geocode.js'

export interface Suggestion { lat: number; lng: number; short: string; label: string }

export const searchQuery = ref('')
export const suggestions = ref<Suggestion[]>([])

let debounce: ReturnType<typeof setTimeout> | null = null
let suppress = false // el texto lo ha puesto la app, no el usuario → no pedir sugerencias

// Autocompletado reactivo: al teclear, pide sugerencias con un pequeño retraso (no spamea).
watch(searchQuery, (q) => {
  if (suppress) { suppress = false; return }
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(async () => {
    try { suggestions.value = await suggestAddresses(q) } catch { suggestions.value = [] }
  }, 350)
})

// Rellena el buscador DESDE LA APP (p. ej. al clicar una finca) sin disparar el autocompletado.
// Sin esto, escribir en searchQuery despertaba al watcher y el desplegable se abría solo encima
// del panel, con sugerencias que el usuario no había pedido.
export function setQuery(text: string) {
  if (searchQuery.value === text) return // el watcher no dispararía y el flag se quedaría colgado
  suppress = true
  if (debounce) clearTimeout(debounce)
  suggestions.value = []
  searchQuery.value = text
}

export function clearSuggestions() { suggestions.value = [] }
