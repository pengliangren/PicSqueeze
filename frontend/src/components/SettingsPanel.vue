<script setup lang="ts">
import { computed } from 'vue'
import {
  NButton,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  useMessage,
} from 'naive-ui'
import { useCompressorStore } from '../stores/compressor'
import type { OutputFormat, QualityMode } from '../types'

const store = useCompressorStore()
const message = useMessage()

const qualityModes: { value: QualityMode; label: string }[] = [
  { value: 'high', label: '高画质' },
  { value: 'balanced', label: '均衡' },
  { value: 'fast', label: '小体积' },
  { value: 'custom', label: '自定义' },
]

const formatOptions: { label: string; value: OutputFormat }[] = [
  { label: '保持原格式', value: 'auto' },
  { label: 'JPG', value: 'jpeg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
]

const widthOptions = [
  { label: '不限制', value: 0 },
  { label: '1920 px', value: 1920 },
  { label: '1600 px', value: 1600 },
  { label: '1280 px', value: 1280 },
  { label: '1024 px', value: 1024 },
  { label: '800 px', value: 800 },
]

const qualityValue = computed({
  get: () => store.settings.quality,
  set: (value: number) => store.setQuality(value),
})

const canClear = computed(
  () => !store.busy && (store.hasFiles || store.results.length > 0 || store.failedResults.length > 0)
)

async function runCompress(): Promise<void> {
  const result = await store.compress()
  if (result.message) {
    if (result.error) message.error(result.message)
    else message.success(result.message)
  } else if (result.ok) {
    message.success('压缩完成')
  }
}

function setQualityMode(value: string | number): void {
  store.setQualityMode(value as QualityMode)
}

function clearAll(): void {
  store.clearAll()
  message.info('已清空')
}
</script>

<template>
  <section class="panel settings-panel">
    <div class="panel-head">
      <h2>压缩设置</h2>
      <span class="hint">质量越低，体积越小</span>
    </div>

    <div class="settings-grid">
      <div class="field">
        <span class="label">压缩质量</span>
        <n-radio-group
          class="quality-modes"
          :value="store.qualityMode"
          size="small"
          @update:value="setQualityMode"
        >
          <n-radio-button v-for="mode in qualityModes" :key="mode.value" :value="mode.value">
            {{ mode.label }}
          </n-radio-button>
        </n-radio-group>
        <div class="range-row">
          <n-slider v-model:value="qualityValue" :min="10" :max="100" :step="1" />
          <span class="quality-value">{{ store.settings.quality }}%</span>
        </div>
      </div>

      <div class="field">
        <span class="label">输出格式</span>
        <n-select
          v-model:value="store.settings.format"
          :options="formatOptions"
          size="medium"
        />
      </div>

      <div class="field">
        <span class="label">最大宽度</span>
        <n-select
          v-model:value="store.settings.maxWidth"
          :options="widthOptions"
          size="medium"
        />
      </div>
    </div>

    <div class="actions">
      <n-button
        type="primary"
        size="large"
        :disabled="!store.hasFiles"
        :loading="store.busy"
        @click="runCompress"
      >
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </template>
        {{ store.busy ? '正在压缩…' : `开始压缩${store.hasFiles ? `（${store.files.length}）` : ''}` }}
      </n-button>

      <n-button size="large" :disabled="!canClear" @click="clearAll">清空全部</n-button>

      <span v-if="store.status" class="status" :class="{ error: store.statusError }">
        {{ store.status }}
      </span>
    </div>

    <n-progress
      v-if="store.busy || store.progress > 0"
      class="progress"
      type="line"
      :percentage="store.progress"
      :height="8"
      :show-indicator="false"
      processing
    />
  </section>
</template>

<style scoped>
.settings-panel :deep(.n-radio-button) {
  flex: 1;
  text-align: center;
}

.settings-panel :deep(.n-base-selection),
.settings-panel :deep(.n-slider) {
  --n-border-radius: 10px;
}

.actions svg {
  width: 18px;
  height: 18px;
}
</style>
