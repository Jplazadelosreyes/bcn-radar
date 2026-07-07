<script setup>
// Explorador de parada (presentacional): muestra las líneas que pasan por la parada
// seleccionada y emite la acción; el dibujo del recorrido lo maneja el padre por ahora.
// `chips` viene ya anotado con `on` (línea activa) para no depender de la lógica del padre.
defineProps({
  stop: { type: Object, default: null },        // { name, sub?, chips:[{id,short,color,long,on}] }
  chips: { type: Array, default: () => [] },
  hasSelection: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'pick', 'clear'])
</script>

<template>
  <div v-if="stop" class="stop-explorer">
    <div class="stop-explorer-head">
      <div class="stop-explorer-title">
        <span class="stop-explorer-k">Parada{{ stop.sub ? ' · ' + stop.sub : '' }}</span>
        <span class="stop-explorer-name">{{ stop.name }}</span>
      </div>
      <button class="stop-explorer-x" @click="emit('close')" title="Cerrar">✕</button>
    </div>
    <span class="stop-explorer-hint">Elige una línea para ver su recorrido y sus paradas:</span>
    <div class="stop-chips">
      <button v-for="c in chips" :key="c.id" type="button"
        class="stop-chip" :class="{ on: c.on }"
        :style="{ '--c': c.color }" :title="c.long"
        @click="emit('pick', c)">{{ c.short }}</button>
    </div>
    <button v-if="hasSelection" class="stop-clear" @click="emit('clear')">Quitar recorridos</button>
  </div>
</template>
