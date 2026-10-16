<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { emitter } from '@/utils/mitt'
import { useNav } from '@/layout/hooks/useNav'
import { useLayout } from '@/layout/hooks/useLayout'
import { usePermissionStoreHook } from '@/store/modules/permission'
import SidebarLogo from './components/SidebarLogo.vue'
import SidebarItem from './components/SidebarItem.vue'
import SidebarLeftCollapse from './components/SidebarLeftCollapse.vue'
import SidebarCenterCollapse from './components/SidebarCenterCollapse.vue'

defineOptions({ name: 'LaySidebar' })

const route = useRoute()
const { isCollapse, device, tooltipEffect, pureApp, toggleSideBar } = useNav()
const { showLogo } = useLayout()
const showLogoState = ref(showLogo.value)
/** 鼠标是否悬浮在侧边栏上（用于显示居中折叠按钮） */
const isShow = ref(false)

const menuData = computed(() => usePermissionStoreHook().wholeMenus)
const loading = computed(() => menuData.value.length === 0)
const defaultActive = computed(() => (route.meta?.activePath as string) || route.path)

onMounted(() => {
  emitter.on('logoChange', (key) => {
    showLogoState.value = key
  })
})

onBeforeUnmount(() => {
  // 解绑公共事件，防止多次触发
  emitter.off('logoChange')
})
</script>

<template>
  <div
    v-loading="loading"
    class="sidebar-container"
    :class="{ 'has-logo': showLogoState }"
    @mouseenter.prevent="isShow = true"
    @mouseleave.prevent="isShow = false"
  >
    <SidebarLogo v-if="showLogoState" :collapse="isCollapse" />
    <el-scrollbar wrap-class="scrollbar-wrapper" :class="[device === 'mobile' ? 'mobile' : 'pc']">
      <el-menu
        router
        unique-opened
        mode="vertical"
        popper-class="pure-scrollbar"
        class="outer-most select-none"
        :collapse="isCollapse"
        :collapse-transition="false"
        :popper-effect="tooltipEffect"
        :default-active="defaultActive"
      >
        <SidebarItem
          v-for="item in menuData"
          :key="item.path"
          :item="item"
          :base-path="item.path"
          class="outer-most select-none"
        />
      </el-menu>
    </el-scrollbar>

    <SidebarLeftCollapse
      v-if="device !== 'mobile'"
      :is-active="pureApp.sidebar.opened"
      @toggle-click="toggleSideBar"
    />
    <SidebarCenterCollapse
      v-if="device !== 'mobile' && isShow"
      :is-active="pureApp.sidebar.opened"
      @toggle-click="toggleSideBar"
    />
  </div>
</template>
