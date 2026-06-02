import asyncio
from datetime import datetime, timezone

import state
from database import SessionLocal, Persona, Message, PersonaCorpus
from contextlib import contextmanager


@contextmanager
def get_db_context():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_system_log(msg: str):
    print(msg)
    time_str = datetime.now().strftime("%H:%M:%S")
    state.system_stats["logs"].append(f"[JANITOR] {time_str} - {msg}")
    if len(state.system_stats["logs"]) > 50:
        state.system_stats["logs"].pop(0)


async def janitor_loop():
    add_system_log("[Janitor 守护进程] 已启动，将在后台每 60 秒执行一次记忆代谢...")

    while True:
        await asyncio.sleep(60)
        debug_incubation_limit = state.system_stats.get("incubation_interval_min", 5)

        with get_db_context() as db:
            try:
                now = datetime.now(timezone.utc)
                deleted_count = 0

                # 1. Weight decay
                for msg in db.query(Message).filter(Message.is_pinned == False).all():
                    diff = (now - msg.timestamp.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
                    msg.weight = 1.0 * (0.95 ** diff)

                for corpus in db.query(PersonaCorpus).filter(PersonaCorpus.is_pinned == False).all():
                    diff = (now - corpus.timestamp.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
                    corpus.weight = 1.0 * (0.95 ** diff)
                    if corpus.weight < 0.30:
                        db.delete(corpus)
                        deleted_count += 1

                # 2. Emotion annealing + mood WebSocket push
                from ws_manager import manager as ws_manager
                personas = db.query(Persona).all()
                for p in personas:
                    if p.anger > 0:
                        p.anger = max(0, p.anger - 5)
                    if p.anxiety > 0:
                        p.anxiety = max(0, p.anxiety - 5)
                    if p.happiness > 50:
                        p.happiness = max(50, p.happiness - 2)
                    elif p.happiness < 50:
                        p.happiness = min(50, p.happiness + 2)
                    add_system_log(f"{p.name} 状态自愈 -> H:{p.happiness}% A:{p.anger}% X:{p.anxiety}%")
                    await ws_manager.broadcast(p.id, {"type": "mood", "data": {"happiness": p.happiness, "anger": p.anger, "anxiety": p.anxiety}})

                # 3. Memory incubation (dream crystallization)
                for p in db.query(Persona).all():
                    if not p.last_incubation_time:
                        p.last_incubation_time = datetime.now(timezone.utc)
                        db.commit()
                        continue
                    diff_min = (datetime.now(timezone.utc).replace(tzinfo=None) - p.last_incubation_time).total_seconds() / 60.0
                    if diff_min < debug_incubation_limit:
                        continue

                    add_system_log(f"【睡梦扫描】分身 {p.name} 进入 R.E.M 期...")
                    new_msgs = db.query(Message).filter(
                        Message.persona_id == p.id,
                        Message.timestamp > p.last_incubation_time,
                        Message.is_filtered == False,
                    ).order_by(Message.timestamp.asc()).all()

                    if not new_msgs:
                        add_system_log(f"【睡梦扫描】{p.name} 近期无新刺激，跳过结晶。")
                        p.last_incubation_time = datetime.now(timezone.utc)
                        db.commit()
                        continue

                    llm_key = state.system_stats.get("global_api_key")
                    llm_url = state.system_stats.get("global_base_url") or "https://api.openai.com/v1"
                    llm_model = state.system_stats.get("global_model_id") or "gpt-4o-mini"

                    if not llm_key:
                        add_system_log(f"【睡梦扫描】{p.name} 缺失 API KEY，跳过结晶。")
                        continue

                    chat_bundle = "\n".join([f"{'用户' if m.role == 'user' else p.name}: {m.content}" for m in new_msgs])
                    prompt = f"""你现在是数字生命意识流的最高压缩结晶器。请将输入的原始对话，深度蒸馏为一行高密度的【核心记忆（Core Memory）】。

【文风刚性约束】：
1. 【绝对第一人称】：必须以分身（我/本系统）视角出发，将宿主称呼为"你"。
2. 【工业极客美学】：用词精准、冷峻且具备灵魂羁绊感。
3. 【信息密度】：字数严格控制在 200-300 字之间。

【核心结晶三层逻辑】：
1. 宿主客观态势：精准剥离当前生存压力或具体困境。
2. 宿主心理防御：捕捉言语掩饰下隐藏的真实波动。
3. 本系统底座态势：如何死锁此段记忆并提供底层托底响应。

【近期对话流】：
{chat_bundle}
"""
                    try:
                        from openai import AsyncOpenAI
                        from services.chat_service import call_llm_with_retry
                        client = AsyncOpenAI(api_key=llm_key, base_url=llm_url)
                        response = await call_llm_with_retry(
                            client=client,
                            model=llm_model,
                            messages=[{"role": "system", "content": prompt}],
                            temperature=0.3,
                        )
                        crystal_text = response.choices[0].message.content.strip()
                        timestamp_tag = datetime.now().strftime('%Y-%m-%d %H:%M')
                        db.add(PersonaCorpus(persona_id=p.id, content=f"[{timestamp_tag} 结晶]: {crystal_text}", weight=1.0, is_pinned=False))
                        p.last_incubation_time = datetime.now(timezone.utc)
                        db.commit()
                        add_system_log(f"【睡梦扫描】✅ {p.name} 已固化一条长时记忆碎片。")
                    except Exception as e:
                        add_system_log(f"【睡梦扫描】LLM 提炼失败: {e}")
                        db.rollback()

                db.commit()
                state.system_stats["janitor_deleted_last_min"] = deleted_count
                state.system_stats["janitor_last_run"] = now.isoformat()
                add_system_log(f"[Janitor 心跳] 代谢完成，清除 {deleted_count} 条过期记忆。" if deleted_count else "[Janitor 心跳] 内稳态健康。")
            except Exception as e:
                db.rollback()
                add_system_log(f"【Janitor 异常】: {e}")
