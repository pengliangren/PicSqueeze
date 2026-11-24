/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 前后端分离部署时后端接口根地址，例如 https://api.example.com/api */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
