// useMap — instancia única del mapa MapLibre (singleton de módulo).
// Toda la app comparte este mapa: createMap() lo construye una vez (onMounted de App)
// y getMap() lo entrega a cualquier componente/composable que lo necesite.
//
//  `any` acotado: frontera con MapLibre (controles nativos, LngLatBoundsLike).
/* eslint-disable @typescript-eslint/no-explicit-any */
import maplibregl from 'maplibre-gl'

let map: any = null

// Indicador de zoom como control nativo de MapLibre (abreviado en móvil: "z11")
class ZoomIndicatorControl {
  _map?: any
  _box!: HTMLElement
  onAdd(m: any) {
    this._map = m
    this._box = document.createElement('div')
    this._box.className = 'maplibregl-ctrl zoom-indicator-box'
    const compact = window.matchMedia('(max-width: 680px)')
    const render = () => {
      const z = m.getZoom().toFixed(0)
      this._box.innerHTML = compact.matches ? `z${z}` : `<b>🔍 Zoom:</b> ${z}`
    }
    render(); m.on('zoom', render); compact.addEventListener('change', render)
    return this._box
  }
  onRemove() { this._box.remove(); this._map = undefined }
}

// Rosa de los vientos: gira con la orientación; clic = volver al norte y aplanar
class CompassRoseControl {
  _map?: any
  _box!: HTMLElement
  _dial!: HTMLElement
  onAdd(m: any) {
    this._map = m
    this._box = document.createElement('div')
    this._box.className = 'maplibregl-ctrl maplibregl-ctrl-group compass-rose'
    this._box.title = 'Volver al norte'
    this._box.innerHTML = `
      <svg viewBox="0 0 48 48" width="40" height="40">
        <g class="compass-dial">
          <circle cx="24" cy="24" r="21" fill="#fff" stroke="#E6E9EF"/>
          <polygon points="24,5 28,24 24,21 20,24" fill="#D24B3E"/>
          <polygon points="24,43 20,24 24,27 28,24" fill="#8A93A3"/>
          <text x="24" y="13" text-anchor="middle" font-size="8" font-weight="700" fill="#0E1726" font-family="Inter,sans-serif">N</text>
          <text x="24" y="42" text-anchor="middle" font-size="6" fill="#9098A4" font-family="Inter,sans-serif">S</text>
          <text x="42" y="26.5" text-anchor="middle" font-size="6" fill="#9098A4" font-family="Inter,sans-serif">E</text>
          <text x="6" y="26.5" text-anchor="middle" font-size="6" fill="#9098A4" font-family="Inter,sans-serif">O</text>
        </g>
      </svg>`
    this._dial = this._box.querySelector('.compass-dial') as HTMLElement
    this._box.addEventListener('click', () => m.easeTo({ bearing: 0, pitch: 0, duration: 500 }))
    const rotate = () => { this._dial.style.transform = `rotate(${-m.getBearing()}deg)` }
    m.on('rotate', rotate); rotate()
    return this._box
  }
  onRemove() { this._box.remove(); this._map = undefined }
}

// Construye el mapa con sus controles nativos y gestos 3D. Llamar UNA vez.
export function createMap(container = 'map') {
  // Límites con holgura alrededor de Barcelona (la máscara mantiene el foco visual)
  const bcnBounds: [[number, number], [number, number]] = [[1.9600, 41.2600], [2.3600, 41.5200]] // [SW],[NE]

  // Motor MapLibre GL (open source) + basemap vectorial OpenFreeMap (sin API key)
  map = new maplibregl.Map({
    container,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [2.1734, 41.3851],
    zoom: 11,
    minZoom: 11,
    maxZoom: 21,
    maxPitch: 70,
    maxBounds: bcnBounds,
    attributionControl: { compact: true },
  })

  // Si el contenedor mide 0 al construir (layout aún no resuelto: CSS tardío, iframe,
  // pestaña en segundo plano), MapLibre cae a su lienzo por defecto de 400×300 y su
  // trackResize DESCARTA el primer aviso del ResizeObserver → el mapa queda chico para
  // siempre. Observamos el contenedor por nuestra cuenta: cada cambio real de tamaño
  // (incluido el aviso inicial) fuerza un resize. Idempotente si ya está bien.
  const ro = new ResizeObserver(() => { if (map) map.resize() })
  ro.observe(map.getContainer())
  map.once('remove', () => ro.disconnect())

  // Zoom. La brújula nativa se omite a propósito: CompassRoseControl (abajo) ya cumple esa
  // función — con las dos activas salían dos brújulas seguidas en la misma columna.
  map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'top-right')
  // Pantalla completa
  map.addControl(new maplibregl.FullscreenControl(), 'top-right')
  // Geolocalización (mi ubicación, con rumbo)
  map.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true,
  } as any), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
  map.addControl(new ZoomIndicatorControl(), 'bottom-right')
  map.addControl(new CompassRoseControl(), 'top-right')

  // Gestos 3D: arrastrar con botón derecho o Ctrl+arrastrar para rotar/inclinar
  map.dragRotate.enable()
  map.touchZoomRotate.enableRotation()
  if (map.touchPitch) map.touchPitch.enable()

  // Atribución plegada al ⓘ (obligatoria por licencia, pero mínima: se expande al tocarla).
  // MapLibre la RE-ABRE cada vez que una fuente nueva aporta créditos (nuestras capas los
  // añaden después del load), así que además del load se pliega en el primer idle, cuando
  // ya está todo montado. En móvil, abierta ocupaba la franja entera y pisaba el zoom.
  const collapseAttrib = () => {
    const attrib = map.getContainer().querySelector('details.maplibregl-ctrl-attrib')
    if (attrib) attrib.removeAttribute('open')
  }
  map.once('load', collapseAttrib)
  map.once('idle', collapseAttrib)

  return map
}

// Acceso a la instancia ya creada (null antes de createMap)
export function getMap() { return map }
