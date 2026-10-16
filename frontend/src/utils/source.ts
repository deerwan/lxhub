export const PLAT: Record<string, string> = {
  kw: '酷我',
  wy: '网易云',
  kg: '酷狗',
  mg: '咪咕',
  tx: 'QQ',
}

export const TYPE_TXT: Record<string, string> = {
  source: '音源脚本',
  companion: '配套脚本（不用于导入）',
  unknown: '存疑',
}

export const STATUS_TXT: Record<string, string> = {
  ok: '可用',
  dead: '失效',
  down: '后端挂',
  comp: '配套',
  unk: '存疑',
}

export type StatusKey = 'ok' | 'dead' | 'down' | 'comp' | 'unk'

export const TAG_TYPE: Record<StatusKey, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
  ok: 'success',
  dead: 'danger',
  down: 'danger',
  comp: 'info',
  unk: 'warning',
}

export function statusKey(s: {
  is_alive?: boolean
  api_alive?: string
  script_type?: string
}): StatusKey {
  if (!s.is_alive) return 'dead'
  if (s.api_alive === 'down') return 'down'
  if (s.script_type === 'companion') return 'comp'
  if (s.script_type === 'unknown') return 'unk'
  return 'ok'
}

export function parseHosts(s: { api_hosts?: string | string[] }): string[] {
  const h = s?.api_hosts
  if (Array.isArray(h)) return h
  if (typeof h === 'string' && h) {
    try {
      const v = JSON.parse(h)
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }
  return []
}

export function baseName(u: string): string {
  try {
    return decodeURIComponent(u.split('?')[0].split('/').pop() || '')
  } catch {
    return u
  }
}