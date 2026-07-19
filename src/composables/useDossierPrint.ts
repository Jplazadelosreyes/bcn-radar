// ═══════════════════════════════════════════════════════════════════════════════
//  useDossierPrint — estado del dossier PDF (singleton). La vista de impresión se
//  monta a nivel App, NO dentro de la ficha: InfoDossier cambia de ficha por nivel
//  de zoom y desmontaría el dossier a mitad de generación si viviera allí.
// ═══════════════════════════════════════════════════════════════════════════════
import { ref } from 'vue'

const imprimiendo = ref(false)

export function useDossierPrint() {
  return { imprimiendo }
}
