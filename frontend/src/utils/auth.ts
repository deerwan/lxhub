import { isIncludeAllChildren, isString, storageLocal } from '@pureadmin/utils'

export const userKey = 'lxhub-user-info'

export interface DataInfo<T = number> {
  /** 用户名 */
  username?: string
  /** 页面级别权限 */
  roles?: Array<string>
  /** 按钮级别权限 */
  permissions?: Array<string>
  /** `accessToken` */
  accessToken?: string
  /** `accessToken` 的过期时间戳（毫秒） */
  expires?: T
}

export const formatToken = (token: string): string => `Bearer ${token}`

/**
 * 读取登录态，未登录或已过期时返回空对象。
 *
 * 注意：这里刻意不依赖 `pinia`（`vue-pure-admin` 里 `setToken` 会写 store），
 * 以避免 `utils/auth -> store -> api -> utils/http -> utils/auth` 的循环依赖。
 * 用户信息统一由 `user` store 从本地存储初始化。
 */
export function getToken(): DataInfo<number> {
  const info = storageLocal().getItem<DataInfo<number>>(userKey)
  if (!info?.accessToken) return {}
  // 过期即视为未登录，避免带着失效 token 反复 401
  if (info.expires && info.expires < Date.now()) {
    removeToken()
    return {}
  }
  return info
}

export function setToken(data: DataInfo<number>): void {
  const prev = storageLocal().getItem<DataInfo<number>>(userKey) ?? {}
  storageLocal().setItem<DataInfo<number>>(userKey, { ...prev, ...data })
}

export function removeToken(): void {
  storageLocal().removeItem(userKey)
}

/** 按钮级别权限判断，`*:*:*` 视为拥有全部权限 */
export function hasPerms(value: string | Array<string>): boolean {
  if (!value) return false
  const permissions = getToken().permissions ?? []
  if (!permissions.length) return false
  if (permissions.includes('*:*:*')) return true
  return isString(value) ? permissions.includes(value) : isIncludeAllChildren(value, permissions)
}
