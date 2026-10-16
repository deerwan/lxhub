import type { Component, CSSProperties } from 'vue'

export type routeMetaType = {
  /** 菜单 / 标签页标题 */
  title?: string
  /** 菜单图标，直接给组件或字符串 */
  icon?: string | Component
  /** 是否参与菜单渲染，默认 `true` */
  showLink?: boolean
  /** 是否缓存该页面 */
  keepAlive?: boolean
  /** 是否固定标签页 */
  fixedTag?: boolean
  /** 是否隐藏标签页 */
  hiddenTag?: boolean
  /** 菜单高亮的激活路径 */
  activePath?: string
  /** 菜单排序，越小越靠前 */
  rank?: number
  /** 页面级别权限 */
  roles?: Array<string>
  /** 按钮级别权限 */
  auths?: Array<string>
  /** 强制显示为父级菜单 */
  showParent?: boolean
  /** 标题右侧额外图标 */
  extraIcon?: string
  /** 是否记录滚动位置 */
  savedPosition?: boolean
  /** 页面切换动画 */
  transition?: { name?: string; enterTransition?: string; leaveTransition?: string }
}

export type RouteConfigs = {
  path?: string
  query?: object
  params?: object
  meta?: routeMetaType
  children?: RouteConfigs[]
  name?: string
  redirect?: string
  component?: unknown
}

/** 标签页始终保留的路由（不可关闭） */
export const routerArrays: Array<RouteConfigs> = [
  {
    path: '/admin/overview',
    name: 'AdminOverview',
    meta: { title: '概览' },
  },
]

export interface setType {
  sidebar: {
    opened: boolean
    withoutAnimation: boolean
    isClickCollapse: boolean
  }
  device: string
  fixedHeader: boolean
  classes: {
    hideSidebar: boolean
    openSidebar: boolean
    withoutAnimation: boolean
    mobile: boolean
  }
  hideTabs: boolean
}

export type menuType = {
  id?: number
  name?: string
  path?: string
  noShowingChildren?: boolean
  children?: menuType[]
  value?: unknown
  meta?: routeMetaType
  showTooltip?: boolean
  parentId?: number | null
  pathList?: number[]
  redirect?: string
}

export type themeColorsType = {
  color: string
  themeColor: string
}

export interface DivStyle extends CSSProperties {
  width?: string
  display?: string
  alignItems?: string
  justifyContent?: string
  overflow?: string
}
