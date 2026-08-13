<template>
  <el-tooltip
    v-if="props.wordCount"
    placement="top-end"
  >
    <template #content>
      <div
        v-if="hasSelection"
        class="word-count-stat word-count-heading has-selection"
      >
        <span />
        <span class="text">{{ t('menu.counter.document') }}</span>
        <span class="text">{{ t('menu.counter.selection') }}</span>
      </div>
      <div
        class="word-count-stat"
        :class="{ 'has-selection': hasSelection }"
      >
        <span class="front">{{ t('menu.counter.words') }}:</span>
        <span class="text">{{ props.wordCount.word }}</span>
        <span
          v-if="hasSelection"
          class="text"
        >{{ props.selectedWordCount?.word }}</span>
      </div>
      <div
        class="word-count-stat"
        :class="{ 'has-selection': hasSelection }"
      >
        <span class="front">{{ t('menu.counter.characters') }}:</span>
        <span class="text">{{ props.wordCount.character }}</span>
        <span
          v-if="hasSelection"
          class="text"
        >{{ props.selectedWordCount?.character }}</span>
      </div>
      <div
        class="word-count-stat"
        :class="{ 'has-selection': hasSelection }"
      >
        <span class="front">{{ t('menu.counter.paragraphs') }}:</span>
        <span class="text">{{ props.wordCount.paragraph }}</span>
        <span
          v-if="hasSelection"
          class="text"
        >{{ props.selectedWordCount?.paragraph }}</span>
      </div>
    </template>
    <div
      class="word-count"
      @click.stop="handleWordClick"
    >
      <span class="text-center-vertical">{{ compactText }}</span>
    </div>
  </el-tooltip>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileWordCount } from '@shared/types/files'

const props = defineProps<{
  wordCount?: FileWordCount | null
  selectedWordCount?: FileWordCount | null
}>()

const { t } = useI18n()

const HASH = {
  word: {
    short: 'W',
    full: 'word'
  },
  character: {
    short: 'C',
    full: 'character'
  },
  paragraph: {
    short: 'P',
    full: 'paragraph'
  },
  all: {
    short: 'A',
    full: '(with space)character'
  }
}

const show = ref<'word' | 'paragraph' | 'character' | 'all'>('word')
const hasSelection = computed(() => props.selectedWordCount != null)
const compactText = computed(() => {
  if (!props.wordCount) return ''
  const documentCount = props.wordCount[show.value]
  const selectedCount = props.selectedWordCount?.[show.value]
  const comparison = selectedCount == null ? '' : ` / ${selectedCount}`
  return `${HASH[show.value].short} ${documentCount}${comparison}`
})

const handleWordClick = () => {
  const ITEMS = ['word', 'paragraph', 'character', 'all'] as const
  const len = ITEMS.length
  let index = ITEMS.indexOf(show.value)
  index += 1
  if (index >= len) index = 0
  show.value = ITEMS[index]!
}
</script>

<style scoped>
.word-count {
  position: absolute;
  /* Clear of the editor's overlay scrollbar. */
  right: 14px;
  bottom: 10px;
  z-index: 2;
  user-select: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--editorColor30);
  text-align: center;
  transition: all 0.25s ease-in-out;
  & > .text-center-vertical {
    display: inline-block;
    vertical-align: middle;
    line-height: normal;
    padding: 2px 6px;
    border-radius: 3px;
    /* Opaque chip so the label stays readable over scrolled document text. */
    background: var(--editorBgColor);
  }
  &:hover > span {
    background: var(--sideBarBgColor);
    color: var(--sideBarTitleColor);
  }
}
</style>

<style>
.word-count-stat {
  height: 28px;
  line-height: 28px;
  display: grid;
  grid-template-columns: minmax(max-content, 1fr) minmax(44px, auto);
  column-gap: 10px;
  &.has-selection {
    grid-template-columns: minmax(max-content, 1fr) minmax(54px, auto) minmax(54px, auto);
  }
  & .front {
    opacity: 0.7;
  }
  & .text {
    text-align: right;
  }
}
.word-count-heading {
  height: 22px;
  line-height: 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
  font-size: 11px;
  opacity: 0.8;
}
</style>
