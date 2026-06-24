# WoofyChatty Portable

## 繁體中文

這是 WoofyChatty 的 Windows x64 portable package。實際對外 release 建議只發布這個 portable 資料夾的 zip，不需要發布 installer。

### 直接執行

1. 解壓縮 zip 到你想放置的位置。
2. 執行 `WoofyChatty.exe`。
3. App 會把資料寫在同一個資料夾下的 `data/`。

### Portable 內容

- `WoofyChatty.exe`：主程式。
- `portable.marker`：讓 app 進入 portable mode。請勿刪除。
- `data/`：本機資料、設定、vault、WebView2 user data 會放在這裡。
- `resources/icon.ico`：輔助圖示資源。

### 一般使用者可能需要的依賴

- Windows 10/11 x64。
- Microsoft Edge WebView2 Runtime。多數 Windows 10/11 環境已內建；如果無法開啟 app，請從 Microsoft 官方來源安裝 Evergreen WebView2 Runtime。
- 不需要 Node.js、Git、Rust 或 npm。

### 如果 Windows 阻擋執行

如果 zip 是從網路下載，Windows 可能會標記檔案。可在 PowerShell 中對解壓縮後的主程式執行：

```powershell
Unblock-File .\WoofyChatty.exe
```

### 維護者重建指令

只有要從 release source 重新打包時才需要以下工具：

- Git
- Node.js LTS
- Rust stable
- Microsoft C++ Build Tools / Visual Studio Build Tools

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```

## English

This is the Windows x64 portable package for WoofyChatty. The public release should publish only the zip made from this portable folder, not the installers.

### Run The App

1. Extract the zip wherever you want to keep the app.
2. Run `WoofyChatty.exe`.
3. The app stores local data under the adjacent `data/` folder.

### Portable Contents

- `WoofyChatty.exe`: main app executable.
- `portable.marker`: enables portable mode. Do not delete it.
- `data/`: local data, settings, vault, and WebView2 user data are stored here.
- `resources/icon.ico`: auxiliary icon resource.

### Possible End-User Dependencies

- Windows 10/11 x64.
- Microsoft Edge WebView2 Runtime. It is already present on most Windows 10/11 systems. If the app cannot open, install the Evergreen WebView2 Runtime from an official Microsoft source.
- Node.js, Git, Rust, and npm are not needed for normal use.

### If Windows Blocks The App

If the zip was downloaded from the web, Windows may mark the executable. After extraction, run this in PowerShell:

```powershell
Unblock-File .\WoofyChatty.exe
```

### Maintainer Rebuild Commands

These tools are needed only when rebuilding from the release source:

- Git
- Node.js LTS
- Rust stable
- Microsoft C++ Build Tools / Visual Studio Build Tools

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```
