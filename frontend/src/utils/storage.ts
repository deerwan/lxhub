import { storageLocal } from '@pureadmin/utils'
import { getConfig, responsiveStorageNameSpace } from '@/config'

const ns = (name: string): string => `${responsiveStorageNameSpace()}${name}`

export const layoutKey = (): string => ns('layout')
export const configureKey = (): string => ns('configure')
export const tagsKey = (): string => ns('tags')

/** 首次进入时把 `platform-config.json` 的默认值落到本地存储 */
export function initStorage(): void {
  if (!storageLocal().getItem<LayoutStorage>(layoutKey())) {
    storageLocal().setItem<LayoutStorage>(layoutKey(), {
      layout: getConfig().Layout ?? 'vertical',
      theme: getConfig().Theme ?? 'light',
      darkMode: getConfig().DarkMode ?? false,
      overallStyle: getConfig().OverallStyle ?? 'light',
      sidebarStatus: getConfig().SidebarStatus ?? true,
      epThemeColor: getConfig().EpThemeColor ?? '#409EFF',
      themeColor: getConfig().Theme ?? 'light',
    })
  }
  if (!storageLocal().getItem<ConfigureStorage>(configureKey())) {
    storageLocal().setItem<ConfigureStorage>(configureKey(), {
      grey: getConfig().Grey ?? false,
      weak: getConfig().Weak ?? false,
      hideTabs: getConfig().HideTabs ?? false,
      hideFooter: getConfig().HideFooter ?? true,
      showLogo: getConfig().ShowLogo ?? true,
      showModel: getConfig().ShowModel ?? 'smart',
      multiTagsCache: getConfig().MultiTagsCache ?? false,
      stretch: getConfig().Stretch ?? false,
    })
  }
}

export function getLayoutStorage(): LayoutStorage {
  return storageLocal().getItem<LayoutStorage>(layoutKey()) ?? {}
}

export function setLayoutStorage(value: LayoutStorage): void {
  storageLocal().setItem<LayoutStorage>(layoutKey(), value)
}

export function getConfigureStorage(): ConfigureStorage {
  return storageLocal().getItem<ConfigureStorage>(configureKey()) ?? {}
}

export function setConfigureStorage(value: ConfigureStorage): void {
  storageLocal().setItem<ConfigureStorage>(configureKey(), value)
}

export { storageLocal }
