import { http } from '@/utils/http'
import type { AdminConfigResp, LoginResult } from '@/types'

export interface SetConfigResult {
  ok: boolean
  applied: string[]
}

/** 登录：失败时抛出 `HttpError`，由登录页按状态码给出提示 */
export function login(username: string, password: string): Promise<LoginResult> {
  return http.post<LoginResult>('/api/admin/login', {
    data: { username, password },
    silent: true,
  })
}

export function logout(): Promise<{ ok: boolean }> {
  return http.post<{ ok: boolean }>('/api/admin/logout', { silent: true })
}

export function getAdminConfig(): Promise<AdminConfigResp> {
  return http.get<AdminConfigResp>('/api/admin/config')
}

export function setAdminConfig(body: Record<string, unknown>): Promise<SetConfigResult> {
  return http.post<SetConfigResult>('/api/admin/config', { data: body })
}
