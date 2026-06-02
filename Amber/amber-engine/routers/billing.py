import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import User, Order, SkuCatalog
from deps import get_db, get_current_user
from services import wallet_service, payment_service

router = APIRouter(prefix="/api/billing", tags=["billing"])

# Allow dev settle channel only when not in production
DEV_PAY_ENABLED = os.getenv("ENV", "dev") != "prod"

DEFAULT_SKUS = [
    ("frag_60", "记忆碎片 ×60", 60, 600, "com.amber.frag60"),
    ("frag_300", "记忆碎片 ×300", 300, 3000, "com.amber.frag300"),
    ("frag_1280", "记忆碎片 ×1280", 1280, 12800, "com.amber.frag1280"),
    ("frag_3280", "记忆碎片 ×3280", 3280, 32800, "com.amber.frag3280"),
]


def seed_skus(db: Session):
    if db.query(SkuCatalog).count() == 0:
        for sku, title, frags, price, apple_id in DEFAULT_SKUS:
            db.add(SkuCatalog(sku=sku, title=title, fragments=frags, price_cny=price,
                              apple_product_id=apple_id, active=True))
        db.commit()
        print("【Billing】已初始化默认 SKU 套餐。")


class OrderRequest(BaseModel):
    sku: str
    channel: str  # dev|wechat|alipay|apple_iap


class DevSettleRequest(BaseModel):
    out_trade_no: str


class AppleVerifyRequest(BaseModel):
    out_trade_no: str
    receipt_data: str


def _settle_order(db: Session, order: Order, platform_txn_id: str = None) -> int:
    """Idempotent: credit fragments once. Returns new balance (or current if already paid)."""
    if order.status == "paid":
        return wallet_service.get_balance(db, order.user_id)
    order.status = "paid"
    order.paid_at = datetime.utcnow()
    if platform_txn_id:
        order.platform_txn_id = platform_txn_id
    db.commit()
    # ledger ref_id = order.id ensures one credit per order (audit trail)
    return wallet_service.credit(db, order.user_id, order.fragments, type_="recharge", ref_id=order.id)


@router.get("/skus")
def list_skus(db: Session = Depends(get_db)):
    rows = db.query(SkuCatalog).filter(SkuCatalog.active == True).all()
    return [
        {"sku": s.sku, "title": s.title, "fragments": s.fragments,
         "price_cny": s.price_cny, "price_display": f"¥{s.price_cny / 100:.2f}",
         "apple_product_id": s.apple_product_id}
        for s in rows
    ]


@router.post("/order")
def create_order(req: OrderRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sku = db.query(SkuCatalog).filter(SkuCatalog.sku == req.sku, SkuCatalog.active == True).first()
    if not sku:
        raise HTTPException(status_code=404, detail="套餐不存在")
    if req.channel == "dev" and not DEV_PAY_ENABLED:
        raise HTTPException(status_code=403, detail="dev 支付渠道在生产环境禁用")

    order = Order(
        user_id=user.id, sku=sku.sku, amount_cny=sku.price_cny, fragments=sku.fragments,
        channel=req.channel, status="pending", out_trade_no=payment_service.gen_out_trade_no(),
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    try:
        pay_params = payment_service.create_payment(req.channel, order)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"order_id": order.id, "out_trade_no": order.out_trade_no,
            "amount_cny": order.amount_cny, "fragments": order.fragments, "pay": pay_params}


@router.get("/orders")
def list_orders(limit: int = 50, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    limit = max(1, min(100, limit))
    rows = (
        db.query(Order)
        .filter(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "order_id": o.id,
            "out_trade_no": o.out_trade_no,
            "sku": o.sku,
            "amount_cny": o.amount_cny,
            "amount_display": f"¥{o.amount_cny / 100:.2f}",
            "fragments": int(o.fragments),
            "channel": o.channel,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "paid_at": o.paid_at.isoformat() if o.paid_at else None,
        }
        for o in rows
    ]


@router.post("/callback/dev")
def callback_dev(req: DevSettleRequest, db: Session = Depends(get_db)):
    """Dev-only: simulate successful payment to verify the full商业闭环 locally."""
    if not DEV_PAY_ENABLED:
        raise HTTPException(status_code=403, detail="dev 渠道已禁用")
    order = db.query(Order).filter(Order.out_trade_no == req.out_trade_no).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    balance = _settle_order(db, order, platform_txn_id="DEV-" + order.out_trade_no)
    return {"status": "paid", "order_id": order.id, "balance": balance}


@router.post("/callback/wechat")
async def callback_wechat(db: Session = Depends(get_db)):
    # TODO: 验签微信异步通知 → 解析 out_trade_no → _settle_order(db, order, wechat_txn_id)
    raise HTTPException(status_code=501, detail="WeChat callback not configured")


@router.post("/callback/alipay")
async def callback_alipay(db: Session = Depends(get_db)):
    # TODO: 验签支付宝异步通知 → 解析 out_trade_no → _settle_order(db, order, alipay_txn_id)
    raise HTTPException(status_code=501, detail="Alipay callback not configured")


@router.post("/verify/apple")
def verify_apple(req: AppleVerifyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.out_trade_no == req.out_trade_no, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    sku = db.query(SkuCatalog).filter(SkuCatalog.sku == order.sku).first()
    try:
        result = payment_service.verify_apple_receipt(req.receipt_data, sku)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    balance = _settle_order(db, order, platform_txn_id=result.get("transaction_id"))
    return {"status": "paid", "balance": balance}
