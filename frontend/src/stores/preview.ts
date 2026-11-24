import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { PreviewItem } from '../types'

export const usePreviewStore = defineStore('preview', () => {
  const items = ref<PreviewItem[]>([])
  const index = ref(0)
  const show = ref(false)

  const current = computed<PreviewItem | null>(() => items.value[index.value] ?? null)
  const isFirst = computed(() => index.value === 0)
  const isLast = computed(() => index.value === items.value.length - 1)
  const multiple = computed(() => items.value.length > 1)

  function open(list: PreviewItem[], startIndex = 0): void {
    if (list.length === 0) return
    items.value = list
    index.value = ((startIndex % list.length) + list.length) % list.length
    show.value = true
  }

  function close(): void {
    show.value = false
  }

  function step(delta: number): void {
    if (!multiple.value) return
    const total = items.value.length
    index.value = (index.value + delta + total) % total
  }

  return { items, index, show, current, isFirst, isLast, multiple, open, close, step }
})
