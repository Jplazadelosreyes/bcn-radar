<script setup>
import { onMounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchFinca } from './services/catastro.js'

// Variables reactivas para el panel
const searchQuery = ref('')
const selectedAddress = ref(null)
const selectedBarrio = ref(null)

// Estado Reactivo del Panel Lateral Dinámico
const mapContext = ref({
  level: 'ciudad', // 'ciudad', 'distrito', 'barrio', 'seccion', 'finca'
  distritoName: null,
  barrioName: null,
  seccionCode: null,
});

const fincaData = ref({
  estado: 'vacio', // 'vacio' | 'cargando' | 'ok' | 'sin-parcela' | 'error'
  refCatastral: null,
  ano: null,
  superficie: null,
  uso: null,
  nInmuebles: null,
  plantas: null,
})

let map = null
let searchMarker = null

// Simulación de generar PDF
const exportReport = () => {
  alert("Generando Informe Oficial en PDF...\\nEn el producto final, esto enviará un email al reclutador con el branding de la empresa.");
}

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
      map.setView([lat, lon], 17)
      
      // Si ya había un pin de una búsqueda anterior, lo borramos
      if (searchMarker) map.removeLayer(searchMarker)
      
      // Clavamos el pin rojo en la dirección exacta
      searchMarker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`<b>🏠 Dirección encontrada:</b><br>${display_name}`)
        .openPopup()
        
    } else {
      alert("No se encontró la dirección. Intenta quitar el número o ser más general.")
    }
  } catch (error) {
    console.error("Error en la búsqueda:", error)
  }
}

onMounted(() => {
  // Ampliamos mucho los límites (Toda la provincia) para que NUNCA se vean los bordes grises
  // El usuario podrá arrastrar el mapa por los alrededores sin sentir un bloqueo claustrofóbico.
  const bcnBounds = L.latLngBounds(
    [41.1000, 1.7000], // Esquina Suroeste (Hacia Sitges)
    [41.6000, 2.5000]  // Esquina Noreste (Hacia Mataró)
  );

  map = L.map('map', {
    maxBounds: bcnBounds,
    maxBoundsViscosity: 0.5, // Un rebote suave, no un muro de hormigón
    minZoom: 11, // Permitimos alejar el mapa un poco más para ver todo el contexto metropolitano
    maxZoom: 22
  }).setView([41.3851, 2.1734], 11);

  // Mapa Base con etiquetas (CartoDB Voyager)
  const streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    bounds: bcnBounds,
    maxZoom: 22
  });

  // NUEVO: Capa de Satélite de Alta Resolución (ESRI)
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    bounds: bcnBounds,
    maxNativeZoom: 19, // MAGIA: Si el usuario hace zoom a 20 o 22, Leaflet "estirará" la foto 19 en lugar de desaparecer
    maxZoom: 22
  });

  // Añadimos la callejera por defecto
  streetLayer.addTo(map);

  // Lógica para alternar entre Callejero y Satélite
  document.querySelectorAll('input[name="mapStyle"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'satelite') {
        map.removeLayer(streetLayer);
        satelliteLayer.addTo(map);
      } else {
        map.removeLayer(satelliteLayer);
        streetLayer.addTo(map);
      }
    });
  });

  // CAPA WMS CATASTRO (Dibuja los límites exactos de cada Finca/Parcela)
  const catastroLayer = L.tileLayer.wms("https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx", {
    layers: 'Catastro',
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    attribution: "Dirección General del Catastro",
    maxZoom: 22
  });

  // Lógica para encender/apagar la capa de Fincas
  document.getElementById('check-fincas').addEventListener('change', function(e) {
    if (e.target.checked) {
      catastroLayer.addTo(map);
      // Hacemos un poco de zoom automático si están muy lejos para ver las fincas
      if (map.getZoom() < 17) map.setZoom(17);
    } else {
      map.removeLayer(catastroLayer);
    }
  });

  // CAPA WMS PIU / AMB (Planeamiento Urbanístico - Calificaciones y Afectaciones)
  // Nota: Usamos el servicio del Área Metropolitana/Ajuntament para las afectaciones.
  const piuLayer = L.tileLayer.wms("https://geoserveis.amb.cat/geoserver/wms", {
    layers: 'amb:planejament_vigent', // Capa de planeamiento del AMB (cubre BCN)
    format: 'image/png',
    transparent: true,
    opacity: 0.6,
    version: '1.1.1',
    attribution: "Área Metropolitana de Barcelona / Ajuntament",
    maxZoom: 22
  });

  // Lógica para encender/apagar Afectaciones Viales (PIU)
  document.querySelector('input[value="vial"]').addEventListener('change', function(e) {
    if (e.target.checked) {
      piuLayer.addTo(map);
      if (map.getZoom() < 16) map.setZoom(16);
    } else {
      map.removeLayer(piuLayer);
    }
  });

  // NUEVO: AGREGAMOS ESCALA REAL Y MEDIDOR DE ZOOM
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

  const zoomIndicator = L.control({ position: 'topleft' });
  zoomIndicator.onAdd = function () {
    const div = L.DomUtil.create('div', 'zoom-indicator-box');
    div.innerHTML = `<b>🔍 Zoom:</b> <span id="current-zoom">${map.getZoom()}</span>`;
    return div;
  };
  zoomIndicator.addTo(map);

  let termeGeoJSONLayer = null;
  let districtesGeoJSONLayer = null;
  let barrisGeoJSONLayer = null;
  let barrisRawData = null;
  let selectedDistricteId = null;

  let seccionsGeoJSONLayer = null;
  let seccionsRawData = null;
  let selectedBarriId = null;
  let selectedSeccionId = null;

  // CARGAMOS TERME MUNICIPAL (Zoom Ultra-Lejano)
  fetch('https://raw.githubusercontent.com/martgnz/bcn-geodata/master/terme-municipal/terme-municipal.geojson')
    .then(response => response.json())
    .then(data => {
      termeGeoJSONLayer = L.geoJSON(data, {
        style: { color: '#8e44ad', weight: 2, fillOpacity: 0.05, dashArray: '5, 5' }, // Bordes ultra sutiles y punteados
        onEachFeature: function (feature, layer) {
          // Tooltip solo al pasar el ratón para no ensuciar
          layer.bindTooltip(`<b>Barcelona</b>`, { sticky: true, className: 'zone-tooltip' });
          layer.on({
            mouseover: function(e) {
              e.target.setStyle({ weight: 4, color: '#9b59b6', fillOpacity: 0.3 });
              e.target.bringToFront();
            },
            mouseout: function(e) {
              if (window.isTermeSelected) return; // Mantiene el resaltado
              if (termeGeoJSONLayer) termeGeoJSONLayer.resetStyle(e.target);
            },
            click: function(e) {
              // 2do Clic: Hacemos zoom para entrar a los Distritos
              if (window.isTermeSelected) {
                map.fitBounds(e.target.getBounds(), { padding: [50, 50], maxZoom: 12, animate: true });
                window.isTermeSelected = false; // Reset para la próxima vez
                return;
              }
              
              // 1er Clic: Solo seleccionar
              if (termeGeoJSONLayer) termeGeoJSONLayer.eachLayer(l => termeGeoJSONLayer.resetStyle(l));
              e.target.setStyle({ weight: 4, color: '#9b59b6', fillOpacity: 0.15 });
              window.isTermeSelected = true;
              mapContext.value.level = 'ciudad';
            }
          });
        }
      }).addTo(map); // Este será el único visible por defecto al abrir en Zoom 11
    });

  // CARGAMOS DISTRITOS (Zoom medio-lejano)
  fetch('https://raw.githubusercontent.com/martgnz/bcn-geodata/master/districtes/districtes.geojson')
    .then(response => response.json())
    .then(data => {
      districtesGeoJSONLayer = L.geoJSON(data, {
        style: { color: '#e67e22', weight: 1.5, fillOpacity: 0.05 }, // Líneas finas y muy transparente
        onEachFeature: function (feature, layer) {
          
          // Tooltip clásico al pasar el ratón
          layer.bindTooltip(`<b>${feature.properties.NOM}</b>`, { sticky: true, className: 'zone-tooltip' });

          layer.on({
            mouseover: function(e) {
              e.target.setStyle({ weight: 4, color: '#d35400', fillOpacity: 0.3 });
              e.target.bringToFront();
            },
            mouseout: function(e) {
              if (selectedDistricteId === feature.properties.DISTRICTE) return; // Mantiene el resaltado si está seleccionado
              if (districtesGeoJSONLayer) districtesGeoJSONLayer.resetStyle(e.target);
            },
            click: function(e) {
              // 2do Clic: Hacemos zoom para entrar al Distrito
              if (selectedDistricteId === feature.properties.DISTRICTE) {
                map.fitBounds(e.target.getBounds(), { padding: [50, 50], maxZoom: 14, animate: true });
                return;
              }

              // 1er Clic: Seleccionar, resaltar y actualizar panel
              if (districtesGeoJSONLayer) districtesGeoJSONLayer.eachLayer(l => districtesGeoJSONLayer.resetStyle(l));
              e.target.setStyle({ weight: 3, color: '#e67e22', fillOpacity: 0.15 }); // Dejar resaltado
              
              // Actualizamos el contexto del panel lateral
              mapContext.value.distritoName = feature.properties.NOM;
              
              // Guardamos el ID del Distrito para filtrar los barrios
              selectedDistricteId = feature.properties.DISTRICTE;
              updateBarrisLayer(); // Refrescamos los barrios
            }
          });
        }
      }); // IMPORTANTE: NO hacemos .addTo(map) aquí
    });

  // PREPARAMOS BARRIOS (Zoom medio) - Se inicializa vacío, los datos se inyectan en updateBarrisLayer
  barrisGeoJSONLayer = L.geoJSON(null, {
    style: { color: '#3498db', weight: 1, fillOpacity: 0.05 }, // Muy tenue
    onEachFeature: function (feature, layer) {
      
      // Tooltip clásico al pasar el ratón
      layer.bindTooltip(`<b>${feature.properties.NOM}</b>`, { sticky: true, className: 'zone-tooltip' });

      layer.on({
        mouseover: function(e) {
          if (map.getZoom() >= 15) return; // Nada de hover en nivel Secciones Censales
          e.target.setStyle({ weight: 3, color: '#e74c3c', fillOpacity: 0.4 });
          e.target.bringToFront();
        },
        mouseout: function(e) {
          if (map.getZoom() >= 15) return;
          if (selectedBarriId === feature.properties.BARRI) return; // Mantiene resaltado
          if (barrisGeoJSONLayer) barrisGeoJSONLayer.resetStyle(e.target);
        },
        click: function(e) {
          if (map.getZoom() >= 15) return; // Nada de clic en nivel Secciones Censales
          
          // 2do Clic: Zoom
          if (selectedBarriId === feature.properties.BARRI) {
            map.fitBounds(e.target.getBounds(), { padding: [50, 50], maxZoom: 15, animate: true });
            return;
          }

          // 1er Clic: Seleccionar
          if (barrisGeoJSONLayer) barrisGeoJSONLayer.eachLayer(l => barrisGeoJSONLayer.resetStyle(l));
          e.target.setStyle({ weight: 3, color: '#e74c3c', fillOpacity: 0.2 }); // Dejar resaltado
          
          // Actualizamos el contexto del panel lateral
          mapContext.value.barrioName = feature.properties.NOM;
          
          selectedBarriId = feature.properties.BARRI;
          if (typeof updateSeccionsLayer === 'function') updateSeccionsLayer();
        }
      });
    }
  });

  fetch('https://raw.githubusercontent.com/martgnz/bcn-geodata/master/barris/barris.geojson')
    .then(response => response.json())
    .then(data => {
      barrisRawData = data;
      updateBarrisLayer(); // Primera carga (mostrará todos si no hay distrito seleccionado)
    });

  // Función mágica que filtra los barrios mostrados
  const updateBarrisLayer = () => {
    if (!barrisRawData) return;
    barrisGeoJSONLayer.clearLayers();
    
    // Si no hay un distrito seleccionado (zoom libre global), pasamos todos. 
    // Si hay uno, filtramos matemáticamente.
    const featuresToDisplay = barrisRawData.features.filter(f => {
      if (!selectedDistricteId) return true; 
      return f.properties.DISTRICTE === selectedDistricteId;
    });
    
    barrisGeoJSONLayer.addData(featuresToDisplay);
  };

  // PREPARAMOS SECCIONES CENSALES (Zoom micro)
  seccionsGeoJSONLayer = L.geoJSON(null, {
    style: { color: '#2ecc71', weight: 1.5, fillOpacity: 0.05 }, // Verde esmeralda tenue
    onEachFeature: function (feature, layer) {
      
      // Tooltip clásico al pasar el ratón
      layer.bindTooltip(`<b>Sección Censal: ${feature.properties.DISTRICTE}-${feature.properties.SEC_CENS}</b>`, { sticky: true, className: 'zone-tooltip' });

      layer.on({
        mouseover: function(e) {
          if (map.getZoom() >= 16) return; // Nada de hover a nivel de calle
          e.target.setStyle({ weight: 2.5, color: '#27ae60', fillOpacity: 0.4 });
          e.target.bringToFront();
        },
        mouseout: function(e) {
          if (map.getZoom() >= 16) return;
          const secId = `${feature.properties.DISTRICTE}-${feature.properties.SEC_CENS}`;
          if (selectedSeccionId === secId) return; // Mantiene resaltado
          if (seccionsGeoJSONLayer) seccionsGeoJSONLayer.resetStyle(e.target);
        },
        click: function(e) {
          if (map.getZoom() >= 16) return;
          
          const secId = `${feature.properties.DISTRICTE}-${feature.properties.SEC_CENS}`;
          
          // 2do Clic: Zoom
          if (selectedSeccionId === secId) {
            map.fitBounds(e.target.getBounds(), { padding: [50, 50], maxZoom: 17, animate: true });
            return;
          }

          // 1er Clic: Seleccionar
          if (seccionsGeoJSONLayer) seccionsGeoJSONLayer.eachLayer(l => seccionsGeoJSONLayer.resetStyle(l));
          e.target.setStyle({ weight: 2.5, color: '#27ae60', fillOpacity: 0.2 }); // Dejar resaltado
          
          selectedSeccionId = secId;
          
          // Actualizamos el contexto del panel lateral
          mapContext.value.seccionCode = secId;
        }
      });
    }
  });

  fetch('https://raw.githubusercontent.com/martgnz/bcn-geodata/master/seccio-censal/seccio-censal.geojson')
    .then(response => response.json())
    .then(data => {
      seccionsRawData = data;
      updateSeccionsLayer();
    });

  const updateSeccionsLayer = () => {
    if (!seccionsRawData) return;
    seccionsGeoJSONLayer.clearLayers();
    
    const featuresToDisplay = seccionsRawData.features.filter(f => {
      if (!selectedBarriId) return false; // Solo mostramos secciones si hay barrio
      return f.properties.BARRI === selectedBarriId && f.properties.DISTRICTE === selectedDistricteId;
    });
    
    seccionsGeoJSONLayer.addData(featuresToDisplay);
  };

  // MAGIA DEL DRILL-DOWN: Dependiendo de la altura (Zoom), encendemos y apagamos las capas
  map.on('zoomend', function() {
    const z = map.getZoom();
    
    // Actualizamos el panel lateral según la capa de datos
    if (z < 12) mapContext.value.level = 'ciudad';
    else if (z < 14) mapContext.value.level = 'distrito';
    else if (z < 15) mapContext.value.level = 'barrio';
    else if (z < 16) mapContext.value.level = 'seccion';
    else mapContext.value.level = 'finca';

    // Actualizamos el indicador visual numérico en la pantalla
    const zoomText = document.getElementById('current-zoom');
    if (zoomText) zoomText.innerText = z;

    // Si el usuario se aleja a la vista de ciudad, borramos el filtro de distrito
    if (z < 14 && selectedDistricteId !== null) {
      selectedDistricteId = null;
      updateBarrisLayer();
      
      selectedBarriId = null;
      if (typeof updateSeccionsLayer === 'function') updateSeccionsLayer();
    }
    
    // Si el usuario se aleja a la vista de distrito, borramos el filtro de barrio
    if (z < 15 && selectedBarriId !== null) {
      selectedBarriId = null;
      if (typeof updateSeccionsLayer === 'function') updateSeccionsLayer();
    }

    // 0. TERME MUNICIPAL (Visible solo si Zoom < 12)
    if (termeGeoJSONLayer) {
      if (z < 12 && !map.hasLayer(termeGeoJSONLayer)) map.addLayer(termeGeoJSONLayer);
      if (z >= 12 && map.hasLayer(termeGeoJSONLayer)) map.removeLayer(termeGeoJSONLayer);
    }

    // 1. DISTRITOS (Visibles entre Zoom 12 y 13)
    if (districtesGeoJSONLayer) {
      if (z >= 12 && z < 14 && !map.hasLayer(districtesGeoJSONLayer)) map.addLayer(districtesGeoJSONLayer);
      if ((z < 12 || z >= 14) && map.hasLayer(districtesGeoJSONLayer)) map.removeLayer(districtesGeoJSONLayer);
    }

    // 2. BARRIOS (Visibles desde altura media en adelante: Zoom >= 14)
    if (barrisGeoJSONLayer) {
      if (z >= 14 && !map.hasLayer(barrisGeoJSONLayer)) map.addLayer(barrisGeoJSONLayer);
      if (z < 14 && map.hasLayer(barrisGeoJSONLayer)) map.removeLayer(barrisGeoJSONLayer);

      // Si bajamos a nivel Secciones Censales (>=15), dejamos el borde pero desactivamos la interactividad
      if (z >= 15) {
        barrisGeoJSONLayer.eachLayer(layer => {
          if (layer._path) layer._path.style.pointerEvents = 'none';
          if (layer.getTooltip()) layer.unbindTooltip();
          // MAGIA ANTI-BLOB: Forzamos que el relleno sea totalmente transparente para no tapar las fincas
          layer.setStyle({ color: '#3498db', weight: 1, fillOpacity: 0 });
        });
      } else {
        barrisGeoJSONLayer.eachLayer(layer => {
          if (layer._path) layer._path.style.pointerEvents = 'auto';
          if (!layer.getTooltip()) layer.bindTooltip(`<b>${layer.feature.properties.NOM}</b>`, { sticky: true, className: 'zone-tooltip' });
          // Restauramos el estilo base
          layer.setStyle({ color: '#3498db', weight: 1, fillOpacity: 0.05 });
        });
      }
    }

    // 3. SECCIONES CENSALES (Visibles desde altura micro en adelante: Zoom >= 15)
    if (seccionsGeoJSONLayer) {
      if (z >= 15 && !map.hasLayer(seccionsGeoJSONLayer)) map.addLayer(seccionsGeoJSONLayer);
      if (z < 15 && map.hasLayer(seccionsGeoJSONLayer)) map.removeLayer(seccionsGeoJSONLayer);

      // Si bajamos a nivel Finca (>=16), dejamos el borde pero desactivamos la interactividad
      if (z >= 16) {
        seccionsGeoJSONLayer.eachLayer(layer => {
          if (layer._path) layer._path.style.pointerEvents = 'none';
          if (layer.getTooltip()) layer.unbindTooltip();
          layer.setStyle({ color: '#2ecc71', weight: 1.5, fillOpacity: 0 });
        });
      } else {
        seccionsGeoJSONLayer.eachLayer(layer => {
          if (layer._path) layer._path.style.pointerEvents = 'auto';
          if (!layer.getTooltip()) layer.bindTooltip(`<b>Sección Censal: ${layer.feature.properties.DISTRICTE}-${layer.feature.properties.SEC_CENS}</b>`, { sticky: true, className: 'zone-tooltip' });
          layer.setStyle({ color: '#2ecc71', weight: 1.5, fillOpacity: 0.05 });
        });
      }
    }
  });

  // MAGIA INTERACTIVA: Seleccionar la finca/dirección con el ratón
  map.on('click', async function(e) {
    // Solo permitimos clavar el pin si ya estamos a nivel de calle/finca (Zoom >= 16)
    if (map.getZoom() >= 16) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      // Movemos el pin o lo creamos
      if (searchMarker) {
        searchMarker.setLatLng([lat, lng]);
      } else {
        searchMarker = L.marker([lat, lng]).addTo(map);
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
          
          searchMarker.bindPopup(`<b>🏢 Finca Seleccionada</b><br>${data.display_name}`).openPopup();
        } else {
          selectedAddress.value = `Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          searchMarker.bindPopup(`<b>🏢 Finca Seleccionada</b><br>Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`).openPopup();
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
              ano: finca.ano,
              superficie: finca.superficie,
              uso: finca.uso,
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
    <header class="header">
      <div class="brand">
        <h1>BCN Helper 🗺️</h1>
        <p>Tu escáner de la ciudad</p>
      </div>
      
      <!-- NUEVO BUSCADOR -->
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          @keyup.enter="buscarDireccion"
          type="text" 
          placeholder="📍 Ej: Av. d'Escolapi Càncer 54" 
        />
        <button @click="buscarDireccion">Buscar Dirección</button>
      </div>
    </header>
    
    <main class="main-content">
      
      <!-- PANEL LATERAL (IZQUIERDA) -->
      <aside class="sidebar">
        
        <!-- NIVEL 0: CIUDAD -->
        <div v-if="mapContext.level === 'ciudad'" class="context-panel">
          <h2 class="address-title">🏙️ Mercado Barcelona</h2>
          <p class="subtitle">Visión Macro (Haz clic en un Distrito)</p>
          <div class="data-card">
            <h3>📊 Tendencias Globales</h3>
            <ul class="stats-list">
              <li><span>💰 Precio Promedio:</span> <strong>4.120 €/m²</strong></li>
              <li><span>📈 Variación anual:</span> <strong class="text-green">+3.2%</strong></li>
              <li><span>👥 Población total:</span> <strong>1.62M</strong></li>
            </ul>
          </div>
        </div>

        <!-- NIVEL 1: DISTRITO -->
        <div v-else-if="mapContext.level === 'distrito'" class="context-panel">
          <h2 class="address-title">📍 Distrito: {{ mapContext.distritoName || '...' }}</h2>
          <p class="subtitle">Mercado Zonal (Haz clic en un Barrio)</p>
          <div class="data-card">
            <h3>🏢 Análisis de Distrito</h3>
            <ul class="stats-list">
              <li><span>🏢 Oferta Viviendas:</span> <strong>2.450 uds</strong></li>
              <li><span>⏳ Rotación (Liquidez):</span> <strong>Alta</strong></li>
              <li><span>📉 Tasa de descuento:</span> <strong>-4.5%</strong></li>
            </ul>
          </div>
        </div>

        <!-- NIVEL 2: BARRIO -->
        <div v-else-if="mapContext.level === 'barrio'" class="context-panel">
          <h2 class="address-title">🏘️ Barrio: {{ mapContext.barrioName || '...' }}</h2>
          <p class="subtitle">Mercado Local (Haz clic para explorar Secciones)</p>
          <div class="data-card">
            <h3>📊 Entorno del Barrio</h3>
            <ul class="stats-list">
              <li><span>💰 Precio M2 Promedio:</span> <strong>15.2 €/m² / mes</strong></li>
              <li><span>🚨 Índice Delincuencia:</span> <strong class="text-green">Bajo</strong></li>
              <li><span>📈 Renta Media Anual:</span> <strong>34.500 €</strong></li>
            </ul>
          </div>
        </div>

        <!-- NIVEL 3: SECCIÓN CENSAL -->
        <div v-else-if="mapContext.level === 'seccion'" class="context-panel">
          <h2 class="address-title">🎯 Censo: {{ mapContext.seccionCode || '...' }}</h2>
          <p class="subtitle">Micro-mercado (Haz clic en cualquier calle)</p>
          <div class="data-card">
            <h3>👥 Perfil de la Zona</h3>
            <ul class="stats-list">
              <li><span>💰 Renta Familiar:</span> <strong>42.500 €/año</strong></li>
              <li><span>🎓 Nivel Estudios:</span> <strong>Alto (45%)</strong></li>
              <li><span>🚨 Vulnerabilidad:</span> <strong class="text-green">Baja</strong></li>
            </ul>
            <div class="insight-alert" style="margin-top: 15px;">
              💡 <strong>Insight:</strong> Esta sección censal tiene una renta un 15% superior a la media de su distrito. Ideal para inquilinos Premium.
            </div>
          </div>
        </div>

        <!-- NIVEL 4: FINCA (CATASTRO) -->
        <div v-else-if="mapContext.level === 'finca'" class="context-panel">
          <div v-if="selectedAddress" class="ficha-header">
            <div class="ficha-crumb">Barcelona · Catastro en vivo</div>
            <h2 class="ficha-address">{{ selectedAddress }}</h2>
            <div v-if="fincaData.refCatastral" class="ficha-ref">
              <span class="ficha-ref-label">Ref. parcela</span>
              <span class="ficha-ref-value">{{ fincaData.refCatastral }}</span>
            </div>
          </div>
          <h2 class="address-title" v-else>📍 Explorador de fincas</h2>
          
          <div v-if="!selectedAddress" class="empty-state">
            <p>Haz clic en cualquier parcela del mapa para cargar los datos en vivo del Catastro y las afectaciones urbanísticas (PIU).</p>
          </div>
          
          <div v-else>
            <!-- La Finca (Catastro) -->
            <div class="ficha-block">
              <div class="ficha-block-head">
                <span class="ficha-block-title">La Finca</span>
                <span class="ficha-source">FUENTE · Catastro</span>
              </div>

              <div v-if="fincaData.estado === 'cargando'" class="ficha-grid">
                <div v-for="n in 6" :key="n" class="ficha-cell"><span class="skeleton"></span></div>
              </div>

              <div v-else-if="fincaData.estado === 'ok'" class="ficha-grid">
                <div class="ficha-cell">
                  <span class="ficha-k">Año constr.</span>
                  <span class="ficha-v">{{ fincaData.ano ?? '—' }}</span>
                </div>
                <div class="ficha-cell">
                  <span class="ficha-k">Superficie</span>
                  <span class="ficha-v"><template v-if="fincaData.superficie">{{ fincaData.superficie }}<small> m²</small></template><template v-else>—</template></span>
                </div>
                <div class="ficha-cell">
                  <span class="ficha-k">Plantas</span>
                  <span class="ficha-v">{{ fincaData.plantas ?? '—' }}</span>
                </div>
                <div class="ficha-cell">
                  <span class="ficha-k">Inmuebles</span>
                  <span class="ficha-v">{{ fincaData.nInmuebles ?? '—' }}</span>
                </div>
                <div class="ficha-cell">
                  <span class="ficha-k">Uso princ.</span>
                  <span class="ficha-v ficha-v-sm">{{ fincaData.uso ?? '—' }}</span>
                </div>
                <div class="ficha-cell">
                  <span class="ficha-k">Valor cat.</span>
                  <span class="ficha-v ficha-v-sm ficha-na" title="El valor catastral no es un dato público">no público</span>
                </div>
              </div>

              <div v-else-if="fincaData.estado === 'sin-parcela'" class="ficha-msg">
                Sin parcela catastral en este punto. Prueba sobre un edificio.
              </div>
              <div v-else-if="fincaData.estado === 'error'" class="ficha-msg ficha-msg-err">
                No se pudo consultar el Catastro. Reintenta el clic.
              </div>
            </div>

            <!-- Afectaciones urbanísticas (pendiente de fuente oficial) -->
            <div class="ficha-block">
              <details class="expandable">
                <summary>🚧 Afectaciones urbanísticas (PIU)</summary>
                <div class="details-content">
                  <p class="ficha-na">Pendiente de conectar con la fuente oficial del Ajuntament.</p>
                </div>
              </details>
            </div>

            <!-- Acciones -->
            <div class="action-buttons">
              <button class="street-view-btn">🚶 Ver en Street View</button>
              <button class="export-btn" @click="exportReport">📄 Generar informe (PDF)</button>
            </div>
          </div>
        </div>

      </aside>

      <!-- MAPA Y SUS CONTROLES (DERECHA) -->
      <div class="map-section">
        <div id="map" class="map-container"></div>
        
        <!-- Controles flotantes del mapa (Abajo Derecha) -->
        <div class="map-floating-controls">
          <div class="control-section">
            <h4>🗺️ Estilo de Mapa</h4>
            <div class="control-group">
              <label><input type="radio" name="mapStyle" value="calle" checked> Callejero</label>
              <label><input type="radio" name="mapStyle" value="satelite"> Satélite</label>
            </div>
          </div>
          
          <hr class="divider">
          
          <div class="control-section">
            <h4>📊 Capas Demográficas</h4>
            <div class="control-group">
              <label><input type="radio" name="baseLayer" value="precio" checked> Precio M2</label>
              <label><input type="radio" name="baseLayer" value="delitos"> Delincuencia</label>
              <label><input type="radio" name="baseLayer" value="renta"> Renta Media</label>
            </div>
          </div>
          
          <hr class="divider">
          
          <div class="control-section">
            <h4>🏗️ Capas Urbanísticas</h4>
            <div class="control-group">
              <label><input type="checkbox" id="check-fincas" value="fincas"> Parcelas (Catastro)</label>
              <label><input type="checkbox" value="vial"> Afectaciones (PIU)</label>
            </div>
          </div>
        </div>
      </div>
      
    </main>
  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, sans-serif;
  height: 100vh;
  width: 100vw;
  background-color: #f8f9fa;
}
#app { height: 100%; }
.app-container {
  display: flex; flex-direction: column; height: 100vh;
}
.header {
  background-color: #2c3e50; color: white; padding: 1rem 2rem;
  display: flex; justify-content: space-between; align-items: center;
}
.brand h1 { margin: 0; font-size: 1.5rem; }
.brand p { margin: 0; opacity: 0.8; font-size: 0.9rem; }

/* Estilos del buscador */
.search-box {
  display: flex;
  gap: 10px;
}
.search-box input {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  width: 300px;
  font-size: 1rem;
}
.search-box button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  background-color: #e74c3c;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}
.search-box button:hover {
  background-color: #c0392b;
}

.main-content { display: flex; flex: 1; overflow: hidden; }

.map-section {
  flex: 3;
  position: relative;
  height: 100%;
}

.map-container {
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* Controles Flotantes del Mapa */
.map-floating-controls {
  position: absolute;
  bottom: 30px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  padding: 15px 20px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  z-index: 1000; /* Asegura que flote sobre Leaflet */
  width: 200px;
  border: 1px solid rgba(0,0,0,0.05);
}

.map-floating-controls h4 {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
  color: #2c3e50;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.map-floating-controls .control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-floating-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #34495e;
  cursor: pointer;
}

.map-floating-controls .divider {
  border: 0;
  border-top: 1px solid #ecf0f1;
  margin: 15px 0;
}

.sidebar {
  width: 400px; /* Panel más ancho para que quepa bien la info */
  background: #f8f9fa;
  border-right: 1px solid #ddd;
  padding: 25px;
  overflow-y: auto;
  box-shadow: 2px 0 10px rgba(0,0,0,0.05);
  z-index: 10; /* Para que la sombra pase por encima del mapa */
}

/* Tipografía y diseño del Panel */
.address-title {
  font-size: 1.4rem;
  color: #2c3e50;
  margin-top: 0;
  margin-bottom: 20px;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}

.data-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  border: 1px solid #eee;
}

.data-card h3 {
  margin-top: 0;
  font-size: 1.1rem;
  color: #34495e;
  margin-bottom: 15px;
}

.data-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.data-item {
  display: flex;
  flex-direction: column;
}

.data-item .label {
  font-size: 0.8rem;
  color: #7f8c8d;
  text-transform: uppercase;
  font-weight: 600;
}

.data-item .value {
  font-size: 1.1rem;
  color: #2c3e50;
  font-weight: 500;
}

.ref-catastral {
  font-family: monospace;
  background: #ecf0f1;
  padding: 2px 5px;
  border-radius: 4px;
}

.insight-alert {
  margin-top: 15px;
  background: #fff3cd;
  color: #856404;
  padding: 10px;
  border-radius: 6px;
  font-size: 0.9rem;
  border-left: 4px solid #ffeeba;
}

.stats-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.stats-list li {
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
}

.stats-list li:last-child {
  border-bottom: none;
}

.text-green {
  color: #27ae60;
}

/* Expandible */
details.expandable summary {
  font-weight: bold;
  color: #2c3e50;
  cursor: pointer;
  outline: none;
  font-size: 1.1rem;
}

.details-content {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
  font-size: 0.95rem;
  color: #555;
}

.link-btn {
  display: inline-block;
  margin-top: 10px;
  color: #3498db;
  text-decoration: none;
  font-weight: 500;
}

/* Botones */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.street-view-btn, .export-btn {
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.street-view-btn {
  background: #ecf0f1;
  color: #2c3e50;
}

.street-view-btn:hover {
  background: #bdc3c7;
}

.export-btn {
  background: #e74c3c;
  color: white;
}

.export-btn:hover {
  background: #c0392b;
}

.layer-controls hr { border: 0; border-top: 1px solid #eee; margin: 15px 0; }

/* Indicador de Zoom */
.zoom-indicator-box {
  background: white;
  padding: 5px 10px;
  border-radius: 4px;
  box-shadow: 0 1px 5px rgba(0,0,0,0.4);
  font-size: 0.9rem;
  color: #2c3e50;
  border: 2px solid rgba(0,0,0,0.2);
}

/* Etiquetas de nombres de zonas (Permanentes) */
.zone-label {
  background: transparent;
  border: none;
  box-shadow: none;
  color: #2c3e50;
  font-weight: 800;
  font-size: 0.85rem;
  text-align: center;
  /* Efecto de borde blanco para que la letra se lea sobre cualquier fondo */
  text-shadow: 2px 2px 0px rgba(255,255,255,0.8), -2px -2px 0px rgba(255,255,255,0.8), 2px -2px 0px rgba(255,255,255,0.8), -2px 2px 0px rgba(255,255,255,0.8);
}
.zone-label::before {
  display: none !important; /* Ocultamos el triangulito que Leaflet le pone por defecto a los tooltips */
}

/* Tooltip del mapa: Estilo "fantasma" que simula texto nativo de CartoDB */
.zone-tooltip {
  background: transparent;
  color: #666666;
  border: none;
  font-family: 'Montserrat', 'Open Sans', 'Helvetica Neue', Arial, sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  padding: 0;
  box-shadow: none;
  /* Halo blanco clásico de los mapas GIS para legibilidad máxima */
  text-shadow: 2px 2px 0px rgba(255,255,255,0.95), 
              -2px -2px 0px rgba(255,255,255,0.95), 
               2px -2px 0px rgba(255,255,255,0.95), 
              -2px 2px 0px rgba(255,255,255,0.95);
}
.zone-tooltip::before {
  display: none !important;
}

</style>

<!-- Sistema visual de la Ficha de Propiedad (diseño BCN Radar) -->
<style>
.ficha-header { margin-bottom: 20px; }
.ficha-crumb {
  font: 600 9px/1 'IBM Plex Mono', monospace;
  letter-spacing: .08em; text-transform: uppercase;
  color: #2D5BD0; margin-bottom: 10px;
}
.ficha-address {
  font: 600 22px/1.12 'Source Serif 4', Georgia, serif;
  letter-spacing: -.01em; color: #0E1726; margin: 0 0 12px;
}
.ficha-ref { display: flex; align-items: center; gap: 8px; }
.ficha-ref-label {
  font: 600 8px/1 'Inter', sans-serif; letter-spacing: .1em;
  text-transform: uppercase; color: #9098A4;
}
.ficha-ref-value {
  font: 500 11px/1 'IBM Plex Mono', monospace; color: #404B5E;
  background: #F3F5F8; border: 1px solid #E7EAF0; padding: 3px 6px; border-radius: 5px;
}

.ficha-block { margin-bottom: 16px; }
.ficha-block-head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
}
.ficha-block-title {
  font: 600 12px/1 'Inter', sans-serif; letter-spacing: .04em; color: #0E1726;
}
.ficha-source {
  font: 500 9px/1 'IBM Plex Mono', monospace; color: #64748B;
  background: #F1F3F6; border: 1px solid #E6E9EF; padding: 4px 8px; border-radius: 5px;
}

.ficha-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px;
  background: #EEF0F4; border: 1px solid #EEF0F4; border-radius: 10px; overflow: hidden;
}
.ficha-cell {
  background: #fff; padding: 11px 12px;
  display: flex; flex-direction: column; gap: 7px; min-height: 56px;
}
.ficha-k {
  font: 500 9px/1 'Inter', sans-serif; letter-spacing: .07em;
  text-transform: uppercase; color: #9098A4;
}
.ficha-v { font: 600 18px/1 'IBM Plex Mono', monospace; color: #0E1726; }
.ficha-v small { font-size: 11px; color: #9098A4; }
.ficha-v-sm { font: 600 13px/1.1 'Inter', sans-serif; }
.ficha-na { color: #B6BCC6; }

.ficha-msg {
  font: 500 12px/1.5 'Inter', sans-serif; color: #7f8c8d;
  padding: 12px 14px; background: #FAFBFC; border: 1px solid #EAEDF2; border-radius: 10px;
}
.ficha-msg-err { color: #c0392b; background: #FBEDEB; border-color: #F5C6CB; }

.skeleton {
  display: block; height: 18px; width: 72%; border-radius: 4px;
  background: linear-gradient(90deg, #EEF0F4 25%, #F6F7F9 50%, #EEF0F4 75%);
  background-size: 200% 100%; animation: sk 1.2s ease-in-out infinite;
}
@keyframes sk { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>
