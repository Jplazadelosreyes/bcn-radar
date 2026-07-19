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
  //  Referencia: el MODO NOCHE oficial de Google Maps (su JSON de styling clásico).
  //  Claves de ese estilo, replicadas aquí:
  //   · Fondo azul grisáceo CÁLIDO (#242F3E), no negro azulado: descansa la vista.
  //   · Calles apenas un tono más claras que el fondo (#38414E): se leen por contorno
  //     y etiqueta, no por brillo. Solo la autopista destaca, en ámbar apagado (#746855).
  //   · Sendas/aceras casi invisibles (el punteado peatonal del Eixample gritaba).
  //   · Halo de las letras = COLOR DEL FONDO, no negro: la letra flota suave.
  night: {
    // ── Fondo y agua ──
    background:      '#21313C',
    water:           '#14222D',
    waterway:        '#2B4254',

    // ── Verdes y usos de suelo ──
    landPark:        '#213A38',
    landParkEdge:    '#2A4643',
    landWood:        '#1C332E',
    landGrass:       '#254039',
    landResidential: '#243440',
    landSand:        '#33352C',
    landIce:         '#263843',
    landPitch:       '#253B3B',
    landCemetery:    '#233830',
    landHospital:    '#3A3038',
    landSchool:      '#33372C',
    aeroway:         '#283641',
    aerowayLine:     '#384754',

    // ── Edificios (footprints 2D) — apenas se insinúan, como en Google ──
    building:        '#2A3A45',
    buildingEdge:    '#364754',
    building3D:      '#2C3C48',

    // ── Calles (relleno) — gama Google noche: gris azulado poco por encima del fondo,
    //    jerarquía por matiz sutil y la autopista en ámbar apagado (marca de la casa).
    //    Subidas un paso sobre el Google puro: a zoom de barrio se fundían con el fondo.
    roadMotorway:        '#8D7550',   // autopista / autovía (ámbar Google, un punto más vivo)
    roadTrunkPrimary:    '#56697B',   // vías primarias
    roadSecondaryTertiary:'#47596A',  // secundarias / terciarias
    roadLink:            '#4E5F6F',   // enlaces / ramales
    roadMinor:           '#3C4C59',   // calles menores
    roadServiceTrack:    '#344350',   // servicio / pistas
    roadPath:            '#384754',   // sendas / aceras (el punteado del Eixample, MUDO)
    rail:                '#313F4C',   // ferrocarril / metro (transit de Google)
    // ── Calles (contorno / casing) — el trazo oscuro que recorta la calle ──
    roadMajorCasing:     '#1B2831',
    roadMinorCasing:     '#1B2831',
    // ── Límites ──
    boundary:            '#3F5464',

    // ── ETIQUETAS / LETRAS — como Google noche: lugares en ámbar cálido (#D59563),
    //    calles en gris azulado claro y halo APENAS más oscuro que el fondo: la letra
    //    recorta sin el cerco negro duro. (El gris Google puro #9CA5B3 se perdía
    //    a zoom de barrio: todo sube un paso de luz.) ──
    labelCountry:    '#D8E3E1',
    labelState:      '#B9C8C8',
    labelCity:       '#E0AA66',   // ciudades: el ámbar señature de Google noche, más vivo
    labelTown:       '#D29E62',
    labelVillage:    '#BF925C',
    labelDistrict:   '#AEBEC4',   // barrios / distritos
    labelStreet:     '#B7C6CB',   // nombres de calle
    labelStreetPath: '#8FA0A8',
    labelWater:      '#7A92A5',
    labelWaterway:   '#88A3B6',
    labelPoi:        '#CFA265',
    labelPoiTransit: '#95ACBD',
    labelAirport:    '#B7C6CB',
    labelHalo:       '#1C2932',
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
  if (!map) return
  // OJO: isStyleLoaded() da false mientras haya CUALQUIER carga en vuelo (tiles incluidas);
  // con el guard antiguo, cambiar el tema en ese momento se PERDÍA en silencio (el chrome
  // cambiaba y el mapa no). setPaintProperty funciona en cuanto el estilo existe: basta con
  // diferir al 'load' si aún no hay estilo, nunca abortar.
  let styleReady = false
  try { styleReady = (map.getStyle()?.layers || []).length > 0 } catch { styleReady = false }
  if (!styleReady) { map.once('load', () => applyMapTheme(map, mode)); return }
  const C = MAP_COLORS[mode] || MAP_COLORS.day
  for (const l of map.getStyle().layers) {
    for (const [prop, role] of rolesFor(l)) {
      const val = C[role]
      if (val == null || !map.getLayer(l.id)) continue
      try { map.setPaintProperty(l.id, prop, val) } catch { /* capa sin esa prop: ignorar */ }
    }
  }
  // Zonas peatonales con trama de IMAGEN (pedestrian_polygon): el patrón blanco no se
  // retiñe con setPaintProperty como los colores — de noche brillaba como neón sobre el
  // mapa oscuro. Se atenúa fuerte en noche y vuelve a plena luz de día.
  if (map.getLayer('road_area_pattern')) {
    try { map.setPaintProperty('road_area_pattern', 'fill-opacity', mode === 'night' ? 0.08 : 1) } catch { /* sin la capa: ignorar */ }
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
