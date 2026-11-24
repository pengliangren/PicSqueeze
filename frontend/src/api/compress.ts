import { http } from './http'
import type { CompressResponse, CompressSettings } from '../types'

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

export const previewUrl = (id: string): string => `/api/files/${id}`
export const downloadUrl = (id: string): string => `/api/download/${id}`
