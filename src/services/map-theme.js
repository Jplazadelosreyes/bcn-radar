// ═══════════════════════════════════════════════════════════════════════════════
//  🎨  COLORES DEL MAPA  —  edita los hex de abajo y recarga la página para verlos
// ═══════════════════════════════════════════════════════════════════════════════
//
//  CÓMO PROBAR:
//   1. Cambia cualquier valor hex en MAP_COLORS.day (mapa de día) o .night (noche).
//   2. Guarda → el navegador recarga solo (Vite HMR) → cambia el tema con el botón ☀/☾.
//   3. Ningún color queda afuera: cada capa del mapa está asignada a un "rol" (ver
//      rolesFor() más abajo). Si un color no te cuadra, busca su rol por el nombre.
//
//  Además, MAP_OPTIONS controla la limpieza del mapa (paradas, comercios, 3D).
//  ───────────────────────────────────────────────────────────────────────────────

export const MAP_COLORS = {
  // ══════════════ ☀️  DÍA  ══════════════
  day: {
    // Fondo y agua
    background:      '#F8F4F0',   // tierra / fondo general
    water:          '#9EBDFF',   // mar, lagos, ríos (relleno)
    waterway:       '#A0C8F0',   // cauces de río (línea)
    // Verdes y usos de suelo
    landPark:       '#D8E8C8',   // parques
    landParkEdge:   '#E4F1D7',   // borde de parque
    landWood:       '#CFE6BB',   // bosque
    landGrass:      '#B0D59A',   // césped / pradera
    landResidential:'#E7E3DD',   // suelo residencial (manzanas)
    landSand:       '#F7EFC3',   // arena / playa
    landIce:        '#E0ECEC',   // hielo
    landPitch:      '#DEE3CD',   // canchas deportivas / pistas
    landCemetery:   '#D3DDB7',   // cementerios
    landHospital:   '#FFE0E6',   // hospitales
    landSchool:     '#ECEECC',   // colegios
    aeroway:        '#E9E6EA',   // aeropuerto (superficie)
    aerowayLine:    '#D1D1D1',   // pistas / calles de rodaje
    // Edificios (footprints 2D, tipo Google — grises visibles sobre el fondo beige)
    building:       '#E3E4E7',   // edificios (relleno 2D)
    buildingEdge:   '#CBCDD2',   // borde de edificio
    building3D:     '#C2CBDB',   // edificios extruidos (solo si activas el 3D)
    // Calles
    roadMajor:      '#FCE7A0',   // vías principales (autopista/avenida) ← el "amarillo" de día
    roadMajorCasing:'#E9AC77',   // contorno de vías principales
    roadMinor:      '#FFFFFF',   // calles menores
    roadMinorCasing:'#CFCDCA',   // contorno de calles menores
    roadPath:       '#FFFFFF',   // sendas / peatonal
    rail:           '#BBBBBB',   // ferrocarril / metro
    boundary:       '#9E9CAB',   // límites administrativos
    // Etiquetas (texto)
    labelPlace:     '#333333',   // nombres de ciudad/pueblo/país
    labelRoad:      '#4D4D4D',   // nombres de calle
    labelWater:     '#4B6A9B',   // nombres de agua
    labelPoi:       '#5B6670',   // nombres de comercios/POI
    labelHalo:      '#FFFFFF',   // halo (borde) de todos los textos
  },

  // ══════════════ 🌙  NOCHE  ══════════════
  night: {
    // Fondo y agua
    background:      '#0F1A21',
    water:          '#0B2637',
    waterway:       '#20455A',
    // Verdes y usos de suelo
    landPark:       '#16281F',
    landParkEdge:   '#1D3327',
    landWood:       '#15291E',
    landGrass:      '#173021',
    landResidential:'#152530',
    landSand:       '#2A2A1E',
    landIce:        '#1F3038',
    landPitch:      '#1A2A2A',
    landCemetery:   '#182A20',
    landHospital:   '#2A2030',
    landSchool:     '#26281E',
    aeroway:        '#1C2833',
    aerowayLine:    '#2A3A44',
    // Edificios (footprints 2D, algo más claros que el fondo para que se lean)
    building:       '#1E2F3B',
    buildingEdge:   '#33485A',
    building3D:     '#233240',
    // Calles
    roadMajor:      '#97B0C1',   // ← vías principales de noche (celeste plomo: resalta suave)
    roadMajorCasing:'#2B3E4A',
    roadMinor:      '#6A7C84',
    roadMinorCasing:'#1C2A30',
    roadPath:       '#4A5A62',
    rail:           '#3F4D55',
    boundary:       '#3A4A54',
    // Etiquetas (texto)
    labelPlace:     '#CBD8DC',
    labelRoad:      '#AEBEC4',
    labelWater:     '#7FB0C4',
    labelPoi:       '#8B9AA2',
    labelHalo:      '#091319',
  },
}

// ─── Limpieza del mapa (independiente del tema) ──────────────────────────────────
export const MAP_OPTIONS = {
  flat2D:        true,   // mapa plano tipo Google (oculta los edificios 3D del estilo)
  hidePoiStops:  true,   // oculta los iconos de paradas de transporte (poi_transit)
  hidePoiPlaces: true,   // oculta los iconos de comercios / puntos de interés
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Maquinaria — normalmente no hace falta tocar de aquí para abajo.
//  Asigna cada capa del estilo Liberty a un rol de la paleta (garantiza cobertura
//  total: no queda ninguna capa con color sin asignar).
// ═══════════════════════════════════════════════════════════════════════════════
function rolesFor(l) {
  const id = l.id, t = l.type
  if (t === 'background') return [['background-color', 'background']]
  if (id === 'water') return [['fill-color', 'water']]
  if (/^waterway/.test(id)) return [['line-color', 'waterway']]
  if (id === 'park') return [['fill-color', 'landPark'], ['fill-outline-color', 'landParkEdge']]
  if (id === 'park_outline') return [['line-color', 'landParkEdge']]
  if (id === 'landuse_residential') return [['fill-color', 'landResidential']]
  if (id === 'landcover_wood') return [['fill-color', 'landWood']]
  if (id === 'landcover_grass') return [['fill-color', 'landGrass']]
  if (id === 'landcover_ice') return [['fill-color', 'landIce']]
  if (id === 'landcover_sand') return [['fill-color', 'landSand']]
  if (id === 'landuse_pitch' || id === 'landuse_track') return [['fill-color', 'landPitch']]
  if (id === 'landuse_cemetery') return [['fill-color', 'landCemetery']]
  if (id === 'landuse_hospital') return [['fill-color', 'landHospital']]
  if (id === 'landuse_school') return [['fill-color', 'landSchool']]
  if (id === 'aeroway_fill') return [['fill-color', 'aeroway']]
  if (id === 'aeroway_runway' || id === 'aeroway_taxiway') return [['line-color', 'aerowayLine']]
  if (id === 'building') return [['fill-color', 'building'], ['fill-outline-color', 'buildingEdge']]
  if (id === 'building-3d') return [['fill-extrusion-color', 'building3D']]
  if (/^boundary/.test(id)) return [['line-color', 'boundary']]
  if (/rail/.test(id)) return [['line-color', 'rail']]
  if (/casing/.test(id)) return [['line-color', /(motorway|trunk|primary|secondary|tertiary|link)/.test(id) ? 'roadMajorCasing' : 'roadMinorCasing']]
  if (t === 'line' && /(motorway|trunk|primary|secondary|tertiary|link)/.test(id)) return [['line-color', 'roadMajor']]
  if (t === 'line' && /(path|pedestrian)/.test(id)) return [['line-color', 'roadPath']]
  if (t === 'line' && /(minor|street|service|track)/.test(id)) return [['line-color', 'roadMinor']]
  if (t === 'symbol') {
    let r = 'labelPlace'
    if (/water/.test(id)) r = 'labelWater'
    else if (/highway-name/.test(id)) r = 'labelRoad'
    else if (/poi|airport/.test(id)) r = 'labelPoi'
    return [['text-color', r], ['text-halo-color', 'labelHalo']]
  }
  return []
}

// Aplica una paleta ('day' | 'night') a todas las capas vectoriales del mapa.
export function applyMapTheme(map, mode) {
  if (!map || !map.isStyleLoaded()) return
  const C = MAP_COLORS[mode] || MAP_COLORS.day
  for (const l of map.getStyle().layers) {
    for (const [prop, role] of rolesFor(l)) {
      const val = C[role]
      if (val == null || !map.getLayer(l.id)) continue
      try { map.setPaintProperty(l.id, prop, val) } catch { /* capa sin esa prop: ignorar */ }
    }
  }
  applyMapOptions(map)
}

// Oculta 3D / paradas / comercios según MAP_OPTIONS (idempotente).
export function applyMapOptions(map) {
  if (!map) return
  const hide = (id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', 'none')
  if (MAP_OPTIONS.flat2D) {
    // El estilo solo dibuja la capa plana `building` hasta z14 y a partir de ahí usa la 3D.
    // Para un mapa 2D tipo Google: ocultamos la 3D y EXTENDEMOS la plana a todos los zooms,
    // así los footprints se ven a nivel calle. (El botón "Edificios 3D" de la app sigue aparte.)
    hide('building-3d')
    if (map.getLayer('building')) map.setLayerZoomRange('building', 13, 24)
  }
  if (MAP_OPTIONS.hidePoiStops) hide('poi_transit')
  if (MAP_OPTIONS.hidePoiPlaces) { hide('poi_r1'); hide('poi_r7'); hide('poi_r20') }
}
