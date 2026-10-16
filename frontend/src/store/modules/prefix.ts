import { defineStore } from 'pinia'
import { store } from '../utils'
import { type prefixItem } from '../types'
import type { SourcesResp } from '@/types'

const PREFIX_ON_KEY = 'lxhub.prefixOn'
const PREFIX_IDX_KEY = 'lxhub.prefixIdx'

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/**
 * 加速前缀：原先散落在 `utils/prefix.ts` 里的模块级单例状态，
 * 重构后收敛为 store，便于在任意页面共享并在设置里统一持久化。
 */
export const usePrefixStore = defineStore('lxhub-prefix', {
  state: () => ({
    prefixes: [] as prefixItem[],
    enabled: false,
    index: 0,
  }),
  getters: {
    current(state): prefixItem | null {
      if (!state.enabled || !state.prefixes.length) return null
      return state.prefixes[Math.min(state.index, state.prefixes.length - 1)] ?? null
    },
    hasPrefixes(state): boolean {
      return state.prefixes.length > 0
    },
  },
  actions: {
    setup(list: SourcesResp['mirror_prefixes']): void {
      this.prefixes = (list ?? [])
        .map((p) => (typeof p === 'string' ? { name: p, prefix: p } : p))
        .filter((p): p is prefixItem => !!p && !!p.prefix)
      this.enabled = readBool(PREFIX_ON_KEY)
      let i = 0
      try {
        i = parseInt(localStorage.getItem(PREFIX_IDX_KEY) || '0', 10)
      } catch {
        i = 0
      }
      this.index = Number.isNaN(i) ? 0 : i
      if (this.index >= this.prefixes.length) this.index = 0
    },
    setEnabled(value: boolean): void {
      this.enabled = value
      this.savePrefs()
    },
    setIndex(value: number): void {
      this.index = value
      this.enabled = true
      this.savePrefs()
    },
    savePrefs(): void {
      try {
        localStorage.setItem(PREFIX_ON_KEY, this.enabled ? '1' : '0')
        localStorage.setItem(PREFIX_IDX_KEY, String(this.index))
      } catch {
        return
      }
    },
  },
})

export function usePrefixStoreHook() {
  return usePrefixStore(store)
}
