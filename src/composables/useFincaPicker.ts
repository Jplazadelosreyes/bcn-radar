// ═══════════════════════════════════════════════════════════════════════════════
//  useFincaPicker — selección de finca al clic sobre el mapa (a nivel calle, zoom ≥ 16).
//  Orquesta la "magia interactiva": pin en el punto, situación urbanística (PIU) en paralelo,
//  reverse-geocoding (Nominatim) → dirección legible, y coords → ref. de parcela → finca
//  (Catastro). Escribe los stores useFinca / searchState; el marcador vive en useMapStore.
//
//  Es el ÚNICO camino para seleccionar un punto: lo usan tanto el clic en el mapa como el
//  buscador (useSearch traduce texto a coordenadas y delega aquí), así que ambos dan el
//  mismo resultado.
//
//  El pin NO abre un popup con la dirección: la misma dirección ya salía a la vez en el
//  buscador, en la ficha y en la cabecera del panel (4 sitios), y el popup era además la peor
//  versión —el display_name crudo de Nominatim, con "Barcelona" tres veces y "Spain" al final,
//  en una app que solo cubre Barcelona— mientras tapaba 240×130 px de mapa justo donde el
//  usuario acababa de pinchar. El pin marca el punto y el panel cuenta la historia; tocar el
//  pin devuelve al panel si estaba cerrado.
//
//  Se separó de MapCanvas para que el componente sea solo el ensamblaje del motor y esta
//  lógica de negocio quede aislada. `any` a nivel de archivo: LÍMITE con MapLibre + XML crudo.
/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════════════════════════
import maplibregl from 'maplibre-gl'
import { fetchFinca, fetchRefFromCoords } from '../services/catastro.js'
import { fetchAfectaciones } from '../services/piu.js'
import { reverseGeocode } from '../services/geocode.js'
import { useMapStore } from './useMapStore'
import { useFinca } from './useFinca'
import { setQuery } from './searchState'
import { usePanels } from './usePanels'

export function useFincaPicker() {
  const { marker } = useMapStore()
  const { fincaData, clickedCoords, selectedAddress, afectaciones } = useFinca()
  const { openSection } = usePanels()

  // Selecciona la finca en un punto: PIU + pin + geocoding + Catastro. `map` es la instancia
  // MapLibre; `lngLat` el punto del clic. Asume que el llamador ya validó el zoom/guards.
  async function selectFincaAt(map: any, lngLat: { lat: number; lng: number }) {
    const lat = lngLat.lat
    const lng = lngLat.lng
    clickedCoords.value = { lat, lng }
    openSection('info') // abre el dossier solo, como Google Maps al tocar un sitio

    // Situación urbanística (PIU) — en paralelo al Catastro, sin bloquearlo
    afectaciones.value = { estado: 'cargando' }
    fetchAfectaciones(lng, lat)
      .then((a) => { afectaciones.value = { estado: 'ok', ...a } })
      .catch((err) => { console.warn('PIU afectaciones', err); afectaciones.value = { estado: 'error' } })

    // Movemos el pin o lo creamos. El pin NO lleva popup: solo marca el punto (ver abajo).
    // Tocarlo devuelve al dossier, que es lo que el usuario querría con la ficha cerrada.
    if (marker.current) {
      marker.current.setLngLat([lng, lat])
    } else {
      marker.current = new maplibregl.Marker({ color: '#D24B3E' }).setLngLat([lng, lat]).addTo(map)
      const el = marker.current.getElement()
      el.style.cursor = 'pointer'
      el.title = 'Ver la ficha de esta finca'
      el.addEventListener('click', (e: Event) => { e.stopPropagation(); openSection('info') })
    }

    // Reverse Geocoding (coordenadas → calle y número) vía services/geocode
    try {
      const data = await reverseGeocode(lat, lng)

      if (data) {
        const calle = data.address.road || data.address.pedestrian || 'Calle Desconocida'
        const numero = data.address.house_number || ''
        const direccionCorta = `${calle} ${numero}`.trim()
        // setQuery y no searchQuery.value: escribirlo directo despertaba al autocompletado y
        // el desplegable se abría solo sobre el panel al clicar una finca.
        setQuery(direccionCorta)
        selectedAddress.value = direccionCorta
      } else {
        selectedAddress.value = `Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      }

      // Datos catastrales REALES: coords → ref. de parcela (14) → finca (edificio + unidad)
      fincaData.value = { ...fincaData.value, estado: 'cargando', refCatastral: null }
      try {
        const rc14 = await fetchRefFromCoords(lng, lat)

        if (!rc14) {
          fincaData.value = { estado: 'sin-parcela', refCatastral: null, rcInmueble: null, ano: null, superficie: null, uso: null, coefParticipacion: null, nInmuebles: null, plantas: null }
        } else {
          const finca = await fetchFinca(rc14)
          fincaData.value = {
            estado: 'ok',
            refCatastral: finca.rc14,
            rcInmueble: finca.rcInmueble,
            ano: finca.ano,
            superficie: finca.superficie,
            uso: finca.uso,
            coefParticipacion: finca.coefParticipacion,
            nInmuebles: finca.nInmuebles,
            plantas: finca.plantas,
          }
        }
      } catch (catErr) {
        console.error('Error Catastro', catErr)
        fincaData.value = { ...fincaData.value, estado: 'error' }
      }
    } catch (error) {
      console.error('Error obteniendo la dirección:', error)
    }
  }

  return { selectFincaAt }
}
