import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { compressImages } from '../api/compress'
import { getErrorMessage } from '../api/http'
import {
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MB,
  type CompressSettings,
  type CompressSuccess,
  type PendingImage,
  type QualityMode,
} from '../types'

interface ActionResult {
  added?: number
  message?: string
  error?: boolean
  ok?: boolean
}

function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|avif|gif|bmp|tiff?)$/i.test(file.name || '')
}

export const useCompressorStore = defineStore('compressor', () => {
  const files = ref<PendingImage[]>([])
  const results = ref<CompressSuccess[]>([])
  const failedResults = ref<{ name: string; error: string; originalPreview?: string }[]>([])
  const settings = ref<CompressSettings>({ quality: 70, format: 'auto', maxWidth: 0 })
  const qualityMode = ref<QualityMode>('balanced')
  const busy = ref(false)
  const progress = ref(0)
  const status = ref('')
  const statusError = ref(false)

  let seq = 0
  let progressTimer: number | undefined

  const hasFiles = computed(() => files.value.length > 0)
  const hasResults = computed(() => results.value.length > 0 || failedResults.value.length > 0)
  const downloadableIds = computed(() => results.value.map((item) => item.id))

  const summary = computed(() => {
    const totalOriginal = results.value.reduce((sum, item) => sum + item.originalSize, 0)
    const totalCompressed = results.value.reduce((sum, item) => sum + item.compressedSize, 0)
    const saved = totalOriginal - totalCompressed
    const percent = totalOriginal > 0 ? Math.round((saved / totalOriginal) * 100) : 0
    return {
      count: results.value.length,
      totalOriginal,
      totalCompressed,
      saved,
      percent,
    }
  })

  function loadDimensions(item: PendingImage): void {
    const probe = new Image()
    probe.onload = () => {
      item.width = probe.naturalWidth
      item.height = probe.naturalHeight
    }
    probe.src = item.previewUrl
  }

  function addFiles(input: FileList | File[]): ActionResult {
    const incoming = Array.from(input)
    if (incoming.length === 0) return {}

    let added = 0
    let skippedType = 0
    let skippedSize = 0
    let skippedDup = 0
    let skippedLimit = 0

    for (const file of incoming) {
      if (!isImageFile(file)) {
        skippedType++
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        skippedSize++
        continue
      }
      const duplicated = files.value.some(
        (item) =>
          item.file.name === file.name &&
          item.file.size === file.size &&
          item.file.lastModified === file.lastModified
      )
      if (duplicated) {
        skippedDup++
        continue
      }
      if (files.value.length >= MAX_FILES) {
        skippedLimit++
        continue
      }

      const item: PendingImage = {
        id: `f${++seq}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }
      files.value.push(item)
      loadDimensions(item)
      added++
    }

    if (skippedType) return { added, message: `已忽略 ${skippedType} 个非图片文件`, error: true }
    if (skippedSize) return { added, message: `有 ${skippedSize} 张图片超过 ${MAX_FILE_SIZE_MB}MB，已忽略`, error: true }
    if (skippedLimit) return { added, message: `一次最多处理 ${MAX_FILES} 张图片`, error: true }
    if (skippedDup && !added) return { added, message: '这些图片已经在列表里了' }
    if (added) status.value = `已添加 ${added} 张图片，可以开始压缩`
    return { added }
  }

  function releasePreview(url?: string): void {
    if (!url) return
    const stillUsed = results.value.some((item) => item.originalPreview === url)
    if (!stillUsed) URL.revokeObjectURL(url)
  }

  function removeFile(id: string): void {
    const index = files.value.findIndex((item) => item.id === id)
    if (index < 0) return
    const [removed] = files.value.splice(index, 1)
    releasePreview(removed.previewUrl)
    if (files.value.length === 0) status.value = ''
  }

  function removeAllFiles(): void {
    for (const item of files.value) releasePreview(item.previewUrl)
    files.value = []
    status.value = ''
  }

  /** 重新压缩：保留原图和缩略图，只清空本轮结果 */
  function resetResults(): void {
    results.value = []
    failedResults.value = []
    status.value = ''
    statusError.value = false
    progress.value = 0
    window.clearTimeout(progressTimer)
  }

  function clearAll(): void {
    const urls = new Set<string>()
    for (const item of files.value) urls.add(item.previewUrl)
    for (const item of results.value) if (item.originalPreview) urls.add(item.originalPreview)
    for (const item of failedResults.value) if (item.originalPreview) urls.add(item.originalPreview)
    for (const url of urls) URL.revokeObjectURL(url)

    files.value = []
    results.value = []
    failedResults.value = []
    status.value = ''
    statusError.value = false
    progress.value = 0
    window.clearTimeout(progressTimer)
  }

  function setQualityMode(mode: QualityMode): void {
    qualityMode.value = mode
    if (mode !== 'custom') {
      settings.value.quality = { high: 85, balanced: 70, fast: 50 }[mode]
    }
  }

  function setQuality(value: number): void {
    settings.value.quality = Math.min(100, Math.max(10, Math.round(value)))
    qualityMode.value = 'custom'
  }

  async function compress(): Promise<ActionResult> {
    if (busy.value || files.value.length === 0) return { ok: false }

    const snapshot = files.value.slice()
    busy.value = true
    progress.value = 0
    statusError.value = false
    status.value = `正在压缩 ${snapshot.length} 张图片…`
    window.clearTimeout(progressTimer)

    try {
      const response = await compressImages(
        snapshot.map((item) => item.file),
        { ...settings.value },
        (ratio) => {
          progress.value = Math.round(ratio * 92)
        }
      )

      const successes: CompressSuccess[] = []
      const failures: { name: string; error: string; originalPreview?: string }[] = []

      response.results.forEach((item, index) => {
        const originalPreview = snapshot[index]?.previewUrl
        if (item.ok) {
          item.originalPreview = originalPreview
          successes.push(item)
        } else {
          failures.push({ name: item.name, error: item.error, originalPreview })
        }
      })

      results.value = successes
      failedResults.value = failures
      progress.value = 100
      status.value = `完成 · 成功压缩 ${successes.length} 张`

      progressTimer = window.setTimeout(() => {
        progress.value = 0
      }, 600)

      return {
        ok: successes.length > 0,
        message: successes.length === 0 ? '压缩失败，请查看结果中的错误提示' : undefined,
        error: successes.length === 0,
      }
    } catch (error) {
      const message = await getErrorMessage(error, '压缩失败，请稍后重试')
      status.value = message
      statusError.value = true
      progress.value = 0
      return { ok: false, message, error: true }
    } finally {
      busy.value = false
    }
  }

  function dispose(): void {
    const urls = new Set<string>()
    for (const item of files.value) urls.add(item.previewUrl)
    for (const item of results.value) if (item.originalPreview) urls.add(item.originalPreview)
    for (const item of failedResults.value) if (item.originalPreview) urls.add(item.originalPreview)
    for (const url of urls) URL.revokeObjectURL(url)
  }

  return {
    files,
    results,
    failedResults,
    settings,
    qualityMode,
    busy,
    progress,
    status,
    statusError,
    hasFiles,
    hasResults,
    downloadableIds,
    summary,
    addFiles,
    removeFile,
    removeAllFiles,
    resetResults,
    clearAll,
    setQualityMode,
    setQuality,
    compress,
    dispose,
  }
})
