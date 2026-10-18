<script setup lang="ts">
import { Fold } from '@element-plus/icons-vue'
import { useNav } from '@/layout/hooks/useNav'

/** 侧边栏底部的折叠按钮 */
defineProps<{ isActive?: boolean }>()

const { tooltipEffect } = useNav()
const emit = defineEmits<{ toggleClick: [] }>()
</script>

<template>
  <div class="left-collapse">
    <el-tooltip
      :content="isActive ? '点击折叠' : '点击展开'"
      :effect="tooltipEffect"
      placement="right"
    >
      <el-icon
        class="left-collapse-icon"
        :style="{ transform: isActive ? 'none' : 'rotateY(180deg)' }"
        @click="emit('toggleClick')"
      >
        <Fold />
      </el-icon>
    </el-tooltip>
  </div>
</template>
