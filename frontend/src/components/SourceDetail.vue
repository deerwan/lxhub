<script setup lang="ts">
import { computed } from 'vue'
import {
  baseName,
  parseHosts,
  PLAT,
  STATUS_TXT,
  TAG_TYPE,
  statusKey,
  TYPE_TXT,
} from '@/utils/source'
import { fmtFull, fmtSize } from '@/utils/format'
import { withPrefix } from '@/utils/prefix'
import { copyText } from '@/utils/clipboard'
import type { Source } from '@/types'

const props = defineProps<{ source: Source | null; no?: number | null }>()
const visible = defineModel<boolean>({ default: false })

const shownUrl = computed(() => withPrefix(props.source?.url || ''))

const preText = computed(() => {
  const full = props.source?.content_text || ''
  if (!full) return '（无内容）'
  return full.slice(0, 6000) + (full.length > 6000 ? '\n\n…(已截断，点「下载」查看完整脚本)' : '')
})

const subText = computed(() => {
  const s = props.source
  if (!s) return ''
  const bits: string[] = []
  if (s.version) bits.push('v' + s.version)
  if (s.author) bits.push(s.author)
  const plats = (s.platforms || []).map((p) => PLAT[p] || p)
  if (plats.length) bits.push(plats.join(' / '))
  return bits.join(' · ') || '无元数据'
})

const apiText = computed(() => {
  const s = props.source
  if (!s) return '—'
  const hosts = parseHosts(s)
  if (s.api_alive === 'up') return `活 · ${hosts.length} 个域名可访问`
  if (s.api_alive === 'down') return '挂 · 声明的后端域名均不可达'
  return hosts.length ? '未探测' : '脚本未声明后端域名'
})

const typeText = computed(() => {
  const s = props.source
  if (!s) return '—'
  const t = TYPE_TXT[s.script_type || ''] || '存疑'
  const tier =
    s.valid_tier === 'confirmed' ? ' · 高置信' : s.valid_tier === 'probable' ? ' · 待验证' : ''
  return t + tier
})

const mirrors = computed(() => props.source?.mirrors || [])
const variants = computed(() => props.source?.variants || [])
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="source ? source.name || baseName(source.url) : '—'"
    width="680px"
  >
    <div class="dlg-sub muted">{{ subText }}</div>

    <el-descriptions :column="2" border size="small" style="margin-top: 12px">
      <el-descriptions-item label="可用状态">
        <el-tag v-if="source" :type="TAG_TYPE[statusKey(source)]" size="small">
          {{ STATUS_TXT[statusKey(source)] }}
        </el-tag>
        <span class="muted">（HTTP {{ source?.http_status ?? '—' }}）</span>
      </el-descriptions-item>
      <el-descriptions-item label="后端">{{ apiText }}</el-descriptions-item>
      <el-descriptions-item label="类型">{{ typeText }}</el-descriptions-item>
      <el-descriptions-item label="编号">第 {{ no ?? source?.id }} 条</el-descriptions-item>
    </el-descriptions>

    <el-descriptions :column="1" border size="small" style="margin-top: 12px">
      <el-descriptions-item label="链接">
        <div class="url-box">
          <el-input :model-value="shownUrl" readonly size="small" />
          <el-button size="small" @click="copyText(shownUrl)">复制</el-button>
        </div>
      </el-descriptions-item>
      <el-descriptions-item label="镜像">
        <template v-if="mirrors.length">
          <div v-for="u in mirrors" :key="u" class="break muted">{{ u }}</div>
        </template>
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="同名变体">
        <template v-if="variants.length">
          <div v-for="(v, i) in variants" :key="i" class="break muted">
            {{ v.origin_repo || v.url }}{{ v.version ? ' · v' + v.version : '' }}{{ v.is_alive ? '' : ' · 失效' }}
          </div>
        </template>
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="发现自">
        <a
          v-if="source?.origin_url"
          :href="source.origin_url"
          target="_blank"
          rel="noopener"
        >{{ source.origin_repo || '来源' }}</a>
        <span v-else class="muted">外部直链</span>
      </el-descriptions-item>
      <el-descriptions-item label="大小">{{ fmtSize(source?.file_size) }}</el-descriptions-item>
      <el-descriptions-item label="发现时间">{{ fmtFull(source?.first_seen || '') }}</el-descriptions-item>
      <el-descriptions-item label="最近检测">{{ fmtFull(source?.last_checked || '') }}</el-descriptions-item>
      <el-descriptions-item label="SHA256">
        <span class="mono muted">{{ source?.sha256 || '—' }}</span>
      </el-descriptions-item>
    </el-descriptions>

    <div class="pre-hd">脚本头部内容（截取）</div>
    <pre class="script-pre">{{ preText }}</pre>

    <template #footer>
      <el-button type="primary" @click="source && copyText(shownUrl)">复制链接</el-button>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>
