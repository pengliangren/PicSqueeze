<script setup lang="ts">
import { computed } from 'vue'
import { NAlert, NButton, useMessage } from 'naive-ui'
import { fetchZip, zipResults } from '../api/compress'
import { getErrorMessage } from '../api/http'
import { useCompressorStore } from '../stores/compressor'
import { formatBytes } from '../utils/format'
import ResultCard from './ResultCard.vue'

const store = useCompressorStore()
const message = useMessage()

const savedLabel = computed(() => {
  const { saved, percent } = store.summary
  if (saved > 0) return `节省 ${formatBytes(saved)}（${percent}%）`
  if (saved < 0) return `体积增加 ${formatBytes(-saved)}（+${Math.abs(percent)}%）`
  return '体积基本不变'
})

async function downloadAll(): Promise<void> {
  if (store.downloadableIds.length === 0) return

  const hide = message.loading('正在打包，请稍候…', { duration: 0 })
  try {
    // Vercel 方案：结果以 data URL 返回，浏览器端打包；
    // Express 同域部署：仍走服务端 /api/download-all
    const blob = store.results.length > 0 && store.results.every((item) => item.dataUrl)
      ? await zipResults(store.results)
      : await fetchZip(store.downloadableIds)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'compressed-images.zip'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    message.success(`已打包 ${store.downloadableIds.length} 张图片`)
  } catch (error) {
    message.error(await getErrorMessage(error, '打包下载失败'))
  } finally {
    hide.destroy()
  }
}
</script>

<template>
  <section v-if="store.hasResults" class="results">
    <div class="results-head">
      <div>
        <h2>压缩结果</h2>
        <p class="summary">
          共 <strong>{{ store.summary.count }}</strong> 张成功 ·
          原始 {{ formatBytes(store.summary.totalOriginal) }} →
          压缩后 {{ formatBytes(store.summary.totalCompressed) }} ·
          <strong>{{ savedLabel }}</strong>
        </p>
      </div>
      <div class="results-actions">
        <n-button
          v-if="store.downloadableIds.length > 0"
          type="primary"
          secondary
          @click="downloadAll"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
          </template>
          打包下载全部（ZIP）
        </n-button>
        <n-button v-if="store.results.length > 0" @click="store.resetResults()">
          重新调整并压缩
        </n-button>
      </div>
    </div>

    <n-alert
      v-for="(item, index) in store.failedResults"
      :key="`${item.name}-${index}`"
      class="result-error"
      type="error"
      :show-icon="true"
      :title="`「${item.name}」压缩失败`"
    >
      {{ item.error }}
    </n-alert>

    <div class="results-grid">
      <ResultCard v-for="item in store.results" :key="item.id" :result="item" />
    </div>
  </section>
</template>

<style scoped>
.results-actions svg {
  width: 17px;
  height: 17px;
}

.result-error {
  margin-bottom: 12px;
}
</style>
