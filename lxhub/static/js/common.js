/* 共享工具（首页 index.html 与后台 admin.html 共用） */
const $ = s => document.querySelector(s);

const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function _adminToken(){ return localStorage.getItem("lxh.admin") || ""; }

function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1600);
}

async function trigger(path){
  try{
    const tk = localStorage.getItem("lxh.admin");
    const opt = {method:"POST"};
    if(tk) opt.headers = {Authorization:"Bearer " + tk};
    const r = await fetch(path, opt);
    if(r.status === 401){ localStorage.removeItem("lxh.admin"); location.href = "/login"; return; }
    if(r.status === 409){ toast("已有任务在进行中"); return; }
    if(!r.ok) throw new Error(r.status);
    toast("任务已开始");
    if(typeof startProgPolling === "function") startProgPolling();
  }catch(e){ toast("触发失败（服务未运行?）"); }
}

/** 相对时间：省一半列宽；完整时间放 title（首页与后台共用） */
const fmtRel = s => {
  if(!s) return {t:"—", full:""};
  const d = new Date(s);
  if(isNaN(d)) return {t:String(s), full:""};
  const full = d.toLocaleString("zh-CN", {hour12:false});
  const sec = (Date.now() - d.getTime()) / 1000;
  let t;
  if(sec < 0) t = full;
  else if(sec < 60) t = "刚刚";
  else if(sec < 3600) t = Math.floor(sec/60) + " 分钟前";
  else if(sec < 86400) t = Math.floor(sec/3600) + " 小时前";
  else if(sec < 2592000) t = Math.floor(sec/86400) + " 天前";
  else t = d.toLocaleDateString("zh-CN");
  return {t, full};
};

const fmtTime = s => fmtRel(s).t;
const fmtFull = s => fmtRel(s).full || String(s || "—");

/* ---------- 主题：跟随系统 / 暗色 / 亮色 ---------- */
const THEME_KEY = "lxh.theme";

function getTheme(){ try{ return localStorage.getItem(THEME_KEY) || "system"; }catch(e){ return "system"; } }
function systemIsDark(){
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}
function resolveTheme(t){ return t === "system" ? (systemIsDark() ? "dark" : "light") : t; }
function applyTheme(t){
  const root = document.documentElement;
  // 先关掉过渡，整页一次性换成新主题，再于下一帧恢复过渡
  root.classList.add("theme-switching");
  root.dataset.theme = resolveTheme(t);
  void root.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}
function setTheme(t){
  try{ localStorage.setItem(THEME_KEY, t); }catch(e){}
  applyTheme(t);
}
function initTheme(){
  applyTheme(getTheme());
  const sel = $("#themeSel");
  if(sel){
    sel.value = getTheme();
    sel.onchange = e => setTheme(e.target.value);
  }
  // 选「跟随系统」时，随系统切换实时响应
  if(window.matchMedia){
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if(getTheme() === "system") applyTheme("system"); };
    if(mq.addEventListener) mq.addEventListener("change", onChange);
    else if(mq.addListener) mq.addListener(onChange);
  }
}
