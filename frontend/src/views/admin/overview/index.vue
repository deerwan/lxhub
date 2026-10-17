<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CircleClose, DataAnalysis, Refresh, Search } from '@element-plus/icons-vue'
import { cancelTask, fetchStatus, startTask, type TaskKind } from '@/api/status'
import { useProgress } from '@/composables/useProgress'
import { useStats } from '@/composables/useStats'
import { message } from '@/utils/message'
import StatsOverview from '@/components/StatsOverview.vue'
import TaskProgress from '@/components/TaskProgress.vue'

defineOptions({ name: 'AdminOverview' })

const { stats, loadStats } = useStats()
const { view, start } = useProgress(() => void loadStats())
const taskBusy = ref(false)

async function run(kind: TaskKind): Promise<void> {
  taskBusy.value = true
  const r = await startTask(kind)
  if (r === 'busy') message('已有任务在进行中', { type: 'warning' })
  else if (r === 'failed') message('触发失败（服务未运行?）', { type: 'error' })
  else message(kind === 'probe' ? '实测已开始' : '任务已开始', { type: 'success' })
  await start()
  taskBusy.value = false
}

async function cancel(): Promise<void> {
  taskBusy.value = true
  const ok = await cancelTask()
  message(ok ? '已请求取消任务' : '当前没有进行中的任务', { type: ok ? 'success' : 'warning' })
  await start()
  taskBusy.value = false
}

onMounted(async () => {
  void loadStats()
  try {
    const s = await fetchStatus()
    if (s.busy) await start()
  } catch {
    return
  }
})
</script>

<template>
  <div>
    <TaskProgress :view="view" />
    <StatsOverview v-bind="stats" />
    <el-card shadow="never">
      <template #header>操作</template>
      <div class="admin-actions">
        <el-button type="primary" :icon="Search" :loading="taskBusy" @click="run('crawl')">
          立即爬取
        </el-button>
        <el-button :icon="Refresh" :loading="taskBusy" @click="run('check')">重新检测</el-button>
        <el-button type="success" :icon="DataAnalysis" :loading="taskBusy" @click="run('probe')">
          沙箱实测
        </el-button>
        <el-button :icon="CircleClose" :loading="taskBusy" @click="cancel">取消任务</el-button>
      </div>
    </el-card>
  </div>
</template>
