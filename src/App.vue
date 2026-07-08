<script setup>
import { onMounted, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchFinca } from './services/catastro.js'
import { fetchAfectaciones } from './services/piu.js'
import { fetchAlquilerBarcelona } from './services/valor.js'
import { useTheme } from './composables/useTheme.js'
import { createMap } from './composables/useMap.js'
import { usePanels } from './composables/usePanels.js'
import { initAutoZones } from './composables/useAutoZones.js'
import TheTopbar from './components/TheTopbar.vue'
import { applyMapTheme } from './services/map-theme.js'
import { useMapStore } from './composables/useMapStore.js'
import MapFabs from './components/map/MapFabs.vue'
import StopExplorer from './components/map/StopExplorer.vue'
import MapControls from './components/map/MapControls.vue'
import { useSheetDrag } from './composables/useSheetDrag.js'
import ZonasCard from './components/sidebar/ZonasCard.vue'
import CapasCard from './components/sidebar/CapasCard.vue'
import MovilidadCard from './components/sidebar/MovilidadCard.vue'
import InfoDossier from './components/sidebar/InfoDossier.vue'
import { useMovilidad } from './composables/useMovilidad.js'
import { useFinca } from './composables/useFinca.js'
import { haversine } from './services/overpass.js'

// Tema claro/oscuro (estado compartido en el composable). El chrome lo gestiona
// useTheme; aquí recoloreamos el mapa (paleta completa día/noche) + la máscara.
// ⚙️  Los colores del mapa se editan en src/services/map-theme.js
const { theme } = useTheme()
watch(theme, (t) => {
  const dark = t === 'dark'
  applyMapTheme(map, dark ? 'night' : 'day')
  if (map && map.getLayer('bcn-mask')) map.setPaintProperty('bcn-mask', 'fill-color', dark ? '#0B1017' : '#FFFFFF')
})

// Paneles ocultables (composable singleton): todos parten colapsados, potencia incremental
const { isMobile, sidebarOpen, controlsOpen, utilsOpen } = usePanels()

// Bottom sheets (móvil) con arrastre real en el asa y snap de 3 estados:
// compacto ⇄ expandido (arrastrar arriba) ⇄ cerrado (arrastrar abajo desde compacto).
// Bajar estando expandido colapsa además todas las cards (vuelta al estado mínimo).
// Arrastre del asa de los sheets (composable compartido). El sidebar colapsa las cards
// al bajar desde expandido; los controles no lo necesitan (importan useSheetDrag sin callback).
const { sheetFull, start: sheetTouchStart, move: sheetTouchMove, end: sheetTouchEnd } = useSheetDrag(() => { cardOpen.value = {} })

// Variables reactivas para el panel
const searchQuery = ref('')
const measureTotal = ref(null) // distancia acumulada de la herramienta de medición

// Estado del mapa centralizado en el store (Fase 1 del refactor a componentes).
// `map` sigue como variable local de trabajo aquí y se registra en el store al crearse.
const mapStore = useMapStore()
const mapContext = mapStore.mapContext

// Estado de la finca: aquí solo lo que escribe la lógica de fetch (onMounted). El dossier
// (InfoDossier) consume el resto de useFinca directamente.
const { fincaData, clickedCoords, selectedAddress, afectaciones, valorZona } = useFinca()

// Explorador de parada (store useMovilidad): lo consume el StopExplorer del área del mapa.
const { selectedStop, stopChipsView, stopHasSelection, pickStopLine, clearRoute, stopClear } = useMovilidad()

// Cards del sidebar: expansión INDEPENDIENTE (se pueden mezclar capas de varias:
// metro + distritos, etc.). En móvil el sheet abre con todo colapsado (incremental).
const cardOpen = ref(isMobile.value ? {} : { info: true }) // id -> abierta
function toggleCard(id) { cardOpen.value = { ...cardOpen.value, [id]: !cardOpen.value[id] } }
watch(sidebarOpen, (open) => { if (open && isMobile.value) { cardOpen.value = {}; sheetFull.value = false } })
let map = null
let searchMarker = null
// Compartido con los stores (useZones, etc.): capas cuyo clic abre popup y NO selecciona finca.
const overlayClickLayers = mapStore.overlayClickLayers

// Función de Geocoding (Convertir texto a Coordenadas)
const buscarDireccion = async () => {
  if (!searchQuery.value) return;
  
  // Usamos la API gratuita de Nominatim (OpenStreetMap)
  // Agregamos ", Barcelona" automáticamente para acotar la búsqueda a la ciudad
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.value + ', Barcelona')}`
  
  try {
    const response = await fetch(url)
    const results = await response.json()
    
    if (results && results.length > 0) {
      const { lat, lon, display_name } = results[0]
      
      // Hacemos zoom directamente a la calle encontrada
      map.flyTo({ center: [Number(lon), Number(lat)], zoom: 17 })

      // Clavamos (o movemos) el pin en la dirección exacta
      const popup = new maplibregl.Popup({ offset: 24 }).setHTML(`<b>🏠 Dirección encontrada:</b><br>${display_name}`)
      if (searchMarker) {
        searchMarker.setLngLat([Number(lon), Number(lat)]).setPopup(popup)
      } else {
        searchMarker = new maplibregl.Marker({ color: '#D24B3E' }).setLngLat([Number(lon), Number(lat)]).setPopup(popup).addTo(map)
      }
      searchMarker.togglePopup()

    } else {
      alert("No se encontró la dirección. Intenta quitar el número o ser más general.")
    }
  } catch (error) {
    console.error("Error en la búsqueda:", error)
  }
}

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

  // ── Herramienta de medición de distancias ──
  let measuring = false
  const measurePoints = []
  const renderMeasure = () => {
    const feats = measurePoints.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p } }))
    if (measurePoints.length >= 2) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: measurePoints } })
    const src = map.getSource('measure')
    if (src) src.setData({ type: 'FeatureCollection', features: feats })
    let total = 0
    for (let i = 1; i < measurePoints.length; i++) total += haversine(measurePoints[i - 1], measurePoints[i])
    measureTotal.value = measurePoints.length < 2 ? null : (total >= 1000 ? `${(total / 1000).toFixed(2)} km` : `${Math.round(total)} m`)
  }
  const clearMeasure = () => { measurePoints.length = 0; renderMeasure() }
  const setMeasuring = (on) => {
    measuring = on
    map.getCanvas().style.cursor = on ? 'crosshair' : ''
    if (!on) clearMeasure()
  }
  const checkMeasure = document.getElementById('check-measure')
  if (checkMeasure) checkMeasure.addEventListener('change', (e) => setMeasuring(e.target.checked))
  const btnMeasureClear = document.getElementById('btn-measure-clear')
  if (btnMeasureClear) btnMeasureClear.addEventListener('click', () => clearMeasure())

  // Capas de paradas (transit/radio) — compartidas con los stores para que el click-handler
  // no confunda su clic con seleccionar finca. Las llenan useMovilidad y useRadio.
  const stopLayerIds = mapStore.stopLayerIds

  map.on('load', () => {
    // Aplica la paleta de colores del mapa (día/noche) + limpieza (2D, sin paradas/POIs).
    // Los colores se editan en src/services/map-theme.js
    applyMapTheme(map, theme.value === 'dark' ? 'night' : 'day')

    // Modelo de elevación (DEM) para el terreno 3D real — AWS Terrain Tiles (terrarium, CORS, sin key)
    map.addSource('dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256, encoding: 'terrarium', maxzoom: 14,
      attribution: 'Elevación: Mapzen / AWS Terrain Tiles',
    })

    // Satélite de alta resolución (ESRI) como fuente raster
    map.addSource('satellite', {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19, // ESRI no sirve tiles >19: MapLibre sobre-escala (borroso) en vez de dejar el hueco
      attribution: 'Tiles © Esri — World Imagery',
    })
    map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } })

    // Basemaps ICGC (WMS, EPSG:3857 + CORS verificados) — alternativas de alta calidad
    map.addSource('icgc-orto', {
      type: 'raster',
      tiles: ['https://geoserveis.icgc.cat/servei/catalunya/orto-territorial/wms/service?service=WMS&request=GetMap&version=1.3.0&layers=ortofoto_color_vigent&styles=&format=image/png&transparent=false&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256'],
      tileSize: 256,
      attribution: 'Ortofoto © Institut Cartogràfic i Geològic de Catalunya',
    })
    map.addLayer({ id: 'icgc-orto', type: 'raster', source: 'icgc-orto', layout: { visibility: 'none' } })
    // Relieve topográfico (OpenTopoMap): sombreado + curvas de nivel con cotas — muestra la "altura"
    map.addSource('topo', {
      type: 'raster',
      tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'],
      tileSize: 256, maxzoom: 17,
      attribution: '© OpenTopoMap (CC-BY-SA)',
    })
    map.addLayer({ id: 'topo', type: 'raster', source: 'topo', layout: { visibility: 'none' } })

    // WMS Catastro (límites de parcela) como overlay raster opcional
    map.addSource('catastro', {
      type: 'raster',
      tiles: ['https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx?service=WMS&request=GetMap&version=1.1.1&layers=Catastro&styles=&format=image/png&transparent=true&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256'],
      tileSize: 256,
      attribution: 'Dirección General del Catastro',
    })
    map.addLayer({ id: 'catastro', type: 'raster', source: 'catastro', layout: { visibility: 'none' } })

    // Máscara: atenúa todo lo que NO es el término municipal de Barcelona (foco visual)
    fetch('https://raw.githubusercontent.com/martgnz/bcn-geodata/master/terme-municipal/terme-municipal.geojson')
      .then(r => r.json())
      .then(geo => {
        const holes = []
        for (const feat of geo.features) {
          const g = feat.geometry
          if (g.type === 'Polygon') holes.push(g.coordinates[0])
          else if (g.type === 'MultiPolygon') g.coordinates.forEach(poly => holes.push(poly[0]))
        }
        const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
        map.addSource('bcn-mask', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...holes] } } })
        // La máscara atenúa lo que NO es Barcelona: clara en tema claro, oscura en tema oscuro
        map.addLayer({ id: 'bcn-mask', type: 'fill', source: 'bcn-mask', paint: { 'fill-color': theme.value === 'dark' ? '#0B1017' : '#FFFFFF', 'fill-opacity': 0.6 } })
      })
      .catch(err => console.warn('No se pudo cargar la máscara de Barcelona:', err))

    // Edificios 3D: extrusión sobre la capa building del estilo vectorial
    try {
      map.addLayer({
        id: '3d-buildings',
        source: 'openmaptiles',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 14,
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#c2cbdb',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 9],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.88,
        },
      })
    } catch (err) {
      console.warn('No se pudo añadir la capa 3D de edificios:', err)
    }

    // Radio de exploración desde la finca
    map.addSource('radio', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'radio-fill', type: 'fill', source: 'radio', paint: { 'fill-color': '#2D5BD0', 'fill-opacity': 0.08 } })
    map.addLayer({ id: 'radio-line', type: 'line', source: 'radio', paint: { 'line-color': '#2D5BD0', 'line-width': 2, 'line-dasharray': [2, 2] } })

    // Paradas dentro del radio
    map.addSource('radio-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'radio-stops', type: 'circle', source: 'radio-stops', paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } })
    map.on('click', 'radio-stops', (e) => {
      const p = e.features[0].properties
      new maplibregl.Popup({ offset: 12 }).setLngLat(e.lngLat).setHTML(`<b>${p.name}</b><br><span style="color:#5B616B">${p.modo}${p.lines ? ' · ' + p.lines : ''}</span>`).addTo(map)
    })
    map.on('mouseenter', 'radio-stops', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'radio-stops', () => { map.getCanvas().style.cursor = '' })
    stopLayerIds.push('radio-stops')

    // Capa de medición de distancias
    map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: 'measure-line', type: 'line', source: 'measure', filter: ['==', '$type', 'LineString'],
      paint: { 'line-color': '#2D5BD0', 'line-width': 2.5, 'line-dasharray': [2, 1] },
    })
    map.addLayer({
      id: 'measure-points', type: 'circle', source: 'measure', filter: ['==', '$type', 'Point'],
      paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#2D5BD0', 'circle-stroke-width': 2 },
    })

    setDrillLevel(map.getZoom())
  })

  // Los controles de basemap / catastro / 3D los gestiona Vue (setBasemap, toggleFincas,
  // toggleEdificios3d, toggleRelieve3d) para que el checkbox nunca se desincronice del mapa.

  // ── Drill-down por zoom (Paso 1) ──
  // El sidebar cambia de capa según la altura. Los polígonos GeoJSON de
  // distritos/barrios/secciones (con hover + click para seleccionar/filtrar)
  // se portan a MapLibre en el Paso 2 con feature-state nativo.
  function setDrillLevel(z) {
    if (z < 12) mapContext.value.level = 'ciudad'
    else if (z < 14) mapContext.value.level = 'distrito'
    else if (z < 15) mapContext.value.level = 'barrio'
    else if (z < 16) mapContext.value.level = 'seccion'
    else mapContext.value.level = 'finca'
  }

  map.on('zoomend', () => setDrillLevel(map.getZoom()))

  // MAGIA INTERACTIVA: Seleccionar la finca/dirección con el ratón
  map.on('click', async function(e) {
    // En modo medición el clic añade un vértice, no selecciona finca
    if (measuring) {
      measurePoints.push([e.lngLat.lng, e.lngLat.lat])
      renderMeasure()
      return
    }
    // Si el clic cae sobre una parada de transporte, deja que su popup lo maneje
    const guardLayers = [...stopLayerIds, ...overlayClickLayers].filter(id => map.getLayer(id))
    if (guardLayers.length && map.queryRenderedFeatures(e.point, { layers: guardLayers }).length) return
    // Solo permitimos clavar el pin si ya estamos a nivel de calle/finca (Zoom >= 16)
    if (map.getZoom() >= 16) {
      const lat = e.lngLat.lat;
      const lng = e.lngLat.lng;
      clickedCoords.value = { lat, lng };

      // Situación urbanística (PIU) — en paralelo al Catastro, sin bloquearlo
      afectaciones.value = { estado: 'cargando' };
      fetchAfectaciones(lng, lat)
        .then(a => { afectaciones.value = { estado: 'ok', ...a }; })
        .catch(err => { console.warn('PIU afectaciones', err); afectaciones.value = { estado: 'error' }; });

      // Movemos el pin o lo creamos
      if (searchMarker) {
        searchMarker.setLngLat([lng, lat]);
      } else {
        searchMarker = new maplibregl.Marker({ color: '#D24B3E' }).setLngLat([lng, lat]).addTo(map);
      }

      // Reverse Geocoding (Traducir coordenadas a Calle y Número)
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.address) {
          // Extraemos la calle y el número
          const calle = data.address.road || data.address.pedestrian || 'Calle Desconocida';
          const numero = data.address.house_number || '';
          const direccionCorta = `${calle} ${numero}`.trim();
          
          // Actualizamos la caja de búsqueda visualmente para el usuario
          searchQuery.value = direccionCorta;
          selectedAddress.value = direccionCorta;
          
          searchMarker.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`<b>🏢 Finca Seleccionada</b><br>${data.display_name}`));
          if (!searchMarker.getPopup().isOpen()) searchMarker.togglePopup();
        } else {
          selectedAddress.value = `Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          searchMarker.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`<b>🏢 Finca Seleccionada</b><br>Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`));
          if (!searchMarker.getPopup().isOpen()) searchMarker.togglePopup();
        }

        // Datos catastrales REALES: coords → ref. de parcela (14) → finca (edificio + unidad)
        fincaData.value = { ...fincaData.value, estado: 'cargando', refCatastral: null };
        try {
          const coordUrl = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=${lng}&Coordenada_Y=${lat}`;
          const coordDoc = new DOMParser().parseFromString(await (await fetch(coordUrl)).text(), 'text/xml');
          const pc1 = coordDoc.getElementsByTagName('pc1')[0]?.textContent || '';
          const pc2 = coordDoc.getElementsByTagName('pc2')[0]?.textContent || '';

          if (!pc1 || !pc2) {
            fincaData.value = { estado: 'sin-parcela', refCatastral: null, ano: null, superficie: null, uso: null, nInmuebles: null, plantas: null };
          } else {
            const finca = await fetchFinca(pc1 + pc2);
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
            };
          }
        } catch (catErr) {
          console.error('Error Catastro', catErr);
          fincaData.value = { ...fincaData.value, estado: 'error' };
        }

      } catch (error) {
        console.error("Error obteniendo la dirección:", error);
      }
    }
  });

})
</script>

<template>
  <div class="app-container">
    <TheTopbar v-model:query="searchQuery" @search="buscarDireccion" />
    
    <main class="main-content">
      
      <!-- PANEL LATERAL (IZQUIERDA) -->
      <aside class="sidebar" :class="{ open: sidebarOpen, full: sheetFull }">
        <button class="sheet-handle" @click="sidebarOpen = false" @touchstart.passive="sheetTouchStart" @touchmove.passive="sheetTouchMove" @touchend="(e) => sheetTouchEnd(e, () => (sidebarOpen = false), true)" title="Cerrar" aria-label="Cerrar panel"><span></span></button>
        <button class="panel-close" @click="sidebarOpen = false" title="Cerrar">✕</button>

        <!-- INFORMACIÓN — dossier contextual que sigue el nivel de zoom (ciudad→distrito→barrio→sección→finca) -->
        <InfoDossier :open="!!cardOpen['info']" @toggle="toggleCard('info')" />

        <!-- CAPAS PÚBLICAS — agregador WMS (persistente, sobre las fichas contextuales) -->
        <CapasCard :open="!!cardOpen['capas']" @toggle="toggleCard('capas')" />

        <!-- MOVILIDAD Y SERVICIOS — capas de datos abiertos en vivo -->
        <MovilidadCard :open="!!cardOpen['mov']" @toggle="toggleCard('mov')" />

        <!-- ZONAS ADMINISTRATIVAS — límites de distritos y barrios -->
        <ZonasCard :open="!!cardOpen['zonas']" @toggle="toggleCard('zonas')" />

      </aside>

      <!-- MAPA Y SUS CONTROLES (DERECHA) -->
      <div class="map-section" :class="{ 'utils-collapsed': !utilsOpen, 'sheet-open': sidebarOpen || controlsOpen || !!selectedStop }">
        <div id="map" class="map-container"></div>

        <!-- FABs sobre el mapa (utilidades/tema + reabrir paneles) -->
        <MapFabs />

        <!-- Explorador de parada: líneas que pasan → elegir una dibuja su recorrido -->
        <StopExplorer
          :stop="selectedStop" :chips="stopChipsView" :has-selection="stopHasSelection"
          @close="selectedStop = null; clearRoute()" @pick="pickStopLine" @clear="stopClear" />

        <!-- Controles flotantes del mapa (Abajo Derecha) -->
        <MapControls :measure-total="measureTotal" />
      </div>
      
    </main>
  </div>
</template>

<style>
/* ═══ BCN Radar · Sistema visual v3 — "Mediterrani" ═══
   Modernisme mediterráneo · roig BCN suau + secundario mar · serifa Spectral · esquinas de ola */
:root {
  /* ── Tema CLARO (por defecto) ── */
  --bg: #E7ECEC;         /* bruma marina: fondo / huecos */
  --surface: #FCFDFD;    /* paneles */
  --surface-2: #EFF3F3;  /* superficies elevadas / inputs / celdas */
  --surface-3: #E3EAE9;  /* hover */
  --border: #DEE7E7;     /* hairlines */
  --border-2: #CBD8D7;
  --text-hi: #22303A;    /* titulares (tinta azulada) */
  --text: #4E626E;       /* cuerpo */
  --text-lo: #64757F;    /* secundario */
  --text-mut: #8C9BA4;   /* muted */
  --accent: #BC4B41;     /* roig BCN suau (ambos temas) */
  --accent-ink: #A23A31; /* rojo legible sobre claro */
  --carto: #2F6E8F;      /* azul mar mediterráneo: datos, enlaces, secundario */
  --green: #3E8F73;
  --amber: #BE9140;
  --gold: #C29A4E;       /* dorado modernista: badges, detalles */
  --red: #C06A4C;        /* terracota: alertas cálidas */
  --display: 'Spectral', Georgia, 'Times New Roman', serif;
  --sans: 'Figtree', system-ui, sans-serif;
  --serif: 'Cormorant Garamond', Georgia, serif; /* itálicas decorativas */
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
  /* firma: esquinas de ola (radios suaves modernistas) */
  --r-card: 14px;   /* cards de sección */
  --r-inner: 10px;  /* celdas, inputs, botones */
  --r-pill: 999px;  /* píldoras / badges */
  --chaflan: 8px;   /* legado (mapa) */
  --float-bg: rgba(252,253,253,.92); /* paneles flotantes sobre el mapa */
}
/* ── Tema OSCURO (chrome + mapa) ── */
html[data-theme="dark"] {
  --float-bg: rgba(16,32,40,.92);
  --bg: #0C161C;
  --surface: #14232C;
  --surface-2: #1B2E38;
  --surface-3: #253945;
  --border: #273A44;
  --border-2: #354B56;
  --text-hi: #EAF1EF;
  --text: #BFCECC;
  --text-lo: #8598A0;
  --text-mut: #5E727B;
  --accent: #CB6155;     /* roig suave, algo más luminoso sobre fondo profundo */
  --accent-ink: #E08072;
  --carto: #63A0C0;
  --green: #58B091;
  --amber: #D3AE5E;
  --gold: #CFA85F;
  --red: #CE8367;
}
.cerdanya { border-radius: var(--r-card); }

/* ── Firma "esquinas de ola": redondeo suave de todo el chrome (mapa aparte) ── */
.map-floating-controls, .capas-src, .ficha-grid, .ficha-reg, .ficha-check,
.ver, .piu-clau, .piu-afec, .callout, .ficha-msg { border-radius: var(--r-card); }
.ficha-mini, .ficha-doc, .ficha-link, .ficha-cta, .ficha-ref-value, .ficha-source,
.src-chip, .ficha-badge, .ficha-grouptag, .capas-count, .stop-clear, .tr-search,
.measure-clear, .panel-close, .empty-state .export-btn { border-radius: var(--r-inner); }
.stop-chip, .tr-chip, .tr-mini, .mov-st, .clave-tag { border-radius: var(--r-pill); }
.ficha-grid { overflow: hidden; }

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: var(--sans); height: 100vh; width: 100vw; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
::selection { background: var(--accent); color: #fff; }
#app { height: 100%; }
.app-container { display: flex; flex-direction: column; height: 100vh; }

/* ═══ Barra superior ═══ */

.main-content { display: flex; flex: 1; overflow: hidden; }
.map-section { flex: 1; position: relative; height: 100%; background: var(--bg); }
.map-container { width: 100%; height: 100%; z-index: 1; }

/* ── Paneles ocultables + botones flotantes (base: escritorio se comporta como antes) ── */
.panel-close { display: flex; position: absolute; top: 8px; right: 8px; z-index: 30; width: 28px; height: 28px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-lo); cursor: pointer; font-size: 12px; align-items: center; justify-content: center; }
.panel-close:hover { background: var(--surface-3); color: var(--accent); }
.fab { display: flex; position: absolute; z-index: 1100; width: 46px; height: 46px; border: 1px solid var(--border-2); background: var(--float-bg); backdrop-filter: blur(8px); color: var(--text-hi); cursor: pointer; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(0,0,0,.28); border-radius: var(--r-card); }
.fab:hover { border-color: var(--accent); }
.fab-info { top: 14px; left: 14px; }
.fab-map { top: 14px; right: 60px; }
.fab-round { display: none; } /* botones redondos solo-móvil (speed-dial, tema) */
.sheet-handle { display: none; } /* asa de bottom sheet, solo móvil */

/* Escritorio: los paneles colapsados desaparecen (en móvil se deslizan fuera con transform) */
@media (min-width: 681px) {
  .sidebar:not(.open), .map-floating-controls:not(.open) { display: none; }
}

/* ═══ Controles flotantes del mapa ═══ */
.map-floating-controls { position: absolute; bottom: 22px; right: 16px; background: var(--float-bg); backdrop-filter: blur(8px); padding: 14px 15px; box-shadow: 0 12px 34px -12px rgba(0,0,0,.6); z-index: 1000; width: 210px; border: 1px solid var(--border); }
.map-floating-controls h4 { margin: 0 0 10px; font: 700 8px/1 var(--sans); color: var(--text-mut); text-transform: uppercase; letter-spacing: .16em; }
.control-group { display: flex; flex-direction: column; gap: 9px; }
.ctrl { display: flex; align-items: center; gap: 9px; font: 500 12px/1 var(--sans); color: var(--text); cursor: pointer; }
.ctrl input { accent-color: var(--accent); width: 14px; height: 14px; }
.divider { border: 0; border-top: 1px solid var(--border); margin: 13px 0; }
.ctrl-hint { font: 500 9px/1.45 var(--sans); color: var(--text-mut); margin: 8px 0 0; }
.measure-readout { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; }
.measure-total { font: 700 13px/1 var(--mono); color: var(--carto); }
.measure-clear { font: 600 9px/1 var(--sans); color: var(--text-lo); background: var(--surface-2); border: 1px solid var(--border); padding: 5px 8px; cursor: pointer; }
.measure-clear:hover { background: var(--surface-3); }
.tr-swatch { width: 14px; height: 3px; border-radius: 2px; flex: none; }
.tr-status { font: 600 8px/1 var(--mono); color: var(--text-mut); margin-left: auto; }
.tr-status.tr-err { color: var(--red); }
.tr-mode { margin-bottom: 9px; }
.tr-lines { margin: 6px 0 0 23px; }
.tr-search { width: 100%; box-sizing: border-box; font: 500 10px/1 var(--sans); color: var(--text-hi); padding: 5px 7px; border: 1px solid var(--border); background: var(--surface-2); margin-bottom: 6px; }
.tr-toolbar { display: flex; align-items: center; gap: 5px; margin: 2px 0 7px; }
.tr-mini { font: 600 8.5px/1 var(--sans); letter-spacing: .03em; text-transform: uppercase; color: var(--text); background: var(--surface-2); border: 1px solid var(--border-2); border-radius: 999px; padding: 4px 9px; cursor: pointer; }
.tr-mini:hover { border-color: var(--accent); color: var(--accent); }
.tr-expand { margin-left: auto; }
.tr-count { font: 600 9px/1 var(--mono); color: var(--text-mut); }
.tr-chips { display: flex; flex-wrap: wrap; gap: 4px; max-height: 116px; overflow-y: auto; }
.tr-chips:has(.tr-chip:nth-child(30)) { max-height: 170px; } /* lista larga (bus expandido): más aire */
.tr-chip { font: 700 9px/1 var(--mono); color: #fff; background: var(--c); border: 1px solid var(--c); border-radius: 4px; padding: 4px 5px; cursor: pointer; }
.tr-chip.off { background: transparent; color: var(--text-mut); border-color: var(--border-2); }
.tr-hint-inline { font: 500 9px/1.4 var(--sans); color: var(--text-mut); }
.radio-ctl { margin: 7px 0 0 23px; }
.radio-row { display: flex; align-items: center; gap: 9px; }
.radio-slider { flex: 1; accent-color: var(--accent); }
.radio-val { font: 700 11px/1 var(--mono); color: var(--carto); min-width: 48px; text-align: right; }

.radio-stop { display: flex; align-items: center; gap: 6px; }
.radio-stop-main { flex: 1; display: flex; align-items: center; gap: 8px; background: none; border: 0; padding: 6px 0; cursor: pointer; text-align: left; min-width: 0; }
.radio-stop-dot { width: 9px; height: 9px; border-radius: 99px; flex: none; }
.radio-stop-name { flex: 1; font: 600 11px/1.2 var(--sans); color: var(--text-hi); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.radio-stop-name small { font-weight: 500; color: var(--text-mut); }
.radio-stop-dist { font: 600 9px/1 var(--mono); color: var(--text-lo); flex: none; }
.radio-stop-go { flex: none; font-size: 13px; color: var(--carto); text-decoration: none; padding: 2px 5px; }
.radio-stop-go:hover { background: var(--surface-3); }
.compass-rose { cursor: pointer; padding: 2px; }
.compass-rose .compass-dial { transform-origin: 24px 24px; transition: transform .1s linear; }

/* ═══ Panel lateral ═══ */
.sidebar { width: 416px; flex: none; background: var(--surface); border-right: 1px solid var(--border); padding: 0; overflow-y: auto; z-index: 10; }
/* Escritorio: panel lateral como carta flotante modernista sobre el mapa.
   El panel es un CONTENEDOR (fondo bruma) con padding; cada sección flota como card. */
@media (min-width: 681px) {
  .main-content { position: relative; }
  .sidebar {
    position: absolute; top: 16px; left: 16px; width: 400px;
    height: auto; max-height: calc(100% - 32px);   /* abraza el contenido, tope con margen inferior */
    border-right: 0; border: 1px solid var(--border); border-radius: 20px;
    background: var(--bg); padding: 12px;
    box-shadow: 0 18px 46px -20px rgba(34,48,58,.42);
    overflow: hidden auto;
  }
  .sidebar::-webkit-scrollbar { width: 8px; }

  /* Cards de sección (exploración): sobre el fondo bruma, superficie clara para que resalten */
  .sidebar .capas-panel { background: var(--surface); }

  /* Dossier: se disuelve el contenedor "Información" y cada bloque flota como card independiente */
  .sidebar .capas-panel:has(.context-panel) { background: transparent; border: 0; border-radius: 0; overflow: visible; margin-bottom: 0; }
  .sidebar .capas-panel:has(.context-panel) > .capas-head { border-radius: 13px; margin-bottom: 10px; }
  .sidebar .capas-panel:has(.context-panel) .capas-body { padding: 0; }
  .context-panel { display: flex; flex-direction: column; gap: 10px; }
  .context-panel > .ficha-header,
  .context-panel > .ficha-block { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-card); margin: 0; }
  .context-panel > .ficha-header { padding: 16px; }
  .context-panel > .ficha-block { padding: 15px 16px; }
  .context-panel > .ficha-grouptag { align-self: flex-start; margin: 4px 0 0; }
}
.sidebar::-webkit-scrollbar { width: 9px; }
.sidebar::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 8px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }

.panel { padding: 20px; }
.panel-head { margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.ficha-empty-head { padding: 20px 20px 0; }
.panel-crumb { font: 600 9px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--accent-ink); margin-bottom: 11px; }
.panel-title { font: 700 22px/1.08 var(--display); letter-spacing: .01em; color: var(--text-hi); margin: 0; }
.panel-sub { font: 500 11px/1.5 var(--sans); color: var(--text-lo); margin: 8px 0 0; }

.card { background: var(--surface-2); border: 1px solid var(--border); padding: 15px 16px; margin-bottom: 14px; border-radius: var(--r-card); }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.card-title { font: 600 12px/1 var(--sans); letter-spacing: .03em; color: var(--text-hi); }
.src-chip { font: 500 9px/1 var(--mono); color: var(--text-lo); background: var(--surface-3); border: 1px solid var(--border); padding: 4px 8px; }
.rows { display: flex; flex-direction: column; }
.row { display: flex; align-items: baseline; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--border); }
.row:last-child { border-bottom: none; }
.row-k { font: 500 12px/1 var(--sans); color: var(--text-lo); }
.row-v { font: 600 14px/1 var(--mono); color: var(--text-hi); }
.row-v small { font: 500 10px/1 var(--sans); color: var(--text-mut); }
.row-v.pos { color: var(--green); } .row-v.neg { color: var(--red); }
.callout { margin-top: 13px; padding: 11px 13px; background: rgba(224,162,60,.1); border: 1px solid rgba(224,162,60,.3); font: 500 11px/1.5 var(--sans); color: #E7C079; }
.callout strong { color: var(--amber); }

.empty-state { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding: 20px; }
.empty-pin { width: 42px; height: 42px; flex: none; background: var(--accent-soft, rgba(188,75,65,.14)); border: 1px solid rgba(188,75,65,.3); display: flex; align-items: center; justify-content: center; border-radius: var(--r-inner); }
.empty-state p { font: 500 12px/1.6 var(--sans); color: var(--text-lo); margin: 0; }

.action-buttons { display: flex; flex-direction: column; gap: 9px; padding: 18px 20px 24px; }
.export-btn { height: 44px; border: none; background: var(--accent); color: #fff; font: 600 12px/1 var(--sans); letter-spacing: .04em; text-transform: uppercase; cursor: pointer; transition: filter .15s; border-radius: var(--r-inner); }
.export-btn:hover { filter: brightness(1.12); }

.zoom-indicator-box { background: var(--float-bg); padding: 7px 11px; box-shadow: 0 2px 10px rgba(0,0,0,.4); font: 600 10px/1 var(--mono); color: var(--text); border: 1px solid var(--border); }
.zone-tooltip { background: transparent; color: var(--text-hi); border: none; font-family: var(--sans); font-weight: 700; font-size: 12px; padding: 0; box-shadow: none; text-shadow: 1.5px 1.5px 0 rgba(0,0,0,.85), -1.5px -1.5px 0 rgba(0,0,0,.85), 1.5px -1.5px 0 rgba(0,0,0,.85), -1.5px 1.5px 0 rgba(0,0,0,.85); }
.zone-tooltip::before { display: none !important; }

/* ═══ Ficha de la finca ═══ */
.ficha-header { padding: 20px 20px 18px; border-bottom: 1px solid var(--border); }
.ficha-crumb { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font: 500 10px/1.3 var(--sans); color: var(--text-mut); margin-bottom: 14px; }
.ficha-crumb-hi { color: var(--accent-ink); font-weight: 600; }
.ficha-crumb-sep { color: var(--border-2); }
.ficha-crumb-mono { font-family: var(--mono); font-size: 9px; }
.ficha-address { font: 700 21px/1.14 var(--display); letter-spacing: .01em; color: var(--text-hi); margin: 0 0 12px; }
.ficha-head-row { display: flex; gap: 14px; align-items: flex-start; }
.ficha-head-main { flex: 1; min-width: 0; }
.ficha-thumb { width: 74px; height: 74px; flex: none; object-fit: cover; border: 1px solid var(--border-2); background: var(--surface-2); border-radius: var(--r-inner); }
.ficha-ref { display: flex; align-items: center; gap: 8px; }
.ficha-ref-label { font: 600 8px/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--text-mut); }
.ficha-ref-value { font: 500 11px/1 var(--mono); color: var(--text); background: var(--surface-2); border: 1px solid var(--border); padding: 3px 6px; }

.ficha-lectura { display: flex; flex-direction: column; gap: 8px; }
.ver { display: flex; gap: 10px; padding: 11px 13px; border: 1px solid; }
.ver-dot { width: 8px; height: 8px; border-radius: 99px; flex: none; margin-top: 4px; }
.ver-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ver-titulo { font: 600 12px/1.3 var(--sans); color: var(--text-hi); }
.ver-desc { font: 500 10px/1.5 var(--sans); color: var(--text-lo); }
.ver-red { background: rgba(235,92,77,.1); border-color: rgba(235,92,77,.32); } .ver-red .ver-dot { background: var(--red); }
.ver-amber { background: rgba(224,162,60,.1); border-color: rgba(224,162,60,.32); } .ver-amber .ver-dot { background: var(--amber); }
.ver-green { background: rgba(53,192,138,.1); border-color: rgba(53,192,138,.32); } .ver-green .ver-dot { background: var(--green); }
.ver-blue { background: rgba(91,147,242,.1); border-color: rgba(91,147,242,.32); } .ver-blue .ver-dot { background: var(--carto); }

.ficha-mercado { display: flex; gap: 10px; }
.ficha-yield { flex: 1.1; background: linear-gradient(150deg, var(--carto), color-mix(in srgb, var(--carto) 78%, #1a4a63)); padding: 14px 15px; display: flex; flex-direction: column; gap: 8px; border-radius: var(--r-card); }
.ficha-yield-k { font: 600 9px/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.75); }
.ficha-yield-v { font: 700 30px/1 var(--mono); color: #fff; }
.ficha-yield-v small { font-size: 15px; color: rgba(255,255,255,.8); margin-left: 2px; }
.ficha-yield-foot { font: 500 8.5px/1.35 var(--sans); color: rgba(255,255,255,.78); margin-top: 2px; }
.ficha-mercado-side { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.ficha-mini { border: 1px solid var(--border); background: var(--surface-2); padding: 9px 11px; }
.ficha-mini-k { display: block; font: 600 8px/1 var(--sans); letter-spacing: .08em; text-transform: uppercase; color: var(--text-mut); margin-bottom: 5px; }
.ficha-mini-v { font: 600 14px/1 var(--mono); color: var(--text-hi); }
.ficha-mini-v small { font-size: 9px; color: var(--text-mut); }

.ficha-block { padding: 18px 20px; border-bottom: 1px solid var(--border); }
.ficha-block-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; }
.ficha-block-title { font: 700 11px/1 var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--text-hi); }
.ficha-source { font: 500 9px/1 var(--mono); color: var(--text-lo); background: var(--surface-2); border: 1px solid var(--border); padding: 4px 8px; }
.ficha-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); overflow: hidden; }
.ficha-cell { background: var(--surface-2); padding: 11px 12px; display: flex; flex-direction: column; gap: 7px; min-height: 56px; }
.ficha-k { font: 600 9px/1 var(--sans); letter-spacing: .07em; text-transform: uppercase; color: var(--text-mut); }
.ficha-v { font: 600 18px/1 var(--mono); color: var(--text-hi); }
.ficha-v small { font-size: 11px; color: var(--text-mut); }
.ficha-v-sm { font: 600 13px/1.1 var(--sans); }
.ficha-na { color: var(--text-mut); }
.ficha-sub { font: 500 9px/1 var(--sans); color: var(--text-mut); }
.ficha-msg { font: 500 12px/1.5 var(--sans); color: var(--text-lo); padding: 12px 14px; background: var(--surface-2); border: 1px solid var(--border); }
.ficha-msg-err { color: var(--accent-ink); background: rgba(225,37,27,.1); border-color: rgba(225,37,27,.3); }

.skeleton { display: block; height: 18px; width: 72%; border-radius: 3px; background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%); background-size: 200% 100%; animation: sk 1.2s ease-in-out infinite; }
@keyframes sk { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.ficha-reg { background: var(--surface-2); border: 1px solid var(--border); padding: 12px 13px; margin-bottom: 12px; }
.ficha-reg-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.ficha-reg-k { font: 600 8px/1 var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--text-mut); width: 76px; flex: none; }
.ficha-reg-rc { font: 500 11px/1.3 var(--mono); color: var(--text-hi); word-break: break-all; flex: 1; }
.ficha-copy { flex: none; border: none; background: none; cursor: pointer; color: var(--text-mut); font-size: 13px; padding: 2px; line-height: 1; transition: color .15s; }
.ficha-copy:hover { color: var(--carto); }
.ficha-verify { display: inline-flex; align-items: center; gap: 4px; margin-top: 3px; font: 600 10px/1 var(--sans); color: var(--carto); text-decoration: none; }
.ficha-verify:hover { text-decoration: underline; }
.ficha-verify-sm { font: 600 9px/1 var(--sans); color: var(--carto); text-decoration: none; }
.ficha-verify-sm:hover { text-decoration: underline; }

.clave-legend { display: flex; flex-direction: column; gap: 7px; margin-top: 11px; }
.clave-row { display: flex; gap: 9px; align-items: baseline; font: 500 10px/1.45 var(--sans); color: var(--text-lo); }
.clave-tag { flex: none; min-width: 48px; text-align: center; font: 600 9px/1 var(--mono); letter-spacing: .02em; padding: 4px 6px; border-radius: 4px; }
.clave-row.danger .clave-tag { color: #FF8378; background: rgba(235,92,77,.12); border: 1px solid rgba(235,92,77,.32); }
.clave-row.ok .clave-tag { color: #5FD6A6; background: rgba(53,192,138,.12); border: 1px solid rgba(53,192,138,.32); }

.ficha-cta { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 13px; height: 38px; background: var(--surface-3); border: 1px solid var(--border-2); color: var(--text-hi); text-decoration: none; font: 600 11px/1 var(--sans); transition: border-color .15s, background .15s; }
.ficha-cta:hover { border-color: var(--accent); background: var(--surface-2); }
.ficha-note { font: 500 11px/1.5 var(--sans); color: var(--text-lo); }
.ficha-note-sm { font: 500 10px/1.5 var(--sans); color: var(--text-mut); margin: 0 0 9px; }
.ficha-block > :last-child { margin-bottom: 0; }

.ficha-doc { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 13px; border: 1px solid var(--border); margin-bottom: 8px; text-decoration: none; background: var(--surface-2); transition: border-color .15s; }
.ficha-doc:hover { border-color: var(--carto); }
.ficha-doc-main { display: flex; flex-direction: column; gap: 3px; }
.ficha-doc-t { font: 600 12px/1.2 var(--sans); color: var(--text-hi); }
.ficha-doc-d { font: 500 9px/1.2 var(--sans); color: var(--text-mut); }
.ficha-badge { flex: none; font: 600 9px/1 var(--mono); color: var(--text-lo); background: var(--surface-3); border: 1px solid var(--border); padding: 5px 8px; white-space: nowrap; }
.ficha-grouptag { font: 700 9px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--text-hi); background: var(--surface-3); border: 1px solid var(--border-2); display: inline-block; padding: 6px 10px; margin: 22px 20px 0; }
.ficha-grouptag + .ficha-block { padding-top: 11px; }
.ficha-gasto-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); font: 500 11px/1 var(--sans); color: var(--text); }
.ficha-gasto-row:last-of-type { border-bottom: none; }
.ficha-check { background: var(--surface-2); border: 1px solid var(--border); padding: 11px 13px; margin-bottom: 8px; }
.ficha-check-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.ficha-check-t { font: 600 11px/1.35 var(--sans); color: var(--text-hi); }
.ficha-check-d { font: 500 9px/1.45 var(--sans); color: var(--text-mut); margin: 5px 0 0; }
.ficha-link { display: flex; flex-direction: column; gap: 3px; padding: 11px 13px; border: 1px solid var(--border); margin-bottom: 8px; text-decoration: none; background: var(--surface-2); transition: border-color .15s; }
.ficha-link:hover { border-color: var(--carto); }
.ficha-link-t { font: 600 11px/1.2 var(--sans); color: var(--carto); }
.ficha-link-d { font: 500 9px/1.3 var(--sans); color: var(--text-mut); }

/* ═══ Agregador de capas ═══ */
.capas-panel { border: 1px solid var(--border); background: var(--surface-2); margin-bottom: 14px; overflow: hidden; border-radius: var(--r-card); }
.capas-head { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; background: var(--surface-3); border: 0; border-left: 3px solid var(--accent); cursor: pointer; }
.capas-head-t { display: inline-flex; align-items: center; gap: 9px; font: 700 11px/1 var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--text-hi); }
/* Icono de sección: cuadrado pastel modernista */
.capas-ico { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; flex: none; border-radius: 8px; font-size: 14px; line-height: 1; }
/* Acento de color por sección (Información/Capas/Movilidad/Zonas) */
.capas-panel:nth-of-type(1) .capas-head { border-left-color: var(--accent); }
.capas-panel:nth-of-type(2) .capas-head { border-left-color: var(--gold); }
.capas-panel:nth-of-type(3) .capas-head { border-left-color: var(--green); }
.capas-panel:nth-of-type(4) .capas-head { border-left-color: var(--carto); }
.capas-panel:nth-of-type(1) .capas-ico { background: color-mix(in srgb, var(--accent) 15%, transparent); }
.capas-panel:nth-of-type(2) .capas-ico { background: color-mix(in srgb, var(--gold) 18%, transparent); }
.capas-panel:nth-of-type(3) .capas-ico { background: color-mix(in srgb, var(--green) 16%, transparent); }
.capas-panel:nth-of-type(4) .capas-ico { background: color-mix(in srgb, var(--carto) 15%, transparent); }
.capas-ctx { font: 500 10px/1 var(--sans); color: var(--text-mut); text-transform: none; letter-spacing: .02em; margin-left: 7px; }
.capas-chev { font-size: 10px; color: var(--text-lo); transition: transform .18s; }
.capas-chev.open { transform: rotate(180deg); }
.capas-chev.side { display: inline-block; }
.capas-chev.side.open { transform: rotate(90deg); }
.capas-body { padding: 11px 12px 13px; }
.capas-intro { font: 500 9.5px/1.45 var(--sans); color: var(--text-mut); margin: 0 0 11px; }
.capas-src { border: 1px solid var(--border); margin-bottom: 8px; overflow: hidden; }
.capas-src-head { width: 100%; display: flex; align-items: center; gap: 7px; padding: 9px 11px; background: var(--surface); border: 0; cursor: pointer; text-align: left; }
.capas-src-head:hover { background: var(--surface-3); }
.capas-src-t { font: 700 10.5px/1.25 var(--sans); color: var(--text-hi); flex: 1; }
.capas-badge { font: 700 8px/1 var(--mono); color: #fff; background: var(--gold); padding: 4px 8px; letter-spacing: .04em; border-radius: var(--r-pill); }
.capas-src-body { padding: 4px 11px 11px; border-top: 1px solid var(--border); }
.capas-portal { display: inline-block; font: 600 9px/1 var(--sans); color: var(--carto); text-decoration: none; margin: 9px 0 7px; }
.capas-portal:hover { text-decoration: underline; }
.capas-layer { display: flex; gap: 8px; align-items: flex-start; padding: 7px 0; cursor: pointer; border-top: 1px solid var(--border); }
.capas-layer input { margin-top: 2px; accent-color: var(--accent); flex-shrink: 0; }
.capas-layer-body { display: flex; flex-direction: column; gap: 1px; }
.capas-layer-t { font: 600 10px/1.3 var(--sans); color: var(--text-hi); }
.capas-layer-h { font: 500 8.5px/1.4 var(--sans); color: var(--text-mut); }
.capas-layer.slim { padding: 5px 0; }
.capas-layer.slim .capas-layer-t { font-weight: 500; color: var(--text-lo); }
.capas-all-toggle { display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 9px; padding: 8px 0 0; background: 0; border: 0; border-top: 1px solid var(--border); cursor: pointer; font: 600 9.5px/1 var(--sans); color: var(--text-lo); }
.capas-count { margin-left: auto; font: 700 8px/1 var(--mono); color: var(--text-lo); background: var(--surface-3); padding: 2px 6px; }
.capas-all { padding-top: 2px; }
.capas-status { display: block; font: 500 9px/1.4 var(--sans); color: var(--text-mut); padding: 7px 0; }
.capas-status.err { color: var(--red); }

/* ═══ Situación urbanística (PIU) ═══ */
.piu-clau { display: flex; align-items: center; gap: 11px; padding: 11px 13px; background: var(--surface-2); border: 1px solid var(--border-2); }
.piu-clau-tag { flex-shrink: 0; min-width: 48px; text-align: center; font: 800 17px/1 var(--mono); color: #fff; background: var(--accent); padding: 10px 8px; border-radius: var(--r-inner); }
.piu-clau-body { display: flex; flex-direction: column; gap: 2px; }
.piu-clau-nom { font: 700 11px/1.3 var(--sans); color: var(--text-hi); }
.piu-clau-sub { font: 600 9px/1.2 var(--sans); color: var(--text-lo); }
.piu-meta { display: flex; flex-direction: column; gap: 1px; margin-top: 9px; }
.piu-meta-row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 2px; border-bottom: 1px solid var(--border); font: 500 10px/1.3 var(--sans); color: var(--text-mut); }
.piu-meta-row b { font-weight: 700; color: var(--text-hi); font-family: var(--mono); font-size: 10px; }
.piu-afec { display: flex; flex-direction: column; gap: 4px; margin-top: 9px; padding: 9px 11px; background: var(--surface); border: 1px solid var(--border); }
.piu-afec-red { background: rgba(235,92,77,.1); border-color: rgba(235,92,77,.3); }
.piu-afec-amber { background: rgba(224,162,60,.1); border-color: rgba(224,162,60,.3); }
.piu-afec-h { font: 700 10px/1.2 var(--sans); color: var(--text-hi); }
.piu-afec-red .piu-afec-h { color: #FF8378; }
.piu-afec-amber .piu-afec-h { color: #E7C079; }
.piu-afec-item { font: 500 9.5px/1.4 var(--sans); color: var(--text-lo); padding-left: 2px; }

/* ═══ Movilidad ═══ */
.mov-group { margin-bottom: 6px; }
.mov-group-t { display: block; font: 700 9px/1 var(--sans); color: var(--text-mut); text-transform: uppercase; letter-spacing: .08em; margin: 9px 0 3px; }
.mov-st { font: 700 8px/1 var(--sans); padding: 2px 5px; border-radius: 3px; margin-left: 5px; }
.mov-st.live { color: var(--green); background: rgba(53,192,138,.14); }
.mov-st.err { color: var(--red); background: rgba(235,92,77,.14); }
.mov-group .capas-portal { margin: 4px 0 0; }
.mov-lineas { display: flex; flex-direction: column; gap: 8px; padding: 6px 2px 4px; }
.mov-lineas .ctrl { font-size: 11.5px; }
.capas-foot { font: 500 8.5px/1.4 var(--sans); color: var(--text-mut); margin: 10px 0 0; padding-top: 9px; border-top: 1px solid var(--border); }
.renta-legend { display: flex; align-items: center; gap: 6px; margin-top: 6px; font: 600 8px/1 var(--sans); color: var(--text-mut); }
.renta-scale { width: 66px; height: 8px; border-radius: 2px; background: linear-gradient(90deg, #B5392C, #E0A23C, #F2D024, #8DC63F, #1F9D5B); flex: none; }
.renta-any { font-family: var(--mono); }

/* ═══ Explorador de parada ═══ */
.stop-explorer { position: absolute; top: 16px; left: 16px; z-index: 5; width: 306px; max-width: calc(100% - 32px); background: var(--float-bg); backdrop-filter: blur(8px); border: 1px solid var(--border-2); box-shadow: 0 12px 30px rgba(0,0,0,.5); padding: 14px 15px; border-radius: var(--r-card); }
.stop-explorer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.stop-explorer-k { display: block; font: 700 8px/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--accent-ink); }
.stop-explorer-name { display: block; font: 700 13px/1.25 var(--sans); color: var(--text-hi); margin-top: 3px; }
.stop-explorer-x { flex-shrink: 0; width: 24px; height: 24px; border: 0; background: var(--surface-2); color: var(--text-lo); cursor: pointer; font-size: 12px; }
.stop-explorer-x:hover { background: var(--surface-3); }
.stop-explorer-hint { display: block; font: 500 9.5px/1.4 var(--sans); color: var(--text-mut); margin: 9px 0 8px; }
.stop-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.stop-chip { font: 700 11px/1 var(--mono); color: #fff; background: var(--c); border: 2px solid var(--c); border-radius: 4px; padding: 6px 9px; cursor: pointer; opacity: .5; transition: opacity .12s, transform .12s; }
.stop-chip:hover { opacity: .85; }
.stop-chip.on { opacity: 1; transform: scale(1.06); box-shadow: 0 2px 10px rgba(0,0,0,.4); }
.stop-clear { margin-top: 10px; width: 100%; font: 600 10px/1 var(--sans); color: var(--text-lo); background: var(--surface-2); border: 1px solid var(--border); padding: 8px; cursor: pointer; }
.stop-clear:hover { background: var(--surface-3); }

/* ═══ MÓVIL: mapa a pantalla completa; sidebar y controles como paneles deslizables ═══ */
@media (max-width: 680px) {
  /* App full-screen: el documento NO scrollea; solo el interior del sheet. Mata el
     rubber-band incómodo al interactuar con los componentes. */
  html, body { height: 100dvh; overflow: hidden; overscroll-behavior: none; }
  .app-container { height: 100dvh; }
  .fab { display: flex; }
  .panel-close { display: flex; }
  /* ── Bottom sheets como cards flotantes (patrón Google Maps + lenguaje de la cápsula):
     margen a los lados y abajo, 4 esquinas redondeadas; nunca alcanzan el buscador ── */
  .sidebar, .map-floating-controls {
    position: fixed; left: 8px; right: 8px; bottom: 8px; top: auto;
    width: auto; max-width: none; height: auto;
    border-radius: 18px; border: 1px solid var(--border-2);
    box-shadow: 0 -12px 34px rgba(0,0,0,.30); z-index: 1150;
    overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
    transform: translateY(110%); transition: transform .3s cubic-bezier(.3,.9,.3,1); will-change: transform;
  }
  /* Alturas de anclaje medidas en dvh (viewport REAL del móvil, sin contar la barra del
     navegador) → el sheet nunca se cuela bajo el borde visible. Reservamos ~96px arriba
     para la cápsula de búsqueda flotante. */
  .sidebar { max-height: calc(100dvh - 96px - env(safe-area-inset-top)); }
  /* Estado expandido (arrastre hacia arriba): ocupa toda la altura disponible */
  .sidebar.full { height: calc(100dvh - 96px - env(safe-area-inset-top)); }
  .map-floating-controls { max-height: min(60dvh, calc(100dvh - 96px - env(safe-area-inset-top))); padding-top: 0; }
  .sidebar.open, .map-floating-controls.open { transform: translateY(0); }

  /* Con un sheet abierto, las utilidades del mapa no aplican: fade out limpio */
  .sheet-open .fab-round, .sheet-open .maplibregl-ctrl-top-right,
  .sheet-open .maplibregl-ctrl-bottom-right, .sheet-open .maplibregl-ctrl-bottom-left {
    opacity: 0; pointer-events: none; transition: opacity .2s ease;
  }
  .fab-round, .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left {
    transition: opacity .2s ease;
  }

  /* Asa del sheet: tap o deslizar hacia abajo = cerrar */
  .sheet-handle {
    display: flex; position: sticky; top: 0; z-index: 40; width: 100%;
    padding: 9px 0 7px; align-items: center; justify-content: center;
    background: var(--surface); border: 0; cursor: pointer;
  }
  .sheet-handle span { width: 38px; height: 4px; border-radius: 999px; background: var(--border-2); }

  /* Sin ✕ en móvil: el asa (tap o deslizar) ya cierra el sheet */
  .panel-close { display: none; }

  /* ── Secciones del sheet como CARDS: borde, radio y retícula de padding única (16px)
     para que cabecera y contenido queden alineados abierto o cerrado ── */
  .sidebar {
    padding: 0 10px calc(14px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4);
  }
  .map-floating-controls {
    background: color-mix(in srgb, var(--float-bg) 84%, transparent);
    -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4);
  }
  .sheet-handle { background: transparent; }
  .capas-panel { border: 1px solid var(--border-2); border-radius: 14px; margin: 8px 0 0; background: color-mix(in srgb, var(--surface) 88%, transparent); }
  .capas-head { padding: 13px 16px; border-radius: 13px 13px 0 0; background: color-mix(in srgb, var(--surface-3) 82%, transparent); }
  .capas-body { padding: 12px 16px 14px; }
  .context-panel .ficha-header { padding: 16px 16px 14px; }
  .context-panel .ficha-block { padding: 15px 16px; }
  .context-panel > :last-child, .capas-panel > div > .context-panel:last-child { border-bottom: 0; }

  /* Contenidos curvados: los bloques internos siguen el lenguaje redondeado del sheet */
  .ver, .clave-legend, .capas-src, .radio-ctl { border-radius: 12px; }
  .ficha-cta, .ficha-doc, .tr-search, .search-box input { border-radius: 10px; }
  .ficha-source, .capas-badge, .ficha-badge, .capas-portal { border-radius: 6px; }
  .ficha-grid { border-radius: 12px; }
  /* Explorador de parada como card inferior (zona del pulgar), alineado al lenguaje
     de los sheets; los botones del mapa se desvanecen mientras está abierto */
  .stop-explorer {
    top: auto; bottom: 8px; left: 8px; right: 8px; width: auto; max-width: none;
    border-radius: 16px; clip-path: none; z-index: 1120;
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--float-bg) 88%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
    box-shadow: 0 -10px 30px rgba(0,0,0,.26);
  }

  /* ── Geografía de la UI móvil: buscador flota arriba; utilidades abajo ── */
  /* FABs bajo la cápsula de búsqueda (52px + 10px de margen + aire) */
  .fab-info { top: calc(72px + env(safe-area-inset-top)); left: 10px; }
  .fab-map { top: calc(72px + env(safe-area-inset-top)); right: 10px; }

  /* Botones redondos solo-móvil: speed-dial de utilidades y tema día/noche */
  .fab-round {
    display: flex; position: absolute; z-index: 1100; width: 42px; height: 42px;
    align-items: center; justify-content: center; border-radius: 13px;
    border: 1px solid var(--border-2); background: var(--float-bg); color: var(--text-hi);
    -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
    box-shadow: 0 4px 14px rgba(0,0,0,.22); cursor: pointer; font-size: 15px; line-height: 1;
  }
  .fab-utils { bottom: 34px; left: 8px; }
  .fab-utils svg { transition: transform .25s ease; }
  .fab-utils.open svg { transform: rotate(180deg); }
  .fab-theme { bottom: 42px; right: 8px; }

  /* Utilidades de mapa (navegación, fullscreen, GPS) → una sola tarjeta vertical
     abajo-izquierda, encima del speed-dial; la rosa de los vientos queda suelta debajo */
  .maplibregl-ctrl-top-right {
    top: auto; right: auto; bottom: 86px; left: 8px;
    display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start;
    --map-btn: clamp(38px, 9.5vw, 46px); /* botones cuadrados que autoescalan con el ancho */
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl { margin: 0; float: none; }

  /* Colapso speed-dial: cerrados se deslizan hacia abajo y desvanecen; al abrir
     suben en cascada desde el botón (el de más abajo primero) */
  .maplibregl-ctrl-top-right .maplibregl-ctrl { transition: transform .28s ease, opacity .22s ease, visibility .28s; }
  .maplibregl-ctrl-top-right .maplibregl-ctrl:nth-child(1) { transition-delay: .12s; }
  .maplibregl-ctrl-top-right .maplibregl-ctrl:nth-child(2) { transition-delay: .08s; }
  .maplibregl-ctrl-top-right .maplibregl-ctrl:nth-child(3) { transition-delay: .04s; }
  .maplibregl-ctrl-top-right .maplibregl-ctrl:nth-child(4) { transition-delay: 0s; }
  .utils-collapsed .maplibregl-ctrl-top-right .maplibregl-ctrl {
    opacity: 0; transform: translateY(18px); visibility: hidden; pointer-events: none; transition-delay: 0s;
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl-group:not(.compass-rose) {
    background: var(--float-bg);
    -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
    border: 1px solid var(--border-2); border-top: 0; border-radius: 0; box-shadow: none;
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl-group:not(.compass-rose):first-child {
    border-top: 1px solid var(--border-2); border-radius: 12px 12px 0 0;
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl-group:has(+ .compass-rose) {
    border-radius: 0 0 12px 12px;
  }
  .maplibregl-ctrl-top-right .maplibregl-ctrl-group button {
    width: var(--map-btn); height: var(--map-btn); border-radius: 0;
  }
  /* En tema oscuro los iconos nativos (SVG negros) se invierten para seguir visibles */
  html[data-theme="dark"] .maplibregl-ctrl-top-right .maplibregl-ctrl-group:not(.compass-rose) button .maplibregl-ctrl-icon {
    filter: invert(.88) hue-rotate(180deg);
  }
  .compass-rose { margin-top: 8px !important; border-radius: 50%; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,.22); }

  /* Zoom + atribución: chips en fila, pegados, abajo-derecha */
  .maplibregl-ctrl-bottom-right {
    display: flex; flex-direction: row; align-items: center; justify-content: flex-end;
    gap: 4px; padding: 0 8px 8px 0;
  }
  .maplibregl-ctrl-bottom-right .maplibregl-ctrl { margin: 0; float: none; }
  .zoom-indicator-box { padding: 0 9px; height: 24px; display: flex; align-items: center; font-size: 9px; border-radius: 10px; }
  .maplibregl-ctrl-attrib { font-size: 9px; border-radius: 10px; }

  .maplibregl-ctrl-bottom-left { z-index: 5; }
}
</style>
