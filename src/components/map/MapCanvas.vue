<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any --
   MapCanvas es el LÍMITE con MapLibre GL: la instancia del mapa y los objetos de evento
   tienen tipos enormes y cambiantes; aquí `any` es deliberado y acotado a este archivo. */
// MapCanvas — dueño del ciclo de vida del mapa MapLibre: lo crea, monta las fuentes/capas
// base (basemaps, máscara, edificios 3D, radio, medición) y engancha los eventos (drill por
// zoom + selección de finca al clic, con Catastro + PIU + reverse-geocoding). Escribe los
// stores; su única UI es el lienzo del mapa.
import { onMounted, watch } from 'vue'
// El CSS de MapLibre se importa en main.js (antes que el nuestro) para que podamos
// reposicionar sus controles sin pelear con el orden de inyección.
import { createMap } from '../../composables/useMap'
import { initAutoZones } from '../../composables/useAutoZones'
import { applyMapTheme } from '../../services/map-theme.js'
import { addBasemaps, addBcnMask, add3dBuildings, addRadioLayers, addMeasureLayers } from '../../services/map-layers.js'
import { fetchAlquilerBarcelona } from '../../services/valor.js'
import { useTheme } from '../../composables/useTheme'
import { useMapStore } from '../../composables/useMapStore'
import { useFinca } from '../../composables/useFinca'
import { useMeasure } from '../../composables/useMeasure'
import { useFincaPicker } from '../../composables/useFincaPicker'

const { theme } = useTheme()
const mapStore = useMapStore()
const { mapContext, overlayClickLayers } = mapStore
const { valorZona } = useFinca()
const { measuring, addPoint } = useMeasure()
const { selectFincaAt } = useFincaPicker()

let map: any = null // instancia MapLibre (API amplia; se tipa como any a propósito)

// Recoloreo del mapa al cambiar de tema (paleta día/noche + máscara). Los colores se
// editan en src/services/map-theme.js
watch(theme, (t) => {
  const dark = t === 'dark'
  applyMapTheme(map, dark ? 'night' : 'day')
  if (map && map.getLayer('bcn-mask')) map.setPaintProperty('bcn-mask', 'fill-color', dark ? '#151D28' : '#FFFFFF')
})

onMounted(() => {
  // Valor de mercado de zona (Incasòl) — dato de ciudad, se carga una vez
  fetchAlquilerBarcelona().then(v => { valorZona.value = v }).catch(err => console.warn('Incasòl', err))

  // Instancia única del mapa (composable singleton): motor, controles nativos y gestos 3D
  map = createMap('map')
  mapStore.map.value = map // registrar la instancia en el store (para futuros componentes)

  // Contornos automáticos: Barcelona → distritos → barrios → secciones según el zoom
  initAutoZones(map, mapContext)

  // Paradas de transporte: opt-in. Solo aparecen cuando el usuario las activa en la
  // card "Movilidad y servicios". (Antes se auto-activaban a z16 y, al alejar, se
  // dibujaban todas las paradas de la ciudad = miles de puntos. Se quitó.)


  // Capas de paradas (transit/radio) — compartidas con los stores para que el click-handler
  // no confunda su clic con seleccionar finca. Las llenan useTransporteModos/useExploradorParadas y useRadio.
  const stopLayerIds = mapStore.stopLayerIds

  map.on('load', () => {
    // Paleta del mapa (día/noche) + limpieza (2D, sin paradas/POIs). Colores en map-theme.js.
    applyMapTheme(map, theme.value === 'dark' ? 'night' : 'day')

    // Capas base del motor (definidas en services/map-layers.js): basemaps raster, máscara BCN,
    // edificios 3D, radio y medición. Cada grupo es una función; aquí solo se ensamblan.
    addBasemaps(map)
    addBcnMask(map, theme.value === 'dark')
    add3dBuildings(map)
    addRadioLayers(map, stopLayerIds)
    addMeasureLayers(map)

    setDrillLevel(map.getZoom())
  })

  // Los controles de basemap / catastro / 3D los gestiona Vue (setBasemap, toggleFincas,
  // toggleEdificios3d, toggleRelieve3d) para que el checkbox nunca se desincronice del mapa.

  // ── Drill-down por zoom (Paso 1) ──
  // El sidebar cambia de capa según la altura. Los polígonos GeoJSON de
  // distritos/barrios/secciones (con hover + click para seleccionar/filtrar)
  // se portan a MapLibre en el Paso 2 con feature-state nativo.
  function setDrillLevel(z: number) {
    if (z < 12) mapContext.value.level = 'ciudad'
    else if (z < 14) mapContext.value.level = 'distrito'
    else if (z < 15) mapContext.value.level = 'barrio'
    else if (z < 16) mapContext.value.level = 'seccion'
    else mapContext.value.level = 'finca'
  }

  map.on('zoomend', () => setDrillLevel(map.getZoom()))

  // MAGIA INTERACTIVA: seleccionar la finca/dirección con el ratón (lógica en useFincaPicker).
  map.on('click', async function (e: any) {
    // En modo medición el clic añade un vértice, no selecciona finca
    if (measuring.value) {
      addPoint(e.lngLat)
      return
    }
    // Si el clic cae sobre una parada de transporte, deja que su popup lo maneje
    const guardLayers = [...stopLayerIds, ...overlayClickLayers].filter(id => map.getLayer(id))
    if (guardLayers.length && map.queryRenderedFeatures(e.point, { layers: guardLayers }).length) return
    // Solo permitimos clavar el pin si ya estamos a nivel de calle/finca (Zoom >= 16)
    if (map.getZoom() >= 16) await selectFincaAt(map, e.lngLat)
  });

})
</script>

<template>
  <div id="map" class="map-container"></div>
</template>
