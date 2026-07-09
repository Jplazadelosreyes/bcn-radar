<script setup lang="ts">
// Átomo del dossier: enlace a un documento/fuente oficial (título + descripción + badge).
// Se repite en todos los niveles para apuntar a la fuente pública contrastable. Abre en
// pestaña nueva. `badge` distingue la acción esperada ("consultar 🔗" / "abrir 🔗").
withDefaults(defineProps<{
  href: string
  titulo: string
  desc: string
  badge?: string
}>(), { badge: 'consultar 🔗' })
</script>

<template>
  <a class="ficha-doc" :href="href" target="_blank" rel="noopener">
    <span class="ficha-doc-main">
      <span class="ficha-doc-t">{{ titulo }}</span>
      <span class="ficha-doc-d">{{ desc }}</span>
    </span>
    <span class="ficha-badge">{{ badge }}</span>
  </a>
</template>
