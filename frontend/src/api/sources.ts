import { http } from '@/utils/http'
import type { Source, SourcesResp } from '@/types'

export function fetchSources(): Promise<SourcesResp> {
  return http.get<SourcesResp>('/api/sources', { silent: true })
}

/** 静态导出模式：接口不可用时读取仓库根目录下的 `export.json` */
export function fetchStaticExport(): Promise<SourcesResp> {
  // 用 BASE_URL 而不是绝对路径：GitHub Pages 部署在 /<repo>/ 子路径下时，
  // 绝对路径 /export.json 会解析到域名根目录而 404
  return http.get<SourcesResp>(`${import.meta.env.BASE_URL}export.json`, { silent: true })
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
