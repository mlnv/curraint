# Contributing to curraint

Thanks for contributing to curraint.

## Development setup

- Node.js 20+
- pnpm 10+

Install dependencies:

```bash
pnpm install
```

Run local checks before opening a PR:

```bash
pnpm build
pnpm test
```

Run the app locally:

```bash
pnpm start
```

Optional focused commands:

```bash
pnpm build:renderer
pnpm build:main
pnpm build:cli
```

## Branches and commits

- Create feature/fix branches from `main`.
- Keep each PR focused on one change set.
- Use clear commit messages (imperative mood), for example:
  - `feat: add LM Studio provider selector`
  - `fix: guard destroyed BrowserWindow access`
  - `refactor: extract tray manager`

## Code guidelines

### TypeScript and architecture

- Prefer small functions with clear names.
- Keep modules single-purpose (SRP).
- Reuse shared helpers from `src/common` when possible.
- Avoid duplicating constants/strings across renderer/main/CLI.
- Keep orchestration separate from policy and rendering concerns.

### Shared domain modules

- Keep context policy in `src/common/contextSafety.ts`.
- Keep settings normalization/composition in `src/common/settings.ts`.
- Keep API transport behavior in `src/common/openaiCompatibleClient.ts`.
- Add/update tests for any behavior change in these modules.

### Electron

- Keep `src/main/main.ts` as orchestration only.
- Place tray/window/IPC logic in dedicated modules under `src/main`.
- Guard `BrowserWindow` access (`isDestroyed`) before calling methods.

### React renderer

- Keep container components focused on state + orchestration.
- Extract repeated UI blocks into presentational components.
- Keep status/error messages user-friendly and actionable.
- Prefer hooks for orchestration logic (for example `src/renderer/lib/use-chat-session.ts`).
- Keep markdown/reasoning rendering logic modular and reusable.

## Testing expectations

For any functional change:

- Add or update unit tests under `src/**/*.test.ts` when applicable.
- Ensure all tests pass with:

```bash
pnpm test
```

For UI/main-process changes:

- Ensure project builds:

```bash
pnpm build
```

For workflow/config changes:

- Ensure docs stay aligned with current `.github/workflows/*.yml` behavior.
- Do not reintroduce conflicting pnpm version pinning in workflows.

## Pull request checklist

- [ ] Code compiles (`pnpm build`)
- [ ] Tests pass (`pnpm test`)
- [ ] PR scope is focused and documented
- [ ] README/docs updated if behavior changed
- [ ] New settings fields include defaults + normalization + UI wiring
- [ ] Shared logic changes include/adjust unit tests

## Reporting issues

When opening an issue, include:

- OS and version
- Node and pnpm versions
- Steps to reproduce
- Expected vs actual behavior
- Logs/errors (if any)

For chat regressions, also include:

- Provider and model used
- Whether streaming was enabled/supported
- Whether reasoning tags (`<think>` / `<reasoning>`) appeared

## Security notes

- Do not commit secrets (API keys, tokens, certificates).
- Use local env vars or private secrets in CI/CD settings.
- For sensitive disclosures, contact maintainers privately instead of opening a public issue.

## CI workflow notes

- `CI` workflow is manual (`workflow_dispatch`).
- `Package Test Artifacts` is manual and artifact-only.
- `Package and Release` runs manually and on `v*` tags for release publishing.
