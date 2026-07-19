# Estado de las APIs públicas · BCN Radar

> Generado por `npm run test:apis` — **2026-07-19 01:56 UTC** · **28/29** integraciones respondiendo.
>
> La app no tiene backend: todo lo de esta tabla se consulta en vivo desde el navegador.
> Si una fila está en ❌, ese bloque de la app lo dirá en pantalla en vez de inventar el dato.

| | Fuente | Comprobación | Qué alimenta | HTTP | Latencia | Nota |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | Catastro | Consulta_RCCOOR (coords → referencia) | Primer paso del clic en finca: coordenadas → RC de 14 | 200 | 312 ms | RC 0032917… |
| ✅ | Catastro | Consulta_DNPRC (referencia → datos) | Año, superficie, uso y nº de inmuebles del dossier | 200 | 7333 ms | edificio con 172 inmuebles |
| ✅ | Catastro | WMS parcelario (GetMap) | Capa "Catastro" del selector de mapas base | 200 | 526 ms | image/png |
| ✅ | Nominatim | search (dirección → coords) | El buscador de direcciones y su autocompletado | 200 | 347 ms | El Cafè de la Pedrera, 92 |
| ✅ | Nominatim | reverse (coords → dirección) | La dirección postal que encabeza el dossier de finca | 200 | 354 ms | Carrer de Provença 261-265 |
| ✅ | Overpass | mirror overpass-api.de | Mirror principal de la petición hedged | 200 | 654 ms | 1 elementos |
| ❌ | Overpass | mirror overpass.kumi.systems | Mirror 2 (históricamente el que se cuelga) | — | 15002 ms | sin respuesta en 15s |
| ✅ | Overpass | mirror maps.mail.ru | Mirror 3 de respaldo | 200 | 801 ms | 1 elementos |
| ✅ | PIU · Ajuntament | WMS GetCapabilities | Descubrimiento de capas urbanísticas en useLayers | 200 | 402 ms | 80 nodos <Layer> |
| ✅ | PIU · Ajuntament | GetFeatureInfo (Qualificació urbanística) | La situación urbanística del dossier: clave, clasificación, afectaciones | 200 | 262 ms | con features |
| ✅ | MUC · Generalitat | WMS GetCapabilities | Descubrimiento de capas del Mapa Urbanístic de Catalunya | 200 | 176 ms | 37 nodos <Layer> |
| ✅ | MUC · Generalitat | WMS GetMap (capa MUC) | Render de la capa de planeamiento de Cataluña | 200 | 482 ms | image/png |
| ✅ | ACA | WMS GetCapabilities | Descubrimiento de capas de inundabilidad | 200 | 96 ms | 49 nodos <Layer> |
| ✅ | ACA | WMS GetMap (Zones inundables T100) | La capa de riesgo de inundación de referencia legal | 200 | 68 ms | image/png |
| ✅ | Socrata | Incasòl · alquiler (qww9-bvhh) | Alquiler medio real por fianzas (bloque Valor) | 200 | 318 ms | 1087 €/mes (2025) |
| ✅ | Socrata | Meteocat · estaciones XEMA (yqwd-vj5e) | Ubicación de las estaciones de la capa de temperatura | 200 | 307 ms | estación VC (Pantà de Riba-roja) |
| ✅ | Socrata | Meteocat · lecturas (nzvn-apee) | Temperatura en vivo (variable 32) | 200 | 142 ms | 16.6 °C · 2026-07-19T01:00:00.000 |
| ✅ | Bicing · GBFS | station_information | Nombre y capacidad de cada estación | 200 | 168 ms | 536 estaciones |
| ✅ | Bicing · GBFS | station_status | Bicis y anclajes libres en vivo (refresco 60 s) | 200 | 112 ms | 536 estaciones |
| ✅ | bcn-geodata | districtes.geojson | Capa de distritos y sus fichas | 200 | 403 ms | 10 features |
| ✅ | bcn-geodata | barris.geojson | Capa de barrios y sus fichas | 200 | 130 ms | 73 features |
| ✅ | bcn-geodata | seccio-censal.geojson | Secciones censales + coropleta de renta | 200 | 494 ms | 1068 features |
| ✅ | bcn-geodata | terme-municipal.geojson | El contorno del municipio (máscara y zoom inicial) | 200 | 290 ms | 1 features |
| ✅ | Basemaps | OpenFreeMap · estilo Liberty | El estilo vectorial del mapa (el que retiñe map-theme.js) | 200 | 83 ms | 111 capas de estilo |
| ✅ | Basemaps | ICGC · ortofoto (WMS GetMap) | Mapa base "Orto ICGC" | 200 | 159 ms | image/png |
| ✅ | Basemaps | ArcGIS · World Imagery (tesela) | Mapa base "Satélite" | 200 | 91 ms | image/jpeg |
| ✅ | Basemaps | ArcGIS · export (miniatura de finca) | La foto aérea 160×160 que abre el dossier | 200 | 341 ms | image/jpeg |
| ✅ | Basemaps | OpenTopoMap (tesela) | Mapa base "Topo" | 200 | 257 ms | image/png |
| ✅ | Basemaps | Terrarium DEM (tesela de elevación) | El relieve real del modo 3D | 200 | 583 ms | image/png |

**Cómo leerlo:** cada fila es una petición real mínima (un punto del Eixample, una RC
validada, una tesela) con el mismo contrato que usa el código de `src/services/`. La
latencia es de la máquina que ejecutó la suite. Para regenerar: `npm run test:apis`.
