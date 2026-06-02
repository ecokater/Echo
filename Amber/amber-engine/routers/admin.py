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
from repositories import admin_repo, explore_repo

router = APIRouter(prefix="/api/admin", tags=["admin"])

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
<title>Amber 管理后台</title>
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
  <h1>🟡 Amber 管理后台</h1>
  <input id="tok" type="password" placeholder="管理员 access token" style="width:280px"/>
  <button onclick="saveTok()">保存令牌</button>
  <button onclick="loadAll()">刷新</button>
</header>
<main>
  <div id="err" class="err"></div>
  <div class="cards" id="cards"></div>
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
if(localStorage.getItem(TK))loadAll();
</script></body></html>"""
