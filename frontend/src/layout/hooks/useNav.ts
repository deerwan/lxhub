import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFullscreen } from '@vueuse/core'
import { isAllEmpty } from '@pureadmin/utils'
import { getConfig } from '@/config'
import { emitter } from '@/utils/mitt'
import { handleAliveRoute } from '@/router/utils'
import { useAppStoreHook } from '@/store/modules/app'
import { useUserStoreHook } from '@/store/modules/user'
import { useSettingStoreHook } from '@/store/modules/settings'
import { usePermissionStoreHook } from '@/store/modules/permission'

export function useNav() {
  const route = useRoute()
  const router = useRouter()
  const pureApp = useAppStoreHook()
  const { isFullscreen, toggle } = useFullscreen()

  /** 平台内所有 `el-tooltip` 的 `effect` 配置 */
  const tooltipEffect = getConfig()?.TooltipEffect ?? 'light'

  const username = computed(() => useUserStoreHook()?.username || '管理员')
  const title = computed(() => useSettingStoreHook().title)
  const isCollapse = computed(() => !pureApp.getSidebarStatus)
  const device = computed(() => pureApp.getDevice)

  function toggleSideBar(): void {
    pureApp.toggleSideBar()
  }

  function logout(): void {
    useUserStoreHook().logOut()
    router.replace('/login')
  }

  /** 回到前台聚合页 */
  function toHome(): void {
    router.push('/')
  }

  function onPanel(): void {
    emitter.emit('openPanel', true)
  }

  /** 刷新当前页：先清缓存再经 `/redirect` 中转重新挂载 */
  function refresh(): void {
    handleAliveRoute(route, 'refresh')
    router.replace({ path: `/redirect${route.fullPath}`, query: route.query })
  }

  /** 关闭当前页并跳转到最后一个标签 */
  function closeCurrent(): void {
    usePermissionStoreHook().cacheOperate({ mode: 'delete', name: String(route.name) })
    router.back()
  }

  return {
    route,
    router,
    title,
    device,
    username,
    isCollapse,
    pureApp,
    isFullscreen,
    toggle,
    isAllEmpty,
    toggleSideBar,
    logout,
    toHome,
    onPanel,
    refresh,
    closeCurrent,
    tooltipEffect,
  }
}
