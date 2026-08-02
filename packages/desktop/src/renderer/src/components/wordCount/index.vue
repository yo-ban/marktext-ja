<template>
  <el-tooltip
    v-if="wordCount"
    placement="top-end"
  >
    <template #content>
      <div class="word-count-stat">
        <span class="front">{{ t('menu.counter.words') }}:</span><span class="text">{{ wordCount['word'] }}</span>
      </div>
      <div class="word-count-stat">
        <span class="front">{{ t('menu.counter.characters') }}:</span><span class="text">{{ wordCount['character'] }}</span>
      </div>
      <div class="word-count-stat">
        <span class="front">{{ t('menu.counter.paragraphs') }}:</span><span class="text">{{ wordCount['paragraph'] }}</span>
      </div>
    </template>
    <div
      class="word-count"
      @click.stop="handleWordClick"
    >
      <span class="text-center-vertical">{{ `${HASH[show].short} ${wordCount[show]}` }}</span>
    </div>
  </el-tooltip>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileWordCount } from '@shared/types/files'

defineProps<{
  wordCount?: FileWordCount | null
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
  & .front {
    opacity: 0.7;
  }
  & .text {
    margin-left: 10px;
  }
}
</style>
