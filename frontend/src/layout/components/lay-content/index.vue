<script setup lang="ts">
import { Transition, computed, defineComponent, h } from 'vue'
import { getConfig } from '@/config'
import { usePermissionStoreHook } from '@/store/modules/permission'
import { useLayout } from '@/layout/hooks/useLayout'

defineOptions({ name: 'LayContent' })

defineProps<{ fixedHeader?: boolean }>()

const { stretch } = useLayout()

const isKeepAlive = computed(() => getConfig().KeepAlive !== false)

const getMainWidth = computed(() => (typeof stretch.value === 'number' ? `${stretch.value}px` : '100%'))

/** 页面切换动画：默认 `fade-transform`，可由路由 `meta.transition` 覆盖 */
const transitionMain = defineComponent({
  name: 'TransitionMain',
  props: {
    route: { type: Object, required: true },
  },
  render() {
    const transitionName = (this.route.meta?.transition?.name as string) || 'fade-transform'
    return h(
      Transition,
      { name: transitionName, mode: 'out-in', appear: true },
      { default: () => this.$slots.default?.() },
    )
  },
})
</script>

<template>
  <section class="app-main">
    <router-view v-slot="{ Component, route }">
      <transition-main :route="route">
        <keep-alive v-if="isKeepAlive" :include="usePermissionStoreHook().cachePageList">
          <component
            :is="Component"
            :key="route.fullPath"
            class="main-content"
            :style="{ maxWidth: getMainWidth }"
          />
        </keep-alive>
        <component
          v-else
          :is="Component"
          :key="route.fullPath"
          class="main-content"
          :style="{ maxWidth: getMainWidth }"
        />
      </transition-main>
    </router-view>
  </section>
</template>
