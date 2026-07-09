// Config declarativa de los modos de transporte por líneas (recorridos reales desde
// OpenStreetMap / Overpass). Dato puro y editable: el operador cura el catálogo aquí
// (orden, color, filtro Overpass) sin tocar la lógica del store (useTransporteModos).
export interface TransporteModo {
  key: string
  label: string
  color: string
  filter: string // fragmento de tag Overpass para la relación route
}

export const TRANSPORTES: TransporteModo[] = [
  { key: 'metro', label: 'Metro', color: '#E2231A', filter: '["route"="subway"]' },
  { key: 'rodalies', label: 'Rodalies / Renfe', color: '#1A8A4A', filter: '["route"="train"]' },
  { key: 'bus', label: 'Bus', color: '#0067B1', filter: '["route"="bus"]' },
  { key: 'tram', label: 'FGC / Tranvía', color: '#E87200', filter: '["route"~"tram|light_rail"]' },
]

export const TRANSPORT_BBOX = '41.27,2.00,41.50,2.30' // S,W,N,E (BCN + área cercana)
