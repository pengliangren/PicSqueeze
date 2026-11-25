// Vercel Hobby Functions 的请求体上限为 4.5MB，因此这里按 2MB × 2 张限制
export const MAX_FILE_SIZE_MB = 2
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
export const MAX_FILES = 2

export type OutputFormat = 'auto' | 'jpeg' | 'png' | 'webp'
export type QualityMode = 'high' | 'balanced' | 'fast' | 'custom'

export interface CompressSettings {
  quality: number
  format: OutputFormat
  maxWidth: number
}

export interface PendingImage {
  id: string
  file: File
  previewUrl: string
  width?: number
  height?: number
}

export interface CompressSuccess {
  ok: true
  id: string
  name: string
  outputName: string
  format: string
  originalSize: number
  compressedSize: number
  originalWidth: number
  originalHeight: number
  width: number
  height: number
  /** Vercel Serverless 方案：压缩结果以内联 data URL 返回 */
  dataUrl?: string
  /** 本地 / Express 同域部署方案的结果地址 */
  url?: string
  downloadUrl?: string
  originalPreview?: string
}

export interface CompressFailure {
  ok: false
  name: string
  error: string
  originalPreview?: string
}

export type CompressResultItem = CompressSuccess | CompressFailure

export interface CompressResponse {
  results: CompressResultItem[]
  settings: CompressSettings
}

export interface PreviewItem {
  id: string
  src: string
  name: string
  label: string
  sizeLabel: string
  dimensionsLabel: string
  badge?: string
}
