<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Moon, Sunny, UserFilled } from '@element-plus/icons-vue'
import { exportZipUrl } from '@/api/sources'
import { useSources } from '@/composables/useSources'
import { useStats } from '@/composables/useStats'
import { useDataThemeChange } from '@/layout/hooks/useDataThemeChange'
import { useSettingStoreHook } from '@/store/modules/settings'
import { message } from '@/utils/message'
import type { Source } from '@/types'
import StatsOverview from '@/components/StatsOverview.vue'
import SourceToolbar from '@/components/SourceToolbar.vue'
import SourceTable from '@/components/SourceTable.vue'
import SourceDetail from '@/components/SourceDetail.vue'

defineOptions({ name: 'Welcome' })

const router = useRouter()
const { rows, staticMode, loading, q, statusFilter, typeFilter, load, onSortChange, openDetail } =
  useSources()
const { stats, loadStats } = useStats()
const { toggleDark } = useDataThemeChange()
const darkMode = computed(() => useSettingStoreHook().darkMode)

const dlgVisible = ref(false)
const current = ref<Source | null>(null)

const currentNo = computed(() => {
  if (!current.value) return null
  const row = rows.value.find((x) => x.id === current.value?.id)
  return row?._no ?? current.value.id
})

function onExportZip(): void {
  const list = rows.value
  if (!list.length) {
    message('当前筛选没有可导出的记录', { type: 'warning' })
    return
  }
  const a = document.createElement('a')
  a.href = exportZipUrl(list.map((s) => s.id))
  document.body.appendChild(a)
  a.click()
  a.remove()
  message(`正在打包 ${list.length} 条…`)
}

async function onOpen(id: number): Promise<void> {
  const s = await openDetail(id)
  if (!s) return
  current.value = s
  dlgVisible.value = true
}

onMounted(() => {
  void load()
  void loadStats()
})
</script>

<template>
  <div class="site">
    <header class="site-top">
      <router-link to="/" class="brand">LX 音源</router-link>
      <div class="site-actions">
        <el-tooltip :content="darkMode ? '切换亮色' : '切换暗色'" placement="bottom">
          <el-button text circle @click="toggleDark()">
            <el-icon><component :is="darkMode ? Sunny : Moon" /></el-icon>
          </el-button>
        </el-tooltip>
        <!-- 静态展示模式（GitHub Pages）没有后端，隐藏后台入口避免点进 404 -->
        <el-tooltip v-if="!staticMode" content="后台管理" placement="bottom">
          <el-button text circle @click="router.push('/admin')">
            <el-icon><UserFilled /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </header>

    <div class="page">
      <div class="page-head">
        <div>
          <h1>自定义音源聚合</h1>
          <div class="sub muted">
            聚合公开渠道发布的洛雪自定义音源链接 · 只索引可达性与元数据，不提供任何音乐内容
          </div>
        </div>
        <div v-if="staticMode" class="muted sm">静态模式：数据来自 export.json</div>
      </div>

      <StatsOverview v-bind="stats" />

      <SourceToolbar
        v-model:q="q"
        v-model:status="statusFilter"
        v-model:type="typeFilter"
        @export-zip="onExportZip"
      />

      <SourceTable v-if="rows.length" :rows="rows" @sort="onSortChange" @open="onOpen" />
      <el-card v-else v-loading="loading" shadow="never">
        <div class="empty muted">暂无数据。可到后台「收录来源」添加种子链接并触发爬取。</div>
      </el-card>

      <SourceDetail v-model="dlgVisible" :source="current" :no="currentNo" />

      <footer class="foot muted">
        本工具仅收录并检查互联网上<b>已公开发布</b>的音源脚本链接：元数据（名称/版本/作者等）来自脚本头部注释，「可用性」仅指链接可下载、脚本文本可解析。
        本工具不存储、不解析、不提供任何音乐内容，也不验证音源能否获取平台付费歌曲；导入外部音源脚本的合规与安全风险由使用者自行承担。
      </footer>
    </div>
  </div>
</template>
