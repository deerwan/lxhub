import type { RouteConfigs } from '@/layout/types'

/** 前台首页：不参与后台菜单渲染 */
export default {
  path: '/',
  name: 'Welcome',
  component: () => import('@/views/welcome/index.vue'),
  meta: {
    title: '音源聚合',
    showLink: false,
  },
} satisfies RouteConfigs
