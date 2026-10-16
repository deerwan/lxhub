import { useTimeoutFn } from '@vueuse/core'
import { createWebHashHistory, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { isProxy, toRaw } from 'vue'
import type { RouterHistory } from 'vue-router'
import {
  cloneDeep,
  intersection,
  isAllEmpty,
  isIncludeAllChildren,
  isString,
  storageLocal,
} from '@pureadmin/utils'
import { buildHierarchyTree } from '@/utils/tree'
import { type DataInfo, userKey } from '@/utils/auth'
import { type menuType } from '@/layout/types'
import { type RouteConfigs } from '@/layout/types'
import { router } from './index'
import { useMultiTagsStoreHook } from '@/store/modules/multiTags'
import { usePermissionStoreHook } from '@/store/modules/permission'

type ToRouteType = { name?: string | symbol | null }

function handRank(routeInfo: any) {
  const { name, path, parentId, meta } = routeInfo
  return isAllEmpty(parentId)
    ? isAllEmpty(meta?.rank) || (meta?.rank === 0 && name !== 'Home' && path !== '/')
      ? true
      : false
    : false
}

/** 按照路由中 meta 下的 rank 等级升序来排序路由 */
function ascending(arr: any[]) {
  arr.forEach((v, index) => {
    // 当 rank 不存在时，根据顺序自动创建，首页路由永远在第一位
    if (handRank(v)) v.meta.rank = index + 2
  })
  return arr.sort((a: { meta: { rank: number } }, b: { meta: { rank: number } }) => {
    return a?.meta.rank - b?.meta.rank
  })
}

/** 过滤 meta 中 showLink 为 false 的菜单 */
function filterTree(data: any[]) {
  const newTree = cloneDeep(data).filter((v: any) => v.meta?.showLink !== false)
  newTree.forEach((v: any) => v.children && (v.children = filterTree(v.children)))
  return newTree
}

/** 过滤 children 长度为 0 的目录 */
function filterChildrenTree(data: any[]) {
  const newTree = cloneDeep(data).filter((v: any) => v?.children?.length !== 0)
  newTree.forEach((v: any) => v.children && (v.children = filterTree(v.children)))
  return newTree
}

/** 判断两个数组彼此是否存在相同值 */
function isOneOfArray(a: Array<string>, b: Array<string>) {
  return Array.isArray(a) && Array.isArray(b)
    ? intersection(a, b).length > 0
      ? true
      : false
    : true
}

/** 从本地存储里取出当前登录用户的 roles，过滤无权限的菜单 */
function filterNoPermissionTree(data: any[]) {
  const currentRoles = storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? []
  const newTree = cloneDeep(data).filter((v: any) => isOneOfArray(v.meta?.roles, currentRoles))
  newTree.forEach((v: any) => v.children && (v.children = filterNoPermissionTree(v.children)))
  return filterChildrenTree(newTree)
}

/** 通过指定 `key` 获取父级路径集合，默认 `key` 为 `path` */
function getParentPaths(value: string, routes: any[], key = 'path'): string[] {
  function dfs(routes: any[], value: string, parents: string[]): string[] {
    for (let i = 0; i < routes.length; i++) {
      const item = routes[i]
      // 返回父级 path
      if ((item as Record<string, unknown>)[key] === value) return parents
      // children 不存在或为空则不递归
      if (!item.children || !item.children.length) continue
      // 往下查找时将当前 path 入栈
      parents.push(item.path)
      if (dfs(item.children, value, parents).length) return parents
      // 深度遍历查找未找到时当前 path 出栈
      parents.pop()
    }
    return []
  }
  return dfs(routes, value, [])
}

/** 查找对应 `path` 的路由信息 */
function findRouteByPath(path: string, routes: any[]): any {
  const res = routes.find((item: any) => item.path == path)
  if (res) {
    return isProxy(res) ? toRaw(res) : res
  }
  for (let i = 0; i < routes.length; i++) {
    const children = routes[i]?.children
    if (children instanceof Array && children.length > 0) {
      const found = findRouteByPath(path, children)
      if (found) {
        return isProxy(found) ? toRaw(found) : found
      }
    }
  }
  return null
}

/** 通过 `path` 找到父级菜单（面包屑用） */
function findParentPaths(path: string, menus: any[] = usePermissionStoreHook().wholeMenus): string[] {
  return [...getParentPaths(path, menus), path]
}

/** 动态路由注册完成后，再添加全屏 404 页面，避免刷新时误跳转 */
function addPathMatch() {
  if (!router.hasRoute('PageNotFound')) {
    router.addRoute({
      path: '/:pathMatch(.*)*',
      name: 'PageNotFound',
      component: () => import('@/views/error/404.vue'),
      meta: {
        title: '页面不存在',
        showLink: false,
      },
    } as RouteRecordRaw)
  }
}

/**
 * 将多级嵌套路由处理成一维数组
 */
function formatFlatteningRoutes(routesList: any[]) {
  if (routesList.length === 0) return routesList
  let hierarchyList = buildHierarchyTree(routesList)
  for (let i = 0; i < hierarchyList.length; i++) {
    if (hierarchyList[i].children) {
      hierarchyList = hierarchyList
        .slice(0, i + 1)
        .concat(hierarchyList[i].children, hierarchyList.slice(i + 1))
    }
  }
  return hierarchyList
}

/** 处理缓存路由（添加、删除、刷新） */
function handleAliveRoute({ name }: ToRouteType, mode?: string) {
  switch (mode) {
    case 'add':
      usePermissionStoreHook().cacheOperate({ mode: 'add', name: String(name) })
      break
    case 'delete':
      usePermissionStoreHook().cacheOperate({ mode: 'delete', name: String(name) })
      break
    case 'refresh':
      usePermissionStoreHook().cacheOperate({ mode: 'refresh', name: String(name) })
      break
    default:
      usePermissionStoreHook().cacheOperate({ mode: 'delete', name: String(name) })
      useTimeoutFn(() => {
        usePermissionStoreHook().cacheOperate({ mode: 'add', name: String(name) })
      }, 100)
  }
}

/** 获取路由历史模式 */
function getHistoryMode(routerHistory?: string): RouterHistory {
  const historyMode = (routerHistory ?? 'h5').split(',')
  const leftMode = historyMode[0]
  const rightMode = historyMode[1]
  // no param
  if (historyMode.length === 1) {
    if (leftMode === 'hash') {
      return createWebHashHistory('')
    } else if (leftMode === 'h5') {
      return createWebHistory('')
    }
  } // has param
  else if (historyMode.length === 2) {
    if (leftMode === 'hash') {
      return createWebHashHistory(rightMode)
    } else if (leftMode === 'h5') {
      return createWebHistory(rightMode)
    }
  }
  return createWebHistory('')
}

/** 获取当前页面按钮级别的权限 */
function getAuths(): Array<string> {
  return (router.currentRoute.value.meta.auths as Array<string>) ?? []
}

/** 是否有按钮级别的权限（根据路由 `meta` 中的 `auths` 字段判断） */
function hasAuth(value: string | Array<string>): boolean {
  if (!value) return false
  const metaAuths = getAuths()
  if (!metaAuths) return false
  const isAuths = isString(value)
    ? metaAuths.includes(value)
    : isIncludeAllChildren(value, metaAuths)
  return isAuths ? true : false
}

function handleTopMenu(route: any) {
  if (route?.children && route.children.length > 1) {
    if (route.redirect) {
      return route.children.filter((cur: any) => cur.path === route.redirect)[0]
    } else {
      return route.children[0]
    }
  } else {
    return route
  }
}

/** 获取所有菜单中的第一个菜单（顶级菜单），用于登录后跳转 */
function getTopMenu(tag = false): menuType {
  const menus = usePermissionStoreHook().wholeMenus
  const topMenu = handleTopMenu(menus[0]?.children?.length ? menus[0].children[0] : menus[0])
  tag && useMultiTagsStoreHook().handleTags('push', topMenu as RouteConfigs)
  return topMenu
}

/** 侧边栏子菜单路径解析：支持外链与绝对路径 */
function resolvePath(basePath: string, routePath: string): string {
  const httpReg = /^http(s?):\/\//
  if (httpReg.test(routePath) || httpReg.test(basePath)) {
    return routePath || basePath
  }
  if (routePath.startsWith('/')) return routePath
  return `${basePath.replace(/\/$/, '')}/${routePath}`
}

export {
  hasAuth,
  getAuths,
  ascending,
  filterTree,
  getTopMenu,
  resolvePath,
  addPathMatch,
  isOneOfArray,
  getHistoryMode,
  getParentPaths,
  findRouteByPath,
  findParentPaths,
  handleAliveRoute,
  formatFlatteningRoutes,
  filterNoPermissionTree,
}
