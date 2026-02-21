# Contributing to FlowAI

Thanks for contributing to FlowAI.

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

### Electron

- Keep `src/main/main.ts` as orchestration only.
- Place tray/window/IPC logic in dedicated modules under `src/main`.
- Guard `BrowserWindow` access (`isDestroyed`) before calling methods.

### React renderer

- Keep container components focused on state + orchestration.
- Extract repeated UI blocks into presentational components.
- Keep status/error messages user-friendly and actionable.

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

## Pull request checklist

- [ ] Code compiles (`pnpm build`)
- [ ] Tests pass (`pnpm test`)
- [ ] PR scope is focused and documented
- [ ] README/docs updated if behavior changed

## Reporting issues

When opening an issue, include:

- OS and version
- Node and pnpm versions
- Steps to reproduce
- Expected vs actual behavior
- Logs/errors (if any)

## Security notes

- Do not commit secrets (API keys, tokens, certificates).
- Use local env vars or private secrets in CI/CD settings.
- For sensitive disclosures, contact maintainers privately instead of opening a public issue.
