// ═══════════════════════════════════════════════════════════════════════════════
//  useSearch — buscador de direcciones (Nominatim/OSM). Su trabajo es TRADUCIR texto a
//  coordenadas; a partir de ahí delega en useFincaPicker, el mismo camino que el clic en
//  el mapa. Buscar una dirección ES seleccionarla (modelo Google Maps).
//
//  Antes los dos caminos hacían cosas distintas: buscar volaba y ponía un pin con el popup
//  "Dirección encontrada" pero NO cargaba el dossier (había que volver a clicar encima), y
//  clicar sí lo cargaba. Mismo destino, dos resultados → quedaban cruzados.
//
//  El estado (texto y sugerencias) vive en searchState para no crear un ciclo de imports.
//  Singleton. Comparte el marcador con el clic en el mapa (useMapStore.marker).
// ═══════════════════════════════════════════════════════════════════════════════
import { useMapStore } from './useMapStore.js'
import { geocodeAddress } from '../services/geocode.js'
import { searchQuery, suggestions, setQuery, clearSuggestions, type Suggestion } from './searchState'
import { useFincaPicker } from './useFincaPicker'

export type { Suggestion }

export function useSearch() {
  const { map: mapRef } = useMapStore()
  const { selectFincaAt } = useFincaPicker()

  // Vuela a un punto y lo SELECCIONA: pin, dossier y panel los pone selectFincaAt, igual
  // que si el usuario hubiera clicado ahí. Un solo camino, un solo resultado.
  function irYSeleccionar(lat: number, lng: number) {
    const map = mapRef.value
    if (!map) return
    map.flyTo({ center: [lng, lat], zoom: 17 })
    selectFincaAt(map, { lat, lng })
  }

  // Elegir una sugerencia del desplegable.
  function pickSuggestion(s: Suggestion) {
    setQuery(s.short)
    clearSuggestions()
    irYSeleccionar(s.lat, s.lng)
  }

  // Buscar (Enter / lupa): si hay sugerencias, elige la primera; si no, geocodifica el texto.
  async function buscar() {
    const map = mapRef.value
    if (!searchQuery.value || !map) return
    if (suggestions.value.length) { pickSuggestion(suggestions.value[0]); return }
    try {
      const hit = await geocodeAddress(searchQuery.value)
      if (!hit) {
        alert('No se encontró la dirección. Intenta quitar el número o ser más general.')
        return
      }
      irYSeleccionar(hit.lat, hit.lng)
    } catch (error) {
      console.error('Error en la búsqueda:', error)
    }
  }

  return { searchQuery, suggestions, buscar, pickSuggestion, clearSuggestions }
}
