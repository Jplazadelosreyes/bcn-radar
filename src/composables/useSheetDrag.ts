// ═══════════════════════════════════════════════════════════════════════════════
//  useSheetDrag — arrastre real del asa de los bottom sheets (móvil), compartido por
//  el sidebar y el panel de controles. Snap de 3 estados: compacto ⇄ expandido
//  (arrastrar arriba) ⇄ cerrado (arrastrar abajo). Estado singleton.
//
//  onCollapseAll: callback para colapsar todas las cards al bajar desde expandido
//  (lo pasa el sidebar; los controles no lo necesitan).
// ═══════════════════════════════════════════════════════════════════════════════
import { ref } from 'vue'

const sheetFull = ref(false)
let touchY: number | null = null
let el: HTMLElement | null = null

export function useSheetDrag(onCollapseAll?: () => void) {
  function start(e: TouchEvent) {
    touchY = e.touches[0].clientY
    el = (e.currentTarget as HTMLElement).closest('.sidebar, .map-floating-controls')
    if (el) el.style.transition = 'none' // el sheet sigue al dedo sin lag
  }
  function move(e: TouchEvent) {
    if (touchY == null || !el) return
    const dy = e.touches[0].clientY - touchY
    el.style.transform = `translateY(${Math.max(dy, -70)}px)` // hacia arriba, con resistencia
  }
  function end(e: TouchEvent, close: () => void, expandable = false) {
    if (touchY == null) return
    const dy = e.changedTouches[0].clientY - touchY
    touchY = null
    if (el) { el.style.transition = ''; el.style.transform = ''; el = null }
    if (dy < -40 && expandable) { sheetFull.value = true; return }
    if (dy > 40) {
      if (expandable && sheetFull.value) { sheetFull.value = false; onCollapseAll?.() } // bajar de expandido: colapsa todo
      else close()
    }
  }
  return { sheetFull, start, move, end }
}
