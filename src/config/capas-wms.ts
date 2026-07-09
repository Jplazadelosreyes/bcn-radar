// Catálogo declarativo de las capas WMS públicas (urbanismo Ajuntament · MUC · inundabilidad
// ACA). Dato puro y editable: el operador añade una fuente o una capa aquí, sin tocar la lógica
// del store (useLayers). Cada fuente trae su base WMS, versión, portal oficial y sus capas
// "curadas" (las destacadas); el resto se descubren en vivo vía GetCapabilities desde useLayers.
export interface WmsLayer {
  name: string
  label: string
  hint?: string
}
export interface WmsSource {
  id: string
  label: string
  badge: string
  attribution: string
  base: string
  version: string
  portal: string
  layers: WmsLayer[]
}

export const WMS_SOURCES: WmsSource[] = [
  {
    id: 'ajbcn-urb',
    label: 'Urbanismo · Ajuntament de Barcelona',
    badge: 'PIU',
    attribution: 'WMS Urbanisme · Ajuntament de Barcelona',
    base: 'https://w133.bcn.cat/WMSURBANISME/service.svc/get',
    version: '1.3.0',
    portal: 'https://ajuntament.barcelona.cat/informaciourbanistica/cerca/es/',
    layers: [
      { name: 'Qualificació_urbanística', label: 'Calificación urbanística', hint: 'La clave del suelo: qué puedes o no construir en la parcela.' },
      { name: 'Sector_de_planejament', label: 'Sectores de planeamiento', hint: 'Áreas con plan urbanístico propio.' },
      { name: 'Àmbit_de_planejament_aprovat_definitivament', label: 'Planeamiento aprobado', hint: 'Planes ya en vigor que afectan la zona.' },
      { name: 'Àmbit_de_planejament_en_tràmit', label: 'Planeamiento en trámite', hint: 'Lo que viene: revalorización o restricción futura.' },
      { name: 'Àmbit_de_suspensió_de_llicències', label: 'Suspensión de licencias', hint: 'Zonas donde ahora NO se conceden licencias de obra.' },
      { name: 'Àmbit_de_gestió', label: 'Ámbitos de gestión', hint: 'Reparcelaciones y gestión urbanística en curso.' },
      { name: 'Catàleg_de_patrimoni', label: 'Patrimonio protegido', hint: 'Edificios catalogados: obras limitadas, posibles ayudas.' },
      { name: 'Ordenació_volumètrica', label: 'Ordenación volumétrica', hint: 'Alturas y volúmenes edificables permitidos.' },
      { name: 'Parcel·la', label: 'Parcelario municipal', hint: 'Límites de parcela del Ajuntament.' },
    ],
  },
  {
    id: 'muc-cat',
    label: 'Urbanismo · Mapa Urbanístic de Catalunya',
    badge: 'MUC',
    attribution: 'MUC · Generalitat de Catalunya',
    base: 'https://dtes.gencat.cat/webmap/MUC/service.svc/get',
    version: '1.3.0',
    portal: 'https://territori.gencat.cat/ca/06_territori_i_urbanisme/observatori_territori/mapa_urbanistic_de_catalunya/',
    layers: [
      { name: 'MUC', label: 'Mapa urbanístico (Cataluña)', hint: 'Planeamiento vigente de toda Cataluña, unificado en una capa.' },
    ],
  },
  {
    id: 'aca-inund',
    label: "Inundabilidad · Agència Catalana de l'Aigua",
    badge: 'ACA',
    attribution: "Zones inundables · Agència Catalana de l'Aigua",
    base: 'https://aplicacions.aca.gencat.cat/geoserver/vishid/wms',
    version: '1.3.0',
    portal: 'https://aca.gencat.cat/ca/laigua/proteccio-i-conservacio/gestio-de-la-inundabilitat/',
    layers: [
      { name: 'vishid:Zones_inundables_T10', label: 'Inundable · frecuente (T10)', hint: 'Se inunda con episodios de ~10 años. Riesgo alto: evítalo.' },
      { name: 'vishid:Zones_inundables_T100', label: 'Inundable · 100 años (T100)', hint: 'Referencia legal de riesgo. Afecta seguros e hipoteca.' },
      { name: 'vishid:Zones_inundables_T500', label: 'Inundable · excepcional (T500)', hint: 'Episodios extremos de ~500 años. Riesgo bajo pero a conocer.' },
    ],
  },
]
