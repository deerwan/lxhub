function fmtElapsed(s){
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m} 分 ${sec} 秒` : `${sec} 秒`;
}

// 后台只暴露日常需要调整的项；其余（种子仓库、并发、超时、上限等）
// 属于部署期参数，留在 config.json / 环境变量里，避免表单过长、误改。
const ADMIN_FIELDS = [
  ["_sec1", "收录来源", "section"],
  ["github_token", "GitHub Token（可选；留空则不修改，沿用启动环境变量）", "password"],
  ["keywords", "关键词（每行一个）", "lines"],
  ["seed_repos", "种子仓库（每行一个：owner/repo）", "lines"],
  ["mirror_prefixes", "加速前缀（每行一个 URL，例：https://gh1.lhl.one/）。复制 / 导出链接时会自动拼在前面；留空则不启用", "prefixes"],

  ["_sec2", "爬取", "section"],
  ["max_repos_per_keyword", "每关键词最多仓库数", "number"],
  ["max_repos_total", "仓库总数上限", "number"],
  ["concurrency", "并发数", "number"],
  ["request_timeout", "请求超时(秒)", "number"],

  ["_sec3", "前台", "section"],
  ["show_update_button", "前台首页显示「更新」按钮与任务进度（关闭后：前台不显示任何任务入口与进度，只能在 /admin 触发和查看）", "bool"],

  ["_sec4", "定时任务", "section"],
  ["crawl_interval_hours", "全量爬取间隔（小时）", "number"],
  ["check_interval_hours", "可用性复检间隔（小时）", "number"],
];

// 后台表单是否已成功载入服务端配置。
// 未载入就点保存会把所有字段当空值提交，等于清空配置，必须先拦截。
let ADMIN_FORM_LOADED = false;

function fmtPrefix(p){
  // 后台只关心 URL；名称由后端从域名推导，hosts 属于 config.json 级配置
  return typeof p === "string" ? p : ((p && p.prefix) || "");
}

function buildAdminForm(){
  ADMIN_FORM_LOADED = false;
  $("#adminForm").innerHTML = ADMIN_FIELDS.map(([k, label, type]) => {
    if(type === "section") return `<div class="af-sec">${esc(label)}</div>`;
    const area = type === "lines" || type === "json" || type === "prefixes";
    if(type === "bool"){
      return `<div class="full"><label class="af-bool"><input type="checkbox" id="af_${k}"> <span>${esc(label)}</span></label></div>`;
    }
    const input = area
      ? `<textarea id="af_${k}" placeholder="${esc(label)}"></textarea>`
      : `<input type="${type === "password" ? "password" : "text"}" id="af_${k}" placeholder="${esc(label)}">`;
    return `<div class="${area ? "full" : ""}"><label>${esc(label)}</label>${input}</div>`;
  }).join("");
}

function fillAdminForm(cfgResp){
  const c = cfgResp.config || {};
  for(const [k, , type] of ADMIN_FIELDS){
    const el = $("#af_" + k); if(!el) continue;
    let val = c[k];
    if(type === "bool"){ el.checked = !!val; continue; }
    if(type === "password"){
      // 不回填真实 token：留空即「不修改」，避免明文写入数据卷
      if(k === "github_token"){
        el.value = "";
        el.placeholder = cfgResp.github_token_set
          ? "已设置（留空则不修改）"
          : "未设置（可选，用于提高 GitHub API 配额）";
      }else{
        el.value = val ?? "";
      }
      continue;
    }
    if(type === "prefixes"){
      el.value = (val || []).map(fmtPrefix).filter(Boolean).join("\n");
      continue;
    }
    if(type === "lines") val = (val || []).join("\n");
    else if(type === "json") val = JSON.stringify(val || [], null, 1);
    else val = (val ?? "");
    el.value = val;
  }
  ADMIN_FORM_LOADED = true;
}

async function saveAdmin(){
  if(!ADMIN_FORM_LOADED){
    toast("配置尚未载入，保存已取消（避免清空配置）");
    return false;
  }
  const body = {};
  for(const [k, , type] of ADMIN_FIELDS){
    const el = $("#af_" + k); if(!el) continue;
    const raw = el.value.trim();
    if(type === "bool"){ body[k] = !!el.checked; continue; }
    if(type === "lines"){ body[k] = raw ? raw.split(/\n+/).map(s => s.trim()).filter(Boolean) : []; continue; }
    if(type === "prefixes"){
      // 只提交 URL 字符串；补尾斜杠、推导名称等交给后端 _norm_mirror 统一处理
      body[k] = raw ? raw.split(/\n+/).map(s => s.trim()).filter(Boolean) : [];
      continue;
    }
    else if(type === "json"){
      if(raw){ try{ body[k] = JSON.parse(raw); }
        catch(e){ toast("字段 " + k + " 不是合法 JSON"); return false; } }
      else body[k] = [];
    }
    else if(type === "password"){ if(raw) body[k] = raw; }
    else if(type === "number"){ if(raw !== "") body[k] = Number(raw); }
    else body[k] = raw;
  }
  try{
    const r = await fetch("/api/admin/config", {method:"POST",
      headers:{Authorization:"Bearer " + _adminToken(), "Content-Type":"application/json"},
      body: JSON.stringify(body)});
    if(r.status === 401){ localStorage.removeItem("lxh.admin"); location.href = "/login"; return false; }
    if(!r.ok) throw new Error();
    toast("配置已保存并即时生效（无需重启）");
    return true;
  }catch(e){ toast("保存失败"); return false; }
}


function adminApp(){
  return {
    authed: false,
    user: "", pass: "", err: "", busy: false, taskBusy: false,
    stats: {total:"—", alive:"—", valid:"—", lastCrawl:"—", lastCrawlFull:""},
    prog: {running:false, title:"", msg:"", elapsed:"", pct:0, indet:false, stats:"", logs:""},
    _timer: null,

    async init(){
      initTheme();
      buildAdminForm();
      const path = location.pathname;
      const tk = _adminToken();
      if(!tk){
        this.authed = false;
        if(path === "/admin") location.href = "/login";
        return;
      }
      try{
        const r = await fetch("/api/admin/config", {headers:{Authorization:"Bearer " + tk}});
        if(r.ok){
          fillAdminForm(await r.json());
          this.authed = true;
          this.loadStats();
          if(path === "/login") location.href = "/admin";
          return;
        }
      }catch(e){}
      localStorage.removeItem("lxh.admin");
      this.authed = false;
      if(path === "/admin") location.href = "/login";
    },

    async loadStats(){
      try{
        const s = await (await fetch("/api/status")).json();
        this.stats.total = s.stats.total;
        this.stats.alive = s.stats.alive;
        this.stats.valid = s.stats.valid;
        const lc = s.last_crawl;
        const when = lc ? (lc.finished_at || lc.started_at || "") : "";
        const rel = fmtRel(when);
        this.stats.lastCrawl = rel.t;          // 「3 小时前」这类短文本，避免溢出
        this.stats.lastCrawlFull = rel.full;   // 完整时间放 title
        // 打开后台时若已有任务在跑，自动接上进度显示
        if(s.busy && !this._timer) this.startWatch();
      }catch(e){}
    },

    async login(){
      this.err = ""; this.busy = true;
      try{
        const r = await fetch("/api/admin/login", {method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({username: this.user.trim(), password: this.pass})});
        if(r.status === 403){ this.err = "后台未启用（部署时需设置环境变量 LXH_ADMIN_PASS）"; return; }
        if(!r.ok){ this.err = "账户名或密码错误"; return; }
        const j = await r.json();
        localStorage.setItem("lxh.admin", j.token);
        location.href = "/admin";
      }catch(e){ this.err = "登录失败"; }
      finally{ this.busy = false; }
    },

    async logout(){
      try{
        await fetch("/api/admin/logout", {method:"POST",
          headers:{Authorization:"Bearer " + _adminToken()}});
      }catch(e){}
      localStorage.removeItem("lxh.admin");
      location.href = "/login";
    },

    async save(){ if(await saveAdmin()) this.loadStats(); },
    async crawl(){ await this.runTask("/api/crawl"); },
    async check(){ await this.runTask("/api/check"); },
    async runTask(p){
      this.taskBusy = true;
      await trigger(p);
      await this.startWatch();
    },

    // 触发后轮询 /api/progress，实时渲染进度；任务结束后刷新概览
    async startWatch(){
      if(this._timer) return;
      await this.tick();
      this._timer = setInterval(() => this.tick(), 1000);
    },

    async tick(){
      let p;
      try{ p = await (await fetch("/api/progress")).json(); }catch(e){ return; }
      if(!p.running){
        if(this._timer){ clearInterval(this._timer); this._timer = null; }
        this.renderProg(p, true);
        this.taskBusy = false;
        this.loadStats();
        const s = p.stats || {};
        toast(p.cancelled ? "任务已取消"
          : p.kind === "crawl" ? `爬取完成：检测 ${s.checked ?? "—"} 条，疑似音源 ${s.valid ?? "—"} 条`
          : `检测完成：存活 ${s.alive ?? "—"} / 失效 ${s.dead ?? "—"}`);
        setTimeout(() => { this.prog.running = false; }, 6000);
        return;
      }
      this.renderProg(p, false);
    },

    renderProg(p, done){
      const s = p.stats || {};
      this.prog.running = !done;
      this.prog.title = done ? (p.cancelled ? "已取消" : "已完成")
                            : (p.kind === "crawl" ? "正在爬取" : "正在检测");
      this.prog.msg = p.message || "";
      this.prog.elapsed = "已用时 " + fmtElapsed(p.elapsed);
      const total = s.urls_total || 0, cnt = s.urls_done || 0;
      this.prog.indet = !(done || total > 0);
      this.prog.pct = done ? 100 : (total > 0 ? Math.round(cnt / total * 1000) / 10 : 100);
      const bits = [];
      if(s.repos_total) bits.push(`仓库 ${s.repos_done || 0}/${s.repos_total}`);
      if(total) bits.push(`链接 ${cnt}/${total}`);
      if(p.kind === "crawl"){
        if(s.valid != null) bits.push(`疑似音源 ${s.valid}`);
        if(s.new != null) bits.push(`新增 ${s.new}`);
      }else if(s.alive != null) bits.push(`存活 ${s.alive}`);
      if(s.dead) bits.push(`失效 ${s.dead}`);
      this.prog.stats = bits.join(" · ") || "正在收集候选链接…";
      this.prog.logs = (p.logs || []).join("\n");
    },
  };
}
