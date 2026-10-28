# Repository Guidelines

## 專案定位與架構
「家計 · Financial Dashboard」是純瀏覽器端的家庭財務儀表板，以 Excel 匯入資產負債與保險資料，不需要後端或帳號。採用 Astro 7 靜態頁面、React 19 互動島嶼、TypeScript Strict、Tailwind CSS 4、Lucide React、Recharts 與 SheetJS。

## 目錄與文件管理
- `src/pages/`、`src/layouts/`：Astro 頁面與共用版型。
- `src/components/islands/`：互動儀表板與圖表；`src/components/common/`：共用元件。
- `src/lib/`：Excel 解析、Worker、財務計算與儲存；`src/types/`：資料契約。
- `src/config/`：品牌、分類與配色；`src/styles/global.css`：全站樣式；`public/`：公開靜態資源。
- `tests/`：Vitest 測試與測試資料產生器。
- 計畫、里程碑、架構與協作文件分別置於 `docs/plan/`、`docs/milestones/`、`docs/architecture/`、`docs/conventions/`，按需建立；README 與本指南保留於根目錄。

## 開發與驗證指令
使用 Node.js 24，於專案根目錄執行：

| 指令 | 用途 |
| --- | --- |
| `npm install --allow-remote=root` | 安裝依賴，允許明列於 package.json 的 SheetJS 官方 tarball |
| `npm run dev` | 啟動 Astro 開發伺服器 |
| `npm run check` | Astro 與 TypeScript 檢查 |
| `npm test` | 執行 Vitest 測試 |
| `npm run build` | 型別檢查並產生 `dist/` |
| `npm run preview` | 預覽建置成果 |

目前沒有 Makefile、跨平台部署腳本或 CI/CD 設定；新增流程時須同步更新文件，不直接沿用模板的部署指令。

## 編碼與引用規範
使用兩空白縮排、TypeScript 單引號與分號，禁止新增 `any`。元件使用 PascalCase，函式與變數使用 camelCase；共用型別集中於 `src/types/`，計算邏輯與 UI 分離。

`@/*` 對應 `src/*`；跨目錄引用必須使用別名，例如 `import type { MonthlySnapshot } from '@/types/finance'`，禁止 `../` 模組引用。同目錄緊密子元件可使用 `./`；Worker URL 與測試檔案資源路徑依工具需求保留相對引用；同目錄測試輔助模組可使用 `./`。目前未配置獨立 formatter 或 lint 指令。

## 測試與介面原則
測試命名為 `tests/**/*.test.ts`，使用 Vitest 的 `describe`、`it`、`expect` 描述行為。修改相關邏輯時涵蓋解析錯誤、零值與負值、重複月份、累計統計及儲存失敗；優先使用合成資料。目前無覆蓋率門檻。預設測試與 QA 產生器共用 `tests/workbook.ts` 合成資料，不依賴私人工作簿。`npm run test:fixtures` 產生忽略的 QA 檔；原始空白範本相容性驗證使用 `FINANCE_TEMPLATE_PATH` 指定檔案後執行 `npm run test:template`，未設定或缺檔須失敗。勿提交私人工作簿。

提交程式變更前執行 `npm test` 與 `npm run build`。介面採正體中文與台灣用語、`NT$` 金額格式、Mobile-first 版面，並驗證鍵盤操作、窄螢幕及圖表空值狀態。維持無預載假資料的行為。

## Git 與 Agent 協作
開發任務使用 Agent 專屬 Worktree，例如 `git worktree add .worktrees/codex -b codex/task-name`。啟用 `extensions.worktreeConfig` 後，以 `git config --worktree` 設定專屬 `user.name`、`user.email`，避免改寫共用身分。保留使用者既有未提交變更，不將其納入自己的提交。

Agent可以在專屬的worktree內commit修改。

開始任務與里程碑完成時檢查相對 `main` 的基線；需要時在乾淨的工作分支 rebase，完成後重新驗證。Agent 不得自行合併至 `main`；交付變更摘要、驗證結果，以及供人工審核後執行的指令，例如 `git merge --no-ff codex/task-name -m "feat(dashboard): add monthly summary"`。

提交訊息採 Conventional Commits，延續既有 `feat: financial dashboard v1` 慣例。PR 說明行為變更、關聯議題與驗證結果；UI 變更附截圖。

## 隱私與設定
資料處理維持本機執行，不新增上傳、追蹤或外部執行期 API。私人工作簿不得放入 `public/`。保留 `jiayi.finance.v1` 的版本化儲存契約，不儲存原始工作簿、位元組或公式，不清除其他應用的瀏覽器儲存鍵。資料格式或計算規則變更須同步更新 README 與架構文件。
