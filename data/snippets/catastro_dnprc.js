/**
 * Helper para extraer datos de la Sede Electrónica del Catastro (Consulta_DNPRC)
 * No necesita proxy, se puede ejecutar en vivo desde el navegador.
 */

export async function fetchCatastroPropertyDetails(referenciaCatastral) {
  // Aseguramos de que tengamos 20 caracteres
  if (!referenciaCatastral || referenciaCatastral.length !== 20) {
    throw new Error('La referencia catastral debe tener 20 caracteres');
  }

  const url = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=${referenciaCatastral}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    // Verificar si hay error en la respuesta del catastro
    const lerr = xmlDoc.getElementsByTagName('lerr')[0];
    if (lerr) {
      const errDes = xmlDoc.getElementsByTagName('des')[0]?.textContent;
      throw new Error(`Catastro Error: ${errDes}`);
    }

    // Extracción de campos
    const debi = xmlDoc.getElementsByTagName('debi')[0];
    const sfc = debi?.getElementsByTagName('sfc')[0]?.textContent || null;
    const luso = debi?.getElementsByTagName('luso')[0]?.textContent || null;
    const ant = debi?.getElementsByTagName('ant')[0]?.textContent || null;

    // Contar viviendas y total de elementos constructivos
    const lcons = xmlDoc.getElementsByTagName('lcons')[0];
    const consList = lcons ? lcons.getElementsByTagName('cons') : [];
    
    let totalViviendas = 0;
    
    for (let i = 0; i < consList.length; i++) {
      const lcd = consList[i].getElementsByTagName('lcd')[0]?.textContent;
      if (lcd === 'VIVIENDA') {
        totalViviendas++;
      }
    }

    return {
      superficie: sfc ? parseInt(sfc, 10) : null,
      uso: luso,
      anoConstruccion: ant ? parseInt(ant, 10) : null,
      viviendas: totalViviendas,
      rawXml: xmlText // opcional por si se necesita extraer más tarde
    };

  } catch (error) {
    console.error("Error fetching Catastro data:", error);
    return null;
  }
}
