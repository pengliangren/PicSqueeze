'use strict';

/**
 * 图片压缩工具 —— 后端服务
 * 技术栈：Express + Multer + Sharp + Archiver
 */

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { ZipArchive } = require('archiver');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');
// 新版 Vue 构建产物优先；未构建时仍可回退到旧的 public 目录
const STATIC_DIR = fs.existsSync(path.join(DIST_DIR, 'index.html')) ? DIST_DIR : PUBLIC_DIR;
const STORE_DIR = path.join(__dirname, 'storage');

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024; // 单张 10MB
const MAX_FILES = 10;                                 // 单次最多 10 张
const FILE_TTL = 60 * 60 * 1000;        // 结果文件保留 1 小时

const MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|gif|bmp|tiff?|heic|heif)$/i;

// 输入格式 -> 默认输出格式（auto 模式）
const AUTO_OUTPUT = {
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  heif: 'avif',
  gif: 'png',
  tiff: 'jpeg',
  svg: 'png',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------- 存储管理

fs.mkdirSync(STORE_DIR, { recursive: true });

/** id -> { id, path, name, mime, size, createdAt } */
const store = new Map();

// 启动时清空上次残留的临时文件
for (const entry of fs.readdirSync(STORE_DIR)) {
  try {
    fs.unlinkSync(path.join(STORE_DIR, entry));
  } catch {
    /* ignore */
  }
}

async function cleanupExpired() {
  const now = Date.now();
  for (const [id, file] of store) {
    if (now - file.createdAt > FILE_TTL) {
      store.delete(id);
      fsp.unlink(file.path).catch(() => {});
    }
  }
}

setInterval(cleanupExpired, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------- 工具函数

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function stripExtension(filename) {
  return filename.replace(/\.[^./\\]+$/, '') || 'image';
}

function resolveOutputFormat(inputFormat, requested) {
  if (requested !== 'auto') return requested;
  return AUTO_OUTPUT[inputFormat] || 'jpeg';
}

/** 按目标格式配置 Sharp 编码参数 */
function encode(pipeline, format, quality) {
  switch (format) {
    case 'png':
      return pipeline.png({ quality, compressionLevel: 9, effort: 8, palette: true });
    case 'webp':
      return pipeline.webp({ quality, effort: 5, smartSubsample: true });
    case 'avif':
      return pipeline.avif({ quality, effort: 4 });
    case 'jpeg':
    default:
      return pipeline.jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' });
  }
}

function friendlyError(err) {
  const message = String(err && err.message ? err.message : err);
  if (/unsupported image format|Input (file|buffer) contains unsupported/i.test(message)) {
    return '不支持的图片格式，请换一张 JPG / PNG / WebP 图片';
  }
  if (/Input file is missing|Input buffer is empty/i.test(message)) {
    return '图片文件为空或已损坏';
  }
  if (/corrupt|premature end/i.test(message)) {
    return '图片已损坏，无法读取';
  }
  return '压缩失败，请稍后重试';
}

// ---------------------------------------------------------------- 压缩逻辑

async function compressOne(file, options) {
  const meta = await sharp(file.buffer, { failOn: 'none' }).metadata();
  if (!meta.format) throw new Error('unsupported image format');
  if (!meta.width || !meta.height) throw new Error('Input buffer is empty');

  const outputFormat = resolveOutputFormat(meta.format, options.format);

  let pipeline = sharp(file.buffer, { failOn: 'none', animated: false }).rotate();

  if (options.maxWidth > 0) {
    pipeline = pipeline.resize({
      width: options.maxWidth,
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  // JPG 不支持透明通道，用白色背景填充
  if (outputFormat === 'jpeg') {
    pipeline = pipeline.flatten({ background: '#ffffff' });
  }

  pipeline = encode(pipeline, outputFormat, options.quality);

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  const id = crypto.randomBytes(12).toString('hex');
  const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
  const filePath = path.join(STORE_DIR, `${id}.${ext}`);
  await fsp.writeFile(filePath, data);

  const outputName = `${stripExtension(file.originalname)}-min.${ext}`;
  store.set(id, {
    id,
    path: filePath,
    name: outputName,
    mime: MIME_BY_FORMAT[outputFormat] || 'application/octet-stream',
    size: data.length,
    createdAt: Date.now(),
  });

  return {
    ok: true,
    id,
    name: file.originalname,
    outputName,
    format: outputFormat,
    originalSize: file.size,
    compressedSize: data.length,
    originalWidth: meta.width,
    originalHeight: meta.height,
    width: info.width,
    height: info.height,
    url: `/api/files/${id}`,
    downloadUrl: `/api/download/${id}`,
  };
}

// ---------------------------------------------------------------- 应用

const app = express();
app.disable('x-powered-by');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  // 浏览器在 multipart 中按 UTF-8 发送文件名，默认的 latin1 会导致中文乱码
  defParamCharset: 'utf8',
  fileFilter(req, file, cb) {
    const mime = file.mimetype || '';
    const looksLikeImage = mime.startsWith('image/') || IMAGE_EXT_RE.test(file.originalname);
    if (!looksLikeImage) {
      cb(new HttpError(415, `「${file.originalname}」不是图片文件`));
      return;
    }
    cb(null, true);
  },
});

app.use(
  express.static(STATIC_DIR, {
    extensions: ['html'],
    etag: true,
    lastModified: true,
    maxAge: 0,
    setHeaders(res) {
      // 始终向服务器校验，避免浏览器长期缓存旧版 JS/CSS
      res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

app.post('/api/compress', upload.array('images', MAX_FILES), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (files.length === 0) throw new HttpError(400, '请至少选择一张图片');

    const quality = clampInt(req.body.quality, 10, 100, 70);
    const maxWidth = clampInt(req.body.maxWidth, 0, 8000, 0);
    const requestedFormat = String(req.body.format || 'auto');
    const format = ['auto', 'jpeg', 'png', 'webp'].includes(requestedFormat)
      ? requestedFormat
      : 'auto';

    const results = [];
    for (const file of files) {
      try {
        results.push(await compressOne(file, { quality, format, maxWidth }));
      } catch (err) {
        console.error(`[compress] ${file.originalname}:`, err.message);
        results.push({ ok: false, name: file.originalname, error: friendlyError(err) });
      }
    }

    res.json({ results, settings: { quality, format, maxWidth } });
  } catch (err) {
    next(err);
  }
});

/** 内联预览（不带 attachment） */
app.get('/api/files/:id', (req, res, next) => {
  const file = store.get(req.params.id);
  if (!file) return next(new HttpError(404, '文件不存在或已过期'));

  res.type(file.mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(file.path, (err) => {
    if (err && !res.headersSent) next(err);
  });
});

/** 单张下载 */
app.get('/api/download/:id', (req, res, next) => {
  const file = store.get(req.params.id);
  if (!file) return next(new HttpError(404, '文件不存在或已过期'));

  res.download(file.path, file.name, (err) => {
    if (err && !res.headersSent) next(err);
  });
});

/** 批量打包下载 */
app.get('/api/download-all', (req, res, next) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const files = ids.map((id) => store.get(id)).filter(Boolean);
  if (files.length === 0) return next(new HttpError(404, '没有可下载的文件'));

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="compressed-images.zip"');

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', (err) => {
    console.error('[zip]', err.message);
    if (!res.headersSent) next(err);
    else res.destroy(err);
  });
  archive.pipe(res);

  const usedNames = new Set();
  for (const file of files) {
    let name = file.name;
    let i = 1;
    while (usedNames.has(name)) {
      name = file.name.replace(/(\.[^.]+)$/, `-${i++}$1`);
    }
    usedNames.add(name);
    archive.file(file.path, { name });
  }

  archive.finalize();
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 统一错误处理
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status || 500;
  let message = err.message || '服务器开小差了，请稍后重试';

  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = `单张图片不能超过 ${MAX_FILE_SIZE_MB}MB`;
  } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400;
    message = `一次最多处理 ${MAX_FILES} 张图片`;
  } else if (status >= 500) {
    console.error('[server]', err);
    message = '服务器开小差了，请稍后重试';
  }

  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  🌿  图片压缩工具已启动');
  console.log(`  ➜  本地访问: http://localhost:${PORT}`);
  console.log(`  ➜  静态目录: ${path.basename(STATIC_DIR)}`);
  console.log('');
});
