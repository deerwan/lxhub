function fmtElapsed(s){
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m} 分 ${sec} 秒` : `${sec} 秒`;
}

const ADMIN_FIELDS = [
  ["github_token", "GitHub Token（可选；留空则不修改，沿用启动环境变量）", "password"],
  ["keywords", "关键词（每行一个）", "lines"],
  ["seed_repos", "种子仓库（每行一个：owner/repo）", "lines"],
  ["seed_urls", "种子链接（每行一个）", "lines"],
  ["max_repos_per_keyword", "每关键词最多仓库数", "number"],
  ["max_repos_total", "仓库总数上限", "number"],
  ["max_files_per_repo", "每仓库最多文件数", "number"],
  ["max_file_bytes", "单文件字节上限", "number"],
  ["request_timeout", "请求超时(秒)", "number"],
  ["concurrency", "并发数", "number"],
  ["check_interval_hours", "复检间隔(小时)", "number"],
  ["crawl_interval_hours", "爬取间隔(小时)", "number"],
  ["mirror_prefixes", "加速前缀（每行一个 URL，例如 https://gh.example.com/）", "prefixes"],
  ["show_update_button", "前台首页显示「更新」按钮与任务进度（关闭后：前台不显示任何任务入口与进度，只能在 /admin 触发和查看）", "bool"],
];

function buildAdminForm(){
  $("#adminForm").innerHTML = ADMIN_FIELDS.map(([k, label, type]) => {
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
      el.value = (val || [])
        .map(p => typeof p === "string" ? p : ((p && p.prefix) || ""))
        .filter(Boolean).join("\n");
      continue;
    }
    if(type === "lines") val = (val || []).join("\n");
    else if(type === "json") val = JSON.stringify(val || [], null, 1);
    else val = (val ?? "");
    el.value = val;
  }
}

async function saveAdmin(){
  const body = {};
  for(const [k, , type] of ADMIN_FIELDS){
    const el = $("#af_" + k); if(!el) continue;
    const raw = el.value.trim();
    if(type === "bool"){ body[k] = !!el.checked; continue; }
    if(type === "lines"){ body[k] = raw ? raw.split(/\n+/).map(s => s.trim()).filter(Boolean) : []; continue; }
    if(type === "prefixes"){
      body[k] = raw ? raw.split(/\n+/).map(s => {
        let u = s.trim();
        // 只填域名时自动补尾斜杠，避免前缀与原链接拼接后破损
        if(u && !u.endsWith("/") && !u.endsWith("=")) u += "/";
        return u;
      }).filter(Boolean) : [];
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
    stats: {total:"—", alive:"—", valid:"—", lastCrawl:"—"},
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
        this.stats.lastCrawl = lc ? (lc.finished_at || lc.started_at || "—") : "—";
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
        return;
      }
      this.renderProg(p, false);
    },

    renderProg(p, done){
      const s = p.stats || {};
      this.prog.running = true;
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
