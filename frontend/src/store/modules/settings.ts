import { defineStore } from 'pinia'
import { store, getConfig } from '../utils'
import {
  getConfigureStorage,
  getLayoutStorage,
  setConfigureStorage,
  setLayoutStorage,
} from '@/utils/storage'

export const useSettingStore = defineStore('lxhub-setting', {
  state: () => ({
    title: getConfig().Title ?? 'LX 音源',
    fixedHeader: getConfig().FixedHeader ?? true,
    hiddenSideBar: getConfig().HiddenSideBar ?? false,
    /** 外观 / 标签页等持久化配置 */
    configure: getConfigureStorage(),
    /** 深色模式 */
    darkMode: getLayoutStorage().darkMode ?? getConfig().DarkMode ?? false,
    /** 整体风格：`light` / `dark` */
    overallStyle: getLayoutStorage().overallStyle ?? getConfig().OverallStyle ?? 'light',
  }),
  getters: {
    getTitle(state) {
      return state.title
    },
    getFixedHeader(state) {
      return state.fixedHeader
    },
    getHiddenSideBar(state) {
      return state.hiddenSideBar
    },
  },
  actions: {
    CHANGE_SETTING({ key, value }: { key: string; value: unknown }) {
      if (Reflect.has(this, key)) {
        ;(this as unknown as Record<string, unknown>)[key] = value
      }
    },
    changeSetting(data: { key: string; value: unknown }) {
      this.CHANGE_SETTING(data)
    },
    /** 修改外观 / 标签页配置并持久化 */
    changeConfigure(key: keyof ConfigureStorage, value: unknown) {
      ;(this.configure as unknown as Record<string, unknown>)[key] = value
      setConfigureStorage(this.configure)
    },
    /** 修改导航 / 主题配置并持久化 */
    changeLayout(key: 'darkMode' | 'overallStyle', value: unknown) {
      ;(this as unknown as Record<string, unknown>)[key] = value
      const layout = getLayoutStorage()
      ;(layout as unknown as Record<string, unknown>)[key] = value
      setLayoutStorage(layout)
    },
  },
})

export function useSettingStoreHook() {
  return useSettingStore(store)
}
