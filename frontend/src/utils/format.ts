export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatSavings(original: number, compressed: number): string {
  if (original <= 0) return '已最优'
  const percent = Math.round(((original - compressed) / original) * 100)
  return percent > 0 ? `-${percent}%` : '已最优'
}
