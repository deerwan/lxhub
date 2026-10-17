import { HttpError, http } from '@/utils/http'
import type { ProgressSnapshot, StatusResp } from '@/types'

export type TaskKind = 'crawl' | 'check' | 'probe'
export type TaskTriggerResult = 'started' | 'busy' | 'failed'

export function fetchStatus(): Promise<StatusResp> {
  return http.get<StatusResp>('/api/status', { silent: true })
}

export function fetchProgress(): Promise<ProgressSnapshot> {
  return http.get<ProgressSnapshot>('/api/progress', { silent: true })
}

/** 触发爬取 / 检测任务，409 表示已有任务在进行中 */
export async function startTask(kind: TaskKind): Promise<TaskTriggerResult> {
  try {
    await http.post(`/api/${kind}`, { silent: true })
    return 'started'
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) return 'busy'
    return 'failed'
  }
}

/** 取消进行中的任务，409 表示当前没有可取消的任务 */
export async function cancelTask(): Promise<boolean> {
  try {
    await http.post('/api/cancel', { silent: true })
    return true
  } catch {
    return false
  }
}
