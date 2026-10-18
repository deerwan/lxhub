// lx 自定义音源沙箱环境：装配 globalThis.lx 与宿主桥接
import dns from 'node:dns'
import zlib from 'node:zlib'
import nodeCrypto from 'node:crypto'

const DEFAULT_REQ_CAP_MS = 15000

const PRIVATE_V4_RE = /^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|172\.(1[6-9]|2\d|3[01])\.)/
// 本地/私网主机名：localhost、任意 .internal（含云元数据 metadata.google.internal）。
// 注意 .internal 整段拦掉：原正则写成 metadata\.google?internal（? 只让 e 可选），
// 匹配不了真实的 metadata.google.internal，第一道主机名闸门形同虚设
const PRIVATE_HOST_RE = /^(localhost|.*\.localhost|.*\.internal)$/i

export function isPrivateIp(ip) {
  if (PRIVATE_V4_RE.test(ip)) return true
  const v6 = String(ip).toLowerCase()
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd')
    || v6.startsWith('fe80')
}

// 出网域名防护：解析 DNS，公网 IP 才放行（防脚本扫内网/SSRF）
export async function assertPublicHost(host, cache) {
  const key = String(host || '').toLowerCase()
  if (!key || PRIVATE_HOST_RE.test(key)) {
    throw new Error(`拒绝访问本地/私有地址: ${key}`)
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(key)) {
    if (isPrivateIp(key)) throw new Error(`拒绝访问私有地址: ${key}`)
    return
  }
  if (cache.has(key)) {
    if (!cache.get(key)) throw new Error(`拒绝访问私有地址: ${key}`)
    return
  }
  try {
    const addrs = await dns.promises.lookup(key, { all: true })
    const bad = addrs.some(a => isPrivateIp(a.address))
    cache.set(key, !bad)
    if (bad) throw new Error(`拒绝访问私有地址: ${key} → ${addrs.map(a => a.address).join(',')}`)
  } catch (e) {
    if (e instanceof Error && /^拒绝访问/.test(e.message)) throw e
    cache.set(key, false)
    throw new Error(`域名解析失败: ${key}`)
  }
}

export function lxMeta(scriptText) {
  const meta = { name: '', description: '', version: '', author: '', homepage: '' }
  const block = String(scriptText || '').slice(0, 8000).match(/\/\*[*!][\s\S]*?\*\//)
  if (!block) return meta
  const c = block[0]
  const take = re => {
    const m = c.match(re)
    return m && m[1] ? m[1].trim().slice(0, 120) : ''
  }
  meta.name = take(/@name\s+(.+)/)
  meta.description = take(/@(?:description|描述)\s*(.+)/)
  meta.version = take(/@version\s+(.+)/)
  meta.author = take(/@author\s+(.+)/)
  meta.homepage = take(/@(?:homepage|repository|更新地址)\s+(.+)/)
  return meta
}

function toBuf(v) {
  if (Buffer.isBuffer(v)) return v
  if (v instanceof Uint8Array || Array.isArray(v)) return Buffer.from(v)
  if (typeof v === 'string') return Buffer.from(v)
  try { return Buffer.from(JSON.stringify(v)) } catch { return Buffer.alloc(0) }
}

function fmtArgs(args) {
  return args.map(a => {
    if (typeof a === 'string') return a
    try { return JSON.stringify(a) } catch { return String(a) }
  }).join(' ')
}

export function buildLxEnv(scriptText, meta, opts = {}) {
  const reqCapMs = Number(opts.reqCapMs) > 0 ? Number(opts.reqCapMs) : DEFAULT_REQ_CAP_MS
  const allowPrivate = !!opts.allowPrivate
  const debug = !!opts.debug
  const out = w => process.stderr.write(`${w}\n`)
  const scriptLog = (...a) => { const s = fmtArgs(a); if (debug || /\berror\b/i.test(s)) out(`[script] ${s.slice(0, 1000)}`) }

  const handlers = new Map()
  const hostCache = new Map()
  const updateAlerts = []
  let initedPayload = null
  let initedResolve = null
  const initedPromise = new Promise(r => { initedResolve = r })

  const consoleProxy = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'clear') return () => {}
      const fn = console[prop]
      if (typeof fn !== 'function') return () => {}
      return (...args) => scriptLog(...args)
    },
    set() { return true },
  })

  const request = (url, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {} }
    options = options || {}
    let called = false
    const fin = (err, resp, body) => {
      if (called) return
      called = true
      if (typeof callback === 'function') {
        try { callback(err, resp, body) } catch (e) { scriptLog('request callback 异常:', e && e.message) }
      }
    }
    const urlStr = String(url)
    const fail = e => fin(e instanceof Error ? e : new Error(String(e && e.message || e)), null, null)
    const run = async () => {
      const abort = new AbortController()
      const capMs = Math.min(Number(options.timeout) > 0 ? Number(options.timeout) : reqCapMs, reqCapMs)
      const timer = setTimeout(() => abort.abort(), capMs)
      try {
        const u = new URL(urlStr)
        if (!allowPrivate) await assertPublicHost(u.hostname, hostCache)
        const headers = Object.assign({}, options.headers || {})
        let body = options.body ?? null
        if (options.form && !options.body) {
          body = (options.form && typeof options.form === 'object'
            && !(options.form instanceof Buffer) && !(options.form instanceof FormData)
            && !(options.form instanceof Uint8Array))
            ? new URLSearchParams(options.form).toString()
            : options.form
          if (!headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
          }
        } else if (options.formData && !options.body) {
          body = options.formData
        } else if (body && typeof body === 'object' && !(body instanceof Buffer)
          && !(body instanceof Uint8Array) && !(body instanceof FormData)) {
          body = JSON.stringify(body)
          if (!headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json'
          }
        }
        // redirect 用 manual 手动跟随：每跳都过 assertPublicHost，
        // 防止「公网入口 → 302 内网」绕过 DNS 防护（fetch 自动跟随不会重新校验）
        let curUrl = urlStr
        let res = null
        for (let hop = 0; hop < 4; hop++) {
          res = await fetch(curUrl, {
            method: String(options.method || 'GET').toUpperCase(),
            headers,
            body: hop === 0 ? body : undefined,
            signal: abort.signal,
            redirect: 'manual',
          })
          if ([301, 302, 303, 307, 308].includes(res.status)) {
            const loc = res.headers.get('location')
            if (!loc) break
            const next = new URL(loc, curUrl)
            if (!allowPrivate) await assertPublicHost(next.hostname, hostCache)
            curUrl = next.toString()
            continue
          }
          break
        }
        const text = await res.text()
        let parsed = text
        try { parsed = JSON.parse(text) } catch { }
        const resp = {
          statusCode: res.status,
          statusMessage: res.statusText || '',
          headers: Object.fromEntries(res.headers.entries()),
          body: parsed,
        }
        // 更新提醒嗅探：拦截响应体里的 updateMsg/updateUrl
        const sniffSrc = (parsed && typeof parsed === 'object') ? (parsed.data || parsed) : null
        if (sniffSrc && typeof sniffSrc === 'object') {
          const um = sniffSrc.updateMsg ?? sniffSrc.log ?? sniffSrc.updateLog ?? sniffSrc.msg
          const uu = sniffSrc.updateUrl ?? sniffSrc.url ?? sniffSrc.downloadUrl
          if (um && (uu || (typeof um === 'string' && um.includes('更新')))) {
            updateAlerts.push({
              name: meta.name || '',
              log: typeof um === 'string' ? um.slice(0, 200) : JSON.stringify(um).slice(0, 200),
              updateUrl: uu ? String(uu) : '',
            })
          }
        }
        fin(null, resp, parsed)
      } catch (e) {
        fail(e)
      } finally {
        clearTimeout(timer)
      }
    }
    run()
    return () => { }
  }

  const lx = {
    version: '2.0.0',
    env: 'desktop',
    platform: 'web',
    currentScriptInfo: {
      name: meta.name || '',
      description: meta.description || '',
      version: meta.version || '',
      author: meta.author || '',
      homepage: meta.homepage || '',
      rawScript: scriptText,
    },
    EVENT_NAMES: { request: 'request', inited: 'inited', updateAlert: 'updateAlert' },
    utils: {
      buffer: {
        from: (d, e) => Buffer.from(d, e),
        bufToString: (b, f) => (b !== null && typeof b === 'object' && typeof b.toString === 'function')
          ? b.toString(f || 'utf8')
          : Buffer.from(b, 'binary').toString(f || 'utf8'),
      },
      crypto: {
        // 注意必须用 node:crypto：全局 crypto 是 WebCrypto，没有 createHash 等方法
        md5: s => nodeCrypto.createHash('md5').update(typeof s === 'string' ? s : Buffer.from(s || '')).digest('hex'),
        aesEncrypt: (buffer, mode, key, iv) => {
          const k = toBuf(key)
          const algorithm = `aes-${k.length * 8}-${mode}`
          const cipher = nodeCrypto.createCipheriv(algorithm, k, toBuf(iv))
          return Buffer.concat([cipher.update(toBuf(buffer)), cipher.final()])
        },
        rsaEncrypt: (buffer, key) => nodeCrypto.publicEncrypt(toBuf(key), toBuf(buffer)),
        randomBytes: n => nodeCrypto.randomBytes(n),
      },
      zlib: {
        inflate: b => new Promise((resolve, reject) =>
          zlib.inflate(toBuf(b), (e, d) => (e ? reject(e) : resolve(d)))),
        deflate: b => new Promise((resolve, reject) =>
          zlib.deflate(toBuf(b), (e, d) => (e ? reject(e) : resolve(d)))),
      },
    },
    request,
    send: (eventName, data) => {
      if (eventName === 'inited') {
        initedPayload = data
        initedResolve()
      } else if (eventName === 'updateAlert') {
        const d = data && typeof data === 'object' ? data : {}
        updateAlerts.push({
          name: d.name || meta.name || '',
          log: String(d.log || d.updateMsg || d.msg || '').slice(0, 200),
          updateUrl: String(d.updateUrl || d.url || ''),
        })
        initedResolve()
      }
    },
    on: (eventName, handler) => {
      const name = String(eventName).split('.').pop()
      if (name === 'request' && typeof handler === 'function') handlers.set('request', handler)
    },
  }

  const sandbox = {
    console: consoleProxy,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Buffer, URL, URLSearchParams, TextEncoder, TextDecoder,
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    crypto,
    process: {
      nextTick: (fn, ...a) => setTimeout(() => fn(...a), 0),
      env: { NODE_ENV: process.env.NODE_ENV || 'production' },
    },
    lx,
  }
  sandbox.global = sandbox
  sandbox.window = sandbox
  sandbox.globalThis = sandbox

  return {
    sandbox,
    initedPromise,
    getInitedPayload: () => initedPayload,
    updateAlerts,
    dispatchEvent: async payload => {
      const handler = handlers.get('request')
      if (!handler) throw new Error('脚本未注册 request 处理器')
      const result = await handler({
        source: payload.source,
        action: payload.action,
        info: payload.info,
      })
      return result
    },
  }
}
