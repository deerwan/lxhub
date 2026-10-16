import { ref } from 'vue'
import { darken, lighten } from '@pureadmin/utils'
import { getConfig } from '@/config'
import { storageLocal } from '@/utils/storage'
import { useAppStoreHook } from '@/store/modules/app'
import { useEpThemeStoreHook } from '@/store/modules/epTheme'
import { useSettingStoreHook } from '@/store/modules/settings'
import type { themeColorsType } from '@/layout/types'

/** 预置主题色，供系统设置面板选择 */
const presetColors: Array<themeColorsType> = [
  { color: '#409EFF', themeColor: 'default' },
  { color: '#1b2a47', themeColor: 'darkBlue' },
  { color: '#722ed1', themeColor: 'saucePurple' },
  { color: '#eb2f96', themeColor: 'pink' },
  { color: '#f5222d', themeColor: 'dusk' },
  { color: '#fa541c', themeColor: 'volcano' },
  { color: '#13c2c2', themeColor: 'mingQing' },
  { color: '#52c41a', themeColor: 'auroraGreen' },
]

export function useDataThemeChange() {
  const body = document.documentElement as HTMLElement
  const themeColors = ref<Array<themeColorsType>>(presetColors)

  function setPropertyPrimary(mode: string, i: number, color: string) {
    const isDark = useSettingStoreHook().darkMode
    document.documentElement.style.setProperty(
      `--el-color-primary-${mode}-${i}`,
      isDark ? darken(color, i / 10) : lighten(color, i / 10),
    )
  }

  /** 设置 `element-plus` 主题色 */
  const setEpThemeColor = (color: string) => {
    useEpThemeStoreHook().setEpThemeColor(color)
    document.documentElement.style.setProperty('--el-color-primary', color)
    for (let i = 1; i <= 2; i++) {
      setPropertyPrimary('dark', i, color)
    }
    for (let i = 1; i <= 9; i++) {
      setPropertyPrimary('light', i, color)
    }
  }

  /** 浅色 / 深色整体风格切换 */
  function dataThemeChange(overall?: string) {
    const settings = useSettingStoreHook()
    if (overall) settings.changeLayout('overallStyle', overall)
    if (settings.darkMode) {
      body.classList.add('dark')
    } else {
      body.classList.remove('dark')
    }
    setEpThemeColor(useEpThemeStoreHook().epThemeColor)
  }

  /** 切换深色模式 */
  function toggleDark(value?: boolean): void {
    const settings = useSettingStoreHook()
    const next = value ?? !settings.darkMode
    settings.changeLayout('darkMode', next)
    settings.changeLayout('overallStyle', next ? 'dark' : 'light')
    dataThemeChange(next ? 'dark' : 'light')
  }

  /** 色弱 / 灰色模式 */
  function toggleClass(flag: boolean, clsName: string, target?: HTMLElement): void {
    const targetEl = target || document.body
    let { className } = targetEl
    className = className.replace(clsName, '').trim()
    targetEl.className = flag ? `${className} ${clsName}`.trim() : className
  }

  /** 清空缓存并恢复默认配置 */
  function onReset(): void {
    const { EpThemeColor, Layout, Grey, Weak } = getConfig()
    storageLocal().clear()
    useAppStoreHook().setLayout(Layout ?? 'vertical')
    setEpThemeColor(EpThemeColor ?? '#409EFF')
    toggleClass(Grey ?? false, 'html-grey', document.querySelector('html') as HTMLElement)
    toggleClass(Weak ?? false, 'html-weakness', document.querySelector('html') as HTMLElement)
  }

  return {
    body,
    themeColors,
    toggleDark,
    toggleClass,
    onReset,
    dataThemeChange,
    setEpThemeColor,
  }
}
