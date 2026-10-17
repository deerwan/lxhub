<script setup lang="ts">
import ConfigForm from '@/components/ConfigForm.vue'

defineOptions({ name: 'AdminConfigProbe' })
</script>

<template>
  <div>
    <el-alert
      type="warning"
      show-icon
      :closable="false"
      title="沙箱实测会把收录的音源脚本放进 Node 沙箱真实取歌一次（固定测试歌曲，仅测可用性）。原理与风险说明见 docs/probe.md；手动触发请到「概览」页点「沙箱实测」"
      style="margin-bottom: 14px"
    />
    <ConfigForm group-key="probe" />
  </div>
</template>
