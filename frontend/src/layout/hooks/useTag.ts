import { computed, ref } from 'vue'
import { type RouteLocationNormalized, useRoute, useRouter } from 'vue-router'
import { useMultiTagsStoreHook } from '@/store/modules/multiTags'
import { usePermissionStoreHook } from '@/store/modules/permission'
import { useSettingStoreHook } from '@/store/modules/settings'
import { handleAliveRoute } from '@/router/utils'
import { routerArrays, type RouteConfigs } from '@/layout/types'

type TagItem = RouteConfigs

export function useTags() {
  const route = useRoute()
  const router = useRouter()
  const visible = ref(false)
  const activeIndex = ref(-1)

  const multiTags = computed<TagItem[]>(() => useMultiTagsStoreHook().multiTags ?? [])
  const showModel = computed(() => useSettingStoreHook().configure.showModel ?? 'smart')

  /** 固定标签不可关闭（概览页） */
  const isFixed = (tag: TagItem): boolean => routerArrays.some((v) => v.path === tag?.path)

  const activeTag = computed(() => multiTags.value.find((t) => t.path === route.path))

  function tagTitle(tag: TagItem): string {
    return tag?.meta?.title ?? tag?.path ?? ''
  }

  function onMounted(): void {
    if (!multiTags.value.some((t) => t.path === route.path)) {
      useMultiTagsStoreHook().handleTags('push', {
        path: route.path,
        name: route.name as string,
        meta: route.meta,
        query: route.query,
        params: route.params,
      })
    }
  }

  function closeTag(tag: TagItem): void {
    const tags = multiTags.value
    const index = tags.findIndex((t) => t.path === tag?.path)
    if (index === -1 || isFixed(tag)) return
    usePermissionStoreHook().cacheOperate({ mode: 'delete', name: String(tag.name) })
    useMultiTagsStoreHook().handleTags('splice', tag.path)
    const next = multiTags.value[Math.min(index, multiTags.value.length - 1)]
    if (tag.path === route.path && next) router.push(next.path as string)
  }

  function closeOthers(): void {
    const keep = multiTags.value.filter((t) => t.path === route.path || isFixed(t))
    useMultiTagsStoreHook().handleTags('equal', keep)
    keep.forEach((t) => handleAliveRoute(t as unknown as RouteLocationNormalized, 'delete'))
    if (!keep.some((t) => t.path === route.path)) router.push(routerArrays[0].path as string)
  }

  function closeAll(): void {
    useMultiTagsStoreHook().handleTags('equal', [...routerArrays])
    usePermissionStoreHook().clearAllCachePage()
    // 目标恰为当前路由时 router.push 不会触发导航守卫，initMenus 的重建逻辑
    // 不会执行；这里主动重建菜单，避免侧边栏因菜单为空而一直转圈
    usePermissionStoreHook().handleWholeMenus([])
    router.push(routerArrays[0].path as string)
  }

  function refreshSelected(tag?: TagItem): void {
    const target = tag ?? activeTag.value
    if (!target) return
    handleAliveRoute(target as unknown as RouteLocationNormalized, 'refresh')
    router.replace({
      path: `/redirect${target.path}`,
      query: target.query as Record<string, string>,
    })
  }

  return {
    visible,
    activeIndex,
    multiTags,
    showModel,
    activeTag,
    isFixed,
    tagTitle,
    onMounted,
    closeTag,
    closeOthers,
    closeAll,
    refreshSelected,
  }
}
