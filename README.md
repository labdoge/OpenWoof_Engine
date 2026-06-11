# OpenWoof Engine Release Source

## 繁體中文

這個 repo 是 OpenWoof Engine / WoofyChatty 的 GitHub 發布用 release source。它的目標不是保存完整開發源碼或開發歷史，而是整理成「產品發布源 + 功能展示」：保留目前可攜式 Tauri 桌面版、可重打包的最小 Tauri shell、依賴清單，以及全新的 bundled content 起始區。

### 內容結構

- `app/installers/windows/`：目前已建好的 Windows installer。
- `app/portable/windows/`：實際對外發布用的 portable package 與 zip。
- `tauri-shell/`：以 prebuilt `web-bundle` 為核心的最小 Tauri 打包殼。這裡不包含完整前端 source。
- `dependency-manifests/`：從開發專案複製出的 npm、Cargo、Tauri 依賴與設定清單。
- `bundled-content/`：新 repo 專用的內建內容起點，分為 scenarios、characters、lorebooks、portraits。
- `content-templates/`：建立新 scenario、character、lorebook 時可參考的 JSON 模板。
- `release-manifest.json`：本次 staging 的 artifact、hash、版本與用途摘要。

### 使用方式

1. 將 `release-source` 複製為新的 GitHub repo 根目錄，或把它的內容移到你的 release repo。
2. 對外 GitHub Release asset 只發布 `app/portable/windows/WoofyChatty_0.1.0_x64_portable.zip`。
3. 將你要隨 app 內建的內容放進 `bundled-content/`。
4. 若要把內容接回目前 app loader，請依照對應路徑整理：
   - scenarios: `bundled-content/scenarios/*.json` -> app root `scenarios/*.json`
   - characters: `bundled-content/characters/*.json` -> app root `characters/*.json`
   - lorebooks: `bundled-content/lorebooks/{id}/arcanum.json` + `lore/*.json` -> app root `arcana/{id}/...`
   - portraits: `bundled-content/portraits/{npcId}/{npcId}_0.png` etc. -> app root `portraits/{npcId}/...`
5. 若 UI 或 app runtime 更新，請在開發專案重新 build，再替換 `tauri-shell/web-bundle`、portable package 與 installer archive。

### 依賴與重建指令

一般使用者只需要 Windows 10/11 x64；若系統缺少 WebView2，請從 Microsoft 官方來源安裝 Microsoft Edge WebView2 Runtime。一般使用不需要 Node.js、Git、Rust 或 npm。

維護者若要從 release source 重打包，需要 Git、Node.js LTS、Rust stable，以及 Microsoft C++ Build Tools / Visual Studio Build Tools。

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```

### 重要原則

- 這不是完整 developer source repo。
- `tauri-shell` 保留重打包 Tauri installer/portable build 的最低材料。
- 公開 release 只使用 portable zip；installer 只作 repo 內部歸檔與比對。
- bundled content 從空資料夾開始，避免把舊內容帶進新 repo。
- 使用者的 API key 與本機資料不應放入此資料夾。

## English

This repo is the GitHub release source for OpenWoof Engine / WoofyChatty. It is not meant to preserve the full developer source tree or development history. Instead, it is organized as a product release source and feature presentation package: the current portable Tauri desktop build, a minimal Tauri shell that can repackage the prebuilt app bundle, dependency manifests, and a clean bundled content starting point.

### Folder Map

- `app/installers/windows/`: current Windows installers.
- `app/portable/windows/`: portable package and zip for the public release.
- `tauri-shell/`: minimal Tauri packaging shell built around the prebuilt `web-bundle`. It does not include the full frontend source.
- `dependency-manifests/`: npm, Cargo, and Tauri dependency/config manifests copied from the development project.
- `bundled-content/`: fresh built-in content area for scenarios, characters, lorebooks, and portraits.
- `content-templates/`: JSON templates for new scenarios, characters, and lorebooks.
- `release-manifest.json`: artifact, hash, version, and staging summary.

### How To Use

1. Copy `release-source` as the root of the new GitHub repo, or move its contents into your release repo.
2. Publish only `app/portable/windows/WoofyChatty_0.1.0_x64_portable.zip` as the public GitHub Release asset.
3. Put the bundled content for the new product repo under `bundled-content/`.
4. To wire content back into the current app loader, map the folders like this:
   - scenarios: `bundled-content/scenarios/*.json` -> app root `scenarios/*.json`
   - characters: `bundled-content/characters/*.json` -> app root `characters/*.json`
   - lorebooks: `bundled-content/lorebooks/{id}/arcanum.json` + `lore/*.json` -> app root `arcana/{id}/...`
   - portraits: `bundled-content/portraits/{npcId}/{npcId}_0.png` etc. -> app root `portraits/{npcId}/...`
5. When the UI or runtime changes, rebuild in the development project, then replace `tauri-shell/web-bundle`, the portable package, and the installer archive.

### Dependencies And Rebuild Commands

End users need Windows 10/11 x64. If WebView2 is missing, install Microsoft Edge WebView2 Runtime from an official Microsoft source. Node.js, Git, Rust, and npm are not needed for normal use.

Maintainers who rebuild from the release source need Git, Node.js LTS, Rust stable, and Microsoft C++ Build Tools / Visual Studio Build Tools.

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```

### Rules Of Thumb

- This is not a full developer source repository.
- `tauri-shell` keeps only the minimum material needed to rebuild the Tauri installer/portable build.
- Public releases should use only the portable zip; installers are kept only for repository archival and comparison.
- Bundled content starts empty so the new repo can begin with a clean content set.
- User API keys and local user data should never be placed in this folder.
