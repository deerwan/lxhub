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
