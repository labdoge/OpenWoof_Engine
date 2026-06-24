# Windows Installers

## 繁體中文

這裡保留既有 Windows installer 作為 repo 內部歸檔與比對用途。依照目前 release 規則，公開發布資產應使用 `app/portable/windows/WoofyChatty_0.1.1_x64_portable.zip`，不要把 installer 當作主要 release asset。

一般使用者執行 installer 或 portable app 時，可能需要 Windows 10/11 x64 與 Microsoft Edge WebView2 Runtime。若只是使用 app，不需要 Node.js、Git、Rust 或 npm。

若要從 release source 重打包：

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```

## English

This folder keeps the existing Windows installers for repository archival and comparison. Under the current release rule, public release assets should use `app/portable/windows/WoofyChatty_0.1.1_x64_portable.zip`, not the installers.

End users may need Windows 10/11 x64 and Microsoft Edge WebView2 Runtime to run either the installer build or the portable app. Node.js, Git, Rust, and npm are not needed for normal use.

To rebuild from the release source:

```powershell
git clone <repo-url>
cd <repo-folder>\tauri-shell
npm ci
npm run tauri:build:windows
```
