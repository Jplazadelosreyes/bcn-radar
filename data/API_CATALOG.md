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
