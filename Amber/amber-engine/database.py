import os
import uuid
from sqlalchemy import (
    create_engine, Column, Integer, BigInteger, String, Float, Boolean,
    DateTime, Text, ForeignKey, inspect,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
from config import DATABASE_URL

# SQLite needs check_same_thread; Postgres ignores connect_args
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _uuid() -> str:
    return str(uuid.uuid4())


# ───────────────────────── Persona / Message / Corpus ─────────────────────────

class Persona(Base):
    __tablename__ = "personas"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True)  # multi-tenant owner
    name = Column(String, nullable=False)
    gender = Column(String)
    relationship_desc = Column(String)
    impression = Column(Text)
    avatar = Column(Text, nullable=True)
    token = Column(String, nullable=True)
    core_memory = Column(Text)
    traits = Column(Text)
    catchphrases = Column(Text)

    stability = Column(Float, default=85.0)
    synchronization = Column(Float, default=90.0)

    # Emotion axes (drive prompt)
    happiness = Column(Float, default=50.0)
    anger = Column(Float, default=0.0)
    anxiety = Column(Float, default=0.0)

    # Relationship dimensions (console display)
    intimacy = Column(Float, default=50.0, server_default="50.0")
    activity = Column(Float, default=50.0, server_default="50.0")
    curiosity = Column(Float, default=50.0, server_default="50.0")

    # Tunable params
    response_temp = Column(Float, default=70.0, server_default="70.0")
    proactivity = Column(Float, default=55.0, server_default="55.0")
    memory_depth = Column(Float, default=88.0, server_default="88.0")

    # Proactive override / relay
    is_override_active = Column(Boolean, default=False, server_default="0")
    override_interval = Column(Integer, default=180, server_default="180")
    last_interaction_time = Column(DateTime, default=datetime.utcnow)
    last_relay_context = Column(Text, nullable=True)
    bot_app_id = Column(String, nullable=True)
    bot_app_secret = Column(String, nullable=True)
    bot_token = Column(String, nullable=True)
    last_incubation_time = Column(DateTime, default=datetime.utcnow)

    messages = relationship("Message", back_populates="persona", cascade="all, delete-orphan")
    corpus = relationship("PersonaCorpus", back_populates="persona", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(String, ForeignKey("personas.id"), index=True)
    user_id = Column(String, index=True, nullable=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    is_filtered = Column(Boolean, default=False)
    weight = Column(Float, default=1.0, server_default="1.0", nullable=False)
    is_pinned = Column(Boolean, default=False, server_default="0", nullable=False)

    persona = relationship("Persona", back_populates="messages")


class PersonaCorpus(Base):
    __tablename__ = "persona_corpus"

    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(String, ForeignKey("personas.id"), index=True)
    user_id = Column(String, index=True, nullable=True)
    content = Column(Text, nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    weight = Column(Float, default=1.0, server_default="1.0", nullable=False)
    is_pinned = Column(Boolean, default=False, server_default="0", nullable=False)

    persona = relationship("Persona", back_populates="corpus")


# ───────────────────────── Commercial: User / Wallet / Billing ─────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid, index=True)
    phone = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=False)
    nickname = Column(String, nullable=True)
    avatar_url = Column(Text, nullable=True)
    status = Column(String, default="active", server_default="active")  # active|banned|deleted
    created_at = Column(DateTime, default=datetime.utcnow)


class FragmentAccount(Base):
    __tablename__ = "fragment_account"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    balance = Column(BigInteger, default=0, server_default="0", nullable=False)
    total_recharged = Column(BigInteger, default=0, server_default="0", nullable=False)
    total_consumed = Column(BigInteger, default=0, server_default="0", nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FragmentLedger(Base):
    __tablename__ = "fragment_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    delta = Column(BigInteger, nullable=False)  # +recharge / -consume
    type = Column(String, nullable=False)  # recharge|consume_chat|consume_distill|consume_snapshot|refund|gift
    ref_id = Column(String, nullable=True)  # order id / message id / etc.
    balance_after = Column(BigInteger, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    sku = Column(String, nullable=False)
    amount_cny = Column(Integer, nullable=False)  # in cents (分)
    fragments = Column(BigInteger, nullable=False)
    channel = Column(String, nullable=False)  # wechat|alipay|apple_iap|google_play|dev
    status = Column(String, default="pending", server_default="pending")  # pending|paid|failed|refunded
    out_trade_no = Column(String, unique=True, index=True, nullable=False)
    platform_txn_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)


class SkuCatalog(Base):
    __tablename__ = "sku_catalog"

    sku = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    fragments = Column(BigInteger, nullable=False)
    price_cny = Column(Integer, nullable=False)  # in cents (分)
    apple_product_id = Column(String, nullable=True)
    active = Column(Boolean, default=True, server_default="1")


# ───────────────────────── Legacy hard-reset guards (dev only) ─────────────────

inspector = inspect(engine)
if inspector.has_table("personas"):
    columns = [col["name"] for col in inspector.get_columns("personas")]
    if "is_override_active" not in columns:
        print("⚠️ 旧库缺 'is_override_active'，执行刷洗...")
        Base.metadata.drop_all(bind=engine)
if inspector.has_table("messages"):
    columns = [col["name"] for col in inspector.get_columns("messages")]
    if "weight" not in columns:
        print("⚠️ 旧库缺 'weight'，执行刷洗...")
        Base.metadata.drop_all(bind=engine)

Base.metadata.create_all(bind=engine)
