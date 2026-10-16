<script setup lang="ts">
import { DArrowLeft } from '@element-plus/icons-vue'
import { useNav } from '@/layout/hooks/useNav'

/** 鼠标悬浮侧边栏时出现的居中折叠按钮（对应 `vue-pure-admin` 的 `SidebarCenterCollapse`） */
defineProps<{ isActive?: boolean }>()

const { tooltipEffect } = useNav()
const emit = defineEmits<{ toggleClick: [] }>()
</script>

<template>
  <el-tooltip
    :content="isActive ? '点击折叠' : '点击展开'"
    :effect="tooltipEffect"
    placement="right"
  >
    <div class="center-collapse" @click="emit('toggleClick')">
      <el-icon :style="{ transform: isActive ? 'none' : 'rotateY(180deg)' }">
        <DArrowLeft />
      </el-icon>
    </div>
  </el-tooltip>
</template>
