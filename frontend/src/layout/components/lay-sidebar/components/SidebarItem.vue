<script setup lang="ts">
import { ref, toRaw } from 'vue'
import { useNav } from '@/layout/hooks/useNav'
import { resolvePath } from '@/router/utils'
import type { menuType } from '@/layout/types'

const props = withDefaults(
  defineProps<{ item: menuType; isNest?: boolean; basePath?: string }>(),
  { isNest: false, basePath: '' },
)

const { isCollapse } = useNav()

/** 递归渲染菜单时，记录当前唯一可展示的子节点 */
const onlyOneChild = ref<menuType | null>(null)

function hasOneShowingChild(children: menuType[] = [], parent: menuType): boolean {
  const showingChildren = children.filter((item) => {
    onlyOneChild.value = item
    return true
  })

  // 父级强制显示为目录
  if (showingChildren[0]?.meta?.showParent) return false
  if (showingChildren.length === 1) return true
  if (showingChildren.length === 0) {
    onlyOneChild.value = { ...parent, path: '', noShowingChildren: true }
    return true
  }
  return false
}

function getPath(routePath: string): string {
  return resolvePath(props.basePath, routePath)
}

function iconOf(item?: menuType | null) {
  return item?.meta?.icon ? toRaw(item.meta.icon) : null
}

function titleOf(item?: menuType | null): string {
  return item?.meta?.title ?? ''
}
</script>

<template>
  <el-menu-item
    v-if="
      hasOneShowingChild(item.children, item) &&
      (!onlyOneChild?.children || onlyOneChild?.noShowingChildren)
    "
    :index="getPath(onlyOneChild?.path || item.path || '')"
    :class="{ 'submenu-title-noDropdown': !isNest }"
  >
    <el-icon v-if="iconOf(item)" class="sub-menu-icon">
      <component :is="iconOf(item)" />
    </el-icon>
    <template #title>
      <span>{{ titleOf(onlyOneChild) || titleOf(item) }}</span>
    </template>
  </el-menu-item>

  <el-sub-menu v-else :index="getPath(item.path || '')" teleported>
    <template #title>
      <el-icon v-if="iconOf(item)" class="sub-menu-icon">
        <component :is="iconOf(item)" />
      </el-icon>
      <span v-if="!isCollapse">{{ titleOf(item) }}</span>
    </template>
    <sidebar-item
      v-for="child in item.children"
      :key="child.path"
      :is-nest="true"
      :item="child"
      :base-path="getPath(child.path || '')"
    />
  </el-sub-menu>
</template>
