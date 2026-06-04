# Echo

Echo is a local-first digital-life companion app. It lets users create, talk to, organize, and extend personal digital personas while keeping private conversations, persona data, and long-term memories on the user's own device by default.

The project has been renamed to **Echo**. Some folders still contain historical names for compatibility with existing paths and local data, but the product name is Echo.

## Links

- [简体中文](ReadmeChinese.md)
- [日本語](ReadmeJapanese.md)
- [Quick Start](QUICK_START.md)
- [Backend Guide](BACKEND_GUIDE.md)
- [Frontend Guide](FRONTEND_GUIDE.md)

## Real App Screenshots

These screenshots are from the current Android Echo debug build, package `com.echo.app`.

<p align="center">
  <img src="image/echo_chat.png" alt="Echo chat screen" width="260" />
  <img src="image/echo_explore.png" alt="Echo explore screen" width="260" />
  <img src="image/echo_memory.png" alt="Echo memory screen" width="260" />
</p>

<p align="center">
  <img src="image/echo_me.png" alt="Echo account screen" width="260" />
  <img src="image/echo_import.png" alt="Echo import screen" width="260" />
</p>

## Highlights

- Local-first data: personas, chat history, private memories, and imported transcripts stay in local IndexedDB.
- Stateless inference proxy: the server receives only temporary context and does not persist full chats or private memory.
- Multi-platform UI: the same React/Vite app runs on Web, Electron, and Android through Capacitor.
- Long-term memory tools: view, search, pin, delete, manually add, and automatically summarize memories.
- Chat import: supports WeChat/QQ `.txt` import, pasted text, and Android local OCR for screenshot-based import.
- Explore marketplace: users can publish public persona cards and install shared personas locally.
- Wallet and redeem codes: admins can generate redeem codes; users activate them from the account screen.
- Internationalization: Chinese and English UI switching.
- Safety baseline: frontend sensitive-word blocking plus backend pre-billing moderation.
- Admin dashboard: usage, orders, share moderation, model pricing, and redeem-code tools.

## Data Boundary

| Data | Stored in |
|------|-----------|
| Personas, chats, private memories, imported transcripts | User device |
| OCR recognition result | User device |
| Account, wallet, orders, usage audit | Server |
| Explore persona cards | Server, only public fields explicitly published by users |
| Redeem-code state | Server |

Echo does not persist full private chats or private memories in the cloud. For inference, the frontend sends only the temporary context required for the current request.

## Tech Stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, Capacitor, Electron
- Local data: IndexedDB
- Backend: FastAPI, SQLAlchemy, SQLite/PostgreSQL
- Inference: OpenAI-compatible APIs, currently defaulting to SiliconFlow + `deepseek-ai/DeepSeek-V4-Pro`
- Android OCR: bundled ML Kit Chinese text recognizer, offline-capable

## Contributor

Current maintainer and contributor:

- ecokater

## Compliance Notice

Echo is a beta-stage research and personal-use project. Before importing chat records, creating a persona based on another person, or using personal likeness and private data, users must obtain explicit authorization from the relevant rights holders. Do not use this project for impersonation, fraud, harassment, privacy invasion, defamation, or illegal content.
