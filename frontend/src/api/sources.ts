import { http } from '@/utils/http'
import type { Source, SourcesResp } from '@/types'

export function fetchSources(): Promise<SourcesResp> {
  return http.get<SourcesResp>('/api/sources', { silent: true })
}

export function fetchSourceDetail(id: number): Promise<Source> {
  return http.get<Source>(`/api/sources/${id}`, { silent: true })
}

/** 后端直出的下载地址（导出 zip / 下载单个脚本），走原生跳转即可 */
export function downloadUrl(id: number): string {
  return `/api/sources/${id}/download`
}

export function exportZipUrl(ids: number[]): string {
  return ids.length ? `/api/export/zip?ids=${encodeURIComponent(ids.join(','))}` : '/api/export/zip'
}
