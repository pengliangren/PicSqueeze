<script setup lang="ts">
import { ref } from 'vue'
import { MAX_FILE_SIZE_MB, MAX_FILES } from '../types'

const emit = defineEmits<{
  (event: 'files', files: FileList | File[]): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
let dragDepth = 0

function openPicker(): void {
  inputRef.value?.click()
}

function onInputChange(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) emit('files', input.files)
  input.value = ''
}

function onDragEnter(event: DragEvent): void {
  event.preventDefault()
  dragDepth++
  dragging.value = true
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  dragging.value = true
}

function onDragLeave(event: DragEvent): void {
  event.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    emit('files', event.dataTransfer.files)
  }
}
</script>

<template>
  <section class="panel upload-panel">
    <div
      class="dropzone"
      :class="{ 'is-dragging': dragging }"
      role="button"
      tabindex="0"
      aria-label="点击选择或拖放图片到此处"
      @click="openPicker"
      @keydown.enter.prevent="openPicker"
      @keydown.space.prevent="openPicker"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <input
        ref="inputRef"
        class="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/tiff"
        multiple
        @click.stop
        @change="onInputChange"
      />

      <div class="dz-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
          <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
        </svg>
      </div>
      <p class="dz-title">拖放图片到这里，或 <span class="dz-link">点击选择</span></p>
      <p class="dz-hint">支持 JPG、PNG、WebP、AVIF、GIF · 单张最大 {{ MAX_FILE_SIZE_MB }}MB · 最多 {{ MAX_FILES }} 张</p>
      <span class="dz-cta">选择图片</span>
    </div>
  </section>
</template>

<style scoped>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
