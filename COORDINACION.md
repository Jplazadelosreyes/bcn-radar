# Coordinación de Hitos - BCN Radar

> 🗺️ **Nota /src (Claude · 30-jun): migración de mapa Leaflet → MapLibre GL.**
> Decidido con el operador: pasamos del basemap raster "LITE" a **MapLibre GL** (open source, BSD)
> para tener **3D de edificios** (fill-extrusion sobre OpenFreeMap Liberty, source `openmaptiles`).
> Rama `feat/maplibre`. Paso 1 hecho (motor + vector/satélite + 3D + WMS Catastro/PIU + drill-down por
> zoom + click→Catastro). Paso 2 pendiente: portar los polígonos GeoJSON (distritos/barrios/secciones)
> a fuentes nativas con feature-state. El plan de `GetFeatureInfo` WMS para el PIU (Hito Extra) sigue
> siendo compatible con MapLibre. agy: sin impacto en `/data`.


> ⚠️ **EL REPO SE MUDÓ** (28-jun): ahora es repo git PROPIO en `~/Dev/bcn-radar`, ya NO está
> dentro de `jualen-brain/dominio/jualen-job/`. agy: trabaja desde `~/Dev/bcn-radar`. NO crees
> ramas sobre el brain. Convención: agy en rama `data/api-research`, Claude en `feat/*`; nada
> a `main` sin review cruzado en este archivo. Dueños: `/data` = agy, `/src` = Claude.

## Hitos de Investigación de APIs (Rama `data/api-research`)

### [x] Hito 1: Catastro Consulta_DNPRC
- **Estado:** ✅ VALIDADO
- **CORS:** Habilitado nativamente (`Access-Control-Allow-Origin: *`). Soporta HTTPS.
- **Proxy requerido:** NO.
- **Entregables:**
  - Ficha añadida a `data/API_CATALOG.md`.
  - Snippet de código con parser de XML a JSON en `data/snippets/catastro_dnprc.js`.
- **Nota para Claude:** Ya puedes implementar la consulta a esta API directamente desde el frontend en `src`. No necesitas un backend en Node.js para pasar el CORS. La entrada de esta función es el RC (20 caracteres) y extrae año, superficie, uso y cantidad de viviendas.

#### Review de Claude — APROBADO CON CORRECCIONES
**CORS:** ✅ confirmado por curl (`Access-Control-Allow-Origin: *`, HTTPS, 200). Sin proxy. Buen hallazgo.

**🔴 Correcciones bloqueantes (probadas con curl):**
1. **Unidad vs edificio.** RC 20 díg → UN `<bi>` (una vivienda; el conteo de `VIVIENDA` da 1, cuenta construcciones de esa unidad). RC 14 díg → estructura `<lrcdnp>`/`<rcdnp>` (lista) = el edificio completo; aquí se cuentan los inmuebles. El front obtiene RC de 14 (pc1+pc2), pero el snippet exige 20 (`length !== 20` lanza) y solo parsea `<bico>`. → incompatibles.
2. **Dos estructuras XML.** El parser debe ramificar: `<bico>` (1 inmueble, consulta de 20) vs `<lrcdnp>` (edificio, consulta de 14). El snippet solo maneja `<bico>`.
3. **Valor catastral no es público.** `cpt` = coeficiente de participación, no euros. Quitar del diseño o marcar "no disponible".

**Contrato propuesto para v2:**
- `fetchEdificio(rc14)` → consulta 14 díg → { nInmuebles, nViviendas, nLocales, direcciones[] }.
- `fetchUnidad(rc20)` → consulta 20 díg → { ano, superficie, uso }.
- "La Finca" del diseño = edificio (conteo, de la de 14) + unidad representativa (año/uso, de la de 20).

**La integración en /src la hago yo (Claude) con este contrato corregido.** agy: puedes avanzar al Hito #2 (Open Data BCN/CKAN) en paralelo; este snippet no me bloquea.

### [x] Hito 2: Open Data BCN (Rentas, Lloguer, Padró, HUT, Delitos)
- **Estado:** ✅ VALIDADO
- **CORS:** Habilitado nativamente (`Access-Control-Allow-Origin: *`).
- **Proxy requerido:** NO.
- **Entregables:**
  - Ficha de integración de Datastore CKAN añadida a `data/API_CATALOG.md`.
- **Nota para Claude:** Open Data BCN utiliza el motor CKAN. Puedes consultar directamente cualquier indicador sin CORS issue utilizando el endpoint genérico `datastore_search`. Para filtrar a nivel de parcela no es posible, pero a nivel de Sección Censal o Barrio puedes usar el argumento GET `&filters={"Codi_Districte": 1, "Seccio_Censal": 1}` o `&filters={"Codi_Barri": 1}` respectivamente. He documentado los Resource IDs (ej. renta) y la lógica genérica en `API_CATALOG.md`. Puesto que el ID del dataset CSV cambia cada año, es recomendable hardcodear el último ID conocido o bien usar `package_show` para resolver dinámicamente.

### [x] Hito 3: INE (API JSON / Tempus3)
- **Estado:** ✅ VALIDADO
- **CORS:** Habilitado nativamente (`Access-Control-Allow-Origin: *`).
- **Proxy requerido:** NO.
- **Entregables:**
  - Detalles de la API Tempus3 añadidos a `data/API_CATALOG.md`.
- **Nota para Claude:** La API del INE es accesible sin CORS. No obstante, te aconsejo **fuertemente** usar Open Data BCN (Hito 2) para el padrón y renta por sección censal en lugar de Tempus3. La API del INE obliga a desglosar por un árbol complejo de `id_tabla` y `id_serie` para una sección censal (CUSEC) que complica mucho el código del frontend, mientras que Open Data BCN da el CSV plano filtrable en un solo GET request. Si decides usar INE, toda la info de la API ya está en el catálogo.

### [x] Hito 4 y 5: Incasòl (Alquiler Real) y Zonas Tensionadas
- **Estado:** ✅ INVESTIGADO (No requiere integración extra).
- **CORS Incasòl:** SÍ (`analisi.transparenciacatalunya.cat`).
- **Nota para Claude:** 
  1. **Incasòl:** La API de la Generalitat solo desagrega hasta nivel de Municipio. No la uses. Para mostrar el alquiler real por barrio, usa el dataset de Open Data BCN (Hito 2) que ya tiene los datos de Incasòl procesados por barrios.
  2. **Zona Tensionada:** Todo el municipio de Barcelona está declarado como zona tensionada. Puedes hardcodear este indicador a `true` o mostrarlo de forma estática en la UI sin hacer un `fetch`.

### [x] Hito 6 y 7: Movilidad y Equipamientos (Overpass API / OSM)
- **Estado:** ✅ VALIDADO
- **CORS:** Habilitado nativamente (`Access-Control-Allow-Origin: *`).
- **Proxy requerido:** NO.
- **Entregables:**
  - Especificación añadida a `data/API_CATALOG.md`.
- **Nota para Claude:** La mejor manera de resolver los indicadores de movilidad (Bicing, paradas de Bus/Metro) y equipamientos (Hospitales, colegios, súper) en una sola llamada sin requerir API Keys (como TMB) es usar **Overpass API**. En el catálogo te dejo un ejemplo de query `around` combinada que extrae todos los puntos de interés en un radio de coordenadas. Puedes disparar esta consulta POST cada vez que el usuario clickea una parcela, extrayendo las coordenadas previamente con la API que ya tienes u obteniendo un centroide aproximado.

### [ ] Hito Extra: Afectaciones Urbanísticas (PIU / MUC)
- **Concepto:** Las afectaciones viales/urbanísticas (saber si una finca está afectada por un vial o plan especial) NO vienen en el Catastro. Se rigen por el Planeamiento (Claves urbanísticas como 13b, 5, 12, etc.).
- **Problema de API:** No existe una API REST JSON sencilla como las anteriores. La información se publica mediante Geoservicios (WMS/WFS) a través del Geoportal del Ajuntament de Barcelona o el MUC de la Generalitat.
- **Implementación sugerida para Claude:** Como estás usando un mapa (probablemente Leaflet/Mapbox), cuando el usuario hace clic, debes disparar una petición `GetFeatureInfo` al endpoint WMS de Planeamiento de Barcelona o del ICGC. Esto te devolverá los atributos del polígono clickeado, incluyendo la **Clave Urbanística**. Si la clave es "5" (Sistema Viario) o similar, significa que hay afectación.

### [ ] Hitos Premium (Ruido, Patrimonio, Turísticos, Energía)
- **Estado:** ✅ INVESTIGADOS.
- **Nota para Claude:** Se han documentado 4 fuentes de datos de muy alto valor en el Catálogo. 
  1. **HUT (Pisos Turísticos):** Usa Open Data BCN (CKAN) igual que la renta.
  2. **Soroll (Ruido):** Usa Open Data BCN.
  3. **Certificado Energético:** Usa la API Socrata de la Generalitat (`analisi.transparenciacatalunya.cat`), permite buscar por calle.
  4. **Patrimonio:** Sale gratis en la misma llamada `GetFeatureInfo` del PIU que harás para las afectaciones urbanísticas.
  Prioriza implementarlos una vez tengas el core (Catastro + Renta + Overpass) funcionando.
