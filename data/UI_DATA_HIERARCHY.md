# Arquitectura de Datos por Nivel de Zoom (Panel Izquierdo)

Este documento define la estructura de información pura (Data Architecture) que debe inyectarse en el panel izquierdo de la aplicación, dependiendo del nivel de zoom territorial.

---

## Nivel 1: Ciudad (Barcelona)
*Vista general inicial de toda la ciudad.*

* **Status Legal:** 
  * Indicador de "Zona Tensionada" (Valor estático: Sí).
  * Enlace/Tip sobre el Índice de Precios de Referencia (Ley de Vivienda).
* **Macro-Métricas:** 
  * Tip sobre Aval ICO 20% aplicable a toda la ciudad para compra de primera vivienda.

---

## Nivel 2: Distrito
*Zoom en un distrito (ej. Gràcia o Eixample).*

* **Identificación:** Nombre del Distrito.
* **Métricas Agregadas:**
  * Rango de Precios Agregados (media del distrito vs media ciudad).
  * Densidad de Delitos (Macro) basándose en incidentes de la Guardia Urbana.

---

## Nivel 3: Barrio (El motor de la decisión)
*Zoom a nivel de uno de los 73 barrios.*

* **Identificación:** Nombre del Barrio.
* **Economía Inmobiliaria (Open Data BCN):**
  * *Lloguer Mitjà:* Alquiler medio mensual (€) y por metro cuadrado (€/m²).
  * *Compraventa:* Precio medio de venta (€/m²).
  * *Rentabilidad Estimada:* % Yield Bruto (Alquiler Anualizado / Precio de Compra).
* **Entorno y Seguridad:**
  * Criminalidad barrial (Incidentes Guardia Urbana).
  * Tipología predominante del Mapa de Ruido (Contaminación acústica media).
* **Servicios (Overpass API):**
  * Resumen de cercanía a Transporte (Metro, Bus, Bicing).
  * Servicios esenciales (Colegios, Hospitales).

---

## Nivel 4: Sección Censal (Micro-entorno)
*Zoom sobre un conjunto de manzanas/calles.*

* **Poder Adquisitivo (INE):**
  * Renta Neta Media por Persona y por Hogar.
* **Demografía (Padrón Open Data):**
  * Densidad poblacional del micro-sector.
* **Presión Turística:**
  * Densidad de Habitatges d'Ús Turístic (HUT) en estas manzanas.

---

## Nivel 5: Finca / Parcela (El activo inmobiliario)
*El usuario hace clic sobre un polígono de un edificio.*

* **Datos Identificativos (Catastro):**
  * Referencia Catastral.
  * Año de Construcción.
  * Superficie Gráfica (m²) y Uso Principal.
* **Estado Técnico (Generalitat):**
  * *Certificado Energético:* Etiqueta (A-G). Alerta de Subvenciones Next Generation si es E, F, G.
  * *Estado ITE:* (Inspección Técnica de Edificios).
* **Licencias del Inmueble (Open Data BCN):**
  * Pisos Turísticos (HUT) activos en esa dirección.
* **Planeamiento (PIU / Geoportal):**
  * *Clave Urbanística PGM:* Traducida a humano (Ej: "13b - Densificación urbana", "5 - Riesgo Vial").
  * *Patrimonio:* Nivel de protección.
  * **Acción:** Botón que abre la Ficha Oficial del PIU (`.../fitxa/{RC14}/--/--/pa/`).
* **Asesoría (Business Logic):**
  * *Calculadora Fiscal:* Estimación de ITP en base al precio que pida el vendedor.
  * *Checklist de Supervivencia:* Panel de alertas (Nota Simple, Endesa, Modelo 600, Deudas de Comunidad).
