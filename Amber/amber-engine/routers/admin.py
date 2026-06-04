"""Admin console: read-only ops metrics + share moderation.

All JSON endpoints sit behind `get_current_admin`. A self-contained HTML
dashboard is served at GET /api/admin/dashboard (public HTML shell; it calls the
guarded APIs with an admin token entered in-page).
"""
import os
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

import state
from database import User, SharedPersona
from deps import get_db, get_current_admin
from repositories import admin_repo, explore_repo, platform_repo, redeem_repo
from schemas import (
    AdminRedeemCodeResponse,
    AdminRedeemGenerateRequest,
    AdminRedeemGenerateResponse,
    PlatformConfigResponse,
    PlatformConfigUpdate,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/pricing", response_model=PlatformConfigResponse)
def get_pricing(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return platform_repo.serialize(platform_repo.get_config(db))


@router.post("/pricing", response_model=PlatformConfigResponse)
def update_pricing(
    req: PlatformConfigUpdate,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    cfg = platform_repo.update_config(db, **req.model_dump(exclude_unset=True))
    return platform_repo.serialize(cfg)


@router.post("/redeem-codes/generate", response_model=AdminRedeemGenerateResponse)
def generate_redeem_codes(
    req: AdminRedeemGenerateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        batch_id, rows = redeem_repo.generate_codes(
            db,
            count=req.count,
            fragments=req.fragments,
            note=req.note,
            created_by=admin.id,
        )
    except redeem_repo.RedeemError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    items = [AdminRedeemCodeResponse(**redeem_repo.serialize(row)) for row in rows]
    return AdminRedeemGenerateResponse(
        batch_id=batch_id,
        count=len(rows),
        fragments=req.fragments,
        codes=[row.code for row in rows],
        items=items,
    )


@router.get("/redeem-codes", response_model=list[AdminRedeemCodeResponse])
def list_redeem_codes(
    limit: int = 100,
    status: str | None = None,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return [AdminRedeemCodeResponse(**redeem_repo.serialize(row)) for row in redeem_repo.list_codes(db, limit=limit, status=status)]

_PROCESS_START = time.time()


@router.get("/overview")
def get_overview(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return admin_repo.overview(db)


@router.get("/usage")
def get_usage(limit: int = 100, status: str | None = None,
              _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    rows = admin_repo.list_usage(db, limit=limit, status=status)
    return [
        {
            "id": r.id, "user_id": r.user_id, "event_type": r.event_type, "endpoint": r.endpoint,
            "provider": r.provider, "model_id": r.model_id, "status": r.status,
            "cost_fragments": r.cost_fragments, "refunded_fragments": r.refunded_fragments,
            "latency_ms": r.latency_ms, "error_code": r.error_code,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/ledger")
def get_ledger(limit: int = 100, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [admin_repo.serialize_ledger(r) for r in admin_repo.list_ledger(db, limit=limit)]


@router.get("/orders")
def get_orders(limit: int = 100, status: str | None = None,
               _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [admin_repo.serialize_order(r) for r in admin_repo.list_orders(db, limit=limit, status=status)]


@router.get("/shares")
def get_shares(limit: int = 100, status: str | None = None,
               _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [admin_repo.serialize_share(r) for r in admin_repo.list_shares(db, limit=limit, status=status)]


@router.post("/shares/{share_id}/remove")
def moderate_share(share_id: str, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Moderator takedown of a shared persona (soft-remove from the marketplace)."""
    row = db.query(SharedPersona).filter(SharedPersona.id == share_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="分享不存在")
    explore_repo.unpublish(db, row)
    return {"status": "removed", "id": share_id}


@router.get("/system")
def get_system(_: User = Depends(get_current_admin)):
    uptime_s = int(time.time() - _PROCESS_START)
    payload = {
        "uptime_seconds": uptime_s,
        "env": os.getenv("ENV", "dev"),
        "janitor": {
            "test_mode": state.system_stats.get("janitor_test_mode"),
            "deleted_last_min": state.system_stats.get("janitor_deleted_last_min"),
            "last_run": state.system_stats.get("janitor_last_run"),
            "last_latency_ms": state.system_stats.get("last_latency_ms"),
        },
        "host": {"available": False},
        "generated_at": datetime.utcnow().isoformat(),
    }
    try:  # best-effort host metrics; psutil is optional
        import psutil
        payload["host"] = {
            "available": True,
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "mem_percent": psutil.virtual_memory().percent,
            "mem_used_mb": round(psutil.virtual_memory().used / 1024 / 1024),
            "mem_total_mb": round(psutil.virtual_memory().total / 1024 / 1024),
            "disk_percent": psutil.disk_usage(os.getcwd()).percent,
        }
    except Exception:
        pass
    return payload


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    return _DASHBOARD_HTML


_DASHBOARD_HTML = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Echo 管理后台</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--bd:#30363d;--fg:#e6edf3;--mut:#8b949e;--acc:#d2a24c}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,'Segoe UI',sans-serif;background:var(--bg);color:var(--fg)}
header{display:flex;gap:8px;align-items:center;padding:14px 20px;border-bottom:1px solid var(--bd);position:sticky;top:0;background:var(--bg);z-index:5}
header h1{font-size:16px;margin:0;flex:1}
input,button{font:inherit;border-radius:8px;border:1px solid var(--bd);background:var(--card);color:var(--fg);padding:7px 10px}
button{cursor:pointer}button:hover{border-color:var(--acc)}
main{padding:20px;max-width:1100px;margin:0 auto}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:14px}
.card .k{color:var(--mut);font-size:12px}.card .v{font-size:22px;font-weight:600;margin-top:4px}
.card .v small{font-size:12px;color:var(--mut);font-weight:400}
h2{font-size:14px;color:var(--acc);margin:22px 0 8px;border-bottom:1px solid var(--bd);padding-bottom:6px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--bd);white-space:nowrap}
th{color:var(--mut);font-weight:500}
.tag{padding:1px 7px;border-radius:99px;font-size:11px;border:1px solid var(--bd)}
.ok{color:#3fb950}.err{color:#f85149}.mut{color:var(--mut)}
.scroll{overflow:auto;max-height:320px;border:1px solid var(--bd);border-radius:10px}
.row{display:flex;gap:8px;align-items:center}
</style></head><body>
<header>
  <h1>🟡 Echo 管理后台</h1>
  <input id="tok" type="password" placeholder="管理员 access token" style="width:280px"/>
  <button onclick="saveTok()">保存令牌</button>
  <button onclick="loadAll()">刷新</button>
</header>
<main>
  <div id="err" class="err"></div>
  <div class="cards" id="cards"></div>
  <h2>平台模型与定价（硅基流动 / DeepSeek）</h2>
  <div class="card" id="pricing">
    <div class="row" style="flex-wrap:wrap;gap:12px">
      <label>启用平台模型 <input type="checkbox" id="p_enabled"></label>
      <label>Base URL <input id="p_base" style="width:240px"></label>
      <label>选择模型 <select id="p_model_pick" style="width:240px" onchange="if(this.value)document.getElementById('p_model').value=this.value"></select></label>
      <label>模型 ID <input id="p_model" style="width:240px" placeholder="也可手动输入"></label>
      <label>API Key <input id="p_key" type="password" placeholder="留空=不修改" style="width:200px"> <span id="p_keyhint" class="mut"></span></label>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:12px;margin-top:10px">
      <label>对话单价 <input id="p_chat" type="number" min="0" style="width:80px"></label>
      <label>蒸馏单价 <input id="p_distill" type="number" min="0" style="width:80px"></label>
      <label>结晶单价 <input id="p_snap" type="number" min="0" style="width:80px"></label>
      <button onclick="savePricing()">保存定价</button>
      <span id="p_msg" class="mut"></span>
    </div>
  </div>
  <h2>Redeem Codes</h2>
  <div class="card" id="redeem">
    <div class="row" style="flex-wrap:wrap;gap:12px">
      <label>Fragments <input id="r_fragments" type="number" min="100" max="1000" value="100" style="width:90px"></label>
      <label>Count <input id="r_count" type="number" min="1" max="500" value="10" style="width:90px"></label>
      <label>Note <input id="r_note" maxlength="200" style="width:240px"></label>
      <button onclick="generateRedeemCodes()">Generate</button>
      <button onclick="loadRedeemCodes()">Refresh Codes</button>
      <span id="r_msg" class="mut"></span>
    </div>
    <textarea id="r_result" readonly style="width:100%;height:90px;margin-top:10px;border-radius:8px;border:1px solid var(--bd);background:var(--bg);color:var(--fg);padding:8px"></textarea>
  </div>
  <div class="scroll"><table id="redeemCodes"></table></div>
  <h2>服务器负载</h2><div class="cards" id="sys"></div>
  <h2>消耗记录（usage_events）</h2><div class="scroll"><table id="usage"></table></div>
  <h2>碎片流水（ledger）</h2><div class="scroll"><table id="ledger"></table></div>
  <h2>订单</h2><div class="scroll"><table id="orders"></table></div>
  <h2>分享审核（shared personas）</h2><div class="scroll"><table id="shares"></table></div>
</main>
<script>
const TK='amber_admin_token';
const tokEl=document.getElementById('tok');
tokEl.value=localStorage.getItem(TK)||'';
function saveTok(){localStorage.setItem(TK,tokEl.value.trim());loadAll();}
function H(){return{'Authorization':'Bearer '+(localStorage.getItem(TK)||'')}}
async function api(p,opt={}){const r=await fetch(p,{...opt,headers:{...H(),...(opt.headers||{})}});if(!r.ok)throw new Error(p+' → '+r.status);return r.json();}
function card(k,v,sub){return `<div class="card"><div class="k">${k}</div><div class="v">${v}${sub?' <small>'+sub+'</small>':''}</div></div>`}
function tbl(el,rows,cols){const t=document.getElementById(el);if(!rows.length){t.innerHTML='<tr><td class="mut">无数据</td></tr>';return;}
  t.innerHTML='<tr>'+cols.map(c=>`<th>${c[0]}</th>`).join('')+'</tr>'+rows.map(r=>'<tr>'+cols.map(c=>`<td>${c[1](r)??''}</td>`).join('')+'</tr>').join('');}
function st(s){const cls=s==='success'||s==='paid'?'ok':(s&&s.includes('error')||s==='insufficient_balance'?'err':'mut');return `<span class="tag ${cls}">${s||''}</span>`}
function dt(s){return s?String(s).replace('T',' ').slice(0,19):''}
async function loadAll(){
  const err=document.getElementById('err');err.textContent='';
  try{
    const o=await api('/api/admin/overview');
    document.getElementById('cards').innerHTML=[
      card('用户总数',o.users.total,'活跃 '+o.users.active),
      card('24h 新增',o.users.new_24h),
      card('累计充值碎片',o.fragments.total_recharged),
      card('累计消耗碎片',o.fragments.total_consumed),
      card('在外余额',o.fragments.balance_outstanding),
      card('24h 消耗',o.fragments.consumed_24h),
      card('付费订单',o.revenue.paid_orders,'¥'+o.revenue.revenue_cny),
      card('24h 调用',o.usage.events_24h),
      card('公开分享',o.shares.public,'下架 '+o.shares.removed),
      card('累计安装',o.shares.installs_total),
    ].join('');
    await loadPricing();
    await loadRedeemCodes();
    const s=await api('/api/admin/system');
    document.getElementById('sys').innerHTML=[
      card('运行时长',Math.floor(s.uptime_seconds/3600)+'h'+Math.floor(s.uptime_seconds%3600/60)+'m'),
      card('环境',s.env),
      s.host.available?card('CPU',s.host.cpu_percent+'%'):card('CPU','psutil 未装','可选'),
      s.host.available?card('内存',s.host.mem_percent+'%',s.host.mem_used_mb+'/'+s.host.mem_total_mb+'MB'):card('内存','-'),
      s.host.available?card('磁盘',s.host.disk_percent+'%'):card('磁盘','-'),
      card('Janitor',s.janitor.test_mode?'测试模式':'正常',(s.janitor.last_latency_ms||0)+'ms'),
    ].join('');
    tbl('usage',await api('/api/admin/usage?limit=100'),[['时间',r=>dt(r.created_at)],['用户',r=>r.user_id?.slice(0,8)],['类型',r=>r.event_type],['状态',r=>st(r.status)],['花费',r=>r.cost_fragments],['退款',r=>r.refunded_fragments],['延迟',r=>r.latency_ms+'ms'],['错误',r=>r.error_code||'']]);
    tbl('ledger',await api('/api/admin/ledger?limit=100'),[['时间',r=>dt(r.created_at)],['用户',r=>r.user_id?.slice(0,8)],['类型',r=>r.type],['变动',r=>(r.delta>0?'+':'')+r.delta],['余额后',r=>r.balance_after]]);
    tbl('orders',await api('/api/admin/orders?limit=100'),[['时间',r=>dt(r.created_at)],['用户',r=>r.user_id?.slice(0,8)],['SKU',r=>r.sku],['金额',r=>'¥'+(r.amount_cny/100).toFixed(2)],['碎片',r=>r.fragments],['渠道',r=>r.channel],['状态',r=>st(r.status)]]);
    tbl('shares',await api('/api/admin/shares?limit=100'),[['时间',r=>dt(r.created_at)],['名称',r=>r.name],['作者',r=>r.owner_nickname||r.owner_id?.slice(0,8)],['安装',r=>r.install_count],['状态',r=>st(r.status)],['操作',r=>r.status==='public'?`<button onclick="rm('${r.id}')">下架</button>`:'']]);
  }catch(e){err.textContent='加载失败：'+e.message+'（请确认令牌为管理员）';}
}
async function rm(id){if(!confirm('确认下架该分享？'))return;try{await api('/api/admin/shares/'+id+'/remove',{method:'POST'});loadAll();}catch(e){alert(e.message);}}
async function loadRedeemCodes(){
  const rows=await api('/api/admin/redeem-codes?limit=100');
  tbl('redeemCodes',rows,[
    ['Created',r=>dt(r.created_at)],
    ['Code',r=>r.code],
    ['Fragments',r=>r.fragments],
    ['Status',r=>st(r.status)],
    ['Redeemed By',r=>r.redeemed_by?r.redeemed_by.slice(0,8):''],
    ['Redeemed At',r=>dt(r.redeemed_at)],
    ['Note',r=>r.note||'']
  ]);
}
async function generateRedeemCodes(){
  const msg=document.getElementById('r_msg');
  const body={
    fragments:parseInt(document.getElementById('r_fragments').value)||100,
    count:parseInt(document.getElementById('r_count').value)||1,
    note:document.getElementById('r_note').value.trim()||null
  };
  try{
    const res=await api('/api/admin/redeem-codes/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    document.getElementById('r_result').value=res.codes.join('\\n');
    msg.textContent='Generated '+res.count+' codes';
    msg.className='ok';
    await loadRedeemCodes();
  }catch(e){
    msg.textContent='Generate failed: '+e.message;
    msg.className='err';
  }
}
const MODELS=[
  ['DeepSeek 深度求索',['deepseek-ai/DeepSeek-V4-Pro','deepseek-ai/DeepSeek-V4-Flash','deepseek-ai/DeepSeek-V3.2','Pro/deepseek-ai/DeepSeek-V3.2','deepseek-ai/DeepSeek-V3.1-Terminus','Pro/deepseek-ai/DeepSeek-V3.1-Terminus','deepseek-ai/DeepSeek-V3','Pro/deepseek-ai/DeepSeek-V3','deepseek-ai/DeepSeek-R1','Pro/deepseek-ai/DeepSeek-R1','deepseek-ai/DeepSeek-R1-0528-Qwen3-8B']],
  ['通义千问 Qwen',['Qwen/Qwen3.5-397B-A17B','Qwen/Qwen3.5-122B-A10B','Qwen/Qwen3.6-35B-A3B','Qwen/Qwen3.6-27B','Qwen/Qwen3.5-35B-A3B','Qwen/Qwen3.5-27B','Qwen/Qwen3.5-9B','Qwen/Qwen3.5-4B','Qwen/Qwen3-32B','Qwen/Qwen3-30B-A3B-Instruct-2507','Qwen/Qwen3-14B','Qwen/Qwen3-8B','Qwen/Qwen3-Coder-30B-A3B-Instruct','Qwen/Qwen2.5-72B-Instruct-128K','Qwen/Qwen2.5-72B-Instruct','Qwen/Qwen2.5-32B-Instruct','Qwen/Qwen2.5-14B-Instruct','Qwen/Qwen2.5-7B-Instruct','Pro/Qwen/Qwen2.5-7B-Instruct']],
  ['智谱 GLM',['Pro/zai-org/GLM-5.1','Pro/zai-org/GLM-5','Pro/zai-org/GLM-4.7','zai-org/GLM-4.5-Air','THUDM/GLM-4-32B-0414','THUDM/GLM-4-9B-0414','THUDM/GLM-Z1-9B-0414']],
  ['Kimi 月之暗面',['Pro/moonshotai/Kimi-K2.6','Pro/moonshotai/Kimi-K2.5']],
  ['MiniMax',['MiniMaxAI/MiniMax-M2.5','Pro/MiniMaxAI/MiniMax-M2.5']],
  ['视觉 / 多模态',['Qwen/Qwen3-VL-32B-Instruct','Qwen/Qwen3-VL-32B-Thinking','Qwen/Qwen3-VL-30B-A3B-Instruct','Qwen/Qwen3-VL-30B-A3B-Thinking','Qwen/Qwen3-VL-8B-Instruct','Qwen/Qwen3-VL-8B-Thinking','zai-org/GLM-4.5V','Qwen/Qwen3-Omni-30B-A3B-Instruct','Qwen/Qwen3-Omni-30B-A3B-Thinking']],
  ['其他',['ByteDance-Seed/Seed-OSS-36B-Instruct','inclusionAI/Ling-flash-2.0','inclusionAI/Ling-mini-2.0','stepfun-ai/Step-3.5-Flash','tencent/Hunyuan-A13B-Instruct','tencent/Hunyuan-MT-7B']],
];
function fillModelPicker(){
  const sel=document.getElementById('p_model_pick');
  if(sel.dataset.filled)return;
  sel.innerHTML='<option value="">— 选择后填入右侧 —</option>'+MODELS.map(g=>'<optgroup label="'+g[0]+'">'+g[1].map(m=>'<option value="'+m+'">'+m+'</option>').join('')+'</optgroup>').join('');
  sel.dataset.filled='1';
}
async function loadPricing(){
  fillModelPicker();
  const p=await api('/api/admin/pricing');
  document.getElementById('p_enabled').checked=p.platform_enabled;
  document.getElementById('p_base').value=p.provider_base_url||'';
  document.getElementById('p_model').value=p.provider_model_id||'';
  document.getElementById('p_model_pick').value=p.provider_model_id||'';
  document.getElementById('p_chat').value=p.cost_per_chat;
  document.getElementById('p_distill').value=p.cost_per_distill;
  document.getElementById('p_snap').value=p.cost_per_snapshot;
  document.getElementById('p_keyhint').textContent=p.api_key_set?('已配置 '+p.api_key_masked):'未配置';
}
async function savePricing(){
  const body={
    platform_enabled:document.getElementById('p_enabled').checked,
    provider_base_url:document.getElementById('p_base').value.trim(),
    provider_model_id:document.getElementById('p_model').value.trim(),
    cost_per_chat:parseInt(document.getElementById('p_chat').value)||0,
    cost_per_distill:parseInt(document.getElementById('p_distill').value)||0,
    cost_per_snapshot:parseInt(document.getElementById('p_snap').value)||0,
  };
  const key=document.getElementById('p_key').value.trim();
  if(key)body.provider_api_key=key;
  const msg=document.getElementById('p_msg');
  try{await api('/api/admin/pricing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    document.getElementById('p_key').value='';msg.textContent='已保存 ✓';msg.className='ok';await loadPricing();
  }catch(e){msg.textContent='保存失败：'+e.message;msg.className='err';}
}
if(localStorage.getItem(TK))loadAll();
</script></body></html>"""
