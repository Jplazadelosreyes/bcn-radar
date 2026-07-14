import { createApp } from 'vue'
// El CSS de MapLibre va PRIMERO: nuestros estilos reposicionan sus controles con la misma
// especificidad, así que deben cargarse después para poder ganarle. (Cuando lo importaba
// MapCanvas, se inyectaba al final y pisaba nuestras reglas.)
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/index.css'
import App from './App.vue'

createApp(App).mount('#app')
