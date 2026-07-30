<script setup lang="ts">
import { computed } from 'vue'
import { getFileIconClasses } from './fileIconClass'

const props = defineProps<{
  name: string
}>()

const className = computed<string[]>(() => getFileIconClasses(props.name))
</script>

<template>
  <span
    :class="[className, { 'icon-pending': className.length === 0 }]"
    class="file-icon"
  />
</template>

<style scoped>
.file-icon {
  flex-shrink: 0;
  margin-right: 5px;
}

/* Hold the glyph's width while the icon database is still loading so the row
   labels don't shift sideways once it arrives. */
.file-icon.icon-pending {
  display: inline-block;
  width: 16px;
}
</style>
