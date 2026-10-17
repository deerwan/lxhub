<script setup lang="ts">
import { usePrefixStoreHook } from '@/store/modules/prefix'
import { message } from '@/utils/message'

const q = defineModel<string>('q', { default: '' })
const status = defineModel<string>('status', { default: 'all' })
const type = defineModel<string>('type', { default: 'src' })

const emit = defineEmits<{ exportZip: [] }>()

const prefix = usePrefixStoreHook()

function onPrefixChange(): void {
  prefix.savePrefs()
  const p = prefix.current
  message(p ? `复制时拼接 ${p.name || p.prefix}` : '复制原始直链')
}

function onPrefixSelect(): void {
  prefix.setEnabled(true)
  onPrefixChange()
}
</script>

<template>
  <el-card shadow="never" class="toolbar">
    <div class="toolbar-row">
      <el-input
        v-model="q"
        placeholder="搜索名称 / 作者 / 链接…"
        clearable
        style="flex: 1; min-width: 200px"
        @keydown.esc="q = ''"
      />
      <el-select v-model="status" style="width: 130px">
        <el-option label="全部状态" value="all" />
        <el-option label="可访问" value="alive" />
        <el-option label="后端挂" value="down" />
        <el-option label="失效" value="dead" />
        <el-option label="实测可用" value="probegood" />
        <el-option label="实测异常" value="probebad" />
      </el-select>
      <el-select v-model="type" style="width: 140px">
        <el-option label="音源与存疑" value="src" />
        <el-option label="仅音源" value="source" />
        <el-option label="仅存疑" value="unk" />
        <el-option label="全部记录" value="all" />
      </el-select>
      <template v-if="prefix.hasPrefixes">
        <el-checkbox v-model="prefix.enabled" @change="onPrefixChange">加速前缀</el-checkbox>
        <el-select
          v-if="prefix.prefixes.length > 1"
          v-model="prefix.index"
          style="width: 160px"
          @change="onPrefixSelect"
        >
          <el-option
            v-for="(p, i) in prefix.prefixes"
            :key="i"
            :label="p.name || p.prefix"
            :value="i"
          />
        </el-select>
      </template>
      <el-button @click="emit('exportZip')">导出 ZIP</el-button>
    </div>
  </el-card>
</template>
