// ═══════════════════════════════════════════════════════════════════════════════
//  🎨  COLORES DEL MAPA  —  edita los hex de abajo y recarga la página para verlos
// ═══════════════════════════════════════════════════════════════════════════════
//
//  CÓMO PROBAR:
//   1. Cambia cualquier hex en MAP_COLORS.day (día) o .night (noche).
//   2. Guarda → el navegador recarga solo (Vite HMR) → cambia el tema con ☀/☾.
//
//  TODO está mapeado y separado: cada clase de calle y CADA tipo de etiqueta (letras)
//  tiene su propia línea. Ningún objeto usa un color por defecto.
//  ───────────────────────────────────────────────────────────────────────────────

export const MAP_COLORS = {
  // ══════════════════════════════ ☀️  DÍA  ══════════════════════════════
  day: {
    // ── Fondo y agua ──
    background:      '#F8F4F0',   // tierra / fondo general
    water:           '#9EBDFF',   // mar, lagos (relleno)
    waterway:        '#A0C8F0',   // cauces de río (línea)

    // ── Verdes y usos de suelo ──
    landPark:        '#D8E8C8',   // parques
    landParkEdge:    '#E4F1D7',   // borde de parque
    landWood:        '#CFE6BB',   // bosque
    landGrass:       '#B0D59A',   // césped / pradera
    landResidential: '#E7E3DD',   // suelo residencial (manzanas)
    landSand:        '#F7EFC3',   // arena / playa
    landIce:         '#E0ECEC',   // hielo
    landPitch:       '#DEE3CD',   // canchas / pistas deportivas
    landCemetery:    '#D3DDB7',   // cementerios
    landHospital:    '#FFE0E6',   // hospitales
    landSchool:      '#ECEECC',   // colegios
    aeroway:         '#E9E6EA',   // superficie de aeropuerto
    aerowayLine:     '#D1D1D1',   // pistas / rodaje

    // ── Edificios (footprints 2D) ──
    building:        '#E3E4E7',   // relleno de edificio
    buildingEdge:    '#CBCDD2',   // borde de edificio
    building3D:      '#C2CBDB',   // extrusión (solo con el botón 3D activo)

    // ── Calles (relleno) ──
    roadMotorway:        '#FFCC88',   // autopista / autovía
    roadTrunkPrimary:    '#FFE9A6',   // vías primarias (troncales)
    roadSecondaryTertiary:'#FFEEAA',  // secundarias / terciarias
    roadLink:            '#FFEEAA',   // enlaces / ramales
    roadMinor:           '#FFFFFF',   // calles menores
    roadServiceTrack:    '#FFFFFF',   // servicio / pistas
    roadPath:            '#FFFFFF',   // sendas / peatonal
    rail:                '#BBBBBB',   // ferrocarril / metro
    // ── Calles (contorno / casing) ──
    roadMajorCasing:     '#E9AC77',   // contorno de vías principales
    roadMinorCasing:     '#CFCDCA',   // contorno de calles menores
    // ── Límites ──
    boundary:            '#9E9CAB',   // límites administrativos

    // ── ETIQUETAS / LETRAS (texto de cada tipo) ──
    labelCountry:    '#000000',   // países
    labelState:      '#333333',   // comunidades / estados
    labelCity:       '#000000',   // ciudades (y capitales)
    labelTown:       '#000000',   // pueblos
    labelVillage:    '#000000',   // aldeas
    labelDistrict:   '#333333',   // barrios / distritos (otros lugares)
    labelStreet:     '#555555',   // nombres de calle
    labelStreetPath: '#A8977E',   // nombres de senda / peatonal
    labelWater:      '#495E91',   // nombres de mar / lago
    labelWaterway:   '#74AEE9',   // nombres de río
    labelPoi:        '#666666',   // comercios / puntos de interés
    labelPoiTransit: '#2E5A80',   // paradas de transporte
    labelAirport:    '#666666',   // aeropuertos
    labelHalo:       '#FFFFFF',   // halo (borde) de TODAS las letras
  },

  // ══════════════════════════════ 🌙  NOCHE  ══════════════════════════════
  night: {
    // ── Fondo y agua ──
    background:      '#0F1A21',
    water:           '#0B2637',
    waterway:        '#20455A',

    // ── Verdes y usos de suelo ──
    landPark:        '#16281F',
    landParkEdge:    '#1D3327',
    landWood:        '#15291E',
    landGrass:       '#173021',
    landResidential: '#152530',
    landSand:        '#2A2A1E',
    landIce:         '#1F3038',
    landPitch:       '#1A2A2A',
    landCemetery:    '#182A20',
    landHospital:    '#2A2030',
    landSchool:      '#26281E',
    aeroway:         '#1C2833',
    aerowayLine:     '#2A3A44',

    // ── Edificios (footprints 2D) ──
    building:        '#1E2F3B',
    buildingEdge:    '#33485A',
    building3D:      '#233240',

    // ── Calles (relleno) — familia "celeste plomo": resalta suave ──
    roadMotorway:        '#A6BDCC',   // autopista / autovía (la más marcada)
    roadTrunkPrimary:    '#97B0C1',   // vías primarias
    roadSecondaryTertiary:'#7E96A6',  // secundarias / terciarias
    roadLink:            '#8AA0AE',   // enlaces / ramales
    roadMinor:           '#5E7078',   // calles menores
    roadServiceTrack:    '#55666E',   // servicio / pistas
    roadPath:            '#4A5A62',   // sendas / peatonal
    rail:                '#3F4D55',   // ferrocarril / metro
    // ── Calles (contorno / casing) ──
    roadMajorCasing:     '#2B3E4A',
    roadMinorCasing:     '#1C2A30',
    // ── Límites ──
    boundary:            '#3A4A54',

    // ── ETIQUETAS / LETRAS ──
    labelCountry:    '#D8E2E6',
    labelState:      '#B9C7CD',
    labelCity:       '#DDE7EA',
    labelTown:       '#C6D2D6',
    labelVillage:    '#AEBBC0',
    labelDistrict:   '#9FB0B6',
    labelStreet:     '#93A6AE',
    labelStreetPath: '#7E8F86',
    labelWater:      '#6E9AB8',
    labelWaterway:   '#6BA0C4',
    labelPoi:        '#8B9AA2',
    labelPoiTransit: '#6E9AB8',
    labelAirport:    '#8B9AA2',
    labelHalo:       '#0A1319',
  },
}

// ─── Limpieza del mapa (independiente del tema) ──────────────────────────────────
export const MAP_OPTIONS = {
  flat2D:        true,   // mapa plano tipo Google (oculta edificios 3D del estilo)
  hidePoiStops:  true,   // oculta iconos de paradas de transporte (poi_transit)
  hidePoiPlaces: true,   // oculta iconos de comercios / puntos de interés
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Maquinaria — asigna cada capa del estilo Liberty a un rol de la paleta.
//  Cobertura total: si añades una capa nueva y no matchea, no se pinta (queda su
//  color original). Todas las capas de color del estilo actual están cubiertas.
// ═══════════════════════════════════════════════════════════════════════════════
function rolesFor(l) {
  const id = l.id, t = l.type

  // Fondo, agua, tierra
  if (t === 'background') return [['background-color', 'background']]
  if (id === 'water') return [['fill-color', 'water']]
  if (/^waterway/.test(id) && t === 'line') return [['line-color', 'waterway']]
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

  // Ferrocarril (antes que las calles: los ids contienen 'rail')
  if (/rail/.test(id)) return [['line-color', 'rail']]

  // Contornos de calle (casing) — antes que los rellenos
  if (/casing/.test(id)) {
    const major = /(motorway|trunk|primary|secondary|tertiary|link)/.test(id)
    return [['line-color', major ? 'roadMajorCasing' : 'roadMinorCasing']]
  }

  // Rellenos de calle (por clase). Orden: link antes que motorway (motorway_link = ramal).
  if (t === 'line' && /_link/.test(id)) return [['line-color', 'roadLink']]
  if (t === 'line' && /motorway/.test(id)) return [['line-color', 'roadMotorway']]
  if (t === 'line' && /(trunk|primary)/.test(id)) return [['line-color', 'roadTrunkPrimary']]
  if (t === 'line' && /(secondary|tertiary)/.test(id)) return [['line-color', 'roadSecondaryTertiary']]
  if (t === 'line' && /(service|track)/.test(id)) return [['line-color', 'roadServiceTrack']]
  if (t === 'line' && /(path|pedestrian)/.test(id)) return [['line-color', 'roadPath']]
  if (t === 'line' && /(minor|street)/.test(id)) return [['line-color', 'roadMinor']]

  // Etiquetas (texto). Cada tipo su propio color; halo compartido.
  if (t === 'symbol') {
    let r = 'labelDistrict'
    if (/country/.test(id)) r = 'labelCountry'
    else if (/state/.test(id)) r = 'labelState'
    else if (/city/.test(id)) r = 'labelCity'
    else if (/town/.test(id)) r = 'labelTown'
    else if (/village/.test(id)) r = 'labelVillage'
    else if (/label_other/.test(id)) r = 'labelDistrict'
    else if (/highway-name-path/.test(id)) r = 'labelStreetPath'
    else if (/highway-name/.test(id)) r = 'labelStreet'
    else if (/waterway/.test(id)) r = 'labelWaterway'
    else if (/water_name/.test(id)) r = 'labelWater'
    else if (/poi_transit/.test(id)) r = 'labelPoiTransit'
    else if (/poi/.test(id)) r = 'labelPoi'
    else if (/airport/.test(id)) r = 'labelAirport'
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
