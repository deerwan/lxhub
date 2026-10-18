import { defineStore } from 'pinia'
import {
  type cacheType,
  store,
  ascending,
  getKeyList,
  filterTree,
  constantMenus,
  filterNoPermissionTree,
  formatFlatteningRoutes,
} from '../utils'
import { useMultiTagsStoreHook } from './multiTags'

export const usePermissionStore = defineStore('lxhub-permission', {
  state: () => ({
    // 静态路由生成的菜单
    constantMenus,
    // 整体路由生成的菜单（静态 + 动态）
    wholeMenus: [] as any[],
    // 整体路由（一维数组格式）
    flatteningRoutes: [] as any[],
    // 缓存页面 keepAlive
    cachePageList: [] as string[],
  }),
  actions: {
    /** 组装整体路由生成的菜单 */
    handleWholeMenus(routes: any[] = []) {
      this.wholeMenus = filterNoPermissionTree(filterTree(ascending(this.constantMenus.concat(routes))))
      this.flatteningRoutes = formatFlatteningRoutes(this.constantMenus.concat(routes) as any)
    },
    /** 监听缓存页面是否存在于标签页，不存在则删除 */
    clearCache() {
      let cacheLength = this.cachePageList.length
      const nameList = getKeyList(useMultiTagsStoreHook().multiTags as any, 'name')
      while (cacheLength > 0) {
        nameList.findIndex((v) => v === this.cachePageList[cacheLength - 1]) === -1 &&
          this.cachePageList.splice(
            this.cachePageList.indexOf(this.cachePageList[cacheLength - 1]),
            1,
          )
        cacheLength--
      }
    },
    cacheOperate({ mode, name }: cacheType) {
      const delIndex = this.cachePageList.findIndex((v) => v === name)
      switch (mode) {
        case 'refresh':
          this.cachePageList = this.cachePageList.filter((v) => v !== name)
          this.clearCache()
          break
        case 'add':
          delIndex === -1 && this.cachePageList.push(name)
          break
        case 'delete':
          delIndex !== -1 && this.cachePageList.splice(delIndex, 1)
          this.clearCache()
          break
      }
    },
    /** 清空缓存页面（只清 keep-alive 缓存，不动菜单树） */
    clearAllCachePage() {
      this.cachePageList = []
    },
  },
})

export function usePermissionStoreHook() {
  return usePermissionStore(store)
}
