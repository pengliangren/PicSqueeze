<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { NButton, NModal, NTag } from 'naive-ui'
import { usePreviewStore } from '../stores/preview'

const preview = usePreviewStore()

let touchX = 0
let touchY = 0

function onKeydown(event: KeyboardEvent): void {
  if (!preview.show) return

  if (event.key === 'Escape') {
    preview.close()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    preview.step(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    preview.step(1)
  }
}

function onTouchStart(event: TouchEvent): void {
  const touch = event.changedTouches[0]
  if (!touch) return
  touchX = touch.clientX
  touchY = touch.clientY
}

function onTouchEnd(event: TouchEvent): void {
  const touch = event.changedTouches[0]
  if (!touch) return
  const dx = touch.clientX - touchX
  const dy = touch.clientY - touchY
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    preview.step(dx < 0 ? 1 : -1)
  }
}

watch(
  () => preview.show,
  (show) => {
    document.body.style.overflow = show ? 'hidden' : ''
  }
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <n-modal
    v-model:show="preview.show"
    class="preview-modal"
    :mask-closable="true"
    :bordered="false"
    :auto-focus="true"
    @after-leave="preview.close()"
  >
    <div v-if="preview.current" class="preview-shell" role="dialog" aria-modal="true" aria-label="图片大图预览">
      <header class="preview-head">
        <div class="preview-info">
          <span class="preview-name">{{ preview.current.name }}</span>
          <span class="preview-meta">
            {{ preview.current.label }} · {{ preview.current.sizeLabel }} ·
            {{ preview.current.dimensionsLabel }}
          </span>
        </div>
        <n-tag v-if="preview.current.badge" size="small" type="success" round>
          {{ preview.current.badge }}
        </n-tag>
        <n-button class="preview-close" quaternary circle aria-label="关闭预览" @click="preview.close()">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </template>
        </n-button>
      </header>

      <div
        class="preview-stage"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <button
          v-if="preview.multiple"
          type="button"
          class="preview-nav prev"
          aria-label="上一张"
          @click="preview.step(-1)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <img class="preview-image" :src="preview.current.src" :alt="preview.current.name" />

        <button
          v-if="preview.multiple"
          type="button"
          class="preview-nav next"
          aria-label="下一张"
          @click="preview.step(1)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <footer class="preview-foot">
        <span>← → 切换 · Esc 关闭 · 移动端可左右滑动</span>
        <span v-if="preview.multiple" class="preview-counter">
          {{ preview.index + 1 }} / {{ preview.items.length }}
        </span>
      </footer>
    </div>
  </n-modal>
</template>
