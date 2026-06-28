# Lógica de Negocio y Reglas Estáticas (BCN Radar)

Este documento centraliza la inteligencia de negocio (Business Logic) que Claude debe implementar en el frontend para enriquecer los datos crudos extraídos de las APIs públicas. No requiere nuevas APIs, sino cálculos, reglas estáticas y construcción inteligente de enlaces.

## 1. Traductor del PGM (Planeamiento Urbanístico)
Puesto que interpretar un mapa urbanístico es complejo, la UI debe ayudar al usuario dándole contexto cuando abra la Ficha Urbanística Oficial (PIU).

- **Generador de Enlace Directo (PIU):** 
  ```javascript
  const piuUrl = `https://ajuntament.barcelona.cat/informaciourbanistica/cerca/es/fitxa/${refCatastral14}/--/--/pa/`;
  ```
- **Diccionario de Ayuda al Inversor (Mostrar como *tooltip* o cuadro de ayuda):**
  - **Claves 12, 13, 14, 15, 16, 17, 18:** Zonas habitables/residenciales o de actividad económica consolidadas. Zonas seguras para inversión inmobiliaria estándar.
  - **Clave 5 (Sistema Viario):** 🚨 PELIGRO. La finca puede estar afectada total o parcialmente para ampliación de calles. Riesgo de expropiación.
  - **Clave 7 (Equipamientos):** 🚨 PELIGRO. Finca reservada para futuros colegios, hospitales o servicios municipales. 
  - **Clave 22@:** Zona tecnológica. Precaución al comprar pisos aquí, muchos son lofts sin "cédula de habitabilidad" oficial (solo uso terciario).

## 2. Fiscalidad Automatizada (Calculadora de Costes)
BCN Radar debe incluir un panel de "Costes Estimados de Compra" para asistir en los rangos de precio.

- **ITP (Impuesto de Transmisiones Patrimoniales - Cataluña):**
  - Regla General: **10%** sobre el valor de compra (o sobre el Valor de Referencia, el que sea mayor).
  - Tramo Alto: **11%** para inmuebles de más de 1.000.000 €.
  - Bonificación Joven/Social: **5%** (Menores de 32 años con renta < 30.000€, Familias Numerosas, etc).
  - *Sugerencia UI:* Mostrar un recuadro interactivo donde el usuario escriba el precio que le piden, y automáticamente ver los gastos (ITP 10% + ~1.500€ de Notaría y Registro).

- **IBI (Impuesto sobre Bienes Inmuebles):**
  - En Barcelona capital, el IBI residencial ronda el **0,66%** del Valor Catastral. Se puede añadir una nota orientativa.

## 3. Subvenciones de Rehabilitación (Next Generation)
Si la finca tiene una certificación energética baja, en lugar de verlo solo como un problema, presentarlo como una oportunidad.

- **Lógica:** Si la Etiqueta Energética (API de la Generalitat) es **E, F o G**, renderizar un *badge* verde:
  - *"Oportunidad: Inmueble elegible para subvenciones de rehabilitación energética (Next Generation EU / Consorci de l'Habitatge). Ayudas de hasta el 80% del coste en ventanas y aislamiento."*

## 4. Rentabilidad Bruta Estimada (% Yield)
Ya que usamos el Open Data para extraer el **Lloguer Mitjà** (Alquiler) y el **Mercat de Compravenda** (Precio de Venta) del barrio, Claude puede cruzar ambos valores.

- **Fórmula:** `(Alquiler Medio Mensual del Barrio * 12) / Precio Medio de Venta del Barrio = % Rentabilidad Bruta.`
- Mostrar este porcentaje da un valor instantáneo para identificar si el barrio es mejor para comprar para vivir, o comprar para alquilar (Buy-to-Let).

## 5. Checklist del Comprador (Lo que la App NO te da, pero debes exigir)
Un buen producto inmobiliario no solo muestra los datos públicos, sino que alerta sobre los trámites cerrados o burocráticos. Claude debe incluir una sección (ej. un modal de "Checklist Legal" o "Para que no te engañen") con estos avisos en un lenguaje muy sencillo:

- **La Nota Simple (Registro de la Propiedad):** 
  - *Aviso:* "El Catastro dice cómo es el piso, pero NO quién es el dueño real ni sus deudas. Antes de pagar ninguna reserva (Arras), pide una Nota Simple en *registradores.org* (cuesta ~9€). Así confirmarás si el piso tiene embargos o hipotecas."
- **Valor de Referencia de Hacienda:** 
  - *Aviso:* "Hacienda tiene un valor mínimo asignado a este piso. Debes entrar a la Sede del Catastro con tu Certificado Digital. Si compras el piso por menos de ese valor, pagarás los impuestos (ITP) sobre el valor de Hacienda, no sobre lo que te costó."
- **Blanqueo de Capitales:** 
  - *Aviso:* "Ley estricta: El banco y el Notario te pedirán el rastro de todo tu dinero. Prepara nóminas, la renta (IRPF) y extractos para justificar de dónde salieron tus ahorros, o la operación se paralizará."
- **El Modelo 600 (ITP) y Plazos:** 
  - *Aviso:* "Tras ir al notario, tienes 30 días para rellenar el Modelo 600 y pagar el Impuesto de Transmisiones (ITP) a la Generalitat. Si lo necesitas, la Agencia Tributària de Catalunya permite solicitar el fraccionamiento del pago."
- **Deudas Ocultas (Comunidad e IBI):** 
  - *Aviso:* "Exige al vendedor un certificado firmado por el administrador de fincas conforme está al corriente de pago de la comunidad, y los últimos recibos del IBI. Si compras con deudas, ¡te las quedas tú!"

## 6. La Odisea de los Suministros (Agua y Luz)
Muchos compradores se enfrentan a una auténtica pesadilla tras la firma en notaría al intentar poner los suministros a su nombre. Claude debe añadir una alerta vital sobre las altas de servicios (especialmente Endesa/e-distribución y Aigües de Barcelona):

- **Luz (e-distribución / Endesa) y el CUPS:** 
  - *El consejo de oro:* ¡Exige al vendedor la última factura! Si haces un "cambio de titular" (subrogación) el trámite es rápido y gratuito. 
  - *La pesadilla:* Si el vendedor "da de baja" la luz, o compras un piso de banco, la distribuidora (e-distribución) te tratará como un "Alta nueva". Si la instalación tiene más de 20 años, te exigirán contratar a un electricista para hacer un **Boletín Eléctrico nuevo (CIE)**. Esto cuesta dinero y puede dejarte semanas sin luz.
- **Agua (Aigües de Barcelona) y la Cédula:** 
  - *El trámite trampa:* Para cambiar el titular del agua, Aigües de Barcelona es extremadamente estricta: te pedirán la **Cédula de Habitabilidad** en vigor. Exige siempre al vendedor que te entregue la Cédula original; si está caducada, tendrás que pagar a un arquitecto para tramitar una nueva antes de poder ducharte.

## 7. Ley de Vivienda y Arrendamientos Urbanos (El Marco Legal Actual)
Con la reciente Ley de Vivienda (2023) y la Ley de Arrendamientos Urbanos (LAU), el panorama legal ha cambiado drásticamente. BCN Radar debe integrar avisos que orienten al inversor/inquilino sobre las reglas de juego actuales:

- **Límite de Alquileres (Índice de Precios de Referencia):**
  - *El Contexto:* Ya hemos establecido que todo Barcelona es "Zona Tensionada". Esto significa que por ley, si compras un piso para alquilarlo, el alquiler está topado por el "Sistema Estatal de Referencia de Precios de Alquiler de Vivienda" (Ministerio de Vivienda).
  - *El Tip de la App:* Añadir un enlace directo al Ministerio para calcular el alquiler máximo permitido: `https://serpavi.mivau.gob.es/`
- **El pago a la Agencia Inmobiliaria (LAU):**
  - *El Aviso:* "Si vas a alquilar este piso, recuerda que por la nueva Ley de Vivienda, los honorarios de la agencia inmobiliaria (el famoso mes de agencia) los debe pagar **por ley el propietario**, no el inquilino. ¡No dejes que te lo cobren!"
- **El Aval ICO 20% (Compra de primera vivienda):**
  - *La Oportunidad:* "Si tienes menos de 35 años o menores a cargo, el Estado (Ministerio de Vivienda) a través del Instituto de Crédito Oficial (ICO) puede avalar el 20% de tu hipoteca. Esto significa que los bancos te pueden conceder una hipoteca del 100% en lugar del 80% habitual. Consúltalo con tu banco."
- **Contratos de Temporada (El Vacío Legal):**
  - *El Aviso:* "Muchos inversores en Barcelona intentan esquivar el límite de precios haciendo alquileres de 'Temporada' (de 1 a 11 meses). Ojo: la ley es estricta, un alquiler de temporada exige justificar la temporalidad real (estudios, obra, trabajo temporal). Si la necesidad es permanente, se considera fraude de ley."
