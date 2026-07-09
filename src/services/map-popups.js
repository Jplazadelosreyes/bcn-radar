// Plantillas de los popups del mapa (HTML de MapLibre). MapLibre renderiza sus popups FUERA
// del árbol de Vue, así que no pueden ser componentes .vue: se generan como string HTML. Este
// módulo los centraliza para que el look de TODOS los popups se edite en un solo sitio; cada
// dominio (finca, paradas, zonas…) solo llama a la función que necesita.
//
// Nota: el popup de las capas de datos abiertos vive en su catálogo (config/capas-datos.js),
// junto a la definición de cada capa — ahí es donde corresponde editarlo.

// Finca seleccionada (marcador): título fijo + cuerpo (dirección legible o coordenadas).
export const fincaPopup = (body) => `<b>🏢 Finca Seleccionada</b><br>${body}`

// Dirección encontrada por el buscador de la topbar.
export const direccionPopup = (nombre) => `<b>🏠 Dirección encontrada:</b><br>${nombre}`

// Parada de transporte: nombre + modo + líneas que pasan. `s` = { name, modo, lines }.
export const stopPopup = (s) =>
  `<b>${s.name}</b><br><span style="color:#5B616B">${s.modo}${s.lines ? ' · ' + s.lines : ''}</span>`

// Título simple en negrita — zonas administrativas y paradas de un recorrido (solo el nombre).
export const titlePopup = (name) => `<b>${name}</b>`

// Sección censal con su renta media (coropleta de renta). `p` = props de la feature.
export const rentaPopup = (p) =>
  `<b>${p.NOM || 'Sección'} · ${p.DISTRICTE}-${p.SEC_CENS}</b><br><span style="color:#5B616B">Renta media: ${(+p.renta).toLocaleString('es-ES')} €/año</span>`
