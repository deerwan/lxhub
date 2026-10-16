<script setup lang="ts">
import { onBeforeMount } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'LayRedirect' })

const route = useRoute()
const router = useRouter()

/** 刷新当前页的中转路由：进入后立即 replace 回真实地址 */
onBeforeMount(() => {
  const { params, query } = route
  const raw = Array.isArray(params?.path) ? params.path.join('/') : String(params?.path ?? '')
  const path = raw.startsWith('/') ? raw : `/${raw}`
  router.replace({ path, query })
})
</script>

<template>
  <div />
</template>
