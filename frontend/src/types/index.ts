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

export interface StatusResp {
  busy: 'crawl' | 'check' | null
  stats: { total: number; alive: number; valid: number }
  last_crawl: RunInfo | null
  last_check: RunInfo | null
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
}

export interface ProgressSnapshot {
  running: boolean
  kind: 'crawl' | 'check' | null
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
  content_text?: string
  _no?: number
}

export interface SourcesResp {
  sources: Source[]
  mirror_prefixes: (string | { name: string; prefix: string; hosts?: string[] })[]
}
