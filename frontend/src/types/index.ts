export type FieldType = 'text' | 'password' | 'lines' | 'prefixes' | 'number' | 'float' | 'bool'

export interface AdminField {
  key: string
  label: string
  type: FieldType
  /** 补充说明，展示在输入框下方 */
  tip?: string
}

export interface AdminConfigResp {
  config: Record<string, unknown>
  github_token_set: boolean
  admin_enabled: boolean
}

export interface LoginResult {
  token: string
  expires_in: number
}

export interface RunInfo {
  started_at?: string
  finished_at?: string
}

/** 单个平台实测结果（Node 沙箱 worker 产出） */
export interface ProbeRes {
  status: 'usable' | 'failed' | 'skipped'
  ms?: number
  bitrate?: number
  duration?: number
  format?: string
  spec?: string
  quality?: 'matched' | 'degraded' | 'mismatch' | 'refused' | 'unknown'
  reason?: string
  message?: string
  url?: string
}

/** 一条音源的完整实测结果 JSON（存 probe_detail） */
export interface ProbeDetail {
  status: 'usable' | 'degraded' | 'not-loadable'
  declared?: string[]
  platforms?: Record<string, ProbeRes>
  loadError?: string
  updateAlert?: { version?: string; log?: string } | null
}

/** 沙箱实测可用性（/api/status.probe_capability）：缺 Node 时前端禁用入口 */
export interface ProbeCapability {
  available: boolean
  node?: string
  reason?: string | null
}

export interface StatusResp {
  busy: 'crawl' | 'check' | 'probe' | null
  stats: {
    total: number
    alive: number
    valid: number
    probe_usable?: number
    probe_degraded?: number
    probe_not_loadable?: number
  }
  last_crawl: RunInfo | null
  last_check: RunInfo | null
  last_probe: RunInfo | null
  probe_capability?: ProbeCapability
}

export interface ProgressStats {
  urls_total?: number | null
  urls_done?: number | null
  repos_total?: number | null
  repos_done?: number | null
  checked?: number | null
  valid?: number | null
  new?: number | null
  alive?: number | null
  dead?: number | null
  usable?: number | null
  degraded?: number | null
  not_loadable?: number | null
}

export interface ProgressSnapshot {
  running: boolean
  kind: 'crawl' | 'check' | 'probe' | null
  cancelled?: boolean
  message?: string
  elapsed?: number
  stats?: ProgressStats
  logs?: string[]
}

export interface Source {
  id: number
  url: string
  name?: string
  version?: string
  author?: string
  description?: string
  platforms?: string[]
  script_type?: 'source' | 'companion' | 'unknown'
  looks_valid?: boolean
  valid_tier?: 'confirmed' | 'probable' | null
  is_alive?: boolean
  api_alive?: 'up' | 'down' | 'unk'
  http_status?: number | null
  api_hosts?: string | string[]
  mirrors?: string[]
  variants?: { origin_repo?: string; url?: string; version?: string; is_alive?: boolean }[]
  origin_url?: string
  origin_repo?: string
  file_size?: number | null
  sha256?: string | null
  first_seen?: string
  content_updated_at?: string
  repo_pushed_at?: string
  last_checked?: string
  last_alive?: string
  probe_status?: 'usable' | 'degraded' | 'not-loadable' | ''
  probe_detail?: ProbeDetail | { [k: string]: unknown }
  probe_checked?: string
  probe_fail_streak?: number
  content_text?: string
  _no?: number
}

export interface SourcesResp {
  sources: Source[]
  mirror_prefixes: (string | { name: string; prefix: string; hosts?: string[] })[]
}
