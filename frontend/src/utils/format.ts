export function fmtElapsed(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m} 分 ${sec} 秒` : `${sec} 秒`
}

export function fmtRel(value: string): { t: string; full: string } {
  if (!value) return { t: '—', full: '' }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { t: value, full: '' }
  const full = d.toLocaleString('zh-CN', { hour12: false })
  const sec = (Date.now() - d.getTime()) / 1000
  let t: string
  if (sec < 0) t = full
  else if (sec < 60) t = '刚刚'
  else if (sec < 3600) t = `${Math.floor(sec / 60)} 分钟前`
  else if (sec < 86400) t = `${Math.floor(sec / 3600)} 小时前`
  else if (sec < 2592000) t = `${Math.floor(sec / 86400)} 天前`
  else t = d.toLocaleDateString('zh-CN')
  return { t, full }
}
export function fmtTime(value: string): string {
  return fmtRel(value).t
}

export function fmtFull(value: string): string {
  return fmtRel(value).full || String(value || '—')
}

export function fmtSize(n?: number | null): string {
  if (!n) return '—'
  if (n > 1048576) return (n / 1048576).toFixed(1) + ' MB'
  if (n > 1024) return (n / 1024).toFixed(0) + ' KB'
  return n + ' B'
}