<template>
  <div
    class="empty-action-list"
    :class="tone"
  >
    <button
      v-for="action in resolved"
      :key="action.label"
      type="button"
      class="empty-action"
      @click="action.run"
    >
      <el-icon
        v-if="action.icon"
        class="icon"
        :size="16"
      >
        <component :is="action.icon" />
      </el-icon>
      <span class="label">{{ action.label }}</span>
      <span
        v-if="showShortcuts && action.keys.length"
        class="keys"
      >
        <kbd
          v-for="key in action.keys"
          :key="key"
        >{{ key }}</kbd>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useCommandCenterStore } from '@/store/commandCenter'
import { isOsx } from '@/util'
import { acceleratorToTokens } from '@/util/accelerator'

export interface EmptyAction {
  label: string
  run: () => void
  icon?: Component
  commandId?: string
  fallbackAccelerator?: string
}

const props = withDefaults(
  defineProps<{
    actions: EmptyAction[]
    // `sidebar` uses the tree's text/hover tokens so the list is not a
    // foreign green CTA on the gray column.
    tone?: 'editor' | 'sidebar'
    showShortcuts?: boolean
  }>(),
  {
    tone: 'editor',
    showShortcuts: true
  }
)

const commandStore = useCommandCenterStore()

const resolved = computed(() =>
  props.actions.map((action) => {
    const fromCommand = action.commandId
      ? commandStore.rootCommand.subcommands.find((c) => c.id === action.commandId)?.shortcut
      : undefined
    const keys =
      fromCommand && fromCommand.length > 0
        ? fromCommand
        : action.fallbackAccelerator
          ? acceleratorToTokens(action.fallbackAccelerator, isOsx)
          : []
    return { ...action, keys }
  })
)
</script>

<style scoped>
.empty-action-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  max-width: 320px;
}

.empty-action {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  margin: 0;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  appearance: none;
  background-color: transparent;
  color: var(--editorColor);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.empty-action:hover,
.empty-action:focus-visible {
  background-color: var(--floatHoverColor);
  color: var(--editorColor);
  outline: none;
}

.empty-action:focus-visible {
  box-shadow: inset 0 0 0 1px var(--themeColor40);
}

.empty-action .icon {
  flex-shrink: 0;
  color: var(--iconColor);
}

.empty-action .label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-action .keys {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.empty-action kbd {
  display: inline-block;
  min-width: 10px;
  padding: 1px 6px;
  border: 1px solid var(--floatBorderColor);
  border-radius: 4px;
  background: var(--floatBgColor);
  color: var(--editorColor50);
  font-family: inherit;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}

.empty-action-list.sidebar {
  max-width: 100%;
}

.empty-action-list.sidebar .empty-action {
  height: 32px;
  padding: 0 8px;
  color: var(--sideBarColor);
  font-size: 13px;
}

.empty-action-list.sidebar .empty-action:hover,
.empty-action-list.sidebar .empty-action:focus-visible {
  background-color: var(--sideBarItemHoverBgColor);
}
</style>
