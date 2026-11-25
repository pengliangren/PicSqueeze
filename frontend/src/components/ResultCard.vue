<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NTag, NTooltip, useMessage } from 'naive-ui'
import { downloadUrl } from '../api/compress'
import { usePreviewStore } from '../stores/preview'
import type { CompressSuccess, PreviewItem } from '../types'
import { formatBytes, formatSavings } from '../utils/format'

const props = defineProps<{ result: CompressSuccess }>()

const preview = usePreviewStore()
const message = useMessage()

const savings = computed(() => formatSavings(props.result.originalSize, props.result.compressedSize))
const savedBytes = computed(() => props.result.originalSize - props.result.compressedSize)
const formatLabel = computed(() => props.result.format.toUpperCase())
const dimensionsChanged = computed(
  () =>
    props.result.originalWidth !== props.result.width ||
    props.result.originalHeight !== props.result.height
)

const afterSrc = computed(() => props.result.dataUrl || props.result.url || '')
const beforeSrc = computed(() => props.result.originalPreview || '')

function openPreview(startIndex: number): void {
  const list: PreviewItem[] = [
    {
      id: `${props.result.id}-before`,
      src: beforeSrc.value,
      name: props.result.name,
      label: '压缩前',
      sizeLabel: formatBytes(props.result.originalSize),
      dimensionsLabel: `${props.result.originalWidth} × ${props.result.originalHeight}`,
      badge: '原图',
    },
    {
      id: `${props.result.id}-after`,
      src: afterSrc.value,
      name: props.result.outputName,
      label: '压缩后',
      sizeLabel: formatBytes(props.result.compressedSize),
      dimensionsLabel: `${props.result.width} × ${props.result.height}`,
      badge: savings.value,
    },
  ].filter((item) => Boolean(item.src))

  if (list.length === 0) {
    message.warning('原图预览已失效，可直接下载查看压缩结果')
    return
  }

  preview.open(list, startIndex >= list.length ? 0 : startIndex)
}

function triggerDownload(): void {
  const link = document.createElement('a')
  link.href = props.result.dataUrl || downloadUrl(props.result.id)
  link.download = props.result.outputName
  document.body.appendChild(link)
  link.click()
  link.remove()
}
</script>

<template>
  <article class="result-card">
    <header class="result-head">
      <span class="result-name" :title="result.name">{{ result.outputName }}</span>
      <n-tag size="small" type="success" round>{{ formatLabel }}</n-tag>
      <n-tag v-if="savings !== '已最优'" size="small" round class="badge" type="warning">
        {{ savings }}
      </n-tag>
    </header>

    <div class="compare">
      <figure>
        <button
          type="button"
          class="thumb before"
          aria-label="查看压缩前大图"
          @click="openPreview(0)"
        >
          <img v-if="beforeSrc" :src="beforeSrc" :alt="`${result.name} 压缩前`" />
          <span v-else class="thumb-empty">预览已失效</span>
        </button>
        <figcaption>
          <span>压缩前</span>
          <strong>{{ formatBytes(result.originalSize) }}</strong>
          <small>{{ result.originalWidth }} × {{ result.originalHeight }}</small>
        </figcaption>
      </figure>

      <span class="compare-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14m0 0l-5-5m5 5l-5 5" />
        </svg>
      </span>

      <figure>
        <button
          type="button"
          class="thumb after"
          aria-label="查看压缩后大图"
          @click="openPreview(1)"
        >
          <img :src="afterSrc" :alt="`${result.outputName} 压缩后`" />
        </button>
        <figcaption>
          <span>压缩后</span>
          <strong>{{ formatBytes(result.compressedSize) }}</strong>
          <small>
            {{ result.width }} × {{ result.height }}
            <template v-if="dimensionsChanged">（已缩放）</template>
          </small>
        </figcaption>
      </figure>
    </div>

    <footer class="result-foot">
      <span class="saved">
        <template v-if="savedBytes > 0">节省 <b>{{ formatBytes(savedBytes) }}</b></template>
        <template v-else>体积基本不变</template>
      </span>
      <div class="btns">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" quaternary @click="openPreview(1)">大图对比</n-button>
          </template>
          查看压缩前后大图
        </n-tooltip>
        <n-button size="small" type="primary" secondary @click="triggerDownload">下载</n-button>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.thumb-empty {
  font-size: 12px;
  color: var(--muted-2);
}
</style>
