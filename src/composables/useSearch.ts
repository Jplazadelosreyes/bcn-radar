// ═══════════════════════════════════════════════════════════════════════════════
//  useSearch — buscador de direcciones con autocompletado (Nominatim/OSM). Al escribir,
//  ofrece sugerencias (debounce); al elegir una o pulsar Enter, vuela y clava el pin.
//  Singleton. Comparte el marcador con el click en el mapa (useMapStore.marker).
// ═══════════════════════════════════════════════════════════════════════════════
import { ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMapStore } from './useMapStore.js'
import { geocodeAddress, suggestAddresses } from '../services/geocode.js'
import { direccionPopup } from '../services/map-popups.js'

interface Suggestion { lat: number; lng: number; short: string; label: string }

const searchQuery = ref('')
const suggestions = ref<Suggestion[]>([])
let debounce: ReturnType<typeof setTimeout> | null = null
let suppress = false // tras elegir una sugerencia, no re-pedir sugerencias por ese cambio de texto

// Autocompletado reactivo: al teclear, pide sugerencias con un pequeño retraso (no spamea).
watch(searchQuery, (q) => {
  if (suppress) { suppress = false; return }
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(async () => {
    try { suggestions.value = await suggestAddresses(q) } catch { suggestions.value = [] }
  }, 350)
})

export function useSearch() {
  const { map: mapRef, marker } = useMapStore()

  // Vuela a un punto y clava/mueve el pin con su popup.
  function flyTo(lat: number, lng: number, displayName: string) {
    const map = mapRef.value
    if (!map) return
    map.flyTo({ center: [lng, lat], zoom: 17 })
    const popup = new maplibregl.Popup({ offset: 24 }).setHTML(direccionPopup(displayName))
    if (marker.current) {
      marker.current.setLngLat([lng, lat]).setPopup(popup)
    } else {
      marker.current = new maplibregl.Marker({ color: '#D24B3E' }).setLngLat([lng, lat]).setPopup(popup).addTo(map)
    }
    marker.current.togglePopup()
  }

  // Elegir una sugerencia del desplegable.
  function pickSuggestion(s: Suggestion) {
    suppress = true
    searchQuery.value = s.short
    suggestions.value = []
    flyTo(s.lat, s.lng, s.label)
  }

  function clearSuggestions() { suggestions.value = [] }

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
      flyTo(hit.lat, hit.lng, hit.displayName)
    } catch (error) {
      console.error('Error en la búsqueda:', error)
    }
  }

  return { searchQuery, suggestions, buscar, pickSuggestion, clearSuggestions }
}
