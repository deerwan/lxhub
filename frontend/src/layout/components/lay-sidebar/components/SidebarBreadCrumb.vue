<script setup lang="ts">
import { onMounted, ref, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isEqual } from '@pureadmin/utils'
import { findRouteByPath, getParentPaths } from '@/router/utils'
import { useMultiTagsStoreHook } from '@/store/modules/multiTags'

/**
 * 顶栏面包屑，逻辑对齐 `vue-pure-admin` 的 `SidebarBreadCrumb`：
 * 优先按 `query` / `params` 命中标签页，否则按 path 查路由，再逐级向上取父级。
 */
defineOptions({ name: 'SidebarBreadCrumb' })

const route = useRoute()
const router = useRouter()
const routes = router.options.routes as any[]
const levelList = ref<any[]>([])

function getBreadcrumb(): void {
  const multiTags = useMultiTagsStoreHook().multiTags as any[]
  let currentRoute: any

  if (Object.keys(route.query).length > 0) {
    multiTags.forEach((item) => {
      if (isEqual(route.query, item?.query)) currentRoute = toRaw(item)
    })
  } else if (Object.keys(route.params).length > 0) {
    multiTags.forEach((item) => {
      if (isEqual(route.params, item?.params)) currentRoute = toRaw(item)
    })
  } else {
    currentRoute = findRouteByPath(router.currentRoute.value.path, routes)
  }

  // 当前路由的父级路径组成的数组
  const parentRoutes = getParentPaths(router.currentRoute.value.name as string, routes, 'name')
  const matched: any[] = []

  parentRoutes.forEach((path) => {
    if (path !== '/') matched.push(findRouteByPath(path, routes))
  })
  matched.push(currentRoute)

  // 父级与子级标题相同的（目录只有一个可见子项）只保留一个
  matched.forEach((item, index) => {
    if (currentRoute?.query || currentRoute?.params) return
    if (item?.children) {
      item.children.forEach((v: any) => {
        if (v?.meta?.title === item?.meta?.title) matched.splice(index, 1)
      })
    }
  })

  levelList.value = matched.filter((item) => item?.meta && item?.meta.title !== false)
}

function handleLink(item: any): void {
  const { redirect, name, path } = item
  if (redirect) {
    router.push(redirect as string)
  } else if (name) {
    if (item.query) router.push({ name, query: item.query })
    else if (item.params) router.push({ name, params: item.params })
    else router.push({ name })
  } else {
    router.push({ path })
  }
}

onMounted(getBreadcrumb)

watch(
  () => route.path,
  () => getBreadcrumb(),
)
</script>

<template>
  <el-breadcrumb class="breadcrumb-container" separator="/">
    <transition-group name="breadcrumb">
      <el-breadcrumb-item v-for="item in levelList" :key="item.path">
        <a @click.prevent="handleLink(item)">{{ item.meta.title }}</a>
      </el-breadcrumb-item>
    </transition-group>
  </el-breadcrumb>
</template>
