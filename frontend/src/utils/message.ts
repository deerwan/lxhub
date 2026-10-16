import type { VNode } from 'vue'
import { type MessageHandler, ElMessage } from 'element-plus'

type messageTypes = 'info' | 'success' | 'warning' | 'error'

interface MessageParams {
  /** 消息类型，可选 `info` 、`success` 、`warning` 、`error` ，默认 `info` */
  type?: messageTypes
  /** 是否纯色，默认 `false` */
  plain?: boolean
  /** 是否将 `message` 属性作为 `HTML` 片段处理，默认 `false` */
  dangerouslyUseHTMLString?: boolean
  /** 显示时间，单位毫秒，默认 `2000` */
  duration?: number
  /** 是否显示关闭按钮，默认 `false` */
  showClose?: boolean
  /** 自定义类名 */
  customClass?: string
  /** 合并内容相同的消息，默认 `false` */
  grouping?: boolean
}

/** 统一封装 `ElMessage`，默认 2 秒关闭并使用平台样式 */
const message = (
  content: string | VNode | (() => VNode),
  params?: MessageParams,
): MessageHandler => {
  const {
    type = 'info',
    plain = false,
    dangerouslyUseHTMLString = false,
    customClass = 'lxhub-message',
    duration = 2000,
    showClose = false,
    grouping = false,
  } = params ?? {}

  return ElMessage({
    message: content,
    type,
    plain,
    dangerouslyUseHTMLString,
    duration,
    showClose,
    grouping,
    customClass,
  })
}

/** 关闭所有 `Message` 消息提示 */
const closeAllMessage = (): void => ElMessage.closeAll()

export { message, closeAllMessage }
