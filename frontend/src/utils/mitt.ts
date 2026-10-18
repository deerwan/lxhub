import type { Emitter } from 'mitt'
import mitt from 'mitt'

/** 全局公共事件需要在此处添加类型 */
type Events = {
  /** 打开右侧系统设置面板 */
  openPanel: boolean
  /** 切换布局后重新渲染菜单 */
  changLayoutRoute: string
  /** 标签页变化 */
  tagViewsChange: string
  /** 登录态失效，需要退出到登录页 */
  logout: string
}

export const emitter: Emitter<Events> = mitt<Events>()
