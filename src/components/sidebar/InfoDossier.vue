<script setup lang="ts">
// Dossier contextual (Información): conmuta la ficha según el nivel de zoom
// ciudad → distrito → barrio → sección → finca. Cada nivel es su propio componente en
// ./ficha/ y consume los stores singleton que necesita; aquí solo elegimos cuál montar
// y calculamos la etiqueta contextual de la cabecera (infoCtx).
import { computed } from 'vue'
import SectionCard from './SectionCard.vue'
import { useMapStore } from '../../composables/useMapStore'
import { useFinca } from '../../composables/useFinca'
import FichaCiudad from './ficha/FichaCiudad.vue'
import FichaDistrito from './ficha/FichaDistrito.vue'
import FichaBarrio from './ficha/FichaBarrio.vue'
import FichaSeccion from './ficha/FichaSeccion.vue'
import FichaFinca from './ficha/FichaFinca.vue'

defineProps<{ open: boolean }>()
defineEmits<{ toggle: [] }>()

const { mapContext } = useMapStore()
const { selectedAddress } = useFinca()

// Nivel de drill → componente de ficha.
const fichaFor = {
  ciudad: FichaCiudad,
  distrito: FichaDistrito,
  barrio: FichaBarrio,
  seccion: FichaSeccion,
  finca: FichaFinca,
} as const

const ficha = computed(() => fichaFor[mapContext.value.level as keyof typeof fichaFor] ?? FichaCiudad)

// Etiqueta contextual junto al título (nivel actual del drill).
const infoCtx = computed(() => {
  const c = mapContext.value
  if (c.level === 'distrito') return c.distritoName || 'Distrito'
  if (c.level === 'barrio') return c.barrioName || 'Barrio'
  if (c.level === 'seccion') return c.seccionCode ? `Sección ${c.seccionCode}` : 'Sección censal'
  if (c.level === 'finca') return selectedAddress.value || 'Finca'
  return 'Barcelona'
})
</script>

<template>
  <SectionCard ico="📍" title="Información" :ctx="infoCtx" :open="open" @toggle="$emit('toggle')">
    <component :is="ficha" />
  </SectionCard>
</template>
