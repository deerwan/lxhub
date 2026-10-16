/**
 * 统一再导出的中转层：避免 `store -> router -> store` 这类循环依赖
 * 在模块求值阶段就炸掉（所有使用点都在函数/工厂里，属于延迟求值）。
 */
export { store } from '@/store'
export { routerArrays } from '@/layout/types'
export { router, resetRouter, constantMenus, remainingPaths } from '@/router'
export { getConfig, responsiveStorageNameSpace } from '@/config'
export {
  ascending,
  filterTree,
  filterNoPermissionTree,
  formatFlatteningRoutes,
} from '@/router/utils'
export {
  isUrl,
  isEqual,
  isNumber,
  isBoolean,
  getKeyList,
  storageLocal,
  deviceDetection,
} from '@pureadmin/utils'

export type {
  setType,
  appType,
  userType,
  multiType,
  cacheType,
  positionType,
} from './types'
