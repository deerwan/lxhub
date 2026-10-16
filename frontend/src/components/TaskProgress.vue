<script setup lang="ts">
import type { ProgressView } from '@/composables/useProgress'

defineProps<{ view: ProgressView }>()
</script>

<template>
  <el-card v-if="view.running" shadow="never">
    <template #header>任务进度</template>
    <div class="prog-head">
      <b>{{ view.title }}</b>
      <span class="muted">{{ view.msg }}</span>
      <span class="muted">{{ view.elapsed }}</span>
    </div>
    <el-progress
      :percentage="view.pct"
      :indeterminate="view.indet"
      :show-text="!view.indet"
      style="margin: 10px 0 8px"
    />
    <div class="muted">{{ view.statsText }}</div>
    <pre v-if="view.logs" class="prog-logs">{{ view.logs }}</pre>
  </el-card>
</template>
