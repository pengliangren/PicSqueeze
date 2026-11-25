import JSZip from 'jszip'
import { apiUrl, http } from './http'
import type { CompressResponse, CompressSettings, CompressSuccess } from '../types'

export async function compressImages(
  files: File[],
  settings: CompressSettings,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal
): Promise<CompressResponse> {
  const form = new FormData()
  for (const file of files) form.append('images', file, file.name)
  form.append('quality', String(settings.quality))
  form.append('format', settings.format)
  form.append('maxWidth', String(settings.maxWidth))

  const { data } = await http.post<CompressResponse>('/compress', form, {
    signal,
    onUploadProgress: (event) => {
      if (event.total && event.total > 0) onProgress?.(event.loaded / event.total)
    },
  })

  return data
}

export async function fetchZip(ids: string[]): Promise<Blob> {
  const { data } = await http.get<Blob>('/download-all', {
    params: { ids: ids.join(',') },
    responseType: 'blob',
  })
  return data
}

/**
 * Vercel 方案下服务端不保存文件，直接在浏览器把 data URL 打包成 ZIP。
 * 本地 / Express 同域部署仍走 fetchZip()。
 */
export async function zipResults(items: CompressSuccess[]): Promise<Blob> {
  const zip = new JSZip()
  const usedNames = new Set<string>()

  for (const item of items) {
    if (!item.dataUrl) continue
    const base64 = item.dataUrl.slice(item.dataUrl.indexOf(',') + 1)
    let name = item.outputName
    let i = 1
    while (usedNames.has(name)) {
      name = item.outputName.replace(/(\.[^.]+)$/, `-${i++}$1`)
    }
    usedNames.add(name)
    zip.file(name, base64, { base64: true })
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export const previewUrl = (id: string): string => apiUrl(`/files/${id}`)
export const downloadUrl = (id: string): string => apiUrl(`/download/${id}`)
