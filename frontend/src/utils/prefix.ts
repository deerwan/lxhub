import { usePrefixStoreHook } from '@/store/modules/prefix'
import type { prefixItem } from '@/store/types'
import type { SourcesResp } from '@/types'

export type { prefixItem as Prefix } from '@/store/types'

function hostMatch(url: string, p: prefixItem): boolean {
  const hosts = p.hosts || []
  if (!hosts.length) return true
  let h = ''
  try {
    h = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  return hosts.some((x) => {
    const s = String(x).toLowerCase()
    return h === s || h.endsWith('.' + s)
  })
}

export function curPrefix(): prefixItem | null {
  return usePrefixStoreHook().current
}

/** 复制 / 导出链接时，按需拼接镜像加速前缀 */
export function withPrefix(url: string): string {
  const p = curPrefix()
  if (!p || !url) return url
  return hostMatch(url, p) ? p.prefix + url : url
}

export function setupPrefixes(list: SourcesResp['mirror_prefixes']): void {
  usePrefixStoreHook().setup(list)
}

export function savePrefixPrefs(): void {
  usePrefixStoreHook().savePrefs()
}
