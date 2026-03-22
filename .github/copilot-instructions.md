# Copilot instructions for curraint

## Commit messages

Always follow [Conventional Commits](https://www.conventionalcommits.org/).

Format: `<type>(<optional scope>): <short imperative description>`

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

**Scopes** (optional): `core`, `cli`, `desktop`, `ci`

> **Important:** When the change is only to documentation or markdown files (`.md`, `README`, `CONTRIBUTING`, etc.), always use `docs` as the **type** — never as a scope on another type. For example, use `docs: update README` or `docs(ci): clarify workflow triggers`, never `feat(docs): ...`.

> **Important:** Changes to tooling, editor, or config files (`.vscode/`, `.gitignore`, `.gitattributes`, `tsconfig.json`, `vitest.config.ts`, `tsup.config.ts`, `package.json` dev-dependency bumps, CI workflow files, etc.) must use `chore` — never `feat`. These are internal changes with no user-facing behaviour.

**Rules:**
- Use imperative mood — "add", not "added" or "adds"
- Keep the subject line under 72 characters
- Do not end the subject line with a period
- Document breaking changes with `BREAKING CHANGE: <description>` in the commit body

**Always include a commit body** that explains:
1. *What* changed — the specific behaviour, module, or file affected
2. *Why* — the motivation, the problem being solved, or the trade-off made

Separate the subject from the body with a blank line. Wrap the body at 72 characters.

**Examples:**
```
feat(core): add per-message token usage tracking

Track prompt and completion token counts returned by the provider on
each streaming response. Expose them on ChatMessage so the CLI and
desktop can display live cost estimates without a separate API call.
```

```
fix(desktop): guard destroyed BrowserWindow before method calls

Electron can emit tray or IPC events after a window has been closed.
Calling methods on a destroyed BrowserWindow throws, crashing the
main process. Add isDestroyed() checks before every webContents call.
```

```
refactor(cli): decompose session UI into focused modules

index.ts had grown to handle input, rendering, command dispatch, and
session orchestration. Split each concern into its own module so each
file has a single responsibility and can be tested in isolation.
```

```
chore(ci): pin Node.js to 22 across all workflows

Ensures reproducible builds and aligns with the minimum version stated
in CONTRIBUTING.md. Prevents silent breakage if the runner image
updates its default Node version.
```

## Repository structure

This is a pnpm monorepo. All packages live under `packages/`.

| Package | Description |
|---|---|
| `packages/core` (`@curraint/core`) | Shared domain logic: chat sessions, providers, settings, secrets, context management |
| `packages/cli` (`@curraint/cli`) | Terminal interface — depends on `@curraint/core` |
| `packages/desktop` (`@curraint/desktop`) | Electron desktop app (main process + React renderer) — depends on `@curraint/core` |
| `packages/desktop-e2e` (`@curraint/desktop-e2e`) | Playwright end-to-end tests for the desktop app |

## Architecture principles

- Domain logic belongs in `packages/core`. Only promote logic there when it is genuinely shared between packages.
- Separate orchestration from domain logic from rendering concerns.
- Keep entry points thin — delegate to focused, single-purpose modules.
- Avoid duplicating constants or types across packages; share via `@curraint/core`.

## Code style

- TypeScript throughout; prefer explicit types over `any`.
- Small, single-purpose functions with descriptive names.
- Unit tests live alongside source files as `*.test.ts`.
- All tests must pass before a PR is merged (`pnpm test`).
