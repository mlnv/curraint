# Contributing to curraint

Thank you for your interest in contributing. This guide covers everything you need to get started.

## Table of contents

- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Repository structure](#repository-structure)
- [Branches and commits](#branches-and-commits)
- [Code guidelines](#code-guidelines)
- [Testing](#testing)
- [Pull request checklist](#pull-request-checklist)
- [Reporting issues](#reporting-issues)
- [Security](#security)
- [CI workflows](#ci-workflows)

---

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+

## Getting started

Install all workspace dependencies:

```bash
pnpm install
```

Build all packages:

```bash
pnpm build
```

Run all tests:

```bash
pnpm test
```

Run a specific package in isolation:

```bash
pnpm --filter @curraint/core build
pnpm --filter @curraint/desktop build
pnpm --filter @curraint/cli build
pnpm --filter @curraint/obsidian-plugin build
```

Start the desktop app or CLI locally:

```bash
pnpm desktop
pnpm cli
```

---

## Repository structure

This is a **pnpm monorepo**. All packages live under `packages/`.

| Package | Description |
|---|---|
| `packages/core` | Shared business logic: chat sessions, providers, settings, secrets, context management |
| `packages/cli` | Terminal interface — depends on `@curraint/core` |
| `packages/desktop` | Electron desktop app (main process + React renderer) — depends on `@curraint/core` |
| `packages/desktop-e2e` | Playwright end-to-end tests for the desktop app |

`@curraint/core` is the single source of truth for domain logic. Keep package-specific code in the relevant package; only promote logic to `core` when it is genuinely shared.

---

## Branches and commits

- Branch from `main`. Use `feature/`, `fix/`, or `chore/` prefixes (e.g. `feature/lm-studio-selector`).
- Keep each branch and PR focused on a single concern.
- Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short imperative description>
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code restructure with no behavior change |
| `test` | Adding or updating tests only |
| `docs` | Documentation only |
| `chore` | Tooling, deps, CI, config |
| `perf` | Performance improvement |

**Scopes** (optional) help narrow the change: `(core)`, `(cli)`, `(desktop)`, `(obsidian)`, `(ci)`.

**Examples:**

```
feat(core): add per-message token usage tracking
fix(desktop): guard destroyed BrowserWindow before method calls
refactor(cli): decompose session UI into focused modules
chore(ci): pin Node.js to 22 across all workflows
docs: update README setup instructions
```

Breaking changes must include `BREAKING CHANGE:` in the commit body or footer.

---

## Code guidelines

### General

- Write small, single-purpose functions with descriptive names.
- Follow the Single Responsibility Principle — one module, one concern.
- Separate orchestration logic from domain logic from rendering.
- Avoid duplicating constants or types across packages; share via `@curraint/core`.
- Prefer explicit types over `any`. Avoid type assertions unless unavoidable.

### Package boundaries

- Domain logic (providers, settings, sessions, context, secrets) belongs in `packages/core`.
- UI concerns (React components, IPC, tray, windows) belong in `packages/desktop`.
- Terminal UX concerns belong in `packages/cli`.
- Cross-cutting changes that touch multiple packages require extra care — test all affected packages.

### Electron (desktop)

- The main entry point is orchestration only — keep it thin.
- IPC handlers, tray logic, and window management each live in their own dedicated module.
- Always guard `BrowserWindow` access (check `isDestroyed()`) before calling methods.
- Keep preload scripts minimal; expose only what the renderer strictly needs.

### React (desktop renderer)

- Container components own state and orchestration; presentational components own rendering.
- Extract repeated UI into reusable components.
- Encapsulate complex orchestration logic in custom hooks.
- Keep error and status messages user-facing and actionable.

### CLI

- Keep the entry point as a thin command dispatcher.
- Session I/O, markdown rendering, and settings UI are separate modules.
- Avoid blocking the event loop; prefer streaming and async patterns throughout.

### Obsidian plugin

- The plugin is built with esbuild to a single `dist/main.js` bundle; `manifest.json` and `styles.css` are copied to `dist/` alongside it.
- Use `pnpm --filter @curraint/obsidian-plugin dev` for watch mode during development.
- To test locally, use the deploy task (see below) or copy `dist/` contents manually to `.obsidian/plugins/curraint/` inside a vault, then enable the plugin and use `Ctrl+Shift+I` to open the DevTools console.
- The plugin owns its own encrypted API key in `data.json` (separate from the desktop/CLI secrets).
- Do not add Obsidian-specific logic to `packages/core`; only promote logic there when it is genuinely shared across all consumers.

#### One-click deploy to a local vault

A deploy script copies the built plugin files directly into your local Obsidian vault for fast iteration:

```bash
pnpm --filter @curraint/obsidian-plugin run deploy
```

**One-time setup:** create `packages/obsidian-plugin/.vault-path` (this file is gitignored) containing the absolute path to your vault root - nothing else, just the path on a single line:

```
C:\Users\you\Documents\MyVault
```

Your vault root is the folder you open in Obsidian - the one that contains your notes and an `.obsidian/` subfolder. The script writes to `<vault>/.obsidian/plugins/curraint/` and prints each copied file. It will error with a clear message if the file is missing or the path does not exist.

The VS Code task **"pnpm: deploy:obsidian-plugin"** (Terminal > Run Task) runs the build and deploy in one step.

---

## Testing

Unit tests live alongside source files as `*.test.ts`. E2E tests live in `packages/desktop-e2e`.

Run all unit tests:

```bash
pnpm test
```

Run tests for a single package:

```bash
pnpm --filter @curraint/core test
pnpm --filter @curraint/desktop test
pnpm --filter @curraint/cli test
pnpm --filter @curraint/obsidian-plugin test
```

Run E2E tests (requires a built desktop app):

```bash
pnpm --filter @curraint/desktop build
pnpm test:e2e
```

**Expectations:**

- Add or update unit tests for any change in `packages/core`.
- Add or update unit tests for non-trivial logic in `packages/desktop` and `packages/cli`.
- E2E tests cover critical user flows; update them when those flows change.
- All tests must pass before a PR can be merged.

---

## Pull request checklist

- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes
- [ ] PR is scoped to a single concern
- [ ] Commit messages follow Conventional Commits
- [ ] README or docs updated if user-facing behavior changed
- [ ] New settings include defaults, normalization, and (where applicable) UI wiring
- [ ] Breaking changes are documented in the PR description

---

## Reporting issues

Please search existing issues before opening a new one.

Include in your report:

- OS and version
- Node.js and pnpm versions
- Steps to reproduce
- Expected vs. actual behavior
- Relevant logs or error output

For chat or streaming regressions, also include:

- Provider and model
- Whether streaming was active
- Whether `<think>` / `<reasoning>` tags appeared in the response

---

## Security

- Never commit secrets (API keys, tokens, certificates, private keys).
- Use environment variables or CI secrets for sensitive configuration.
- For security vulnerabilities, contact the maintainers privately rather than opening a public issue.

---

## CI workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `CI` | Push/PR to `main`, manual | Build, unit test, and E2E test |
| `Package Test Artifacts` | Manual | Build installable packages for smoke testing; artifacts expire after 3 days |
| `Package and Release` | `v*` tag push, manual | Build release packages and publish a GitHub Release |
