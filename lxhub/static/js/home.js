const PLAT = {kw:"酷我", wy:"网易云", kg:"酷狗", mg:"咪咕", tx:"QQ"};
const TYPE_TXT = {source:"音源脚本", companion:"配套脚本（不用于导入）", unknown:"存疑"};
let ALL = [], STATIC = false, CURRENT = null;
let PREFIXES = [], USE_PREFIX = false, PREFIX_IDX = 0;
let SORT = {key:"", dir:1};
try {
  const _s = JSON.parse(localStorage.getItem("lxh.sort") || "null");
  if(_s && typeof _s.key === "string") SORT = _s;
} catch(e){}


const fmtSize = n => !n ? "—" : n > 1048576 ? (n/1048576).toFixed(1)+" MB"
  : n > 1024 ? (n/1024).toFixed(0)+" KB" : n+" B";

/* fmtRel / fmtTime / fmtFull 已提升到 common.js，首页与后台共用 */

const baseName = u => {
  try { return decodeURIComponent(u.split("?")[0].split("/").pop()); }
  catch(e){ return u; }
};

/** api_hosts 在列表接口里是 JSON 字符串，详情里可能是数组，统一解析 */
const parseHosts = s => {
  const h = s?.api_hosts;
  if(Array.isArray(h)) return h;
  if(typeof h === "string" && h){
    try { const v = JSON.parse(h); return Array.isArray(v) ? v : []; }
    catch(e){ return []; }
  }
  return [];
};


async function copyText(text){
  try { await navigator.clipboard.writeText(text); toast("已复制到剪贴板"); }
  catch(e){
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("已复制到剪贴板"); }
    catch(e2){ toast("复制失败，请手动选择"); }
    ta.remove();
  }
}

// ---------- 加速前缀 ----------
function loadPrefixPrefs(){
  try{
    USE_PREFIX = localStorage.getItem("lxh.prefixOn") === "1";
    const i = parseInt(localStorage.getItem("lxh.prefixIdx") || "0", 10);
    PREFIX_IDX = Number.isNaN(i) ? 0 : i;
  }catch(e){}
}
function savePrefixPrefs(){
  try{
    localStorage.setItem("lxh.prefixOn", USE_PREFIX ? "1" : "0");
    localStorage.setItem("lxh.prefixIdx", String(PREFIX_IDX));
  }catch(e){}
}
function hostMatch(url, p){
  const hosts = p.hosts || [];
  if(!hosts.length) return true;
  let h = "";
  try { h = new URL(url).hostname.toLowerCase(); } catch(e){ return false; }
  return hosts.some(x => { const s = String(x).toLowerCase();
    return h === s || h.endsWith("." + s); });
}
function curPrefix(){
  if(!USE_PREFIX || !PREFIXES.length) return null;
  return PREFIXES[Math.min(PREFIX_IDX, PREFIXES.length - 1)] || null;
}
function withPrefix(url){
  const p = curPrefix();
  if(!p || !url) return url;
  return hostMatch(url, p) ? p.prefix + url : url;
}
function setupPrefixes(list){
  PREFIXES = (list || [])
    .map(p => typeof p === "string" ? {name:p, prefix:p} : p)
    .filter(p => p && p.prefix);
  const wrap = $("#pfxWrap"), sel = $("#pfxSel");
  if(!PREFIXES.length){ wrap.style.display = "none"; sel.style.display = "none"; return; }
  if(PREFIX_IDX >= PREFIXES.length) PREFIX_IDX = 0;
  sel.innerHTML = PREFIXES.map((p, i) =>
    `<option value="${i}">${esc(p.name || p.prefix)}</option>`).join("");
  sel.value = String(PREFIX_IDX);
  sel.style.display = PREFIXES.length > 1 ? "" : "none";
  wrap.style.display = "";
  wrap.title = "开启后复制链接时拼接：" + PREFIXES[PREFIX_IDX].prefix;
  $("#pfxOn").checked = USE_PREFIX;
}
function onPrefixChange(){
  savePrefixPrefs();
  render();
  if(CURRENT) syncDetailUrl();
  const p = curPrefix();
  toast(p ? `复制时拼接 ${p.name || p.prefix}` : "复制原始直链");
}
function syncDetailUrl(){
  if(!CURRENT) return;
  const shown = withPrefix(CURRENT.url);
  $("#dUrl").value = shown;
  $("#dUrl").title = shown === CURRENT.url ? "" : "原始直链：" + CURRENT.url;
}
loadPrefixPrefs();

// ---------- 数据 ----------
async function load(){
  let data;
  try {
    const r = await fetch("/api/sources");
    if(!r.ok) throw new Error(r.status);
    data = await r.json();
  } catch(e){
    const r = await fetch("./export.json");
    data = await r.json();
    STATIC = true;
    $("#btnTasks").disabled = true;
    $("#modeTip").textContent = "静态模式：数据来自 export.json";
  }
  ALL = data.sources || [];
  setupPrefixes(data.mirror_prefixes);
  render();
  if(!STATIC) refreshStatus();
}

function baseList(){
  const st = $("#st").value, tp = $("#tp").value;
  const list = ALL.filter(s => {
    if(st === "alive" && !s.is_alive) return false;
    if(st === "dead" && s.is_alive) return false;
    if(st === "down" && s.api_alive !== "down") return false;
    if(tp === "all") return true;
    if(!s.looks_valid) return false;
    if(tp === "source") return s.script_type === "source";
    if(tp === "unk") return s.script_type === "unknown";
    if(tp === "src") return s.script_type !== "companion";
    return true;
  });
  return sortList(list);
}

const SORT_VAL = {
  no:    s => (s.api_alive === "down") - 0,
  status:s => ["ok","down","unk","comp","dead"].indexOf(statusKey(s)),
  name:  s => (s.name || baseName(s.url)).toLowerCase(),
  plat:  s => (s.platforms || []).join(","),
  ver:   s => s.version || "",
  auth:  s => (s.author || "").toLowerCase(),
  upd:   s => s.content_updated_at || s.first_seen || "",
};

function sortList(list){
  const k = SORT.key;
  if(!k){ // 默认：可用优先 + 最近更新优先（后端挂沉底）
    const t = s => s.content_updated_at || s.first_seen || "";
    return [...list].sort((a, b) =>
      (a.api_alive === "down") - (b.api_alive === "down") ||
      (Number(b.is_alive) - Number(a.is_alive)) ||
      (t(b) < t(a) ? -1 : t(b) > t(a) ? 1 : 0));
  }
  const get = SORT_VAL[k] || (() => "");
  return [...list].sort((a, b) => {
    const x = get(a), y = get(b);
    let c;
    if(k === "ver") c = String(x).localeCompare(String(y), undefined, {numeric:true});
    else if(k === "no") c = 0;
    else c = x < y ? -1 : x > y ? 1 : 0;
    if(c === 0) c = (a.api_alive === "down") - (b.api_alive === "down");
    return SORT.dir * c;
  });
}

function filtered(){
  const base = baseList();
  base.forEach((s, i) => { s._no = i + 1; });
  const q = $("#q").value.trim();
  if(/^\d+$/.test(q)){
    const n = parseInt(q, 10);
    return (n >= 1 && n <= base.length) ? [base[n - 1]] : [];
  }
  if(!q) return base;
  const ql = q.toLowerCase();
  return base.filter(s => {
    const hay = (s.name||"")+" "+(s.author||"")+" "+(s.description||"")+" "+(s.url||"");
    return hay.toLowerCase().includes(ql);
  });
}

/** 状态判定（顺序即优先级） */
function statusKey(s){
  if(!s.is_alive) return "dead";
  if(s.api_alive === "down") return "down";
  if(s.script_type === "companion") return "comp";
  if(s.script_type === "unknown") return "unk";
  return "ok";
}
const STATUS_TXT = {ok:"可用", dead:"失效", down:"后端挂", comp:"配套", unk:"存疑"};

function render(){
  const list = filtered();
  $("#empty").style.display = list.length ? "none" : "block";
  $("#rows").innerHTML = list.map(s => {
    const sk = statusKey(s);
    const plats = (s.platforms || []).length
      ? `<div class="plats">${(s.platforms||[]).map(p =>
          `<span class="plat">${PLAT[p] || esc(p)}</span>`).join("")}</div>`
      : '<span class="muted">—</span>';
    const inline = (!s.looks_valid ? '<span class="tag warn">非音源?</span>' : "")
      + ((s.mirrors||[]).length
          ? `<span class="tag mirror" title="${esc((s.mirrors||[]).join("\n"))}">+${s.mirrors.length} 镜像</span>`
          : "");
    const rel = fmtRel(s.last_alive || s.last_checked);
    return `<div class="grid-row row ${sk === "dead" ? "dead" : ""}" data-id="${s.id}">
      <div class="c-no muted">${s._no ?? s.id}</div>
      <div class="c-st"><span class="pill ${sk}"><i class="dot"></i>${STATUS_TXT[sk]}</span></div>
      <div class="c-name name" title="${esc(s.name || baseName(s.url))}">${esc(s.name || baseName(s.url))}${inline ? `<span class="inline-tags">${inline}</span>` : ""}</div>
      <div class="c-plat">${plats}</div>
      <div class="c-ver muted cell-min" title="${esc(s.version||"")}">${esc(s.version || "—")}</div>
      <div class="c-auth muted cell-min" title="${esc(s.author||"")}">${esc(s.author || "—")}</div>
      <div class="c-upd muted" title="${esc(rel.full)}">${esc(rel.t)}</div>
      <div class="c-act"><button class="copy" data-copy="${esc(withPrefix(s.url))}">复制</button><button class="dl" data-dl="${s.id}">下载</button></div>
    </div>`;
  }).join("");
  syncSortUI();
}

function syncSortUI(){
  document.querySelectorAll("#thead span[data-sort]").forEach(el => {
    const on = el.dataset.sort === SORT.key;
    el.classList.toggle("sorted", on);
    el.innerHTML = el.textContent.replace(/[▲▼]\s*$/, "").trim()
      + (on ? ` <span class="arrow">${SORT.dir > 0 ? "▲" : "▼"}</span>` : "");
  });
}

// ---------- 事件（委托，避免行内 onclick 的引号问题） ----------
function downloadScript(sid){
  const a = document.createElement("a");
  a.href = `./api/sources/${sid}/download`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

$("#rows").addEventListener("click", e => {
  const dl = e.target.closest("[data-dl]");
  if(dl){ e.stopPropagation(); downloadScript(Number(dl.dataset.dl)); return; }
  const cp = e.target.closest("[data-copy]");
  if(cp){ e.stopPropagation(); copyText(cp.dataset.copy); return; }
  const row = e.target.closest("[data-id]");
  if(row) openDetail(Number(row.dataset.id));
});

$("#thead").addEventListener("click", e => {
  const th = e.target.closest("[data-sort]");
  if(!th) return;
  const k = th.dataset.sort;
  if(k === "no"){
    // 编号列：在「默认序」和「默认倒序」之间切换
    SORT = (SORT.key === "no" && SORT.dir === 1) ? {key:"no", dir:-1} : {key:"no", dir:1};
  } else if(SORT.key === k) SORT.dir = -SORT.dir;
  else { SORT.key = k; SORT.dir = 1; }
  try { localStorage.setItem("lxh.sort", JSON.stringify(SORT)); } catch(e){}
  render();
});

let qTimer = null;
$("#q").addEventListener("input", () => {
  clearTimeout(qTimer);
  qTimer = setTimeout(render, 120);
});
["st","tp"].forEach(id => $("#" + id).addEventListener("change", render));

$("#pfxOn").addEventListener("change", e => { USE_PREFIX = e.target.checked; onPrefixChange(); });
$("#pfxSel").addEventListener("change", e => {
  PREFIX_IDX = parseInt(e.target.value || "0", 10) || 0;
  USE_PREFIX = true; $("#pfxOn").checked = true;
  onPrefixChange();
});

$("#btnExportZip").addEventListener("click", () => {
  const list = filtered();
  if(!list.length){ toast("当前筛选没有可导出的记录"); return; }
  const a = document.createElement("a");
  a.href = "./api/export/zip?ids=" + encodeURIComponent(list.map(s => s.id).join(","));
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast(`正在打包 ${list.length} 条…`);
});

// toolbar 吸顶时加分隔线
const tb = $("#toolbar");
addEventListener("scroll", () => {
  tb.classList.toggle("stuck", window.scrollY > 8);
}, {passive:true});

// ---------- 状态与任务 ----------
async function refreshStatus(){
  if(STATIC) return;
  try{
    const s = await (await fetch("/api/status")).json();
    $("#stTotal").textContent = s.stats.total;
    $("#stAlive").textContent = s.stats.alive;
    $("#stValid").textContent = s.stats.valid;
    const lc = s.last_crawl;
    $("#stCrawl").textContent = lc ? fmtTime(lc.finished_at || lc.started_at) : "—";
    $("#stCrawl").title = lc ? fmtFull(lc.finished_at || lc.started_at) : "";
    const busy = !!s.busy;
    // 后台开关：false 时前台隐藏「更新」按钮，同时隐藏任务进度，保持公开页干净
    const showUp = s.show_update !== false;
    $("#btnTasks").style.display = showUp ? "" : "none";
    $("#taskMenu").style.display = showUp ? "" : "none";
    $("#prog").style.display = showUp ? "" : "none";
    if(!showUp && PROG_TIMER){ clearInterval(PROG_TIMER); PROG_TIMER = null; }
    $("#btnTasks").disabled = busy;
    $("#btnTasks").innerHTML = busy
      ? (s.busy === "crawl" ? "爬取中…" : "检测中…")
      : '更新 <span style="opacity:.55">▾</span>';
    if(busy && showUp) startProgPolling();
    return busy;
  }catch(e){ return false; }
}


let PROG_TIMER = null;
const fmtElapsed = s => {
  s = Math.max(0, Math.round(s || 0));
  return s >= 60 ? `${Math.floor(s/60)} 分 ${s%60} 秒` : `${s} 秒`;
};

function startProgPolling(){
  if(PROG_TIMER || STATIC) return;
  pollProgress();
  PROG_TIMER = setInterval(pollProgress, 1000);
}

async function pollProgress(){
  let p;
  try{ p = await (await fetch("/api/progress")).json(); }
  catch(e){ return; }
  if(!p.running){
    if(PROG_TIMER){ clearInterval(PROG_TIMER); PROG_TIMER = null; finishProg(p); }
    return;
  }
  renderProg(p);
}

function renderProg(p, done){
  const s = p.stats || {};
  $("#prog").classList.add("show");
  $("#pTitle").textContent = done
    ? (p.cancelled ? "已取消" : "已完成")
    : (p.kind === "crawl" ? "正在爬取" : "正在检测");
  $("#pMsg").textContent = p.message || "";
  $("#pElapsed").textContent = `已用时 ${fmtElapsed(p.elapsed)}`;
  // 取消属于「操作」：未持有后台令牌的访客不显示（否则点了必然 401）
  $("#btnCancel").style.display = (done || !_adminToken()) ? "none" : "";

  const bar = $("#pBar");
  const total = s.urls_total || 0, cnt = s.urls_done || 0;
  if(done){ bar.classList.remove("indet"); bar.style.width = "100%"; }
  else if(total > 0){ bar.classList.remove("indet"); bar.style.width = (cnt/total*100).toFixed(1)+"%"; }
  else { bar.classList.add("indet"); bar.style.width = "100%"; }

  const bits = [];
  if(s.repos_total) bits.push(`仓库 ${s.repos_done||0}/${s.repos_total}`);
  if(total) bits.push(`链接 ${cnt}/${total}`);
  if(p.kind === "crawl"){
    if(s.valid != null) bits.push(`疑似音源 ${s.valid}`);
    if(s.new != null) bits.push(`新增 ${s.new}`);
  } else if(s.alive != null) bits.push(`存活 ${s.alive}`);
  if(s.dead) bits.push(`失效 ${s.dead}`);
  $("#pStats").textContent = bits.join(" · ") || "正在收集候选链接…";

  const logEl = $("#pLog");
  const stick = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 48;
  logEl.textContent = (p.logs || []).join("\n");
  if(stick) logEl.scrollTop = logEl.scrollHeight;
}

function finishProg(p){
  renderProg(p, true);
  const s = p.stats || {};
  toast(p.cancelled ? "任务已取消"
    : p.kind === "crawl" ? `爬取完成：检测 ${s.checked ?? "—"} 条，疑似音源 ${s.valid ?? "—"} 条`
    : `检测完成：存活 ${s.alive ?? "—"} / 失效 ${s.dead ?? "—"}`);
  load();
  setTimeout(() => $("#prog").classList.remove("show"), 8000);
}

$("#btnCancel").onclick = async () => {
  try{
    const tk = _adminToken();
    const opt = {method:"POST"};
    if(tk) opt.headers = {Authorization:"Bearer " + tk};
    const r = await fetch("/api/cancel", opt);
    if(r.status === 401){ toast("登录已过期，请在后台重新登录"); location.href = "/login"; return; }
    if(!r.ok) throw new Error();
    toast("取消请求已发送，正在停止…");
  }catch(e){ toast("取消失败"); }
};

// ---------- 详情 ----------
async function openDetail(id){
  let s = ALL.find(x => x.id === id);
  if(!STATIC && s){
    try{
      const d = await (await fetch(`/api/sources/${id}`)).json();
      d.mirrors = s.mirrors || [];
      s = d;
    }catch(e){}
  }
  if(!s) return;
  CURRENT = s;

  $("#dName").textContent = s.name || baseName(s.url);
  const subBits = [];
  if(s.version) subBits.push("v" + s.version);
  if(s.author) subBits.push(s.author);
  const plats = (s.platforms || []).map(p => PLAT[p] || p);
  if(plats.length) subBits.push(plats.join(" / "));
  $("#dSub").innerHTML = subBits.length
    ? subBits.map(esc).join('<span class="sep">·</span>')
    : '<span class="muted">无元数据</span>';

  const sk = statusKey(s);
  $("#dStatus").innerHTML =
    `<span class="pill ${sk}"><i class="dot"></i>${STATUS_TXT[sk]}</span>`
    + ` <span class="muted">(HTTP ${s.http_status || "—"})</span>`;
  const hosts = parseHosts(s);
  $("#dApi").textContent = s.api_alive === "up" ? `活 · ${hosts.length} 个域名可访问`
    : s.api_alive === "down" ? "挂 · 声明的后端域名均不可达"
    : hosts.length ? "未探测" : "脚本未声明后端域名";
  $("#dType").textContent = TYPE_TXT[s.script_type] || "存疑";

  $("#dMirrors").innerHTML = (s.mirrors || []).length
    ? s.mirrors.map(u => `<div class="muted" style="word-break:break-all">${esc(u)}</div>`).join("")
    : "—";
  $("#dOrigin").innerHTML = s.origin_url
    ? `<a href="${esc(s.origin_url)}" target="_blank" rel="noopener">${esc(s.origin_repo || "来源")}</a>`
    : '<span class="muted">外部直链</span>';

  $("#dId").textContent = "第 " + (s._no || s.id) + " 条";
  $("#dSize").textContent = fmtSize(s.file_size);
  $("#dHash").textContent = s.sha256 || "—";
  $("#dFirst").textContent = fmtFull(s.first_seen);
  $("#dCheck").textContent = fmtFull(s.last_checked);

  syncDetailUrl();
  const _full = s.content_text || "";
  $("#dPre").textContent = _full
    ? _full.slice(0, 6000) + (_full.length > 6000 ? "\n\n…(已截断，点「下载」查看完整脚本)" : "")
    : "（无内容）";
  dlg.showModal();
}

$("#dCopy").onclick = () => CURRENT && copyText(withPrefix(CURRENT.url));
$("#dCopyUrl").onclick = () => copyText($("#dUrl").value);

const taskMenu = $("#taskMenu");
$("#btnTasks").onclick = e => { e.stopPropagation(); taskMenu.classList.toggle("open"); };
document.addEventListener("click", e => {
  if(!taskMenu.contains(e.target)) taskMenu.classList.remove("open");
});
document.querySelectorAll("#taskMenu .menu-item").forEach(mi => {
  mi.onclick = () => {
    taskMenu.classList.remove("open");
    trigger(mi.dataset.task === "crawl" ? "/api/crawl" : "/api/check");
  };
});
$("#q").addEventListener("keydown", e => {
  if(e.key === "Escape"){ e.target.value = ""; render(); }
});

// ---------- 后台 ----------

initTheme();
load();
setInterval(refreshStatus, 5000);
