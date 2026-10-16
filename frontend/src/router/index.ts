import { createRouter } from 'vue-router'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { cloneDeep } from '@pureadmin/utils'
import NProgress from '@/utils/progress'
import { getConfig } from '@/config'
import { getToken } from '@/utils/auth'
import { buildHierarchyTree } from '@/utils/tree'
import { routerArrays, type RouteConfigs, type routeMetaType } from '@/layout/types'
import homeRouter from './modules/home'
import adminRouter from './modules/admin'
import remainingRouter from './modules/remaining'
import { addPathMatch, ascending, getHistoryMode, handleAliveRoute, isOneOfArray } from './utils'
import { useMultiTagsStoreHook } from '@/store/modules/multiTags'
import { usePermissionStoreHook } from '@/store/modules/permission'

/** 静态路由（含后台、前台与 remaining） */
const initConstantRoutes = [
  homeRouter,
  adminRouter,
  ...remainingRouter,
] as unknown as RouteRecordRaw[]

/** 菜单来源：后台路由的 children（保持原始层级） */
export const constantMenus = buildHierarchyTree(ascending(cloneDeep(adminRouter.children ?? [])))

/** 不参与菜单渲染的路径集合 */
function flattenPaths(list: RouteConfigs[]): string[] {
  return list.flatMap((r) =>
    r.children?.length ? [r.path ?? '', ...flattenPaths(r.children)] : [r.path ?? ''],
  )
}
export const remainingPaths = flattenPaths(remainingRouter).filter(Boolean)

const router = createRouter({
  history: getHistoryMode(import.meta.env.VITE_ROUTER_HISTORY),
  routes: initConstantRoutes,
  strict: true,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

// 全屏 404 放在最后注册，避免刷新已有路由时误判为未匹配
addPathMatch()

export function resetRouter(): void {
  router.removeRoute('Admin')
  router.addRoute(adminRouter as unknown as RouteRecordRaw)
  addPathMatch()
}

/** 已加载过的路径，用于避免重复触发顶部进度条 */
const loadedPaths = new Set<string>()

/** 只有后台需要登录态，前台聚合页保持公开 */
const needAuth = (path: string): boolean => path === '/admin' || path.startsWith('/admin/')

/** 标签页只保存可序列化的字段，避免缓存时循环引用 */
function pickTag(to: RouteLocationNormalized): RouteConfigs {
  return {
    path: to.path,
    name: to.name as string,
    meta: to.meta as routeMetaType,
    query: to.query,
    params: to.params,
  }
}

/** 首次进入后台时组装菜单与固定标签页 */
function initMenus(): void {
  const permission = usePermissionStoreHook()
  if (permission.wholeMenus.length) return
  permission.handleWholeMenus([])
  useMultiTagsStoreHook().handleTags('equal', [
    ...routerArrays,
    ...permission.flatteningRoutes.filter((v) => v?.meta?.fixedTag),
  ])
}

router.beforeEach((to) => {
  if (!loadedPaths.has(to.path)) NProgress.start()

  const title = getConfig().Title ?? 'LX 音源'
  document.title = to.meta?.title ? `${to.meta.title} | ${title}` : title

  if (to.meta?.keepAlive && to.name) handleAliveRoute(to, 'add')

  const info = getToken()

  if (info.accessToken) {
    // 已登录不允许再回到登录页
    if (to.path === '/login') return { path: '/admin/overview' }
    // 页面级别权限
    const roles = to.meta?.roles as string[] | undefined
    if (roles && !isOneOfArray(roles, info.roles ?? [])) return { path: '/error/403' }
    if (needAuth(to.path)) {
      initMenus()
      useMultiTagsStoreHook().handleTags('push', pickTag(to))
    }
    return true
  }

  if (!needAuth(to.path)) return true

  return {
    path: '/login',
    query: to.fullPath && to.fullPath !== '/admin' ? { redirect: to.fullPath } : {},
  }
})

router.afterEach((to) => {
  loadedPaths.add(to.path)
  NProgress.done()
})

export { router }
export default router
