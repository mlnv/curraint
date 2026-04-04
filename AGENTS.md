# Agent instructions for curraint

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

**Scopes** (optional): `core`, `cli`, `desktop`, `obsidian`, `ci`

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
| `packages/obsidian-plugin` (`@curraint/obsidian-plugin`) | Obsidian plugin - adds a chat sidebar to any vault — depends on `@curraint/core` |

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

## Feature development workflow (Red - Green - Refactor)

Follow the TDD red-green-refactor cycle for all new features and non-trivial bug fixes.

**Red** - write failing tests first
- Write all unit tests for the new behaviour before writing any implementation.
- Tests must reference the not-yet-existing module/class/function so they fail with an import or "does not exist" error - confirming the test runner actually executes them.
- Cover the happy path, edge cases, and any documented constraints (e.g. de-dup rules, boundary conditions).
- Run the test suite and confirm every new test fails.

**Green** - make the tests pass with the simplest correct implementation
- Write only enough code to make all failing tests pass.
- Do not add behaviour that has no corresponding test.
- Re-run the suite after implementing - all tests (new and existing) must be green before moving on.

**Refactor** - clean up without changing behaviour
- Review all changed files for duplication, naming consistency, and unnecessary complexity.
- Extract helpers or types only if they genuinely simplify the code - do not over-engineer.
- Run the full test suite again after every refactor step to confirm nothing regressed.

**Practical rules**
- New logic that can be unit tested in isolation (e.g. a class, a pure function, a parser) must live in its own file and have a dedicated `*.test.ts` sibling.
- Logic that only orchestrates side effects (wiring modules together in `run.ts`, IPC handlers, etc.) does not need unit tests but must be covered by the integration or e2e suite where feasible.
- Never skip the Red phase - writing tests after the implementation defeats the purpose.
