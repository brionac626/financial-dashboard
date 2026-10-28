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
