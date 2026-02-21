# FlowAI

FlowAI is a tray-first desktop and CLI AI chat client built with Electron + TypeScript.

It supports OpenAI-compatible chat APIs (OpenAI, LM Studio, and custom endpoints) with streaming, reasoning-block controls, markdown rendering, and robust chat flow safeguards.

## Why FlowAI

- Fast tray-first workflow for quick prompts
- Cross-platform desktop support (Windows, macOS, Linux)
- Optional local-model workflow through LM Studio
- Provider-aware settings (OpenAI, LM Studio, Custom)
- CLI mode for scripting and terminal-based usage
- Streaming-first UX with stop/cancel controls
- Context safety with truncation + summary fallback

## Features

- Always-on tray app with popover chat window
- Settings window with provider selection and connection testing
- Unread message indicator in tray icon + tooltip count
- Enter to send, Shift+Enter for newline
- OpenAI-compatible `/chat/completions` integration
- Streaming responses with graceful non-stream fallback
- Stop current response while preserving partial output
- Edit user messages and regenerate from that point in history
- Markdown rendering for assistant responses (tables, code, lists, headings)
- Copy buttons for code blocks in responses
- Configurable context safety limits (`max messages`, `max characters`)
- Automatic history truncation with compact summary of removed context
- Packaging support via `electron-builder`

## Tech stack

- Electron
- TypeScript
- React + Vite
- Tailwind/shadcn-style UI primitives
- pnpm
- Vitest

## Requirements

- Node.js 20+
- pnpm 10+

## Quick start

Install:

```bash
pnpm install
```

Build:

```bash
pnpm build
```

Run desktop app:

```bash
pnpm start
```

## Desktop usage

- Left click tray icon: open/close chat popover
- Right click tray icon: `Open Chat`, `Settings`, `Quit`

### Settings

Configure:

- Provider (`OpenAI`, `LM Studio`, `Custom OpenAI-compatible`)
- API Key
- API Base URL
- Model
- System Prompt
- Reasoning block handling (`<think>` / `<reasoning>` show-hide)
- Context safety limits in Advanced section

Use **Test Connection** to validate endpoint access before saving.

### LM Studio quick setup

- Provider: `LM Studio (Local)`
- Default base URL: `http://127.0.0.1:1234/v1`
- API key: optional

## CLI usage

Environment variables:

- `FLOWAI_PROVIDER` (optional: `openai`, `lmstudio`, `custom`; default `openai`)
- `FLOWAI_API_KEY` (required for `openai`, optional for `lmstudio` and `custom`)
- `FLOWAI_BASE_URL` (optional, default `https://api.openai.com/v1`)
- `FLOWAI_MODEL` (optional, default `gpt-4o-mini`)
- `FLOWAI_SYSTEM_PROMPT` (optional)

Run:

```bash
pnpm cli
```

Behavior notes:

- Uses the same shared context-safety composition logic as desktop chat.
- Works with OpenAI-compatible endpoints configured via environment variables.

## Testing

Run unit tests:

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

Build specific targets:

```bash
pnpm build:renderer
pnpm build:main
pnpm build:cli
```

## Packaging and releases

Create packages with current host defaults:

```bash
pnpm package
```

Targets configured:

- macOS: DMG
- Windows: NSIS (`.exe`)
- Linux: AppImage + DEB

Platform-specific examples:

```bash
# Windows installer (.exe via NSIS)
pnpm package -- --win

# macOS disk image (.dmg)
pnpm package -- --mac

# Linux artifacts (.AppImage / .deb)
pnpm package -- --linux
```

Notes:

- Build `.exe` on Windows for best compatibility.
- Build `.dmg` on macOS for best compatibility and signing/notarization workflows.

## CI/CD pipelines

- `CI` ([.github/workflows/ci.yml](.github/workflows/ci.yml))
	- Manual trigger only (`workflow_dispatch`)
	- Runs `pnpm build` and `pnpm test`

- `Package and Release` ([.github/workflows/package-release.yml](.github/workflows/package-release.yml))
	- Manual trigger and version tags (`v*`)
	- Builds packages across Windows/macOS/Linux
	- Uploads artifacts
	- On tag builds, creates GitHub Release with attached assets

- `Package Test Artifacts` ([.github/workflows/package-test.yml](.github/workflows/package-test.yml))
	- Manual trigger with `target` input (`all`, `windows`, `macos`, `linux`)
	- Builds selected platform packages
	- Uploads artifacts only (no release)

## Project structure

- `src/main` – Electron main process (tray, windows, IPC orchestration)
- `src/renderer` – React UI (chat/settings)
- `src/common` – shared types, provider config, API client, settings and context safety
- `src/cli` – terminal chat client

Key modules:

- `src/common/contextSafety.ts` – context-window truncation + summary policy
- `src/common/settings.ts` – settings normalization + conversation composition orchestration
- `src/renderer/lib/use-chat-session.ts` – chat session orchestration for renderer

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, coding standards, and PR checklist.
