# 图片压缩工具 · PicSqueeze

一个开箱即用的在线图片压缩网站：支持 JPG / PNG / WebP / AVIF / GIF 批量上传压缩，可调节压缩质量、输出格式与最大宽度，并提供压缩前后尺寸、体积、预览图对比和一键打包下载。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Node.js + Express 5 + Multer + Sharp（libvips）+ Archiver |
| 前端 | Vue 3 + TypeScript + Vite + Naive UI + Pinia + Axios |

> 需要 Node.js ≥ 20.19（Vite 8 的要求）。

## 快速开始

```bash
# 1. 安装依赖（已安装可跳过）
npm install

# 2. 启动服务（使用 dist/ 中已构建的前端）
npm start

# 3. 打开浏览器
# http://localhost:3000
```

如果还没有构建前端产物，先执行：

```bash
npm run build
```

开发模式（Vite 5173 + API 3000 同时启动，前端热更新，后端自动重启）：

```bash
npm run dev
```

> 开发时访问 `http://localhost:5173`，`/api` 会自动代理到 3000 端口。生产构建访问 `http://localhost:3000`。

如需更换端口：

```powershell
# Windows PowerShell
$env:PORT=8080; npm start
```

```bash
# macOS / Linux
PORT=8080 npm start
```

## 功能说明

- **上传**：拖放、点击选择、剪贴板粘贴（Ctrl+V）三种方式。Vercel 部署下单次最多 2 张、单张最大 2MB（Vercel Hobby 请求体上限 4.5MB）；本地 Express 部署由 `server.js` 控制，为单次最多 10 张、单张最大 10MB。
- **统一大图预览**：待处理缩略图、压缩前后对比图都接入同一个预览组件，支持左右切换、方向键、Esc 关闭、手机滑动切换。
- **压缩质量**：高画质（85）/ 均衡（70）/ 高压缩（50）/ 自定义（10–100 滑杆）。
- **输出格式**：保持原格式，或统一转为 JPG / PNG / WebP。
- **尺寸控制**：可选择保持原始尺寸，或限制最大宽度为 1920 / 1280 / 800 px（等比缩放，不放大）。
- **效果对比**：每张图片展示原图与压缩后的预览、文件大小、像素尺寸和节省比例；点击「大图对比」可进入统一预览切换前后图。
- **下载**：单张下载，或一键打包为 ZIP 批量下载。
- **重压**：调整设置后可对当前文件列表重新压缩。
- **自动清理**：压缩结果在服务器保留 1 小时，到期自动删除；服务重启时清空临时目录。

> 说明：GIF 动图会取第一帧并输出为静态 PNG；含透明通道的图片转为 JPG 时会用白色背景填充。

## 目录结构

```
.
├─ server.js                 # Express 服务、压缩接口、下载接口
├─ frontend/
│  ├─ index.html             # Vite 入口
│  ├─ vite.config.mts        # 开发代理与构建配置
│  ├─ tsconfig.json
│  └─ src/
│     ├─ api/                # Axios 封装：压缩、ZIP 下载、地址生成
│     ├─ components/         # 上传、待处理列表、设置、结果卡片、预览弹窗
│     ├─ stores/             # Pinia：compressor / preview
│     ├─ styles/             # 全局绿色主题样式
│     ├─ utils/              # 体积、节省比例格式化
│     ├─ App.vue             # Naive UI 主题与消息 Provider
│     ├─ main.ts
│     └─ types.ts
├─ dist/                     # npm run build 生成的前端产物（由 Express 托管）
├─ storage/                  # 压缩结果临时目录（运行时自动创建）
├─ package.json
└─ README.md
```

## API

### `POST /api/compress`

`multipart/form-data`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `images` | File[] | 待压缩图片，可多张 |
| `quality` | number | 压缩质量 10–100，默认 70 |
| `format` | string | `auto` / `jpeg` / `png` / `webp`，默认 `auto` |
| `maxWidth` | number | 最大宽度像素，`0` 表示不缩放 |

返回示例：

```json
{
  "results": [
    {
      "ok": true,
      "id": "a1b2c3d4e5f6a7b8c9d0e1f2",
      "name": "photo.jpg",
      "outputName": "photo-min.jpg",
      "format": "jpeg",
      "originalSize": 2456789,
      "compressedSize": 612345,
      "originalWidth": 3024,
      "originalHeight": 4032,
      "width": 3024,
      "height": 4032,
      "url": "/api/files/a1b2c3d4e5f6a7b8c9d0e1f2",
      "downloadUrl": "/api/download/a1b2c3d4e5f6a7b8c9d0e1f2"
    }
  ],
  "settings": { "quality": 70, "format": "auto", "maxWidth": 0 }
}
```

单张图片压缩失败时，对应结果会是 `{ "ok": false, "name": "...", "error": "..." }`，不会影响其他图片。

### 其他接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/files/:id` | 在线预览压缩结果 |
| `GET` | `/api/download/:id` | 下载单张压缩结果 |
| `GET` | `/api/download-all?ids=a,b,c` | 打包下载 ZIP |

## 实现要点

- 使用 Sharp 的 `mozjpeg` 编码 JPEG，`palette + quality` 优化 PNG，`smartSubsample` 优化 WebP，兼顾体积与观感。
- `rotate()` 自动修正手机照片的 EXIF 方向，输出时去除元数据。
- JPG 不支持透明通道，转换前用白色背景 `flatten`。
- 压缩结果以随机 ID 命名存放，避免路径穿越与文件名冲突。
- 批量 ZIP 下载时自动处理重名文件。

## 常见问题

**安装 sharp 失败？**
sharp 自带各平台预编译二进制。若网络受限，可切换 npm 镜像后重试，例如：

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

**压缩后体积反而变大？**
部分图片本身已高度优化（例如已经是高质量 WebP），再压缩空间有限。可降低质量或限制最大宽度后重试。

## 部署

### 纯 Vercel 部署（无需后端平台）

项目已同时提供两套接口实现：

| 文件 | 用途 | 运行方式 |
| --- | --- | --- |
| `server.js` | 本地开发 / 同域 Express 部署 | `npm start`，结果写入本地 `storage/` |
| `api/compress.js`、`api/health.js` | Vercel Serverless Functions | Vercel 自动识别 `api/` 目录 |

Vercel 部署流程：

1. 导入 GitHub 仓库，框架选 Vite；`vercel.json` 已锁定 `npm run build` 和产物目录 `dist/`。
2. 直接 Deploy，**不需要**配置 `VITE_API_BASE_URL`、`CORS_ORIGIN` 等任何环境变量（前后端同源）。
3. 验证：`https://<你的项目>.vercel.app/api/health` 返回 `{"ok":true,"runtime":"vercel"}`。

Vercel 版本的实现细节：

- 压缩结果不写入磁盘，而是以 `data:image/...;base64,...` 随 JSON 返回；
- 预览大图、单张下载、ZIP 打包全部在浏览器完成，因此不需要持久存储；
- 上传限制为 **单张 2MB、单次 2 张**，因为 Vercel Functions 默认请求体和响应体上限均为 **4.5MB**（Hobby 计划，以官方文档为准）；
- 若升级到 Pro 并启用 Fluid Compute + 4GB 内存 + `VERCEL_SUPPORT_LARGE_REQUEST_BODY=1`，请求体上限可提升到 20MiB，届时可同步调大 `types.ts` 与 `api/compress.js` 中的常量。

### 本地 Express / 同域 Node 主机部署

```bash
npm run build
npm start
```

Express 会同时托管 `dist/` 和 `/api`，同源请求、无需跨域配置。此时上传限制为单张 10MB、单次 10 张，压缩结果写入 `storage/` 并在 1 小时后清理，需保持单实例运行。

如需把前端单独部署到其他平台并跨域调用 Express，可设置：

- 前端：`VITE_API_BASE_URL=https://<后端域名>/api`
- 后端：`CORS_ORIGIN=https://<前端域名>`
