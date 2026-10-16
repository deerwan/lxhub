<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { exportZipUrl } from '@/api/sources'
import { useSources } from '@/composables/useSources'
import { message } from '@/utils/message'
import type { Source } from '@/types'
import SourceToolbar from '@/components/SourceToolbar.vue'
import SourceTable from '@/components/SourceTable.vue'
import SourceDetail from '@/components/SourceDetail.vue'

defineOptions({ name: 'AdminSources' })

const { rows, staticMode, loading, q, statusFilter, typeFilter, load, onSortChange, openDetail } =
  useSources()

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

onMounted(() => void load())
</script>

<template>
  <div>
    <el-alert
      v-if="staticMode"
      type="info"
      show-icon
      :closable="false"
      title="静态模式：接口不可用，数据来自 export.json"
      style="margin-bottom: 14px"
    />

    <SourceToolbar
      v-model:q="q"
      v-model:status="statusFilter"
      v-model:type="typeFilter"
      @export-zip="onExportZip"
    />

    <SourceTable v-if="rows.length" :rows="rows" @sort="onSortChange" @open="onOpen" />
    <el-card v-else v-loading="loading" shadow="never">
      <div class="empty muted">暂无数据。可到「配置管理 - 收录来源」添加种子链接并触发爬取。</div>
    </el-card>

    <SourceDetail v-model="dlgVisible" :source="current" :no="currentNo" />
  </div>
</template>
