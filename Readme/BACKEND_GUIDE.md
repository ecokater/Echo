# Echo Backend Guide

Echo Engine is the FastAPI backend under `Echo/echo-engine/`.

It is intentionally not a cloud chat-history database. The backend provides account, wallet, billing, inference proxy, usage audit, admin dashboard, explore cards, redeem codes, and moderation. Private conversations and private memories stay on the client.

## Run locally

```powershell
cd Echo/echo-engine
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Local API:

```text
http://127.0.0.1:8000
```

Health check:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/health
```

## Main modules

| Module | Purpose |
|--------|---------|
| `routers/auth.py` | Register, login, refresh token, account deletion |
| `routers/wallet.py` | Fragment balance and ledger |
| `routers/billing.py` | SKUs, orders, dev callback |
| `routers/inference.py` | Stateless chat, distill, memory-summary proxy |
| `routers/explore.py` | Public persona-card marketplace |
| `routers/redeem.py` | User redeem-code activation |
| `routers/admin.py` | Admin APIs and HTML dashboard |
| `services/moderation_service.py` | Sensitive-word moderation before billing |
| `services/wallet_service.py` | Atomic wallet credit/consume ledger |
| `repositories/platform_repo.py` | Platform model and live pricing |

## Important endpoints

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET/DELETE /api/auth/me` |
| Wallet | `GET /api/wallet/balance`, `GET /api/wallet/ledger` |
| Billing | `GET /api/billing/skus`, `POST /api/billing/order`, `GET /api/billing/orders`, `POST /api/billing/callback/dev` |
| Inference | `POST /api/inference/chat`, `POST /api/inference/distill`, `POST /api/inference/memory-summary` |
| Explore | `POST /api/explore/publish`, `GET /api/explore/list`, `GET /api/explore/mine`, `POST /api/explore/{id}/install`, `DELETE /api/explore/{id}` |
| Redeem | `POST /api/redeem` |
| Admin | `GET /api/admin/dashboard`, `GET/POST /api/admin/pricing`, `GET /api/admin/overview`, `GET /api/admin/redeem-codes`, `POST /api/admin/redeem-codes/generate` |

## Configuration

Use `.env` or environment variables:

```env
SECRET_KEY=change-me
DATABASE_URL=sqlite:///data/amber_memory.db
ADMIN_PHONES=
ADMIN_STATIC_TOKEN=
PLATFORM_API_KEY=
PLATFORM_BASE_URL=https://api.siliconflow.cn/v1
PLATFORM_MODEL_ID=deepseek-ai/DeepSeek-V4-Pro
SIGNUP_GIFT_FRAGMENTS=100
LOW_BALANCE_THRESHOLD=10
```

`ADMIN_STATIC_TOKEN` is a long-lived admin secret. It can access admin routes only; it must not be committed or posted publicly.

## Inference flow

1. Client builds temporary context from local chat and local memories.
2. Client calls `/api/inference/chat`.
3. Backend checks moderation before billing.
4. Backend consumes fragments if needed.
5. Backend calls the configured OpenAI-compatible provider.
6. Backend returns reply, mood delta, memory candidates, and usage metadata.
7. Client stores the assistant message locally.

## Admin dashboard

Open:

```text
http://127.0.0.1:8000/api/admin/dashboard
```

Paste an admin JWT or `ADMIN_STATIC_TOKEN`.

Dashboard tools include:

- platform model and pricing
- usage and ledger tables
- order table
- explore share moderation
- redeem-code generation and list
- server health information

## Docker deployment

Deployment files are under `deploy/`.

```bash
cd deploy
cp .env.example .env
# edit .env
docker compose up -d --build
```

For production, use PostgreSQL and HTTPS through Caddy or another reverse proxy.

## Verification

```powershell
python -m compileall Echo\echo-engine
python -c "import sys; sys.path.insert(0, r'Echo\\echo-engine'); import main; print('main import ok')"
```

For API contract checks:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/openapi.json
```

## Data policy

The backend stores commercial and operational metadata. It does not persist full private chat logs or private memory corpora. Explore only stores persona cards explicitly published by users.
