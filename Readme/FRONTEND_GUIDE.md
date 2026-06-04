# Echo Frontend Guide

The current Echo frontend lives in `回声Echo数字生命UI/`. The directory name is historical; the product is Echo.

The app is built with Vite, React, TypeScript, Tailwind CSS, Zustand, IndexedDB, Capacitor, and Electron.

## Run locally

```powershell
cd 回声Echo数字生命UI
npm install
npm.cmd run dev
```

If PowerShell blocks `npm.ps1`, use `npm.cmd`.

## Build

```powershell
npx.cmd tsc --noEmit -p tsconfig.app.json
npm.cmd run build
```

## Android

```powershell
npm.cmd run android:check
npm.cmd run android:build
```

The app package is:

```text
com.echo.app
```

To point the debug build to the current test server:

```powershell
$env:VITE_API_BASE_URL="http://129.204.151.118"
$env:VITE_WS_BASE_URL="ws://129.204.151.118"
npm.cmd run android:build
```

## Main source areas

| Path | Purpose |
|------|---------|
| `src/pages/Chat.tsx` | Main chat shell, tabs, account area, send flow |
| `src/pages/CreatePersona.tsx` | Persona creation and preset import |
| `src/components/MemoryPanel.tsx` | Local memory management |
| `src/components/ExplorePanel.tsx` | Explore marketplace UI |
| `src/components/ChatImportModal.tsx` | `.txt`, paste, and OCR import UI |
| `src/api/` | Backend API clients |
| `src/lib/localdb.ts` | IndexedDB stores for personas, messages, corpus |
| `src/lib/localRag.ts` | Local retrieval and context assembly |
| `src/lib/janitor.ts` | Local emotion annealing and memory summary trigger |
| `src/lib/chatImport.ts` | WeChat/QQ text cleanup and chunking |
| `src/lib/ocr.ts` | Android local OCR integration |
| `src/lib/i18n.ts` | Chinese/English dictionaries |
| `src/lib/moderation.ts` | Frontend sensitive-word filtering |

## Local-first chat flow

1. User sends a message.
2. Message is written to local IndexedDB.
3. Frontend retrieves recent local messages and relevant local memories.
4. Frontend sends temporary context to `/api/inference/chat`.
5. Backend returns reply and metadata.
6. Frontend writes the reply locally and updates persona mood.
7. Local Janitor may later summarize older messages into local corpus.

## Import flow

Text import:

1. User selects a `.txt` file or pastes chat text.
2. `parseChatExport()` removes timestamps, headers, media placeholders, and noise.
3. `chunkText()` splits cleaned text into about 500-character blocks.
4. `corpusStore.bulkAdd()` writes blocks to the selected persona's local memory.

OCR import:

1. Android user chooses a screenshot from the album.
2. ML Kit bundled Chinese text recognizer extracts text locally.
3. Extracted text is appended to the same import pipeline.
4. Nothing is uploaded during OCR recognition.

## Account area

The Account tab includes:

- wallet balance
- recharge entry
- usage history
- orders
- redeem-code activation
- help and about panels
- language and settings entry

## Internationalization

`src/lib/i18n.ts` holds the dictionary. `src/stores/locale.ts` persists the selected language in `echo_locale`.

When adding UI strings:

1. Add keys to the dictionary.
2. Use `useI18n()` in components.
3. Keep generated/user content untranslated.

## Styling

Echo currently uses a dark, amber-accented interface. The historical class name `bubble-amber-rim` remains for compatibility. Avoid renaming storage keys, IndexedDB names, or legacy CSS class names unless a migration is implemented.

## Safety

Frontend moderation is a convenience layer, not the only safety layer. The backend also checks sensitive words before billing. Do not remove backend moderation when changing frontend logic.

## Verification checklist

Before handing off frontend changes:

```powershell
npx.cmd tsc --noEmit -p tsconfig.app.json
npm.cmd run build
```

For Android-facing changes:

```powershell
npm.cmd run android:build
```

Then install to an emulator or real device and check:

- login
- create persona
- chat
- memory tab
- explore tab
- account tab
- import modal
- OCR picker if native Android is affected
