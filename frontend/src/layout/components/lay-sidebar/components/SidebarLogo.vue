<script setup lang="ts">
import { computed } from 'vue'
import { useSettingStoreHook } from '@/store/modules/settings'

const props = withDefaults(defineProps<{ collapse?: boolean }>(), { collapse: false })
const title = computed(() => useSettingStoreHook().title)
const short = computed(() => (title.value || 'LX').slice(0, 2))
</script>

<template>
  <div class="sidebar-logo-container" :class="{ collapse: props.collapse }">
    <router-link to="/" class="sidebar-logo-link" title="前台首页">
      <span v-if="props.collapse" class="sidebar-logo-sm">{{ short }}</span>
      <span v-else class="sidebar-title">{{ title }}</span>
    </router-link>
  </div>
</template>
