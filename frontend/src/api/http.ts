import axios from 'axios'

/**
 * 接口根地址：
 * - 默认 `/api`：与 Express 同域部署（本地开发由 Vite 代理到 3000）
 * - 前后端分离部署时，在部署平台设置 VITE_API_BASE_URL=https://<后端域名>/api
 */
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

/** 所有接口请求统一走这个实例 */
export const http = axios.create({
  baseURL: API_BASE,
  timeout: 120 * 1000,
})

/** 生成可直接用于 img.src / a.href 的地址，与 axios 共用同一个接口根地址 */
export const apiUrl = (path: string): string => `${API_BASE}/${path.replace(/^\/+/, '')}`

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
