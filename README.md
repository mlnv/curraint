# curraint

curraint is a tray-first desktop and CLI AI chat client built with Electron + TypeScript.

It supports OpenAI-compatible chat APIs (OpenAI, LM Studio, and custom endpoints) with streaming, reasoning-block controls, markdown rendering, and robust chat flow safeguards.

## Why curraint

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

- `CURRAINT_PROVIDER` (optional: `openai`, `lmstudio`, `custom`; default `openai`)
- `CURRAINT_API_KEY` (required for `openai`, optional for `lmstudio` and `custom`)
- `CURRAINT_BASE_URL` (optional, default `https://api.openai.com/v1`)
- `CURRAINT_MODEL` (optional, default `gpt-4o-mini`)
- `CURRAINT_SYSTEM_PROMPT` (optional)

Run:

```bash
pnpm cli
```

Behavior notes:

- Uses the same shared chat-session core as desktop chat (streaming, stop, edit/regenerate flow).
- Uses the same shared context-safety composition logic as desktop chat.
- Works with OpenAI-compatible endpoints configured via environment variables.
- CLI commands:
	- `/help` – show available commands
	- `/history` – print conversation history
	- `/edit <number>` – edit a previous user message and regenerate from that point
	- `Ctrl+C` while streaming – stop current response

## Security

### API key storage

API keys are **never written to `settings.json`** in plain text.  They are stored in a separate encrypted file:

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\curraint\secrets.json` |
| macOS    | `~/Library/Application Support/curraint/secrets.json` |
| Linux    | `~/.config/curraint/secrets.json` |

Each value is individually encrypted with **AES-256-GCM**.  The encryption key is derived from the current machine's hostname and OS username using PBKDF2-SHA256 (100 000 iterations), making the secrets file unreadable on any other machine or user account without access to the same credentials.

On Unix systems the file is created with `0600` permissions (owner read/write only).

The Desktop and CLI share the same `secrets.json`, so API keys entered in either app are immediately available in the other — no re-entry needed.

The `CURRAINT_API_KEY` environment variable always takes precedence over the stored secret when set.

### `settings.json`

Non-sensitive settings (provider, base URL, model, system prompt, theme, shortcuts) continue to be stored in plain JSON in `settings.json` alongside `secrets.json`.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, coding standards, and PR checklist.
