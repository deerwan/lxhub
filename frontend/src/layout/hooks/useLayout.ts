import { computed } from 'vue'
import { useAppStoreHook } from '@/store/modules/app'
import { useSettingStoreHook } from '@/store/modules/settings'
import { useMultiTagsStoreHook } from '@/store/modules/multiTags'
import { initStorage } from '@/utils/storage'
import { routerArrays } from '@/layout/types'

/**
 * 布局相关的响应式配置，统一由 `settings` store 持有。
 */
export function useLayout() {
  const layout = computed(() => useAppStoreHook().layout)
  const configure = computed(() => useSettingStoreHook().configure)

  const hideTabs = computed(() => !!configure.value.hideTabs)
  const hideFooter = computed(() => configure.value.hideFooter !== false)
  const showLogo = computed(() => configure.value.showLogo !== false)
  const grey = computed(() => !!configure.value.grey)
  const weak = computed(() => !!configure.value.weak)
  const stretch = computed(() => configure.value.stretch ?? false)
  const multiTagsCache = computed(() => !!configure.value.multiTagsCache)
  const showModel = computed(() => configure.value.showModel ?? 'smart')

  /** 首次进入时把 `platform-config.json` 的默认值落到本地存储 */
  function initStorageDefault(): void {
    initStorage()
    if (!useMultiTagsStoreHook().multiTags?.length) {
      useMultiTagsStoreHook().handleTags('equal', [...routerArrays])
    }
  }

  function setConfigure(key: keyof ConfigureStorage, value: unknown): void {
    useSettingStoreHook().changeConfigure(key, value)
  }

  return {
    layout,
    configure,
    hideTabs,
    hideFooter,
    showLogo,
    grey,
    weak,
    stretch,
    showModel,
    multiTagsCache,
    initStorageDefault,
    setConfigure,
  }
}
