<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
// null = 尚未探测到（不拦截），false = 运行环境缺 Node ≥20（禁用入口并提示原因）
const probeAvailable = ref<boolean | null>(null)
const probeTip = computed(() =>
  probeAvailable.value === false
    ? '当前运行环境未安装 Node ≥20，无法沙箱实测：容器部署需在镜像内安装 Node ≥20，或在本机安装后重试'
    : '把收录的音源脚本放进 Node 沙箱真实取歌一次（固定测试歌曲，仅测可用性）')

async function run(kind: TaskKind): Promise<void> {
  if (kind === 'probe' && probeAvailable.value === false) {
    message('当前运行环境未安装 Node ≥20，无法沙箱实测', { type: 'warning' })
    return
  }
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
    if (s.probe_capability) probeAvailable.value = s.probe_capability.available
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
        <el-tooltip :content="probeTip" :disabled="probeAvailable !== false" placement="top">
          <span>
            <el-button
              type="success"
              :icon="DataAnalysis"
              :loading="taskBusy"
              :disabled="probeAvailable === false"
              @click="run('probe')"
            >
              沙箱实测
            </el-button>
          </span>
        </el-tooltip>
        <el-button :icon="CircleClose" :loading="taskBusy" @click="cancel">取消任务</el-button>
      </div>
    </el-card>
  </div>
</template>
