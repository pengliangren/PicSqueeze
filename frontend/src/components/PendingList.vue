<script setup lang="ts">
import { NButton, NTooltip } from 'naive-ui'
import { useCompressorStore } from '../stores/compressor'
import { usePreviewStore } from '../stores/preview'
import { formatBytes } from '../utils/format'
import type { PreviewItem } from '../types'

const store = useCompressorStore()
const preview = usePreviewStore()

function openPreview(index: number): void {
  const list: PreviewItem[] = store.files.map((item, i) => ({
    id: item.id,
    src: item.previewUrl,
    name: item.file.name,
    label: '原图',
    sizeLabel: formatBytes(item.file.size),
    dimensionsLabel:
      item.width && item.height ? `${item.width} × ${item.height}` : '尺寸读取中…',
    badge: `第 ${i + 1} 张`,
  }))
  preview.open(list, index)
}
</script>

<template>
  <div v-if="store.hasFiles" class="pending">
    <div class="pending-head">
      <span>待处理图片 · {{ store.files.length }} 张</span>
      <span class="pending-tip">点击缩略图可查看大图</span>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button quaternary size="tiny" @click="store.removeAllFiles()">清空</n-button>
        </template>
        清空待处理列表
      </n-tooltip>
    </div>

    <ul class="pending-list">
      <li v-for="(item, index) in store.files" :key="item.id" class="pending-item">
        <button
          type="button"
          class="pending-preview"
          :aria-label="`预览 ${item.file.name}`"
          @click="openPreview(index)"
        >
          <img class="pending-thumb" :src="item.previewUrl" :alt="item.file.name" />
        </button>

        <div class="pending-meta">
          <span class="pending-name" :title="item.file.name">{{ item.file.name }}</span>
          <span class="pending-size">
            {{ formatBytes(item.file.size) }}
            <template v-if="item.width && item.height">· {{ item.width }} × {{ item.height }}</template>
          </span>
        </div>

        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button
              class="remove-btn"
              quaternary
              circle
              size="small"
              aria-label="移除这张图片"
              @click="store.removeFile(item.id)"
            >
              <template #icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </template>
            </n-button>
          </template>
          移除
        </n-tooltip>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.remove-btn :deep(svg) {
  width: 14px;
  height: 14px;
}
</style>
