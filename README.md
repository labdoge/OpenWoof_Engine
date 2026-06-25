# OpenWoof Engine / WoofyChatty 發布原始包

## 下載 v0.1.1

**Windows 可攜版套件：** [WoofyChatty_0.1.1_x64_portable.zip](https://github.com/labdoge/OpenWoof_Engine/releases/download/portable_v011/WoofyChatty_0.1.1_x64_portable.zip)

下載並解壓縮套件後，執行 `WoofyChatty.exe`，輸入你偏好的 LLM 供應商 API key，即可開始遊玩。無需安裝。

這是 **OpenWoof Engine / WoofyChatty v0.1.1** 的 Windows 可攜版發布原始包。

此倉庫是給 GitHub Release 使用的公開發布包，不是完整開發原始碼倉庫。它包含目前的 Windows 可攜版、供比較與封存用的安裝程式、可重新打包預建應用程式套件的最小 Tauri v2 shell、相依性清單，以及已整理好的內建內容。

## 快速開始

1. 下載 [WoofyChatty_0.1.1_x64_portable.zip](https://github.com/labdoge/OpenWoof_Engine/releases/download/portable_v011/WoofyChatty_0.1.1_x64_portable.zip)。
2. 將 zip 解壓縮到你想放置 app 的位置。
3. 執行 `WoofyChatty.exe`。
4. 輸入你偏好的 LLM 供應商 API key，即可開始遊玩。

此版本支援的供應商設定包含 Claude (Anthropic)、Gemini (Google)、xAI/Grok、DeepSeek。不需要專案後端伺服器；app 會從本機直接向你選擇的供應商發送請求。

## 這個發布包包含什麼

- `app/portable/windows/`：建議公開發布的 Windows 可攜版 zip。
- `app/installers/windows/`：保留作為封存與比較用的 Windows 安裝程式。
- `tauri-shell/`：使用預建 `web-bundle` 的最小 Tauri v2 打包 shell。
- `tauri-shell/web-bundle/`：從開發專案複製而來的已編譯應用程式套件。
- `dependency-manifests/`：供發布審查使用的 npm、Cargo、Tauri 清單。
- `bundled-content/`：公開劇本、角色、世界書，以及最佳化後的 WebP 角色立繪。
- `content-templates/`：建立公開內容用的 JSON 範本。
- `release-manifest.json`：版本、發布檔案路徑、檔案大小、SHA-256 hash 與發布規則摘要。

## 發布檔案

| 檔案 | 用途 | 是否作為公開發布資產 |
|---|---|---|
| `app/portable/windows/WoofyChatty_0.1.1_x64_portable.zip` | Windows x64 可攜版 | 是 |
| `app/installers/windows/WoofyChatty_0.1.1_x64-setup.exe` | NSIS 安裝程式封存 | 否 |
| `app/installers/windows/WoofyChatty_0.1.1_x64_en-US.msi` | MSI 安裝程式封存 | 否 |

公開下載建議只使用可攜版 zip。安裝程式檔案保留在倉庫內，主要是為了封存與比較。

## 一般玩家需求

- Windows 10/11 x64。
- 若系統尚未安裝，需安裝 Microsoft Edge WebView2 Runtime。
- 至少一組支援供應商的 API key。

一般遊玩不需要 Node.js、Git、Rust、npm 或建置工具。

如果 Windows 封鎖下載來的執行檔，請先解壓縮 zip，然後在可攜版資料夾中執行：

```powershell
Unblock-File .\WoofyChatty.exe
```

## 從發布原始包重新打包

這個倉庫可以重新打包既有的預建前端套件，但不包含完整前端 TypeScript 原始碼。如果 UI 或應用程式執行環境有更新，請先從完整開發專案重建，再替換 `tauri-shell/web-bundle/`。

維護者需要 Git、Node.js LTS、Rust stable，以及 Microsoft C++ Build Tools / Visual Studio Build Tools。

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```

產出的安裝程式會位於 `tauri-shell/src-tauri/target/release/bundle/`。

## 內建內容對應

公開內容會先整理在 `bundled-content/`。若要接回目前的應用程式載入器，資料夾對應如下：

- `bundled-content/scenarios/*.json` -> 應用程式根目錄 `scenarios/*.json`
- `bundled-content/characters/*.json` -> 應用程式根目錄 `characters/*.json`
- `bundled-content/lorebooks/{id}/arcanum.json` 與 `lore/*.json` -> 應用程式根目錄 `arcana/{id}/...`
- `bundled-content/portraits/{npcId}/{npcId}_0.webp` 等檔案 -> 應用程式根目錄 `portraits-optimized/{npcId}/...`

## 發布規則

- 公開 GitHub Release 資產使用可攜版 zip。
- 安裝程式只保留作為封存與比較，不建議作為公開下載主檔。
- 不要把使用者 API key、vault 檔案、記錄檔、本機設定或私人使用者資料放進這個倉庫。
- 發布檔案有變動時，記得更新 `release-manifest.json`。
- `tauri-shell/` 是重新打包用 shell，不是完整應用程式原始碼。

依內建劇本與 modules 內容不同，app 可能包含成熟向互動小說內容。公開內容審查應與私人使用者資料分開處理。

---

# OpenWoof Engine / WoofyChatty Release Source

## Download v0.1.1

**Windows portable package:** [WoofyChatty_0.1.1_x64_portable.zip](https://github.com/labdoge/OpenWoof_Engine/releases/download/portable_v011/WoofyChatty_0.1.1_x64_portable.zip)

Download and unzip the package, run `WoofyChatty.exe`, then enter an API key for your preferred LLM provider to start playing. No installation required.

Portable Windows release source for **OpenWoof Engine / WoofyChatty v0.1.1**.

This repository is the GitHub-facing release package, not the full development source tree. It contains the current portable Windows build, installer archives for comparison, a minimal Tauri v2 shell for repackaging the prebuilt app bundle, dependency manifests, and staged bundled content.

## Quick Start

1. Download [WoofyChatty_0.1.1_x64_portable.zip](https://github.com/labdoge/OpenWoof_Engine/releases/download/portable_v011/WoofyChatty_0.1.1_x64_portable.zip).
2. Unzip it anywhere you want to keep the app.
3. Run `WoofyChatty.exe`.
4. Enter an API key for your preferred LLM provider, then start playing.

Supported provider settings in this release include Claude (Anthropic), Gemini (Google), xAI/Grok, and DeepSeek. No project backend server is required. The app sends requests directly from your local machine to the provider you choose.

## What This Package Contains

- `app/portable/windows/`: the recommended public release asset, including the portable zip.
- `app/installers/windows/`: Windows installer builds kept for archive and comparison.
- `tauri-shell/`: a minimal Tauri v2 packaging shell using the prebuilt `web-bundle`.
- `tauri-shell/web-bundle/`: the compiled app bundle copied from the development project.
- `dependency-manifests/`: npm, Cargo, and Tauri manifests used for release review.
- `bundled-content/`: public scenarios, characters, lorebooks, and optimized WebP portraits.
- `content-templates/`: JSON templates for creating new public content.
- `release-manifest.json`: release version, artifact paths, file sizes, SHA-256 hashes, and policy notes.

## Release Artifacts

| Artifact | Purpose | Public release asset |
|---|---|---|
| `app/portable/windows/WoofyChatty_0.1.1_x64_portable.zip` | Windows x64 portable package | Yes |
| `app/installers/windows/WoofyChatty_0.1.1_x64-setup.exe` | NSIS installer archive | No |
| `app/installers/windows/WoofyChatty_0.1.1_x64_en-US.msi` | MSI installer archive | No |

The portable zip is the recommended public download. Installer files are retained in the repository only for archival comparison.

## End-User Requirements

- Windows 10/11 x64.
- Microsoft Edge WebView2 Runtime, if it is not already installed.
- An API key from at least one supported LLM provider.

Node.js, Git, Rust, npm, and build tools are not needed for normal play.

If Windows blocks the downloaded executable, extract the zip first, then run this in PowerShell from the portable folder:

```powershell
Unblock-File .\WoofyChatty.exe
```

## Rebuilding From Release Source

This repo can repackage the existing prebuilt frontend bundle. It does not contain the full frontend TypeScript source. If the app UI or runtime changes, rebuild from the full development project first, then replace `tauri-shell/web-bundle/`.

Maintainers need Git, Node.js LTS, Rust stable, and Microsoft C++ Build Tools / Visual Studio Build Tools.

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```

Generated installer output appears under `tauri-shell/src-tauri/target/release/bundle/`.

## Bundled Content Mapping

Public content is staged under `bundled-content/`. To wire it back into the current app loader, map it like this:

- `bundled-content/scenarios/*.json` -> app root `scenarios/*.json`
- `bundled-content/characters/*.json` -> app root `characters/*.json`
- `bundled-content/lorebooks/{id}/arcanum.json` and `lore/*.json` -> app root `arcana/{id}/...`
- `bundled-content/portraits/{npcId}/{npcId}_0.webp` etc. -> app root `portraits-optimized/{npcId}/...`

## Release Rules

- Publish the portable zip as the public GitHub Release asset.
- Keep installers in the repository for archive/comparison only.
- Do not place user API keys, vault files, logs, local settings, or private user data in this repo.
- Keep `release-manifest.json` updated when artifacts change.
- Treat `tauri-shell/` as a repackaging shell, not as the full app source.

Depending on bundled scenarios and modules, the app may contain mature interactive fiction content. Keep public content review separate from private user data.
