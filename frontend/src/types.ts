export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
export const MAX_FILES = 10

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
  url: string
  downloadUrl: string
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
