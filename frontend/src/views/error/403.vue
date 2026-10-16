<script setup lang="ts">
import { useRouter } from 'vue-router'

defineOptions({ name: 'Error403' })

const router = useRouter()
</script>

<template>
  <div class="error-page">
    <el-result icon="error" title="403" sub-title="抱歉，你没有权限访问该页面">
      <template #extra>
        <el-button type="primary" @click="router.replace('/admin/overview')">回到后台</el-button>
        <el-button @click="router.replace('/')">回到首页</el-button>
      </template>
    </el-result>
  </div>
</template>

<style scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
</style>
