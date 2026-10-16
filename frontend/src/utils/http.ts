import { emitter } from './mitt'
import { message } from './message'
import { formatToken, getToken, removeToken } from './auth'

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface HttpRequestConfig {
  /** `query` 参数 */
  params?: Record<string, unknown>
  /** 请求体，对象会被序列化为 `JSON` */
  data?: unknown
  headers?: Record<string, string>
  /** 超时时间（毫秒），默认 `20000` */
  timeout?: number
  signal?: AbortSignal
  /** 失败时不弹全局提示 */
  silent?: boolean
  /** 单次请求生效，优先级高于全局配置 */
  beforeRequestCallback?: (config: HttpRequestConfig) => void
  /** 单次请求生效，优先级高于全局配置，返回值即 `request` 的返回值 */
  beforeResponseCallback?: <T>(data: T) => T
}

/** 统一错误类型，业务侧可据此拿到状态码做分支处理 */
export class HttpError extends Error {
  status: number
  data: unknown

  constructor(status: number, msg: string, data?: unknown) {
    super(msg)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}

/** 无需携带 token、也不触发登出跳转的地址 */
const whiteList: Array<string> = ['/api/admin/login']

function buildUrl(url: string, params?: Record<string, unknown>): string {
  if (!params) return url
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.append(key, String(value))
  })
  const qs = search.toString()
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url
}

function pickMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const detail = (data as Record<string, unknown>).detail
    const msg = (data as Record<string, unknown>).message
    if (typeof detail === 'string' && detail) return detail
    if (typeof msg === 'string' && msg) return msg
  }
  return `请求失败（${status}）`
}

let unauthorizedLock = false

/** 登录态失效：清理本地 token 并跳转登录页 */
async function handleUnauthorized(): Promise<void> {
  if (unauthorizedLock) return
  unauthorizedLock = true
  removeToken()
  emitter.emit('logout', 'unauthorized')
  const { default: router } = await import('@/router')
  const redirect = router.currentRoute.value.fullPath
  await router.push(redirect && redirect !== '/login' ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login')
  unauthorizedLock = false
}

const defaultConfig: HttpRequestConfig = { timeout: 20000 }

/**
 * 极简 `http` 封装：对齐 `vue-pure-admin` 的 `PureHttp` 用法
 * （`request/get/post` + 请求/响应回调），底层使用原生 `fetch`，不额外引入 `axios`。
 */
class PureHttp {
  private static initConfig: HttpRequestConfig = {}

  /** 全局默认配置 */
  static setConfig(config: HttpRequestConfig): void {
    PureHttp.initConfig = { ...PureHttp.initConfig, ...config }
  }

  request<T>(method: HttpMethod, url: string, options: HttpRequestConfig = {}): Promise<T> {
    const config: HttpRequestConfig = { ...defaultConfig, ...PureHttp.initConfig, ...options }
    config.beforeRequestCallback?.(config)
    if (!options.beforeRequestCallback) PureHttp.initConfig.beforeRequestCallback?.(config)

    const headers: Record<string, string> = { ...(config.headers ?? {}) }
    const isForm = typeof FormData !== 'undefined' && config.data instanceof FormData
    let body: BodyInit | undefined

    if (method !== 'get' && method !== 'delete' && config.data !== undefined) {
      if (isForm || typeof config.data === 'string') {
        body = config.data as BodyInit
      } else {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify(config.data)
      }
    }

    if (!whiteList.includes(url)) {
      const token = getToken().accessToken
      if (token) headers.Authorization = formatToken(token)
    }

    const signal = config.signal ?? (config.timeout ? AbortSignal.timeout(config.timeout) : undefined)

    return fetch(buildUrl(url, config.params), { method: method.toUpperCase(), headers, body, signal })
      .then(async (resp) => {
        const text = await resp.text()
        let data: unknown = text
        if (text) {
          try {
            data = JSON.parse(text)
          } catch {
            data = text
          }
        }
        if (resp.status === 401) {
          // 登录接口自身的 401 只是「账号密码错误」，不应触发登出跳转，
          // 否则会把登录页地址当成回跳目标，造成 redirect 参数套娃
          if (!whiteList.includes(url)) void handleUnauthorized()
          throw new HttpError(401, pickMessage(data, 401), data)
        }
        if (!resp.ok) {
          const err = new HttpError(resp.status, pickMessage(data, resp.status), data)
          if (!config.silent) message(err.message, { type: 'error' })
          throw err
        }
        if (options.beforeResponseCallback) return options.beforeResponseCallback(data as T)
        if (PureHttp.initConfig.beforeResponseCallback) return PureHttp.initConfig.beforeResponseCallback(data as T)
        return data as T
      })
      .catch((err: unknown) => {
        if (err instanceof HttpError) throw err
        const status = (err as { name?: string })?.name === 'TimeoutError' ? 408 : 0
        const msg = status === 408 ? '请求超时，请稍后重试' : '网络异常，请检查服务是否运行'
        if (!config.silent) message(msg, { type: 'error' })
        throw new HttpError(status, msg)
      })
  }

  post<T>(url: string, options?: HttpRequestConfig): Promise<T> {
    return this.request<T>('post', url, options)
  }

  get<T>(url: string, options?: HttpRequestConfig): Promise<T> {
    return this.request<T>('get', url, options)
  }
}

export const http = new PureHttp()
