import axios from 'axios'

/** 所有 /api 请求统一走这个实例，开发环境由 Vite 代理到 Express */
export const http = axios.create({
  baseURL: '/api',
  timeout: 120 * 1000,
})

/** 从任意错误对象里提取可展示的后端错误信息（兼容 blob 类型的错误响应） */
export async function getErrorMessage(error: unknown, fallback = '请求失败'): Promise<string> {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data

    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text()) as { error?: unknown }
        if (typeof parsed.error === 'string') return parsed.error
      } catch {
        // 不是 JSON，忽略
      }
    } else if (data && typeof data === 'object' && 'error' in data) {
      const message = (data as { error?: unknown }).error
      if (typeof message === 'string') return message
    }

    return error.message || fallback
  }

  return error instanceof Error ? error.message : fallback
}
