import { defineStore } from 'pinia'
import { type userType, store, routerArrays } from '../utils'
import { type DataInfo, removeToken, setToken, userKey } from '@/utils/auth'
import { storageLocal } from '@/utils/storage'
import { login as loginApi, logout as logoutApi } from '@/api/auth'
import { useMultiTagsStoreHook } from './multiTags'
import { usePermissionStoreHook } from './permission'

export const useUserStore = defineStore('lxhub-user', {
  state: (): userType => ({
    username: storageLocal().getItem<DataInfo<number>>(userKey)?.username ?? '',
    nickname: '',
    roles: storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? [],
    permissions: storageLocal().getItem<DataInfo<number>>(userKey)?.permissions ?? [],
    isRemembered: false,
    loginDay: 7,
  }),
  actions: {
    SET_USERNAME(username: string) {
      this.username = username
    },
    SET_NICKNAME(nickname: string) {
      this.nickname = nickname
    },
    SET_ROLES(roles: Array<string>) {
      this.roles = roles
    },
    SET_PERMS(permissions: Array<string>) {
      this.permissions = permissions
    },
    SET_ISREMEMBERED(bool: boolean) {
      this.isRemembered = bool
    },
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value)
    },
    /** 登入 */
    async loginByUsername(data: { username: string; password: string }) {
      const res = await loginApi(data.username, data.password)
      setToken({
        username: data.username,
        accessToken: res.token,
        expires: Date.now() + Math.max(res.expires_in ?? 0, 60) * 1000,
        roles: ['admin'],
        permissions: ['*:*:*'],
      })
      this.SET_USERNAME(data.username)
      this.SET_ROLES(['admin'])
      this.SET_PERMS(['*:*:*'])
      return res
    },
    /** 登出（前端清理） */
    logOut() {
      this.username = ''
      this.nickname = ''
      this.roles = []
      this.permissions = []
      removeToken()
      useMultiTagsStoreHook().handleTags('equal', [...routerArrays])
      usePermissionStoreHook().clearAllCachePage()
      void logoutApi()
    },
  },
})

export function useUserStoreHook() {
  return useUserStore(store)
}
