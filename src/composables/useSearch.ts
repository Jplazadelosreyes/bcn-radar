// ═══════════════════════════════════════════════════════════════════════════════
//  useSearch — geocoding de direcciones (Nominatim/OSM): vuela a la dirección y clava
//  el pin. Singleton. Comparte el marcador con el click en el mapa (useMapStore.marker).
// ═══════════════════════════════════════════════════════════════════════════════
import { ref } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMapStore } from './useMapStore.js'

const searchQuery = ref('')

export function useSearch() {
  const { map: mapRef, marker } = useMapStore()

  async function buscar() {
    const map = mapRef.value
    if (!searchQuery.value || !map) return
    // Nominatim gratuito; se acota a Barcelona automáticamente.
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.value + ', Barcelona')}`
    try {
      const response = await fetch(url)
      const results = await response.json()
      if (results && results.length > 0) {
        const { lat, lon, display_name } = results[0]
        map.flyTo({ center: [Number(lon), Number(lat)], zoom: 17 })
        const popup = new maplibregl.Popup({ offset: 24 }).setHTML(`<b>🏠 Dirección encontrada:</b><br>${display_name}`)
        if (marker.current) {
          marker.current.setLngLat([Number(lon), Number(lat)]).setPopup(popup)
        } else {
          marker.current = new maplibregl.Marker({ color: '#D24B3E' }).setLngLat([Number(lon), Number(lat)]).setPopup(popup).addTo(map)
        }
        marker.current.togglePopup()
      } else {
        alert('No se encontró la dirección. Intenta quitar el número o ser más general.')
      }
    } catch (error) {
      console.error('Error en la búsqueda:', error)
    }
  }

  return { searchQuery, buscar }
}
