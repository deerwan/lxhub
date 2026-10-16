<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { emitter } from '@/utils/mitt'
import { message } from '@/utils/message'
import { useLayout } from '@/layout/hooks/useLayout'
import { useDataThemeChange } from '@/layout/hooks/useDataThemeChange'
import { useSettingStoreHook } from '@/store/modules/settings'
import { useEpThemeStoreHook } from '@/store/modules/epTheme'
import { useUserStoreHook } from '@/store/modules/user'

defineOptions({ name: 'LaySetting' })

const visible = ref(false)
const { configure, setConfigure, initStorageDefault } = useLayout()
const { themeColors, setEpThemeColor, toggleDark, onReset } = useDataThemeChange()
const setting = useSettingStoreHook()

const epThemeColor = computed(() => useEpThemeStoreHook().epThemeColor)
const darkMode = computed(() => setting.darkMode)

const PRESET_COLORS = ['#409EFF', '#1b2a47', '#722ed1', '#eb2f96', '#f5222d', '#fa541c', '#13c2c2', '#52c41a']

onMounted(() => {
  emitter.on('openPanel', () => {
    visible.value = !visible.value
  })
})

onBeforeUnmount(() => {
  emitter.off('openPanel')
})

function onChangeColor(color: string): void {
  setEpThemeColor(color)
}

function onResetAll(): void {
  onReset()
  initStorageDefault()
  useUserStoreHook().logOut()
  message('已清空本地缓存，请重新登录', { type: 'success' })
}
</script>

<template>
  <el-drawer v-model="visible" title="系统设置" size="300px" class="lxhub-setting">
    <el-divider content-position="left">主题</el-divider>
    <div class="setting-row">
      <span>深色模式</span>
      <el-switch :model-value="darkMode" @change="toggleDark()" />
    </div>
    <div class="setting-row">
      <span>主题色</span>
      <div class="setting-colors">
        <span
          v-for="c in PRESET_COLORS"
          :key="c"
          class="setting-color"
          :class="{ active: c === epThemeColor }"
          :style="{ background: c }"
          @click="onChangeColor(c)"
        />
      </div>
    </div>

    <el-divider content-position="left">导航栏</el-divider>
    <div class="setting-row">
      <span>显示 Logo</span>
      <el-switch
        :model-value="configure.showLogo !== false"
        @change="setConfigure('showLogo', $event)"
      />
    </div>
    <div class="setting-row">
      <span>固定头部</span>
      <el-switch
        :model-value="setting.fixedHeader"
        @change="setting.changeSetting({ key: 'fixedHeader', value: $event })"
      />
    </div>
    <div class="setting-row">
      <span>隐藏侧边栏</span>
      <el-switch
        :model-value="setting.hiddenSideBar"
        @change="setting.changeSetting({ key: 'hiddenSideBar', value: $event })"
      />
    </div>

    <el-divider content-position="left">标签页</el-divider>
    <div class="setting-row">
      <span>显示标签页</span>
      <el-switch
        :model-value="!configure.hideTabs"
        @change="setConfigure('hideTabs', !$event)"
      />
    </div>
    <div class="setting-row">
      <span>持久化标签</span>
      <el-switch
        :model-value="!!configure.multiTagsCache"
        @change="setConfigure('multiTagsCache', $event)"
      />
    </div>

    <el-divider content-position="left">色觉辅助</el-divider>
    <div class="setting-row">
      <span>灰色模式</span>
      <el-switch :model-value="!!configure.grey" @change="setConfigure('grey', $event)" />
    </div>
    <div class="setting-row">
      <span>色弱模式</span>
      <el-switch :model-value="!!configure.weak" @change="setConfigure('weak', $event)" />
    </div>

    <el-divider content-position="left">其他</el-divider>
    <div class="setting-row">
      <span>主题色清单</span>
      <el-select :model-value="epThemeColor" size="small" @change="onChangeColor">
        <el-option
          v-for="c in themeColors"
          :key="c.color"
          :label="c.themeColor"
          :value="c.color"
        />
      </el-select>
    </div>
    <el-button class="setting-reset" type="danger" plain @click="onResetAll">
      清空缓存并退出登录
    </el-button>
  </el-drawer>
</template>
