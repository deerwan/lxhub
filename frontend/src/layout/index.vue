<script setup lang="ts">
import { computed, onBeforeMount, onMounted, reactive, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { deviceDetection } from '@pureadmin/utils'
import { useNav } from './hooks/useNav'
import { useLayout } from './hooks/useLayout'
import { useDataThemeChange } from './hooks/useDataThemeChange'
import { useAppStoreHook } from '@/store/modules/app'
import { useSettingStoreHook } from '@/store/modules/settings'
import LayNavbar from './components/lay-navbar/index.vue'
import LayContent from './components/lay-content/index.vue'
import LayTag from './components/lay-tag/index.vue'
import LaySetting from './components/lay-setting/index.vue'
import NavVertical from './components/lay-sidebar/index.vue'

defineOptions({ name: 'LayLayout' })

const appWrapperRef = ref()
const { device, pureApp, toggleSideBar } = useNav()
const { hideTabs, grey, weak, initStorageDefault } = useLayout()
const { dataThemeChange, toggleClass } = useDataThemeChange()
const setting = useSettingStoreHook()
const isMobile = deviceDetection()

const set = reactive({
  sidebar: computed(() => pureApp.sidebar),
  device: computed(() => device.value),
  fixedHeader: computed(() => setting.fixedHeader),
  classes: computed(() => ({
    hideSidebar: !pureApp.sidebar.opened,
    openSidebar: pureApp.sidebar.opened,
    withoutAnimation: pureApp.sidebar.withoutAnimation,
    mobile: device.value === 'mobile',
  })),
  hideTabs: computed(() => hideTabs.value),
})

function toggle(device: string, bool: boolean): void {
  useAppStoreHook().toggleDevice(device)
  useAppStoreHook().toggleSideBar(bool, 'resize')
}

/** 判断是否可自动关闭菜单栏 */
let isAutoCloseSidebar = true

useResizeObserver(appWrapperRef, (entries) => {
  if (isMobile) return
  const entry = entries[0]
  const size = entry?.borderBoxSize?.[0]
  const width = size ? size.inlineSize : entry.contentRect.width
  const height = size ? size.blockSize : entry.contentRect.height
  useAppStoreHook().setViewportSize({ width, height })
  /** width 为 app-wrapper 容器宽度
   * 0 < width <= 760 隐藏侧边栏
   * 760 < width <= 990 折叠侧边栏
   * width > 990 展开侧边栏
   */
  if (width > 0 && width <= 760) {
    toggle('mobile', false)
    isAutoCloseSidebar = true
  } else if (width > 760 && width <= 990) {
    if (isAutoCloseSidebar) {
      toggle('desktop', false)
      isAutoCloseSidebar = false
    }
  } else if (width > 990 && !useAppStoreHook().sidebar.isClickCollapse) {
    toggle('desktop', true)
    isAutoCloseSidebar = true
  } else {
    toggle('desktop', false)
    isAutoCloseSidebar = false
  }
})

watch(
  [grey, weak],
  ([g, w]) => {
    const html = document.querySelector('html') as HTMLElement
    toggleClass(g, 'html-grey', html)
    toggleClass(w, 'html-weakness', html)
  },
  { immediate: true },
)

onMounted(() => {
  if (isMobile) {
    toggle('mobile', false)
  }
})

/**
 * 把导航模式写到 `body[layout]`：
 * 侧边栏宽度等样式由 `body[layout="vertical"]` 决定，便于后续扩展横向 / 混合布局
 */
watch(
  () => pureApp.layout,
  (layout) => document.body.setAttribute('layout', layout || 'vertical'),
  { immediate: true },
)

onBeforeMount(() => {
  initStorageDefault()
  dataThemeChange(setting.overallStyle)
})
</script>

<template>
  <div ref="appWrapperRef" :class="['app-wrapper', set.classes]">
    <div
      v-show="set.device === 'mobile' && set.sidebar.opened"
      class="app-mask"
      @click="toggleSideBar"
    />
    <NavVertical v-show="!setting.hiddenSideBar" />
    <div class="main-container" :class="{ 'main-hidden': setting.hiddenSideBar }">
      <div class="fixed-header">
        <LayNavbar />
        <LayTag v-if="!set.hideTabs" />
      </div>
      <LayContent :fixed-header="set.fixedHeader" />
    </div>
    <LaySetting />
  </div>
</template>
