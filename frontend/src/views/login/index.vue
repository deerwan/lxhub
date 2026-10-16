<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock, User } from '@element-plus/icons-vue'
import { useUserStoreHook } from '@/store/modules/user'
import { HttpError } from '@/utils/http'

defineOptions({ name: 'Login' })

const route = useRoute()
const router = useRouter()
const user = ref('')
const pass = ref('')
const err = ref('')
const busy = ref(false)

async function submit(): Promise<void> {
  err.value = ''
  busy.value = true
  try {
    await useUserStoreHook().loginByUsername({ username: user.value.trim(), password: pass.value })
    const redirect = (route.query.redirect as string) || '/admin/overview'
    await router.replace(redirect)
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.status === 403) {
        err.value = '后台未启用（部署时需设置环境变量 LXH_ADMIN_PASS）'
      } else if (e.status === 401) {
        err.value = '账户名或密码错误'
      } else {
        err.value = e.message || '登录失败'
      }
    } else {
      err.value = '登录失败'
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <el-card shadow="never">
      <h1>LX 音源 · 后台登录</h1>
      <el-input
        v-model="user"
        placeholder="账户名"
        autocomplete="username"
        :prefix-icon="User"
        @keydown.enter="submit"
      />
      <el-input
        v-model="pass"
        type="password"
        show-password
        placeholder="密码"
        autocomplete="current-password"
        :prefix-icon="Lock"
        style="margin-top: 12px"
        @keydown.enter="submit"
      />
      <div class="login-err">{{ err }}</div>
      <el-button type="primary" :loading="busy" style="width: 100%" @click="submit">
        登录
      </el-button>
      <p class="login-back">
        <router-link to="/">← 返回首页</router-link>
      </p>
    </el-card>
  </div>
</template>
