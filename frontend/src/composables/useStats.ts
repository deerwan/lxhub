import { reactive } from 'vue'
import { fetchStatus } from '@/api/status'
import { fmtRel } from '@/utils/format'

export interface StatsView {
  total: string
  alive: string
  valid: string
  usable: string
  lastCrawl: string
  lastCrawlFull: string
}

/**
 * 概览统计卡片数据。
 * 原先前台首页与后台概览各写了一份 `loadStats`，这里统一抽出来复用。
 */
export function useStats() {
  const stats = reactive<StatsView>({
    total: '—',
    alive: '—',
    valid: '—',
    usable: '—',
    lastCrawl: '—',
    lastCrawlFull: '',
  })

  async function loadStats(): Promise<void> {
    try {
      const s = await fetchStatus()
      stats.total = String(s.stats.total)
      stats.alive = String(s.stats.alive)
      stats.valid = String(s.stats.valid)
      stats.usable = s.stats.probe_usable == null ? '—' : String(s.stats.probe_usable)
      const lc = s.last_crawl
      const when = lc ? lc.finished_at || lc.started_at || '' : ''
      const rel = fmtRel(when)
      // 卡片里只放相对时间（"4 小时前"），完整时间放 title 提示，
      // 否则 "2026/10/17 02:23:45" 会被卡片宽度截断成省略号
      stats.lastCrawl = rel.t
      stats.lastCrawlFull = rel.full
    } catch {
      return
    }
  }

  return { stats, loadStats }
}
