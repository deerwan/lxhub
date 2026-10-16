import type { RouteConfigs } from '@/layout/types'

export interface appType {
  sidebar: {
    opened: boolean
    withoutAnimation: boolean
    isClickCollapse: boolean
  }
  layout: string
  device: string
  viewportSize: {
    width: number
    height: number
  }
}

export interface userType {
  username: string
  nickname: string
  roles: Array<string>
  permissions: Array<string>
  /** 登录页是否勾选免登录 */
  isRemembered: boolean
  /** 免登录保存天数 */
  loginDay: number
}

export type multiType = RouteConfigs

export interface cacheType {
  mode: string
  name: string
}

export interface positionType {
  startIndex?: number
  length?: number
}

export interface setType {
  title: string
  fixedHeader: boolean
  hiddenSideBar: boolean
}

export interface prefixItem {
  name: string
  prefix: string
  hosts?: string[]
}
