<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import PendingList from './PendingList.vue'
import PreviewModal from './PreviewModal.vue'
import ResultsPanel from './ResultsPanel.vue'
import SettingsPanel from './SettingsPanel.vue'
import UploadDropzone from './UploadDropzone.vue'
import { useCompressorStore } from '../stores/compressor'
import { MAX_FILE_SIZE_MB, MAX_FILES } from '../types'

const store = useCompressorStore()
const message = useMessage()

function handleFiles(files: FileList | File[]): void {
  const result = store.addFiles(files)
  if (result.message) {
    if (result.error) message.warning(result.message)
    else message.info(result.message)
  } else if (result.added) {
    message.success(`已添加 ${result.added} 张图片`)
  }
}

function onPaste(event: ClipboardEvent): void {
  const files = Array.from(event.clipboardData?.files || [])
  if (files.length === 0) return
  event.preventDefault()
  handleFiles(files)
}

onMounted(() => window.addEventListener('paste', onPaste))
onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste)
  store.dispose()
})
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <span class="orb orb-1" />
    <span class="orb orb-2" />
  </div>

  <header class="site-header">
    <div class="wrap header-inner">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </span>
        <span class="brand-text">
          <strong>PicSqueeze</strong>
          <small>Image Compressor</small>
        </span>
      </div>
      <div class="header-tags">
        <span class="tag">🔒 本地处理 · 不上传原图到第三方</span>
        <span class="tag">⚡ 批量压缩</span>
      </div>
    </div>
  </header>

  <main class="wrap">
    <section class="hero">
      <h1>让图片更轻，<span class="accent">清晰依旧</span></h1>
      <p class="hero-sub">
        免费在线批量压缩 JPG、PNG、WebP 图片。自由调节质量、实时对比效果，一键打包下载。
      </p>
      <ul class="hero-points">
        <li>批量处理</li>
        <li>质量可调</li>
        <li>前后对比</li>
        <li>批量下载</li>
      </ul>
    </section>

    <upload-dropzone @files="handleFiles" />
    <pending-list />
    <settings-panel />
    <results-panel />
    <preview-modal />
  </main>

  <footer class="site-footer">
    <div class="wrap footer-inner">
      <p>© 2026 PicSqueeze · 图片仅在服务端临时处理，1 小时后自动清理</p>
      <p class="footer-dim">支持 JPG / PNG / WebP / AVIF · 单张最大 {{ MAX_FILE_SIZE_MB }}MB · 单次最多 {{ MAX_FILES }} 张</p>
    </div>
  </footer>
</template>
