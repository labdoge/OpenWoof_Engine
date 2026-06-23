# Release Source Workflow

Status: [CURRENT]

`release-source/` is the GitHub-facing release repository for OpenWoof Engine / WoofyChatty. It is intentionally a nested Git repository under the development workspace. Treat it as a packaged product source repo, not as part of the parent development repo.

## Purpose

- Publish a compact, stable release source package to GitHub.
- Keep the current Windows portable package and installer archives available for release review.
- Preserve a minimal Tauri shell that can rebuild from a prebuilt frontend bundle.
- Keep bundled content slots clean for public scenarios, characters, lorebooks, and portraits.

## Repository Boundary

- Parent repo: full development source, tests, design docs, local tooling, and implementation history.
- `release-source/`: public release source and artifacts only.
- Do not stage `release-source/` from the parent repo with `git add .`.
- Commit and push from inside `release-source/` when updating the GitHub release source.

## Folder Contract

| Path | Meaning |
|---|---|
| `app/portable/windows/` | Public Windows portable package and zip. This is the primary release asset. |
| `app/installers/windows/` | Windows NSIS/MSI installers kept for archival and comparison. |
| `tauri-shell/` | Minimal Tauri v2 packaging shell using the prebuilt `web-bundle`. |
| `tauri-shell/web-bundle/` | Copy of the parent repo `dist/` output. |
| `dependency-manifests/` | npm, Cargo, and Tauri manifests copied from the development project. |
| `bundled-content/` | Clean public content staging area. Never put user data or API keys here. |
| `content-templates/` | JSON templates for public content authors. |
| `release-manifest.json` | Version, artifact paths, sizes, hashes, and release policy summary. |

## Update Workflow

1. Finish and verify development changes in the parent repo.
2. Run `npm run optimize:portraits`.
3. Run `npm run optimize:portraits -- --check`.
4. Run `npx vitest run`.
5. Run `npm run build`.
6. Confirm `dist/assets` does not contain bundled portrait `.png` files.
7. Run `npm run tauri:build`.
8. Replace `release-source/tauri-shell/web-bundle/` with the new `dist/`.
9. Replace `release-source/bundled-content/portraits/` with `portraits-optimized/**/*.webp`.
10. Replace installer archives from `src-tauri/target/release/bundle/`.
11. Replace `app/portable/windows/WoofyChatty-0.1.0-portable/WoofyChatty.exe` from `src-tauri/target/release/woofychatty.exe`.
12. Recreate `app/portable/windows/WoofyChatty_0.1.0_x64_portable.zip`.
13. Update `release-manifest.json` with current size and SHA-256 values.
14. In `release-source/`, run `git status`, stage the release-source changes, commit, and push to its GitHub remote.

## Release Policy

- Public GitHub Release asset: `app/portable/windows/WoofyChatty_0.1.0_x64_portable.zip`.
- Installers may remain in the repository for archive/comparison, but the portable zip is the recommended public download.
- Bundled release portraits are optimized offline WebP files generated from source PNG artwork. Keep `portraits/` as source artwork in the parent repo and ship `portraits-optimized/` output in release artifacts.
- User data, API keys, vault files, logs, and local settings must never be copied into `release-source/`.
- `release-source/app/portable/windows/WoofyChatty-0.1.0-portable/data/` should contain only placeholder documentation.

## Future Update Notes

- If Tauri config changes, update both `dependency-manifests/tauri/tauri.conf.json` and the release shell config. The shell config must keep `build.frontendDist` pointed at `../web-bundle`.
- If Rust backend code changes, copy the corresponding `src-tauri/src/`, `capabilities/`, `Cargo.toml`, `Cargo.lock`, and `build.rs` into the release shell.
- If npm dependencies change, update both `dependency-manifests/npm/` and `tauri-shell/package.json` / `package-lock.json`.
- If bundled public content is added, place it under `release-source/bundled-content/` and document the loader mapping in `release-source/README.md`.
