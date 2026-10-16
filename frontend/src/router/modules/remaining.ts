import Layout from '@/layout/index.vue'
import type { RouteConfigs } from '@/layout/types'

/**
 * 不参与菜单渲染、也不参与权限收集的路由：
 * 登录页、错误页、以及用于「刷新当前页」的中转路由。
 */
const remainingRouter: Array<RouteConfigs> = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: {
      title: '登录',
      showLink: false,
      hiddenTag: true,
    },
  },
  {
    path: '/redirect',
    component: Layout,
    meta: { showLink: false },
    children: [
      {
        path: '/redirect/:path(.*)',
        name: 'Redirect',
        component: () => import('@/layout/redirect.vue'),
        meta: {
          title: '刷新',
          showLink: false,
          hiddenTag: true,
        },
      },
    ],
  },
  {
    path: '/error/403',
    name: 'Error403',
    component: () => import('@/views/error/403.vue'),
    meta: {
      title: '无权限',
      showLink: false,
      hiddenTag: true,
    },
  },
  {
    path: '/error/404',
    name: 'Error404',
    component: () => import('@/views/error/404.vue'),
    meta: {
      title: '页面不存在',
      showLink: false,
      hiddenTag: true,
    },
  },
]

export default remainingRouter
