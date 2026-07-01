// Descripciones legibles para las capas técnicas de los WMS urbanísticos
// (Ajuntament en catalán + MUC con códigos crípticos). Se aplican en "ver todas".
// Reglas por patrón: devuelve la primera que coincide con el nombre de la capa.
const RULES = [
  [/qualificaci|^qual/i, 'Calificación del suelo: la clave que fija qué se puede construir y para qué uso.'],
  [/classific|^clas\b|^clas-/i, 'Clasificación del suelo: urbano, urbanizable o no urbanizable.'],
  [/sector|^sect\b/i, 'Sectores de planeamiento: ámbitos con un plan urbanístico propio.'],
  [/ordenaci.*volum|volum.*tric/i, 'Ordenación volumétrica: alturas y volúmenes edificables permitidos.'],
  [/alineaci/i, 'Alineación de fachada prevista (retranqueo o ensanche de la calle).'],
  [/planejament aprovat|aprovat definitiv/i, 'Ámbitos con planeamiento aprobado definitivamente (en vigor).'],
  [/planejament en tr[àa]mit|en tr[àa]mit/i, 'Planeamiento en tramitación: cambios que podrían venir.'],
  [/suspensi/i, 'Suspensión de licencias: zonas donde ahora no se conceden.'],
  [/gesti[oó]/i, 'Ámbitos de gestión urbanística (reparcelaciones, expropiaciones).'],
  [/sent[èe]ncia/i, 'Ámbitos afectados por sentencia judicial.'],
  [/patrimoni|conjunt.*protegit|entorn.*protecci|emblem[àa]tic/i, 'Patrimonio protegido: edificios, conjuntos y establecimientos catalogados.'],
  [/interior.*illa/i, 'Interior de manzana (habitualmente no edificable en planta baja).'],
  [/parcel/i, 'Parcelario: límites de las parcelas.'],
  [/^illa|d.?illa/i, 'Manzanas (illes).'],
  [/t[uú]nel.*metro/i, 'Trazado de los túneles de metro.'],
  [/dpmt|mar[ií]tim/i, 'Dominio público marítimo-terrestre y sus servidumbres (costa).'],
  [/ztm/i, 'Zona de servidumbre / protección del litoral (Ministerio).'],
  [/ample.*(vial|oficial|carrer)/i, 'Ancho oficial de la calle.'],
  [/divisi[oó]/i, 'Divisiones administrativas del planeamiento.'],
  [/terme municipal|^tm\b|^tm_/i, 'Término municipal: límites del municipio.'],
  [/^urbans?\b/i, 'Suelo urbano.'],
  [/adre[çc]|adreces/i, 'Direcciones postales.'],
  [/retolaci|r[èe]tol/i, 'Rotulación de calles y viario.'],
  [/n[uú]mero postal/i, 'Números de policía (portales).'],
  [/l[íi]mit de terme/i, 'Límite del término municipal.'],
  [/xarxa vi[àa]ria|vial|^via/i, 'Red viaria (calles y vías).'],
  [/equipament/i, 'Equipamientos (sistemas de servicios públicos).'],
  [/espais? lliures?|zona verda|verd/i, 'Espacios libres y zonas verdes.'],
]

export function describeLayer(name) {
  if (!name) return ''
  for (const [re, d] of RULES) if (re.test(name)) return d
  return ''
}
