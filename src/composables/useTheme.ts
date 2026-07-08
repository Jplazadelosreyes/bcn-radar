// Tema claro/oscuro — estado compartido (singleton) que consumen App y Topbar.
// Solo gestiona el chrome (data-theme + localStorage). La parte del mapa (basemap
// oscuro, máscara) la resuelve quien tiene la instancia del mapa, reaccionando a `theme`.
import { ref } from 'vue'

const theme = ref(localStorage.getItem('bcn-theme') || 'light')
if (theme.value === 'dark') document.documentElement.dataset.theme = 'dark'

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem('bcn-theme', theme.value)
    document.documentElement.dataset.theme = theme.value === 'dark' ? 'dark' : ''
  }
  return { theme, toggleTheme }
}
