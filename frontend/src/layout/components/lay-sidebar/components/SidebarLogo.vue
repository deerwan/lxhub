<script setup lang="ts">
import { computed } from 'vue'
import { useSettingStoreHook } from '@/store/modules/settings'

const props = withDefaults(defineProps<{ collapse?: boolean }>(), { collapse: false })
const title = computed(() => useSettingStoreHook().title)
/** Logo 图片与浏览器标签页图标同一文件（public/favicon.svg） */
const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`
</script>

<template>
  <div class="sidebar-logo-container" :class="{ collapse: props.collapse }">
    <router-link to="/" class="sidebar-logo-link" title="前台首页">
      <img class="sidebar-logo-img" :src="logoUrl" alt="logo" draggable="false" />
      <span v-if="!props.collapse" class="sidebar-title">{{ title }}</span>
    </router-link>
  </div>
</template>
