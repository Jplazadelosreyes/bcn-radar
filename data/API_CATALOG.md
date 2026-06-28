# Catálogo de APIs - BCN Radar

Este documento centraliza los contratos de integración para las llamadas a API en vivo desde el frontend.

## 1. Catastro — Características del Inmueble
**Responde a:** Dada una referencia catastral, ¿cuál es el año de construcción, superficie, uso, nº de plantas y nº de viviendas de la finca?

- **Endpoint base + método:** `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC` (GET)
- **Parámetros:** 
  - `Provincia` (opcional, puede ir vacío)
  - `Municipio` (opcional, puede ir vacío)
  - `RC` (Clave dinámica: los 20 dígitos de la referencia catastral)
- **Auth:** Ninguna.
- **CORS:** **SÍ**. Devuelve `Access-Control-Allow-Origin: *`. Se puede llamar directamente desde el navegador (testeado desde origen localhost y orígenes externos).
- **Rate limit conocido:** No hay limitación estricta documentada para consultas on-demand, pero se asume un uso razonable individual por cliente.
- **Nivel territorial del dato:** Parcela / Finca.
- **Request de ejemplo REAL:**
  ```bash
  curl "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=4649603DF3844H0001AU"
  ```
- **Response de ejemplo:**
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <consulta_dnp xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.catastro.meh.es/">
    <control>
      <cudnp>1</cudnp>
      <cucons>2</cucons>
      <cucul>0</cucul>
    </control>
    <bico>
      <bi>
        <!-- idbi omitido -->
        <dt>
          <locs>
            <lous>
              <lourb>
                <dir>
                  <cv>1364</cv>
                  <tv>AV</tv>
                  <nv>DIAGONAL</nv>
                  <pnp>2</pnp>
                  <snp>0</snp>
                </dir>
              </lourb>
            </lous>
          </locs>
        </dt>
        <debi>
          <luso>Residencial</luso>
          <sfc>99</sfc>
          <cpt>0,620000</cpt>
          <ant>1977</ant>
        </debi>
      </bi>
      <lcons>
        <cons>
          <lcd>VIVIENDA</lcd>
          <dfcons>
            <stl>91</stl>
          </dfcons>
        </cons>
        <cons>
          <lcd>ELEMENTOS COMUNES</lcd>
          <dfcons>
            <stl>8</stl>
          </dfcons>
        </cons>
      </lcons>
    </bico>
  </consulta_dnp>
  ```
- **Path de extracción:** (Nota: el fetch devolverá texto XML, es necesario parsearlo con `DOMParser` o similar).
  - *Año construcción:* `consulta_dnp > bico > bi > debi > ant`
  - *Superficie:* `consulta_dnp > bico > bi > debi > sfc`
  - *Uso:* `consulta_dnp > bico > bi > debi > luso`
  - *Nº viviendas/plantas:* Contar o iterar sobre los nodos `<cons>` dentro de `consulta_dnp > bico > lcons`. Por ejemplo, para contar viviendas, buscar `<lcd>VIVIENDA</lcd>`.
- **Frecuencia real de actualización del dato:** Live / Directamente desde la base de datos de Sede Electrónica del Catastro.
- **¿NECESITA PROXY backend?**: **NO**. Soporta HTTPS nativo y CORS habilitado explícitamente con `*`.

---

## Resumen Arquitectura de Red (CORS)
| API | Nivel | Auth | CORS | ¿Necesita Proxy? |
| :--- | :---: | :---: | :---: | :---: |
| **Catastro DNPRC** | Finca | No | Sí | **NO** |

## 2. Open Data BCN (CKAN Datastore API)
**Responde a:** Consultas de indicadores socioeconómicos (Renta, Padrón, Lloguer, HUT, Delitos) a nivel de Barrio o Sección Censal.

El Ayuntamiento de Barcelona expone estos datasets mediante CKAN. Todos comparten el mismo contrato de integración.

- **Endpoint base + método:** `https://opendata-ajuntament.barcelona.cat/data/api/3/action/datastore_search` (GET)
- **Parámetros comunes:** 
  - `resource_id`: ID del archivo CSV cargado en datastore (cada año tiene un ID distinto, por lo que es necesario mapearlos o consultarlos al inicio).
  - `filters`: JSON string para filtrar por la clave territorial.
- **Claves Dinámicas (Filtro territorial):** 
  - Si es por Sección Censal: `&filters={"Codi_Districte": 1, "Seccio_Censal": 1}`
  - Si es por Barrio: `&filters={"Codi_Barri": 1}`
- **Auth:** Ninguna.
- **CORS:** **SÍ**. Devuelve `Access-Control-Allow-Origin: *`.
- **Rate limit conocido:** No estricto, pero la API puede retornar 503 u ocultar respuestas si hay sobrecarga.
- **Nivel territorial del dato:** Sección Censal o Barrio, según el dataset.
- **Request de ejemplo REAL (Renta Bruta por Hogar 2023 - Seccio Censal 1, Districte 1):**
  ```bash
  curl -g 'https://opendata-ajuntament.barcelona.cat/data/api/3/action/datastore_search?resource_id=fd12fd1f-5fe6-4642-9ace-34503c2a9dd5&filters={"Codi_Districte":1,"Seccio_Censal":1}'
  ```
- **Response de ejemplo (Renta):**
  ```json
  {
    "help": "...",
    "success": true,
    "result": {
      "resource_id": "fd12fd1f-5fe6-4642-9ace-34503c2a9dd5",
      "records": [
        {
          "Codi_Districte": "1",
          "Nom_Districte": "Ciutat Vella",
          "Import_Renda_Bruta_€": "42658",
          "Nom_Barri": "el Raval",
          "Seccio_Censal": "1",
          "Codi_Barri": "1",
          "_id": 1,
          "Any": "2023"
        }
      ],
      "total": 1
    }
  }
  ```
- **Path de extracción:** `response.result.records[0]['Import_Renda_Bruta_€']` (o el nombre de la columna relevante según el dataset).
- **Frecuencia real de actualización del dato:** Anual para la mayoría de estos datasets.
- **¿NECESITA PROXY backend?**: **NO**. Soporta CORS.

### Indicadores Open Data a integrar:
A continuación se detalla dónde se sitúa cada dato (algunos a nivel Barrio, otros a Sección Censal):

1. **Renta del hogar**: Dataset "Renda bruta mitjana per llar". Nivel: *Sección Censal*. `resource_id` (2023): `fd12fd1f-5fe6-4642-9ace-34503c2a9dd5`
2. **Lloguer mitjà**: Dataset "Lloguer mitjà mensual de la ciutat de Barcelona". Nivel: *Barrio*. La columna a extraer es `Preu` filtrando por "Lloguer mitjà mensual (Euros/mes)".
3. **Padró (edad, extranjeros, estudios)**: Diferentes datasets como "Població per sexe i edat" o "Població per lloc de naixement". Nivel: *Sección Censal* o *Barrio*.
4. **Fets penals (Delitos)**: "Fets penals coneguts". Nivel: *Barrio*.
5. **Habitatges ús turístic (HUT)**: Dataset de censo HUT. Nivel: *Barrio* / coordenada.

*(Nota técnica: Debido a que cada año cambia el `resource_id`, el frontend de Claude deberá tener los `resource_id` más recientes harcodeados en un diccionario de configuración o consultarlos dinámicamente usando `/api/3/action/package_show?id=slug-del-dataset`)*.


---

## 3. INE (Instituto Nacional de Estadística) - Tempus3 API
**Responde a:** Consultas de indicadores sociodemográficos a nivel nacional y desagregado, como el Atlas de Distribución de Renta de los Hogares (ADRH) y el Censo de Población, consultable por Sección Censal.

- **Endpoint base + método:** `https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{id_tabla}` o `DATOS_SERIE/{id_serie}` (GET)
- **Parámetros:** 
  - Para extraer datos de la sección censal hay que conocer el `id_tabla` correspondiente al municipio (ej. Tablas de Renta) o bien usar operaciones de filtro en la API.
  - La clave dinámica es el código CUSEC (Sección censal, 10 dígitos: Provincia + Municipio + Distrito + Sección).
- **Auth:** Ninguna (datos públicos, aunque hay límites de saturación).
- **CORS:** **SÍ**. Devuelve `Access-Control-Allow-Origin: *`.
- **Rate limit conocido:** No hay rate limit escrito en cabeceras, pero INE puede retornar errores 503 u ofuscar consultas intensivas sin control.
- **Nivel territorial del dato:** Sección Censal (Unidad mínima del INE).
- **Request de ejemplo REAL (Consultar Operaciones):**
  ```bash
  curl "https://servicios.ine.es/wstempus/js/ES/OPERACIONES_DISPONIBLES"
  ```
- **Response de ejemplo:**
  ```json
  [
    {"Id":303, "Cod_IOE":"30325", "Nombre":"Atlas de Distribución de Renta de los Hogares", "Codigo":"ADRH"},
    ...
  ]
  ```
- **Formato y Path de extracción:** JSON Array con objetos que contienen propiedades como `Nombre` y la lista `Data`. El valor numérico se halla en `response[0].Data[0].Valor`.
- **Frecuencia real de actualización del dato:** Anual para Renta, Decenal para Censo (ahora actualizaciones continuas cada cierto tiempo).
- **¿NECESITA PROXY backend?**: **NO**. Soporta CORS y es accesible desde navegador. 

*(Nota de arquitectura: Aunque el INE ofrece la Renta a nivel sección censal con CORS, **se recomienda usar Open Data BCN (Hito 2)** para la app, ya que la API del INE (Tempus3) tiene una jerarquía de series complejas y ofuscadas, requiriendo en muchos casos resolver el ID de la serie previamente con varias llamadas en cascada, mientras que Open Data BCN permite consultar directamente el código de la sección).*

---

## 4. Incasòl / Idescat (Generalitat) - Alquiler real
**Responde a:** Precios de alquiler medios según las fianzas depositadas en Incasòl.

- **Endpoint base:** `https://analisi.transparenciacatalunya.cat/resource/qww9-bvhh.json` (API Socrata)
- **CORS:** **SÍ**. Devuelve `Access-Control-Allow-Origin: *`.
- **Nivel territorial del dato:** **Solo a nivel de Municipio** o Comarca.
- **Conclusión y bloqueo:** Aunque la API funciona y tiene CORS, **NO ES ÚTIL** para BCN Radar. Generalitat agrupa todo Barcelona en un único `codi_territorial: 080193` (Municipi). No se puede bajar a nivel de Barrio o Sección Censal mediante esta API. 
- **Alternativa (Solución validada):** Para obtener el alquiler real registrado por Barrio, se debe usar **Open Data BCN (Hito 2)**. El Ayuntamiento procesa los microdatos de Incasòl y expone un dataset específico ("Lloguer mitjà mensual de la ciutat de Barcelona") a nivel de barrio.

---

## 5. Zonas Tensionadas (Generalitat / Ministerio)
**Responde a:** Saber si una dirección se encuentra en zona de mercado residencial tensionado.

- **Estado:** No requiere API.
- **Conclusión:** La declaración de "Zona de Mercat Residencial Tensionat" (Llei 12/2023) en Cataluña se realiza a nivel de **municipio completo**. Dado que BCN Radar opera exclusivamente dentro del municipio de Barcelona (Codi INE: 08019), **todo el mapa es zona tensionada**. 
- **Recomendación para el frontend:** Es un listado fijo. Para Barcelona ciudad, se puede hardcodear a `true` o simplemente mostrar el *badge* por defecto, sin gastar peticiones HTTP innecesarias.

---

## 6 y 7. Movilidad y Equipamientos (Overpass API / OSM)
**Responde a:** ¿Qué hay cerca de esta propiedad en un radio de X metros? (Transporte, Hospitales, Colegios, Supermercados).

- **Endpoint base + método:** `https://overpass-api.de/api/interpreter` (POST o GET)
- **Parámetros:** Query en formato Overpass QL usando `around:radio,lat,lon` para buscar nodos específicos.
  - Ejemplos de nodos: `node["amenity"="hospital"]`, `node["highway"="bus_stop"]`, `node["amenity"="bicycle_rental"]` (para Bicing), `node["shop"="supermarket"]`.
- **Auth:** Ninguna.
- **CORS:** **SÍ**. Permite acceso desde cualquier origen (diseñado para ser consumido por clientes web como Leaflet u OSM).
- **Rate limit conocido:** Hay un límite de peticiones simultáneas por IP y timeout máximo (generalmente 10.000 peticiones al día y un máximo de memoria), más que suficiente para consultar on-demand.
- **Nivel territorial del dato:** Radio de coordenadas dinámico.
- **Request de ejemplo REAL (Buscar transporte y servicios a 500m):**
  ```overpass
  [out:json];
  (
    node["highway"="bus_stop"](around:500,41.3851,2.1734);
    node["amenity"="bicycle_rental"](around:500,41.3851,2.1734);
    node["amenity"="hospital"](around:500,41.3851,2.1734);
  );
  out body;
  ```
- **Frecuencia real de actualización del dato:** Live (OpenStreetMap se actualiza minuto a minuto y Overpass refleja los cambios casi inmediatamente).
- **¿NECESITA PROXY backend?**: **NO**.
- **Recomendación frente a TMB:** Usar Overpass para buscar paradas de bus / metro y estaciones de Bicing es mucho más ágil que registrarse para obtener API Keys de TMB y cruzar diferentes APIs, ya que OSM centraliza toda la movilidad y equipamientos en una única petición espacial con soporte nativo de radio (`around`).


---

## 8. Hitos Premium: Ruido, Patrimonio, HUT y Eficiencia Energética

### A. Mapa de Ruido (Open Data BCN)
**Responde a:** Nivel de contaminación acústica de la calle (decibelios).
- **Fuente:** Open Data BCN (CKAN Datastore).
- **Dataset:** "Mapa estratègic de soroll de la ciutat de Barcelona".
- **CORS:** SÍ.
- **Implementación:** Similar al Hito 2, se consulta el `datastore_search` filtrando por las coordenadas o el tramo de calle.

### B. Patrimonio y Nivel de Protección (PIU)
**Responde a:** ¿El edificio está protegido históricamente? ¿Se puede reformar la fachada?
- **Fuente:** Geoportal Ajuntament de Barcelona (WMS).
- **CORS:** SÍ (o mediante proxy si el Geoportal falla, aunque Leaflet suele gestionarlo).
- **Implementación:** Al hacer `GetFeatureInfo` en el mapa (Hito Extra), el servidor devuelve también si el edificio forma parte del Catálogo de Patrimonio (Niveles A, B, C, D).

### C. Licencias Turísticas - HUT (Open Data BCN)
**Responde a:** ¿Cuántos Airbnbs / pisos turísticos legales hay en este edificio?
- **Fuente:** Open Data BCN (CKAN Datastore).
- **Dataset:** "Habitatges d'ús turístic (HUT) de la ciutat de Barcelona".
- **Implementación:** Se consulta `datastore_search` buscando por la dirección exacta o coordenadas. Es un indicador clave para evaluar el ruido interno del edificio.

### D. Certificado de Eficiencia Energética (Generalitat)
**Responde a:** Consumo energético del inmueble (Etiqueta A-G).
- **Fuente:** Generalitat de Catalunya (Socrata API `analisi.transparenciacatalunya.cat`).
- **Dataset:** "Registre de certificats d'eficiència energètica d'edificis".
- **CORS:** SÍ.
- **Implementación:** Se hace una query GET (`?$where=adreca like '%CALLE%'`) pasando la dirección. Devuelve la etiqueta (A, B, C, D, E, F, G).

