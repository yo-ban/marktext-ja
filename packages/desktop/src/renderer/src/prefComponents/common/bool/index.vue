<template>
  <section
    class="pref-switch-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div
      class="description"
      style="display: flex; align-items: center"
    >
      <span>{{ description }}:</span>
      <LinkIcon
        v-if="more"
        :size="14"
        class="link-icon"
        @click="handleMoreClick"
      />
      <el-tooltip
        v-else-if="detailedDescription"
        :content="detailedDescription"
        class="item"
        effect="dark"
        placement="top-start"
      >
        <InfoFilled
          width="16"
          height="16"
        />
      </el-tooltip>
      <span
        v-if="notes"
        class="notes"
      >
        {{ notes }}
      </span>
    </div>
    <el-switch
      v-model="status"
      @change="handleSwitchChange"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PrefControlBaseProps } from '../types'

interface BoolProps extends PrefControlBaseProps {
  notes?: string
  bool: boolean
  onChange: (value: boolean) => void
  detailedDescription?: string
}

const props = withDefaults(defineProps<BoolProps>(), {
  description: '',
  notes: '',
  more: '',
  detailedDescription: '',
  disable: false
})

const status = ref(props.bool)

watch(
  () => props.bool,
  (value, oldValue) => {
    if (value !== oldValue) {
      status.value = value
    }
  }
)

const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
  }
}

const handleSwitchChange = (value: boolean | string | number) => {
  props.onChange(Boolean(value))
}
</script>

<style>
.pref-switch-item {
  font-size: 14px;
  user-select: none;
  margin: 12px 0;
  color: var(--editorColor);
  display: flex;
  align-items: center;
  justify-content: space-between;

  & .description {
    & svg {
      margin-left: 4px;
      cursor: pointer;
      opacity: 0.7;
      color: var(--iconColor);
    }
    & svg:hover {
      color: var(--themeColor);
    }
    & > .notes {
      display: inline;
      margin: 0 0 0 8px;
    }
  }
}

/* Element Plus paints the knob `.el-switch__action` white. The OFF track is
   transparent, so that white knob vanished on light editor surfaces. Colour
   it with the same token as the outline; ON keeps EP's white on --themeColor. */
.pref-switch-item .el-switch .el-switch__core {
  border: 2px solid var(--iconColor);
  background: transparent;
  box-sizing: border-box;
}

.pref-switch-item .el-switch:not(.is-checked) .el-switch__action {
  background-color: var(--iconColor);
}

.pref-switch-item span.el-switch__label {
  color: var(--editorColor50);
}

.pref-switch-item .el-switch.is-checked .el-switch__core {
  border-color: var(--themeColor);
  background-color: var(--themeColor);
}
</style>
