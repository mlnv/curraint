# Release Process

This project uses a single unified release workflow for all components:
desktop app, CLI, and Obsidian plugin. All components share the same version.

## Dev builds (pre-release)

Used for testing feature branches or sharing work-in-progress builds.
No manual version changes required.

1. Go to **Actions** tab > **Release** workflow > **Run workflow**
2. Select the **branch** to build from (empty = current default branch)
3. Click **Run workflow**

The version is auto-generated as `{root-version}-dev.{branch}.{timestamp}`,
for example `0.1.0-dev.feat-dark-mode.20250531143000`.

The workflow creates a **pre-release** containing:

| Component | Artifacts |
|---|---|
| Desktop | Windows `.exe`, macOS `.dmg`, Linux `.AppImage` and `.deb` |
| CLI | Self-contained `curraint` binary |
| Obsidian | `main.js`, `manifest.json`, `styles.css` |

### Testing the Obsidian plugin on mobile via BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) in Obsidian
2. Open BRAT settings > **Add Beta Plugin**
3. Enter repository: `{owner}/flowai`
4. Check "Enable updating frozen version" and paste the tag from the release
5. Click **Add Plugin**

To update to a newer dev build, trigger the workflow again and update the
frozen version in BRAT with the new tag.

## Actual release

Use this when publishing a stable version. All components are released
together under the same version tag.

### Steps

1. Bump the version in these files:

   - `package.json` (root)
   - `packages/core/package.json`
   - `packages/cli/package.json`
   - `packages/desktop/package.json`
   - `packages/obsidian-plugin/manifest.json`

2. Commit the version bump:

   ```
   git add package.json packages/*/package.json packages/obsidian-plugin/manifest.json
   git commit -m "chore: bump version to X.Y.Z"
   ```

3. Tag and push:

   ```
   git tag vX.Y.Z
   git push
   git push --tags
   ```

4. CI triggers on the `vX.Y.Z` tag, builds all components, and creates a
   **GitHub Release** with all artifacts.

### Example

```bash
# Bump from 0.1.0 to 0.2.0
# (manually edit the version fields in the files listed above)

git add package.json packages/*/package.json packages/obsidian-plugin/manifest.json
git commit -m "chore: bump version to 0.2.0"
git tag v0.2.0
git push && git push --tags
```

## Version authority

| Trigger | Version source | Tag format | Release type |
|---|---|---|---|
| Tag push (`v*`) | Git tag (strip `v` prefix) | `v1.0.0` | Release |
| Workflow dispatch | `package.json` + auto suffix | `0.1.0-dev.branch.timestamp` | Pre-release |

## Community plugin submission (future)

When the Obsidian plugin is submitted to the community plugin directory,
a `versions.json` file at the repo root will map each plugin version to the
minimum compatible Obsidian version.
