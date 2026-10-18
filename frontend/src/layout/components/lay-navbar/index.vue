<script setup lang="ts">
import {
  ArrowDown,
  Expand,
  Fold,
  FullScreen,
  HomeFilled,
  Moon,
  Refresh,
  Setting,
  Sunny,
  UserFilled,
} from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useNav } from '@/layout/hooks/useNav'
import { useDataThemeChange } from '@/layout/hooks/useDataThemeChange'
import { useSettingStoreHook } from '@/store/modules/settings'
import SidebarBreadCrumb from '@/layout/components/lay-sidebar/components/SidebarBreadCrumb.vue'

defineOptions({ name: 'LayNavbar' })

const {
  device,
  username,
  isCollapse,
  isFullscreen,
  toggle,
  toggleSideBar,
  logout,
  toHome,
  onPanel,
  refresh,
} = useNav()
const { toggleDark } = useDataThemeChange()
const darkMode = computed(() => useSettingStoreHook().darkMode)

function onCommand(command: string): void {
  if (command === 'home') toHome()
  if (command === 'logout') logout()
}
</script>

<template>
  <div class="navbar">
    <!-- 桌面端折叠入口在侧边栏左下角，顶栏只在移动端保留（此时侧边栏为抽屉，需要拉出口） -->
    <div v-if="device === 'mobile'" class="hamburger-container" @click="toggleSideBar">
      <el-icon :size="20">
        <component :is="isCollapse ? Expand : Fold" />
      </el-icon>
    </div>

    <!-- 移动端不渲染面包屑，避免窄屏挤压换行 -->
    <SidebarBreadCrumb v-if="device !== 'mobile'" />

    <div class="navbar-right">
      <el-tooltip content="刷新" placement="bottom">
        <el-icon class="navbar-icon" :size="18" @click="refresh"><Refresh /></el-icon>
      </el-tooltip>
      <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏'" placement="bottom">
        <el-icon class="navbar-icon" :size="18" @click="toggle()"><FullScreen /></el-icon>
      </el-tooltip>
      <el-tooltip content="前台首页" placement="bottom">
        <el-icon class="navbar-icon" :size="18" @click="toHome"><HomeFilled /></el-icon>
      </el-tooltip>
      <el-tooltip :content="darkMode ? '切换亮色' : '切换暗色'" placement="bottom">
        <el-icon class="navbar-icon" :size="18" @click="toggleDark()">
          <component :is="darkMode ? Sunny : Moon" />
        </el-icon>
      </el-tooltip>
      <el-tooltip content="系统设置" placement="bottom">
        <el-icon class="navbar-icon" :size="18" @click="onPanel"><Setting /></el-icon>
      </el-tooltip>

      <el-dropdown trigger="click" @command="onCommand">
        <span class="navbar-user">
          <el-icon><UserFilled /></el-icon>
          <span class="navbar-username">{{ username }}</span>
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="home">前台首页</el-dropdown-item>
            <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>
