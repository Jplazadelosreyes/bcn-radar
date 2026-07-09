// ═══════════════════════════════════════════════════════════════════════════════
//  useFincaPicker — selección de finca al clic sobre el mapa (a nivel calle, zoom ≥ 16).
//  Orquesta la "magia interactiva": pin en el punto, situación urbanística (PIU) en paralelo,
//  reverse-geocoding (Nominatim) → dirección legible, y coords → ref. de parcela → finca
//  (Catastro). Escribe los stores useFinca / useSearch; el marcador vive en useMapStore.
//
//  Se separó de MapCanvas para que el componente sea solo el ensamblaje del motor y esta
//  lógica de negocio quede aislada. `any` a nivel de archivo: LÍMITE con MapLibre + XML crudo.
/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════════════════════════
import maplibregl from 'maplibre-gl'
import { fetchFinca } from '../services/catastro.js'
import { fetchAfectaciones } from '../services/piu.js'
import { fincaPopup } from '../services/map-popups.js'
import { useMapStore } from './useMapStore'
import { useFinca } from './useFinca'
import { useSearch } from './useSearch'

export function useFincaPicker() {
  const { marker } = useMapStore()
  const { fincaData, clickedCoords, selectedAddress, afectaciones } = useFinca()
  const { searchQuery } = useSearch()

  // Selecciona la finca en un punto: PIU + pin + geocoding + Catastro. `map` es la instancia
  // MapLibre; `lngLat` el punto del clic. Asume que el llamador ya validó el zoom/guards.
  async function selectFincaAt(map: any, lngLat: { lat: number; lng: number }) {
    const lat = lngLat.lat
    const lng = lngLat.lng
    clickedCoords.value = { lat, lng }

    // Situación urbanística (PIU) — en paralelo al Catastro, sin bloquearlo
    afectaciones.value = { estado: 'cargando' }
    fetchAfectaciones(lng, lat)
      .then((a) => { afectaciones.value = { estado: 'ok', ...a } })
      .catch((err) => { console.warn('PIU afectaciones', err); afectaciones.value = { estado: 'error' } })

    // Movemos el pin o lo creamos
    if (marker.current) {
      marker.current.setLngLat([lng, lat])
    } else {
      marker.current = new maplibregl.Marker({ color: '#D24B3E' }).setLngLat([lng, lat]).addTo(map)
    }

    // Reverse Geocoding (traducir coordenadas a calle y número)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    try {
      const response = await fetch(url)
      const data = await response.json()

      if (data && data.address) {
        const calle = data.address.road || data.address.pedestrian || 'Calle Desconocida'
        const numero = data.address.house_number || ''
        const direccionCorta = `${calle} ${numero}`.trim()
        searchQuery.value = direccionCorta
        selectedAddress.value = direccionCorta
        marker.current.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(fincaPopup(data.display_name)))
        if (!marker.current.getPopup().isOpen()) marker.current.togglePopup()
      } else {
        selectedAddress.value = `Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
        marker.current.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(fincaPopup(`Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)))
        if (!marker.current.getPopup().isOpen()) marker.current.togglePopup()
      }

      // Datos catastrales REALES: coords → ref. de parcela (14) → finca (edificio + unidad)
      fincaData.value = { ...fincaData.value, estado: 'cargando', refCatastral: null }
      try {
        const coordUrl = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=${lng}&Coordenada_Y=${lat}`
        const coordDoc = new DOMParser().parseFromString(await (await fetch(coordUrl)).text(), 'text/xml')
        const pc1 = coordDoc.getElementsByTagName('pc1')[0]?.textContent || ''
        const pc2 = coordDoc.getElementsByTagName('pc2')[0]?.textContent || ''

        if (!pc1 || !pc2) {
          fincaData.value = { estado: 'sin-parcela', refCatastral: null, rcInmueble: null, ano: null, superficie: null, uso: null, coefParticipacion: null, nInmuebles: null, plantas: null }
        } else {
          const finca = await fetchFinca(pc1 + pc2)
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
