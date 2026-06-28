import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URLs Oficiales de Open Data BCN (Catálogo)
// Se proveerán estos enlaces directos en la UI para transparencia total
const FUENTES = {
  alquiler: {
    nombre: "Precios de alquiler (INCASOL)",
    url_fuente: "https://opendata-ajuntament.barcelona.cat/data/es/dataset/est-mercat-immobiliari-lloguer-mitja-mensual",
    url_csv: "URL_RAW_PENDIENTE" // Lo inyectaremos cuando descarguemos el CSV real
  },
  delitos: {
    nombre: "Incidentes Penales",
    url_fuente: "https://opendata-ajuntament.barcelona.cat/data/es/dataset/fets-penals-coneguts",
    url_csv: "URL_RAW_PENDIENTE"
  }
};

async function consolidarDatos() {
  console.log("🚀 Iniciando la Gran Cosecha de Datos de BCN...");
  
  // Aquí es donde haremos el 'fetch' a los CSVs oficiales del gobierno
  // Por ahora, estructuramos el JSON final que consumirá nuestra app Vue
  
  const datosConsolidados = {
    metadata: {
      ultima_actualizacion: new Date().toISOString(),
      fuentes: FUENTES,
      nota: "Los datos de alquiler reflejan fianzas reales depositadas en INCASOL, no precios especulativos de portales."
    },
    barrios: {
      // Estructura de ejemplo para Torre Baró
      "Torre Baró": {
        precio_medio_alquiler: 650,
        delitos_anuales: 120,
        renta_media: 18000
      },
      "el Raval": {
        precio_medio_alquiler: 950,
        delitos_anuales: 4500,
        renta_media: 14000
      }
      // ... se llenará con los 73 barrios
    }
  };

  // Guardamos el resultado en un JSON estático para que Vue lo consuma súper rápido
  const outputPath = path.join(__dirname, '../public/bcn_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(datosConsolidados, null, 2));
  
  console.log(`✅ Datos consolidados con éxito en: ${outputPath}`);
}

consolidarDatos();
