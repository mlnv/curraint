# curraint

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

> [!CAUTION]
> **Early alpha: expect breaking changes.** curraint is under active development.
> APIs, configuration format, storage layout, and behaviour can change significantly
> between releases without prior notice. Do not rely on it in production environments.

curraint is a tray-first desktop, CLI, and Obsidian AI chat client built with Electron + TypeScript.

It supports OpenAI-compatible chat APIs (OpenAI, LM Studio, and custom endpoints) with streaming, reasoning-block controls, markdown rendering, and robust chat flow safeguards, all powered by a shared `@curraint/core` library.

## Why curraint

- Fast tray-first workflow for quick prompts without switching apps
- Cross-platform desktop support (Windows, macOS, Linux)
- Optional local-model workflow through LM Studio
- Provider-aware settings (OpenAI, LM Studio, Custom)
- CLI mode for scripting and terminal-based usage
- Obsidian plugin for in-vault AI chat with note context injection
- Streaming-first UX with stop/cancel controls
- Context safety with automatic truncation and summary fallback

## Apps and packages

### 🖥️ Desktop (`@curraint/desktop`)

The tray-first Electron app for quick, always-available AI chat.

- Always-on tray app: left-click to open or close the chat popover
- Right-click tray menu: `Open Chat`, `Settings`, `Quit`
- **Quick Input**: a configurable global keyboard shortcut that opens a floating input bar from anywhere on the desktop
- Unread message indicator with count in the tray icon tooltip
- Settings window with provider selection, connection testing, and saved connections
- Streaming responses with one-click stop that preserves partial output
- Edit any user message and regenerate the conversation from that point
- Markdown rendering: tables, code blocks with copy button, lists, and headings
- Show or hide `<think>` / `<reasoning>` blocks from models that emit reasoning traces
- Configurable context safety limits (max messages, max characters)
- Automatic history truncation with a compact summary of removed context
- Session saving: persist and resume named conversations across restarts (off by default)
- Light and dark theme
- Cross-platform packaging: Windows NSIS installer, macOS DMG, Linux AppImage and DEB

### 💻 CLI (`@curraint/cli`)

A terminal interface that shares the same chat engine as the desktop app.

- Configure fully through environment variables, no config file required
- Streaming, stop (`Ctrl+C`), and edit/regenerate flow identical to the desktop
- Markdown rendering in the terminal via marked-terminal
- Input history with up-arrow recall
- Session saving with `/sessions-save on` and interactive session browser with `/sessions`
- Slash commands:

  | Command | Description |
  |---|---|
  | `/help` | Show available commands |
  | `/history` | Print the current conversation history |
  | `/sessions` | Browse and resume saved sessions interactively |
  | `/sessions-save on\|off` | Enable or disable session saving |
  | `/edit <number>` | Edit a previous user message and regenerate from that point |
  | `/retry` | Regenerate the last assistant response |
  | `/provider` | Change the active provider interactively |
  | `/model` | Change the active model interactively |
  | `/version` | Print the CLI version |
  | `/clear` | Clear the screen and reset the current session |
  | `/exit` | Exit the CLI |

### 🔌 Obsidian plugin (`@curraint/obsidian-plugin`)

A chat sidebar for any Obsidian vault, powered by `@curraint/core`.

- Chat sidebar with full streaming, stop, and edit/regenerate support
- Inject the active note as context with one click
- Note picker: a multi-select, searchable modal to add any vault notes as context
- Multiple simultaneous conversations with background streaming while switching between them
- Editable conversation titles and a sessions modal to browse, rename, and delete saved conversations
- Optional session saving (off by default) with configurable context limits (max messages, max characters)
- Markdown/plain mode toggle per conversation
- Encrypted API key storage (AES-256-GCM, machine-bound on desktop; Web Crypto AES-GCM on mobile)
- Provider, model, and system prompt settings via the standard Obsidian settings tab

> **Note:** The plugin stores its own encrypted API key separately from the desktop/CLI `secrets.json`. Keys are not shared between the plugin and the desktop/CLI apps.

### 📦 Core (`@curraint/core`)

The shared domain logic used by all apps and the plugin.

- Streaming chat sessions: start, stop, and resume with a consistent API
- Edit/regenerate flow: trim conversation history to any message and re-run from there
- OpenAI-compatible provider abstraction supporting OpenAI, LM Studio, and Custom endpoints
- Context safety: truncate history and generate a compact summary when limits are reached
- AES-256-GCM encrypted secret storage with a per-machine key derived via PBKDF2-SHA256 (100,000 iterations)
- Session persistence: save and restore named conversations
- Settings management with normalisation and file-based persistence
- Think-tag parsing: extract and show or hide `<think>` / `<reasoning>` blocks

## Tech stack

- Electron
- TypeScript
- React + Vite
- Tailwind/shadcn-style UI primitives
- pnpm monorepo
- Vitest

## Requirements

- Node.js 22+
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

Run the desktop app:

```bash
pnpm desktop
```

## Desktop usage

- Left-click tray icon: open/close the chat popover
- Right-click tray icon: `Open Chat`, `Settings`, `Quit`

### Settings

Configure:

- Provider (`OpenAI`, `LM Studio`, `Custom OpenAI-compatible`)
- API Key
- API Base URL
- Model
- System Prompt
- Reasoning block handling (`<think>` / `<reasoning>` show/hide)
- Context safety limits in the Advanced section
- **Save sessions**: persist conversations so you can resume them later (off by default)

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

- Uses the same shared chat-session core as the desktop (streaming, stop, edit/regenerate flow).
- Works with any OpenAI-compatible endpoint configured via environment variables.
- Conversation history is **not saved by default**. Use `/sessions-save on` to enable persistence; sessions are saved to `settings.json`. Use `/sessions` to browse and resume past conversations once saving is on.
- Use `Ctrl+C` while streaming to stop the current response.

## Obsidian plugin

**Build:**

```bash
pnpm --filter @curraint/obsidian-plugin build
```

Output is written to `packages/obsidian-plugin/dist/` (`main.js`, `manifest.json`, `styles.css`). Copy the contents of `dist/` to `.obsidian/plugins/curraint/` inside your vault, then enable the plugin in Obsidian settings.

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

The Desktop and CLI share the same `secrets.json`, so API keys entered in either app are immediately available in the other, no re-entry needed.

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

Build specific packages:

```bash
pnpm --filter @curraint/core build
pnpm --filter @curraint/desktop build
pnpm --filter @curraint/cli build
pnpm --filter @curraint/obsidian-plugin build
```

## Packaging and releases

Create packages with current host defaults:

```bash
pnpm --filter @curraint/desktop package
```

Targets configured:

- macOS: DMG
- Windows: NSIS (`.exe`)
- Linux: AppImage + DEB

Platform-specific examples:

```bash
# Windows installer (.exe via NSIS)
pnpm --filter @curraint/desktop package -- --win

# macOS disk image (.dmg)
pnpm --filter @curraint/desktop package -- --mac

# Linux artifacts (.AppImage / .deb)
pnpm --filter @curraint/desktop package -- --linux
```

Notes:

- Build `.exe` on Windows for best compatibility.
- Build `.dmg` on macOS for best compatibility and signing/notarization workflows.

### macOS, "app is damaged" warning

Because the DMG is not code-signed or notarized (no Apple Developer account), macOS Gatekeeper may block the app with a _"curraint is damaged and can't be opened"_ error after installation.

Run this command once to remove the quarantine attribute:

```bash
xattr -cr /Applications/curraint.app
```

Then open the app normally. This is safe, the flag is added automatically by macOS to any app downloaded via a browser and is unrelated to the actual integrity of the binary.

## CI/CD pipelines

- `CI` ([.github/workflows/ci.yml](.github/workflows/ci.yml))
	- Push or PR to `main`, and manual (`workflow_dispatch`)
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

## Licenses

Third-party dependency licenses are listed in [LICENSES.md](LICENSES.md) (auto-generated during `pnpm build`).

## License

Copyright (C) 2026 Maksym Yemelianov

This program is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License](LICENSE) as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
