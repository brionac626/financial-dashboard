# Cloudflare Pages 部署驗證

2026-10-28，工作分支 `codex/cloudflare-pages`，基線 `main`。

- Node.js 24；Wrangler 固定為 4.154.0。
- `npm ci --allow-remote=root` 從 lockfile 成功安裝，npm 稽核零已知漏洞。
- 從另一個工作目錄以 PowerShell 執行真正的 `deploy-remote.ps1 -DryRun`：46 項應用測試通過，正式建置成功，Astro 檢查零錯誤／警告／提示，最後列出目標與命令並明確跳過上傳。
- `npm run test:deploy`：PowerShell 與 WSL Ubuntu-20.04 各 10 個案例，加上 workflow 事件保護測試。涵蓋含空白路徑、乾跑、專案名稱覆寫、缺少憑證、測試／建置／上傳失敗的退出碼與短路、缺少 dist、非法名稱及本機預覽參數。全部使用替身 npm／node，絕不呼叫雲端。
- 真正上傳的 CLI 以非互動模式執行；缺少 Pages 專案時直接失敗，不提示或自動建立。整合測試檢查 CI 模式有傳入替身 CLI。
- actionlint 1.7.12 驗證 workflow 無錯誤；兩支 Bash 腳本通過 WSL `bash -n`。
- 實際啟動固定版本 Wrangler 的 `pages dev dist --ip 127.0.0.1 --port 8794`，HTTP 回應為 200；驗證後停止服務。
- `dist/` 僅含 HTML、CSS、JS 與 favicon；不含 Excel、測試資料或憑證。

本次未建立 Cloudflare 專案、未實際部署、未觸發遠端 GitHub Actions。GitHub Secrets、Cloudflare 帳號權限與正式上傳須由工程師依 README 設定後驗證。自訂名稱透過環境變數／Repository Variable 覆寫；正式分支固定 main。

## 首次建立與 .env 更新

- `setup-pages.ps1`／`.sh` 與遠端部署改用共用 Node.js 執行器 `pages.mjs`；`pages-config.mjs` 使用 Node 24 `util.parseEnv`，只解析三個 Cloudflare 設定。非空白終端設定優先於根目錄 `.env`，專案名稱最後回退至 `wrangler.jsonc`。
- 首次建立只呼叫 `pages project create <name> --production-branch main`，不建置、不上傳。乾跑不呼叫 Wrangler；建立失敗保留退出碼及錯誤，不宣告成功。
- 憑證只以環境變數傳給 Wrangler；npm 子程序的啟動環境移除三個 Cloudflare 設定，呼叫端環境不變。環境解析、子程序啟動錯誤不回顯憑證值；Wrangler 保持非互動模式。
- Windows 真實乾跑已分別驗證 setup 與遠端部署，並以合成 `.env` 完成 46 項應用測試及正式建置；型別檢查零錯誤、零警告、零提示。再次從其他目錄執行乾跑亦成功。
- 建置產物掃描未包含合成 Token；Git 忽略 `.env`、允許 `.env.example`，測試用 `.env` 已移除。
- 部署整合測試改為真實 Node 執行設定載入器、以替身 npm 與 Wrangler 隔離雲端。最終 42 項測試全部通過，包含建立、部署、既有退出碼案例、.env-only、終端覆寫、空白回退、引號／註解／CRLF、特殊字元、無命令執行、無額外變數注入、憑證不進入輸出及不變更呼叫端設定。
- Linux 驗證使用從 Node 官方下載並比對 SHA256 的暫存 Node 24.22.1 執行器，透過 WSL Ubuntu-20.04 實跑；執行器僅存於忽略的 `tests/.generated/`，不加入套件依賴或產物。測試讓 WSL launcher 在穩定目錄啟動，再由 Linux shell 切換至隔離目錄，避免 Windows cwd handle 阻擋清理。
- 新增 Bash 腳本通過 WSL `bash -n`，既有 workflow 通過 actionlint；GitHub Actions 仍直接使用 Secrets，不採用本機 .env 載入器。本次未實際建立 Pages 或發布。
