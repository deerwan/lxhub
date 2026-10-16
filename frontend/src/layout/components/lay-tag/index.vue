<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Close, Refresh } from '@element-plus/icons-vue'
import { useTags } from '@/layout/hooks/useTag'
import type { RouteConfigs } from '@/layout/types'

defineOptions({ name: 'LayTag' })

const route = useRoute()
const router = useRouter()
const { multiTags, isFixed, tagTitle, onMounted: initTags, closeTag, closeOthers, closeAll, refreshSelected } =
  useTags()

onMounted(initTags)

function go(tag: RouteConfigs): void {
  if (!tag?.path || tag.path === route.path) return
  router.push(tag.path)
}

function onCommand(command: string): void {
  if (command === 'refresh') refreshSelected()
  if (command === 'others') closeOthers()
  if (command === 'all') closeAll()
}
</script>

<template>
  <div class="tags-view">
    <div
      v-for="tag in multiTags"
      :key="tag.path"
      class="tags-view-item"
      :class="{ 'is-active': tag.path === route.path }"
      @click="go(tag)"
    >
      <span class="tags-view-title">{{ tagTitle(tag) }}</span>
      <el-icon v-if="!isFixed(tag)" class="tags-view-close" @click.stop="closeTag(tag)">
        <Close />
      </el-icon>
    </div>

    <el-dropdown trigger="click" class="tags-view-ops" @command="onCommand">
      <span class="tags-view-ops-btn">
        <el-icon><ArrowDown /></el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="refresh">
            <el-icon><Refresh /></el-icon>
            刷新当前
          </el-dropdown-item>
          <el-dropdown-item command="others">关闭其他</el-dropdown-item>
          <el-dropdown-item command="all" divided>关闭全部</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>
