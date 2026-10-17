// lx 音源真实可用探测（P1 worker）
// 用法: node probe.mjs <脚本路径> [--deep]
// 输出: stdout 仅一行 JSON 结果；脚本与流程日志走 stderr。退出码 0=探测完成
// 流程: 装配 lx 沙箱 → 执行脚本等 inited → 逐平台 musicUrl(128k) → Range 探测 + 音频魔数
//      deep 模式追加音质核验（flac / flac24bit 规格解析）
import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'
import { buildLxEnv, lxMeta, isPrivateIp } from './env.mjs'

const PLATFORMS = ['wy', 'tx', 'kw', 'kg', 'mg']

// 各平台真实测试歌（主 + 稳定备选）：字段规格参考 lxserver callRequest musicInfo 结构
// duration 为常数参考时长（秒），用于无 Content-Range 时估算平均码率
const TEST_SONGS = {
  wy: [
    { name: '海阔天空', singer: 'Beyond', duration: 325, info: { songmid: '347230' } },
  ],
  tx: [
    { name: '晴天', singer: '周杰伦', duration: 269, info: { songmid: '0039MnYb0qxYhV' } },
  ],
  kw: [
    { name: '晴天', singer: '周杰伦', duration: 269, info: { songmid: '838607' } },
  ],
  kg: [
    { name: '晴天', singer: '周杰伦', duration: 269, info: { hash: '30ece05c17d4e9ec8ba0ef9f96e7a07c' } },
  ],
  mg: [
    { name: '晴天', singer: '周杰伦', duration: 269, info: { copyrightId: '69984639', songmid: '69984639' } },
  ],
}

let staleTimers = []
function guardTimeout(ms, label) {
  return new Promise((_, reject) => {
    const t = setTimeout(() => {
      const i = staleTimers.indexOf(t)
      if (i >= 0) staleTimers.splice(i, 1)
      reject(new Error(`${label} 超时(${Math.round(ms / 1000)}s)`))
    }, ms)
    staleTimers.push(t)
  })
}
function winRace(p, ms, label) {
  return Promise.race([p, guardTimeout(ms, label)])
}

// ---------- 音频魔数与规格解析 ----------
function asciiHead(bytes, n) {
  let s = ''
  for (let i = 0; i < Math.min(bytes.length, n); i++) s += String.fromCharCode(bytes[i])
  return s
}

// STREAMINFO 位于首个 metadata block（必须 type=0）：布局 [2,2][3,3][8 打包]
function parseFlacSpec(b) {
  if (asciiHead(b, 4) !== 'fLaC') return null
  const spec = { container: 'flac', sampleRate: 0, bitDepth: 0, channels: 0, totalSamples: 0 }
  const hi = b[4], len = (b[5] << 16) | (b[6] << 8) | b[7]
  const type = hi & 0x7f
  const last = (hi & 0x80) !== 0
  const o = 8 // STREAMINFO 起始绝对偏移
  if (type === 0 && len >= 34 && b.length >= o + 18) {
    spec.sampleRate = (b[o + 10] << 12) | (b[o + 11] << 4) | (b[o + 12] >>> 4)
    spec.channels = ((b[o + 12] >>> 1) & 0x07) + 1
    spec.bitDepth = (((b[o + 12] & 0x01) << 4) | (b[o + 13] >>> 4)) + 1
    spec.totalSamples =
      (b[o + 13] & 0x0f) * 2 ** 28 + (b[o + 14] * 2 ** 20) + (b[o + 15] * 2 ** 12)
      + (b[o + 16] * 2 ** 4) + (b[o + 17] >>> 4)
  }
  return spec
}

function parseMp3Spec(b) {
  // ID3v2 头跳过（synchsafe 大小）
  let at = 0
  if (asciiHead(b, 3) === 'ID3' && b.length > 10) {
    const sz = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f)
    at = 10 + sz + ((b[5] & 0x10) !== 0 ? 10 : 0)
  }
  const limit = Math.min(b.length, at + 4096)
  while (at < limit - 4) {
    if (b[at] === 0xff && (b[at + 1] & 0xe0) === 0xe0) {
      const versionBits = (b[at + 1] >>> 3) & 0x03
      const bitrateIdx = (b[at + 2] >>> 4) & 0x0f
      const srIdx = (b[at + 2] >>> 2) & 0x03
      const rates = versionBits === 3 ? [44100, 48000, 32000]
        : versionBits === 1 || versionBits === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000]
      const BR = versionBits === 3
        ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
        : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
      return {
        container: 'mp3',
        bitrate: BR[bitrateIdx] || 0,
        sampleRate: rates[srIdx] || 0,
        mpeg: versionBits === 3 ? 1 : 2,
      }
    }
    at++
  }
  return null
}

function parseAudioSpec(bytes) {
  const b = bytes.subarray ? bytes.subarray(0, Math.min(bytes.length, 2048)) : bytes
  const head4 = asciiHead(b, 4)
  if (head4 === 'fLaC') return parseFlacSpec(bytes)
  if (head4 === 'OggS') return { container: 'ogg' }
  if (head4 === 'RIFF') return { container: 'wav' }
  if (asciiHead(b.slice(4, 8), 4) === 'ftyp') return { container: 'mp4' }
  if (asciiHead(b, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) {
    const s = parseMp3Spec(bytes)
    if (s) return s
    return { container: 'mp3' }
  }
  return null
}

function qualityVerdict(claimed, spec) {
  if (!spec) return 'unknown'
  const c = spec.container
  const avg = spec.avgBitrateKbps || 0
  switch (claimed) {
    case '320k':
      if (c === 'mp3' && (spec.bitrate === 320 || (avg && Math.round(avg) >= 280))) return 'matched'
      if (c === 'flac') return 'matched'
      return 'mismatch'
    case '128k':
    case '192k':
      if (c === 'mp3') return 'matched'
      if (c === 'flac') return 'matched'
      return 'unknown'
    case 'flac':
      if (c === 'flac') return 'matched'
      if (c === 'mp3' || c === 'mp4') return 'mismatch'
      return 'unknown'
    case 'flac24bit':
      if (c === 'flac' && (spec.bitDepth === 24 || spec.bitDepth === 32)) return 'matched'
      if (c === 'flac' && spec.bitDepth === 16) return 'degraded'
      if (c === 'flac') return 'unknown'
      if (c === 'mp3' || c === 'mp4') return 'mismatch'
      return 'unknown'
    case 'hires':
      if (c === 'flac' && spec.sampleRate >= 88200) return 'matched'
      if (c === 'flac' && spec.sampleRate >= 44100) return 'degraded'
      if (c === 'mp3' || c === 'mp4') return 'mismatch'
      return 'unknown'
    default:
      if (c === 'flac' && (spec.bitDepth >= 24 || spec.sampleRate >= 88200)) return 'matched'
      return 'unknown'
  }
}

// ---------- URL 真实性核验（Range 探测 + 魔数） ----------
async function verifyUrl(url, { timeoutMs = 8000 } = {}) {
  const u = new URL(url)
  const host = (u.hostname || '').toLowerCase()
  if (host === 'localhost' || host === '' || isPrivateIp(host)) {
    return { ok: false, reason: '私有/本地地址，疑似假链接' }
  }
  const res = await fetch(url, {
    headers: { Range: 'bytes=0-16383', 'User-Agent': UA_PROBE },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  if (/json|text\/html|text\/plain/i.test(ct)) {
    return { ok: false, reason: `返回 ${ct.split(';')[0]}，非音频` }
  }
  if (!res.ok && res.status !== 206) return { ok: false, reason: `HTTP ${res.status}` }
  const bytes = new Uint8Array(await res.arrayBuffer())
  const ascii = asciiHead(bytes, 16)
  const magic =
    ascii.slice(0, 3) === 'ID3' ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
    ascii.slice(0, 4) === 'fLaC' || ascii.slice(0, 4) === 'OggS' ||
    ascii.slice(0, 4) === 'RIFF' || ascii.slice(4, 8) === 'ftyp'
  if (!magic && !/audio|octet-stream/i.test(ct)) {
    return { ok: false, reason: `非音频内容 (${ct || '未知'})` }
  }
    let total = 0
    try {
      const cr = res.headers.get('content-range') || ''
      const m = cr.match(/\/(\d+)\s*$/)
      if (m) total = parseInt(m[1], 10)
    } catch { }
    let spec = null
    try {
      spec = parseAudioSpec(bytes)
    } catch { }
    if (spec) {
      if (spec.container === 'flac' && spec.sampleRate > 0 && spec.totalSamples > 0) {
        const seconds = spec.totalSamples / spec.sampleRate
        const avg = Math.round((total * 8) / seconds / 1000)
        if (seconds > 30 && total > 0 && avg > 1 && avg <= 1250) {
          spec.avgBitrateKbps = avg
          spec.seconds = Math.round(seconds)
        } else {
          spec.specUnverified = 'STREAMINFO 时长与文件长度不符（疑似头部被改写/加密封装）'
        }
      }
      spec.bytes = total || bytes.length
    }
  return { ok: true, spec, contentType: ct.split(';')[0], bytes }
}

const UA_PROBE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) lx-source-probe/1.0'

// ---------- 主流程 ----------
function argParse(argv) {
  const flags = { deep: false, script: '' }
  for (const a of argv) {
    if (a === '--deep') flags.deep = true
    else if (!flags.script && !a.startsWith('--')) flags.script = a
  }
  return flags
}

const numEnv = (k, d) => {
  const v = parseInt(process.env[k] || '', 10)
  return Number.isFinite(v) && v > 0 ? v : d
}
const listEnv = k => (process.env[k] || '').split(',').map(s => s.trim()).filter(Boolean)

async function probeSongOnce(env, src, song, type) {
  const payload = {
    source: src,
    action: 'musicUrl',
    info: {
      type,
      musicInfo: Object.assign(
        { name: song.name, singer: song.singer, meta: Object.assign({ name: song.name, singer: song.singer }, song.info) },
        song.info),
    },
  }
  const t0 = Date.now()
  const ret = await winRace(
    env.dispatchEvent(payload),
    numEnv('LXH_PROBE_URL_TIMEOUT', 8000),
    '取链请求')
  if (typeof ret !== 'string') {
    return { error: ret == null || ret === '' ? '返回空链接' : `返回异常: ${String(ret).slice(0, 60)}`, url: '' }
  }
  if (!/^https?:\/\/.+/i.test(ret.trim())) {
    return { error: `返回非 http 链接: ${ret.slice(0, 40)}`, url: ret }
  }
  return { error: '', url: ret.trim(), ms: Date.now() - t0 }
}

async function main() {
  const flags = argParse(process.argv.slice(2))
  const scriptPath = path.resolve(flags.script)
  const scriptText = fs.readFileSync(scriptPath, 'utf8')

  const budgetMs = numEnv('LXH_PROBE_BUDGET', 45000)
  const budget = setTimeout(() => {
    process.stderr.write(`[probe] 总预算 ${Math.round(budgetMs / 1000)}s 超时，强制退出\n`)
    process.exit(3)
  }, budgetMs)
  budget.unref()

  const result = {
    status: 'not-loadable',
    loadable: false,
    inited: false,
    loadError: null,
    declared: [],
    platforms: {},
    l2: flags.deep ? {} : null,
    updateAlert: null,
    checkedAt: new Date().toISOString(),
  }

  const emit = () => {
    process.stdout.write(JSON.stringify(result) + '\n')
  }

  try {
    const meta = lxMeta(scriptText)
    const env = buildLxEnv(scriptText, meta, {
      reqCapMs: numEnv('LXH_PROBE_REQ_CAP', 15000),
      allowPrivate: process.env.LXH_PROBE_ALLOW_PRIVATE === '1',
      debug: process.env.LXH_PROBE_DEBUG === '1',
    })
    const context = vm.createContext(env.sandbox)
    try {
      vm.runInContext(scriptText, context, { filename: path.basename(scriptPath), timeout: 10000 })
    } catch (e) {
      result.loadError = String(e && e.message || e).slice(0, 300)
      emit()
      return
    }
    const initMs = numEnv('LXH_PROBE_INIT_TIMEOUT', 8000)
    try {
      await winRace(env.initedPromise, initMs, '脚本初始化')
    } catch (e) {
      result.loadError = `脚本未调用 lx.send('inited'): ${e.message}`
      emit()
      return
    }
    if (env.getInitedPayload() && typeof env.getInitedPayload() !== 'object') { /* 容忍非对象载荷 */ }
    const declaredRaw = env.getInitedPayload() && env.getInitedPayload().sources
    const declared = declaredRaw && typeof declaredRaw === 'object' ? Object.keys(declaredRaw) : []
    result.loadable = true
    result.inited = true
    result.declared = declared
    const targets = declared.filter(p => PLATFORMS.includes(p))
    if (!targets.length) targets.push(...PLATFORMS)

    const qualities = listEnv('LXH_PROBE_QUALITIES')
    let usableCount = 0

    for (const src of targets) {
      const songs = TEST_SONGS[src] || []
      const entry = { status: 'failed', message: '无测试歌曲' }
      for (let i = 0; i < songs.length; i++) {
        const song = songs[i]
        let r
        try {
          r = await probeSongOnce(env, src, song, '128k')
        } catch (e) {
          r = { error: String(e && e.message || e).slice(0, 120), url: '' }
        }
        if (r.error) {
          entry.message = `试听「${song.name}」${r.error}`
          continue
        }
        let v
        try {
          v = await winRace(verifyUrl(r.url), numEnv('LXH_PROBE_URL_TIMEOUT', 8000), 'Range 探测')
        } catch (e) {
          entry.message = `试听「${song.name}」校验失败 ${String(e && e.message || e).slice(0, 80)}`
          continue
        }
        if (!v.ok) {
          entry.message = `试听「${song.name}」${v.reason}`
          continue
        }
        entry.status = 'usable'
        entry.message = `测试歌曲「${song.name}」返回真实音频`
        entry.latencyMs = r.ms || 0
        try { entry.urlHost = new URL(r.url).hostname } catch { }
        entry.spec = v.spec || null
        usableCount++
        break
      }
      result.platforms[src] = entry
    }

    result.status = usableCount > 0 ? 'usable' : 'degraded'
    if (flags.deep) {
      for (const src of Object.keys(result.platforms)) {
        if (result.platforms[src].status !== 'usable') {
          result.l2[src] = { verdict: 'refused', reason: result.platforms[src].message }
          continue
        }
        const songs = TEST_SONGS[src] || []
        const song = songs[0]
        const claims = []
        for (const q of (qualities.length ? qualities : ['flac', 'flac24bit'])) {
          const qEntry = { claimed: q, verdict: 'unknown', spec: null, error: null }
          try {
            const r = await probeSongOnce(env, src, song, q)
            if (r.error) { qEntry.verdict = 'refused'; qEntry.error = r.error }
            else {
              const v = await winRace(verifyUrl(r.url), numEnv('LXH_PROBE_URL_TIMEOUT', 8000), '音质核验')
              if (!v.ok) { qEntry.verdict = 'refused'; qEntry.error = v.reason }
              else {
                qEntry.spec = v.spec || null
                qEntry.verdict = v.spec ? qualityVerdict(q, v.spec) : 'unknown'
              }
            }
          } catch (e) {
            qEntry.verdict = 'refused'
            qEntry.error = String(e && e.message || e).slice(0, 120)
          }
          claims.push(qEntry)
        }
        const l2verdict = (claims.find(c => c.verdict === 'matched') || claims[0] || {}).verdict || 'unknown'
        result.l2[src] = { verdict: l2verdict, claims }
        // 同步到平台条目，前端与 Python 侧只看 platforms 即可
        result.platforms[src].quality = l2verdict
      }
    }

    const alerts = env.updateAlerts
    if (alerts.length) result.updateAlert = alerts[alerts.length - 1]
    emit()
  } catch (e) {
    result.loadError = String(e && e.stack || e).slice(0, 400)
    emit()
  } finally {
    for (const t of staleTimers) clearTimeout(t)
    staleTimers = []
  }
}

// 先清 stderr 缓冲再退出，保证日志顺序；stdout 在 emit 时直接 write 已无缓冲问题
main().then(() => process.exit(0), e => {
  process.stderr.write(`[probe] worker 异常: ${e && e.stack || e}\n`)
  process.stdout.write(JSON.stringify({ status: 'not-loadable', loadable: false, loadError: String(e && e.stack || e).slice(0, 300), platforms: {}, updateAlert: null, checkedAt: new Date().toISOString() }) + '\n')
  process.exit(1)
})
