# FlowAI

Simple cross-platform AI chat app with:

- Electron tray application (always-on tray icon)
- Chat popup on tray click
- Settings popup on tray right-click menu
- CLI chat client
- OpenAI-compatible Chat Completions endpoint support

## Requirements

- Node.js 20+
- pnpm 10+

## Install

```bash
pnpm install
```

## Build

```bash
pnpm build
```

## Run Desktop App

```bash
pnpm start
```

- Left click tray icon: open/close chat popup
- Right click tray icon: `Open Chat`, `Settings`, `Quit`

Use the Settings window to configure:

- Provider (`OpenAI`, `LM Studio`, `Custom OpenAI-compatible`)
- API Key
- API Base URL (any OpenAI-compatible endpoint)
- Model
- System Prompt

LM Studio quick setup:

- Select provider: `LM Studio (Local)`
- Base URL defaults to `http://127.0.0.1:1234/v1`
- API key is optional

## Run CLI

Set environment variables:

- `FLOWAI_PROVIDER` (optional: `openai`, `lmstudio`, `custom`; default `openai`)
- `FLOWAI_API_KEY` (required for `openai`, optional for `lmstudio` and `custom`)
- `FLOWAI_BASE_URL` (optional, default `https://api.openai.com/v1`)
- `FLOWAI_MODEL` (optional, default `gpt-4o-mini`)
- `FLOWAI_SYSTEM_PROMPT` (optional)

Then run:

```bash
pnpm cli
```

## Package installers

```bash
pnpm package
```

Build targets:

- macOS: DMG
- Windows: NSIS
- Linux: AppImage + DEB
