import { defineStore } from 'pinia'
import {
  type multiType,
  type positionType,
  store,
  isUrl,
  isEqual,
  isNumber,
  isBoolean,
  getConfig,
  routerArrays,
  storageLocal,
} from '../utils'
import { tagsKey } from '@/utils/storage'
import { usePermissionStoreHook } from './permission'
import type { RouteConfigs } from '@/layout/types'

export const useMultiTagsStore = defineStore('lxhub-multiTags', {
  state: () => ({
    // 存储标签页信息（路由信息）
    multiTags: (storageLocal().getItem<RouteConfigs[]>(tagsKey()) ??
      ([
        ...routerArrays,
        ...usePermissionStoreHook().flatteningRoutes.filter((v) => v?.meta?.fixedTag),
      ] as any)) as any[],
    multiTagsCache: getConfig().MultiTagsCache ?? false,
  }),
  getters: {
    getMultiTagsCache(state) {
      return state.multiTagsCache
    },
  },
  actions: {
    multiTagsCacheChange(multiTagsCache: boolean) {
      this.multiTagsCache = multiTagsCache
      if (multiTagsCache) {
        storageLocal().setItem(tagsKey(), this.multiTags)
      } else {
        storageLocal().removeItem(tagsKey())
      }
    },
    tagsCache(multiTags: any[]) {
      this.getMultiTagsCache && storageLocal().setItem(tagsKey(), multiTags)
    },
    handleTags<T>(mode: string, value?: T | multiType, position?: positionType): T {
      switch (mode) {
        case 'equal': {
          // 按 path 去重，避免固定标签与路由标签重复入列
          const list = (value as any[]) ?? []
          this.multiTags = list.filter(
            (tag, i) => list.findIndex((t) => t?.path === tag?.path) === i,
          )
          this.tagsCache(this.multiTags)
          break
        }
        case 'push':
          {
            const tagVal = value as any
            // 不添加到标签页
            if (tagVal?.meta?.hiddenTag) return undefined as T
            // 如果是外链无需添加信息到标签页
            if (isUrl(tagVal?.name)) return undefined as T
            // 如果 title 为空拒绝添加空信息到标签页
            if (tagVal?.meta?.title === undefined || tagVal?.meta?.title === '') return undefined as T
            // showLink: false 不添加到标签页
            if (isBoolean(tagVal?.meta?.showLink) && !tagVal?.meta?.showLink) return undefined as T
            const tagPath = tagVal.path
            // 空对象与 undefined 视为相同，否则 `routerArrays` 里的标签永远匹配不上
            const emptyAsUndefined = (v: unknown) =>
              v && Object.keys(v as object).length ? v : undefined
            const tagHasExits = this.multiTags.some(
              (tag) =>
                tag.path === tagPath &&
                isEqual(emptyAsUndefined(tag?.query), emptyAsUndefined(tagVal?.query)) &&
                isEqual(emptyAsUndefined(tag?.params), emptyAsUndefined(tagVal?.params)),
            )
            if (tagHasExits) return undefined as T

            // 动态路由可打开的最大数量
            const dynamicLevel = tagVal?.meta?.dynamicLevel ?? -1
            if (dynamicLevel > 0) {
              if (this.multiTags.filter((e) => e?.path === tagPath).length >= dynamicLevel) {
                // 如果当前已打开的动态路由数大于 dynamicLevel，替换第一个动态路由标签
                const index = this.multiTags.findIndex((item) => item?.path === tagPath)
                index !== -1 && this.multiTags.splice(index, 1)
              }
            }
            this.multiTags.push(value)
            this.tagsCache(this.multiTags)
            if (getConfig()?.MaxTagsLevel && isNumber(getConfig().MaxTagsLevel)) {
              if (this.multiTags.length > getConfig().MaxTagsLevel) {
                this.multiTags.splice(1, 1)
              }
            }
          }
          break
        case 'splice':
          if (!position) {
            const index = this.multiTags.findIndex((v) => v.path === value)
            if (index === -1) return undefined as T
            this.multiTags.splice(index, 1)
          } else {
            this.multiTags.splice(position?.startIndex ?? 0, position?.length ?? 1)
          }
          this.tagsCache(this.multiTags)
          return this.multiTags as T
        case 'slice':
          return this.multiTags.slice(-1) as T
      }
      return undefined as T
    },
  },
})

export function useMultiTagsStoreHook() {
  return useMultiTagsStore(store)
}
