# Tauri Shell

## 繁體中文

這裡是 release repo 用的最小 Tauri 打包殼。它使用 `web-bundle` 內已建好的前端 bundle，不包含完整前端 TypeScript source。

### 重打包

需要 Git、Node.js LTS、Rust stable，以及 Microsoft C++ Build Tools / Visual Studio Build Tools。若你是從遠端 repo 開始：

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```

產出的 installer 會在 `src-tauri/target/release/bundle/`。如果你更新了 UI 或 app runtime，請先在完整開發專案重新 build，再把新的 `dist` 內容複製到這裡的 `web-bundle`。

## English

This is the minimal Tauri packaging shell for the release repo. It uses the prebuilt frontend bundle in `web-bundle` and does not include the full frontend TypeScript source.

### Repackaging

You need Git, Node.js LTS, Rust stable, and Microsoft C++ Build Tools / Visual Studio Build Tools. If starting from a remote repo:

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```

Generated installers will appear under `src-tauri/target/release/bundle/`. If the UI or app runtime changes, rebuild in the full development project first, then copy the new `dist` output into this shell as `web-bundle`.
