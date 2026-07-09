// ═══════════════════════════════════════════════════════════════════════════════
//  useSearch — geocoding de direcciones (Nominatim/OSM): vuela a la dirección y clava
//  el pin. Singleton. Comparte el marcador con el click en el mapa (useMapStore.marker).
// ═══════════════════════════════════════════════════════════════════════════════
import { ref } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMapStore } from './useMapStore.js'
import { geocodeAddress } from '../services/geocode.js'
import { direccionPopup } from '../services/map-popups.js'

const searchQuery = ref('')

export function useSearch() {
  const { map: mapRef, marker } = useMapStore()

  async function buscar() {
    const map = mapRef.value
    if (!searchQuery.value || !map) return
    try {
      const hit = await geocodeAddress(searchQuery.value)
      if (!hit) {
        alert('No se encontró la dirección. Intenta quitar el número o ser más general.')
        return
      }
      map.flyTo({ center: [hit.lng, hit.lat], zoom: 17 })
      const popup = new maplibregl.Popup({ offset: 24 }).setHTML(direccionPopup(hit.displayName))
      if (marker.current) {
        marker.current.setLngLat([hit.lng, hit.lat]).setPopup(popup)
      } else {
        marker.current = new maplibregl.Marker({ color: '#D24B3E' }).setLngLat([hit.lng, hit.lat]).setPopup(popup).addTo(map)
      }
      marker.current.togglePopup()
    } catch (error) {
      console.error('Error en la búsqueda:', error)
    }
  }

  return { searchQuery, buscar }
}
