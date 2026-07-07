<script setup lang="ts">
// Card de sección colapsable del sidebar (Información / Capas / Movilidad / Zonas).
// Presentacional: cabecera con icono pastel + título + contexto + chevron, y el cuerpo
// como slot. El estado abierto/cerrado lo controla el padre (props + emit toggle).
defineProps<{
  ico: string // emoji del cuadrado pastel
  title: string
  open: boolean
  ctx?: string // texto contextual junto al título (p. ej. el nivel de drill)
  bodyClass?: string // clase del contenedor del cuerpo (los no-Info usan 'capas-body')
}>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <div class="capas-panel">
    <button class="capas-head" :aria-expanded="open" @click="$emit('toggle')">
      <span class="capas-head-t">
        <span class="capas-ico">{{ ico }}</span>{{ title }}
        <span v-if="ctx" class="capas-ctx">{{ ctx }}</span>
      </span>
      <span class="capas-chev" :class="{ open }">▾</span>
    </button>
    <div v-show="open" :class="bodyClass"><slot /></div>
  </div>
</template>
