import { defineStore } from 'pinia'
import { store, getConfig } from '../utils'
import { getLayoutStorage, setLayoutStorage } from '@/utils/storage'

export const useEpThemeStore = defineStore('lxhub-epTheme', {
  state: () => ({
    epThemeColor: getLayoutStorage().epThemeColor ?? getConfig().EpThemeColor ?? '#409EFF',
    epTheme: getLayoutStorage().theme ?? getConfig().Theme ?? 'light',
  }),
  getters: {
    getEpThemeColor(state) {
      return state.epThemeColor
    },
  },
  actions: {
    setEpThemeColor(newColor: string): void {
      const layout = getLayoutStorage()
      this.epTheme = layout?.theme
      this.epThemeColor = newColor
      layout.epThemeColor = newColor
      setLayoutStorage(layout)
    },
    setEpTheme(theme: string): void {
      const layout = getLayoutStorage()
      this.epTheme = theme
      layout.theme = theme
      setLayoutStorage(layout)
    },
  },
})

export function useEpThemeStoreHook() {
  return useEpThemeStore(store)
}
