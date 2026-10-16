import type { RouteConfigs } from '@/layout/types'

declare global {
  /** 运行时全局配置，对应 `public/platform-config.json` */
  interface PlatformConfigs {
    Version?: string
    Title?: string
    FixedHeader?: boolean
    HiddenSideBar?: boolean
    MultiTagsCache?: boolean
    KeepAlive?: boolean
    Layout?: string
    Theme?: string
    DarkMode?: boolean
    OverallStyle?: string
    Grey?: boolean
    Weak?: boolean
    HideTabs?: boolean
    HideFooter?: boolean
    Stretch?: boolean
    SidebarStatus?: boolean
    EpThemeColor?: string
    ShowLogo?: boolean
    ShowModel?: string
    TooltipEffect?: string
    MaxTagsLevel?: number
    ResponsiveStorageNameSpace?: string
  }

  /** 导航相关持久化配置 */
  interface LayoutStorage {
    layout?: string
    theme?: string
    darkMode?: boolean
    overallStyle?: string
    sidebarStatus?: boolean
    /** 是否由用户点击折叠：用于避免宽屏下 ResizeObserver 把折叠状态冲掉 */
    isClickCollapse?: boolean
    epThemeColor?: string
    themeColor?: string
  }

  /** 外观 / 标签页相关持久化配置 */
  interface ConfigureStorage {
    grey?: boolean
    weak?: boolean
    hideTabs?: boolean
    hideFooter?: boolean
    showLogo?: boolean
    showModel?: string
    multiTagsCache?: boolean
    stretch?: boolean
  }

  interface ResponsiveStorage {
    layout?: LayoutStorage
    configure?: ConfigureStorage
    tags?: RouteConfigs[]
  }

  /** `app.config.globalProperties` 上挂载的内容 */
  interface GlobalPropertiesApi {
    $config?: PlatformConfigs
    $storage?: ResponsiveStorage
  }
}

export {}
