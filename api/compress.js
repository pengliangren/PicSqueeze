'use strict';

/**
 * Vercel Serverless Function: POST /api/compress
 *
 * 与本地 server.js 使用同一套 Sharp 压缩参数，但不写本地磁盘。
 * 压缩结果以 data URL 随 JSON 返回，预览与下载都在浏览器完成。
 *
 * 注意：Vercel Hobby 的请求体 / 响应体上限为 4.5MB，
 * 因此这里的上传限制是 单张 2MB × 最多 2 张。
 */

const crypto = require('crypto');
const busboy = require('busboy');
const sharp = require('sharp');

const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES = 2;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

const MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|gif|bmp|tiff?|heic|heif)$/i;

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

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value), 10);
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

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

/** 读取 multipart/form-data，把图片收集到内存中 */
function readMultipart(req) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = busboy({
        headers: req.headers,
        defParamCharset: 'utf8',
        limits: {
          fileSize: MAX_FILE_SIZE,
          files: MAX_FILES,
          fields: 10,
          parts: MAX_FILES + 10,
        },
      });
    } catch (err) {
      reject(err);
      return;
    }

    const fields = {};
    const files = [];
    let limitError = null;

    parser.on('field', (name, value) => {
      fields[name] = value;
    });

    parser.on('file', (name, stream, info) => {
      if (name !== 'images') {
        stream.resume();
        return;
      }

      const mime = info.mimeType || '';
      const looksLikeImage = mime.startsWith('image/') || IMAGE_EXT_RE.test(info.filename || '');

      const chunks = [];
      let size = 0;
      let limited = false;

      stream.on('data', (chunk) => {
        size += chunk.length;
        chunks.push(chunk);
      });
      stream.on('limit', () => {
        limited = true;
        if (!limitError) {
          limitError = {
            status: 413,
            error: `单张图片不能超过 ${MAX_FILE_SIZE_MB}MB`,
          };
        }
      });
      stream.on('error', reject);
      stream.on('end', () => {
        if (limited) return;
        if (!looksLikeImage) {
          if (!limitError) {
            limitError = {
              status: 415,
              error: `「${info.filename}」不是图片文件`,
            };
          }
          return;
        }
        files.push({
          buffer: Buffer.concat(chunks),
          size,
          originalname: info.filename || 'image',
        });
      });
    });

    parser.on('filesLimit', () => {
      if (!limitError) {
        limitError = { status: 400, error: `一次最多处理 ${MAX_FILES} 张图片` };
      }
    });
    parser.on('partsLimit', () => {
      if (!limitError) {
        limitError = { status: 400, error: `一次最多处理 ${MAX_FILES} 张图片` };
      }
    });
    parser.on('error', reject);
    parser.on('finish', () => resolve({ fields, files, limitError }));

    req.pipe(parser);
  });
}

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

  if (outputFormat === 'jpeg') {
    pipeline = pipeline.flatten({ background: '#ffffff' });
  }

  pipeline = encode(pipeline, outputFormat, options.quality);

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const mime = MIME_BY_FORMAT[outputFormat] || 'application/octet-stream';
  const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;

  return {
    ok: true,
    id: crypto.randomBytes(8).toString('hex'),
    name: file.originalname,
    outputName: `${stripExtension(file.originalname)}-min.${ext}`,
    format: outputFormat,
    originalSize: file.size,
    compressedSize: data.length,
    originalWidth: meta.width,
    originalHeight: meta.height,
    width: info.width,
    height: info.height,
    dataUrl: `data:${mime};base64,${data.toString('base64')}`,
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: '仅支持 POST 请求' });
    return;
  }

  let input;
  try {
    input = await readMultipart(req);
  } catch (err) {
    console.error('[compress] multipart:', err);
    sendJson(res, 400, { error: '请求格式不正确' });
    return;
  }

  if (input.limitError) {
    sendJson(res, input.limitError.status, { error: input.limitError.error });
    return;
  }
  if (input.files.length === 0) {
    sendJson(res, 400, { error: '请至少选择一张图片' });
    return;
  }

  const quality = clampInt(input.fields.quality, 10, 100, 70);
  const maxWidth = clampInt(input.fields.maxWidth, 0, 8000, 0);
  const requestedFormat = String(input.fields.format || 'auto');
  const format = ['auto', 'jpeg', 'png', 'webp'].includes(requestedFormat)
    ? requestedFormat
    : 'auto';

  const results = [];
  for (const file of input.files) {
    try {
      results.push(await compressOne(file, { quality, format, maxWidth }));
    } catch (err) {
      console.error(`[compress] ${file.originalname}:`, err.message);
      results.push({
        ok: false,
        name: file.originalname,
        error: friendlyError(err),
      });
    }
  }

  const body = JSON.stringify({
    results,
    settings: { quality, format, maxWidth },
  });
  if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
    sendJson(res, 413, { error: '压缩结果过大，请减少图片数量或限制最大宽度后重试' });
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
};
