<script setup lang="ts">
withDefaults(
  defineProps<{
    total?: string
    alive?: string
    valid?: string
    lastCrawl?: string
    lastCrawlFull?: string
  }>(),
  { total: '—', alive: '—', valid: '—', lastCrawl: '—', lastCrawlFull: '' },
)
</script>

<template>
  <el-card shadow="never">
    <template #header>概览</template>
    <div class="stat-row">
      <div class="stat-box">
        <b>{{ total }}</b>
        <span>收录链接</span>
      </div>
      <div class="stat-box">
        <b>{{ alive }}</b>
        <span>当前可访问</span>
      </div>
      <div class="stat-box">
        <b>{{ valid }}</b>
        <span>疑似音源脚本</span>
      </div>
      <div class="stat-box" :title="lastCrawlFull">
        <b>{{ lastCrawl }}</b>
        <span>最近爬取</span>
      </div>
    </div>
  </el-card>
</template>
