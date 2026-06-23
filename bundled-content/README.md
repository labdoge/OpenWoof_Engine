# 內建內容

這裡存放隨桌面版一起發布的劇本、角色、世界書與壓縮後立繪。這些檔案是從主工作區的 `scenarios/`、`characters/`、`arcana/` 與 `portraits-optimized/` 鏡像而來，供 release source 與 GitHub 發布包留存。

## 資料夾

- `scenarios/`：內建劇本 JSON。
- `characters/`：可重用的內建角色 JSON。
- `lorebooks/`：世界書與知識條目，每本世界書使用 `{id}/arcanum.json` 與 `{id}/lore/*.json`。
- `portraits/`：已最佳化的 WebP 角色立繪，命名為 `{npcId}/{npcId}_0.webp`、`{npcId}_1.webp` 等。

## 注意

- 顯示文字與敘事內容以繁體中文為主。
- `scenarioId`、`npcId`、`loreId`、`slotId`、enum 值與檔名是資料結構，不做中文化。
- 原始 PNG 立繪保留在主工作區作為素材來源，不放入 portable release。