"""Payment channel dispatch.

- `dev`: fully functional for local商业闭环 verification (instantly settleable).
- `wechat` / `alipay` / `apple_iap`: signature-ready skeletons. Real integration
  requires a merchant ID (商户号) + cert/key, configured via env. Each TODO marks
  the exact插入点 for the official SDK call.
"""
import uuid


def gen_out_trade_no() -> str:
    return "ECHO" + uuid.uuid4().hex[:24]


def create_payment(channel: str, order) -> dict:
    """Return client-side payment params for the given channel."""
    if channel == "dev":
        # Dev channel: no real gateway; client calls /callback/dev to settle.
        return {"channel": "dev", "order_id": order.id, "out_trade_no": order.out_trade_no,
                "settle_url": "/api/billing/callback/dev"}

    if channel == "wechat":
        # TODO: 微信支付 — 调用统一下单 API (Native/APP), 返回 code_url 或 prepay_id。
        #   需要 mch_id, api_v3_key, 证书; 见 wechatpayv3 SDK。
        raise NotImplementedError("WeChat Pay not configured. Set merchant credentials.")

    if channel == "alipay":
        # TODO: 支付宝 — alipay.trade.precreate (扫码) / app.pay (APP)。需 app_id + 私钥。
        raise NotImplementedError("Alipay not configured. Set app_id and private key.")

    if channel == "apple_iap":
        # IAP flow is client-driven: client buys via StoreKit, then POSTs receipt to
        # /api/billing/verify/apple. No server-side payment creation needed here.
        return {"channel": "apple_iap", "order_id": order.id,
                "note": "Purchase via StoreKit then POST receipt to /verify/apple"}

    raise ValueError(f"Unsupported channel: {channel}")


def verify_apple_receipt(receipt_data: str, sku) -> dict:
    """Verify an Apple IAP receipt with App Store servers.

    TODO: POST receipt to https://buy.itunes.apple.com/verifyReceipt
    (fallback sandbox https://sandbox.itunes.apple.com/verifyReceipt),
    validate `bundle_id`, `product_id == sku.apple_product_id`, and that the
    transaction_id is not already settled. Returns {valid, transaction_id}.
    """
    raise NotImplementedError("Apple IAP receipt verification not configured.")
