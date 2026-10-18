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

  /**
   * 主题切换期间临时禁用全部 CSS transition。
   *
   * 不禁用会有「两段式绘制」：直接引用 CSS 变量的表面（body / 导航栏 /
   * 侧边栏）瞬间变色，而 Element Plus 控件自带过渡（.el-card 是
   * transition: all 0.3s、.el-button 0.1s），会用几百毫秒从旧色慢慢
   * 追赶新色——视觉上就是暗色骨架上一块块旧色控件"闪一下"。
   * 在禁用过渡的窗口内完成类切换与主题色重设，所有表面同一帧落到终色。
   */
  function withoutTransitions(fn: () => void): void {
    const style = document.createElement('style')
    style.textContent = '*,*::before,*::after{transition:none!important}'
    document.head.appendChild(style)
    fn()
    // 强制回流：确保"无过渡"状态已参与本次样式计算，再移除覆盖规则
    void document.body.offsetHeight
    style.remove()
  }

  /** 浅色 / 深色整体风格切换 */
  function dataThemeChange(overall?: string) {
    const settings = useSettingStoreHook()
    if (overall) settings.changeLayout('overallStyle', overall)
    withoutTransitions(() => {
      if (settings.darkMode) {
        body.classList.add('dark')
      } else {
        body.classList.remove('dark')
      }
      setEpThemeColor(useEpThemeStoreHook().epThemeColor)
    })
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
