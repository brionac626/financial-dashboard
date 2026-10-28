# 家計 · Financial Dashboard

以 OnePageTemplate 架構建立的家庭財務儀表板。使用 Astro 靜態頁面、React 互動島嶼、TypeScript、Tailwind CSS、Lucide、Recharts 與 SheetJS，全部資料在瀏覽器處理，不需要後端或帳號。

## 本機開發

```sh
npm install --allow-remote=root
npm run dev
```

SheetJS 0.20.3 依[官方安裝方式](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)使用官方 CDN tarball；`--allow-remote=root` 僅允許本專案 package.json 明確列出的 URL 依賴，不修改全域設定。瀏覽器執行時使用已打包的本機程式碼，不從 CDN 載入套件。

```sh
npm test        # 匯入、財務計算、保險及儲存測試
npm run check  # Astro / TypeScript
npm run build  # 型別檢查與靜態建置，輸出 dist/
npm run preview
```

預設測試與 QA 檔案均使用 `tests/workbook.ts` 建立合成工作簿，不需要根目錄 Excel。執行 `npm run test:fixtures` 可在忽略的 `tests/.generated/` 產生兩份年度資料、零值、負值與損壞檔案；這些資料不隨網站發布，也不預載於畫面。

原始空白範本另以選用測試驗證（PowerShell）：

```powershell
$env:FINANCE_TEMPLATE_PATH = 'C:\path\to\blank-template.xlsx'
npm run test:template
Remove-Item Env:FINANCE_TEMPLATE_PATH
```

`test:template` 獨立執行相容性測試；未設定環境變數、路徑不存在或內容不符時均會失敗。正式資料處理與儲存格式不受測試資料調整影響。

使用 Node.js 24。建置結果可由一般靜態伺服器提供。Cloudflare Pages 設定與跨平台腳本已備妥，首次部署前請依下列指引設定；本次程式交付未建立雲端專案或實際發布。

## 部署至 Cloudflare Pages

採用 [Direct Upload 與 GitHub Actions](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)，上傳已建置的 `dist/`。這是純靜態網站，不需要 Astro Cloudflare adapter、Pages Functions 或後端資料庫。Wrangler 為固定版本的開發依賴，CI 與本機均直接呼叫專案內的 CLI，避免 npx 臨時下載不同版本。

### 1. 工具與首次建立專案

準備 Node.js 24、Git；Windows 使用 PowerShell 7，Linux 使用 Bash。從乾淨 checkout 安裝含開發依賴的 lockfile：

```sh
npm ci --allow-remote=root
```

在 Cloudflare 建立僅限目標帳號的 API Token，權限為 **Account → Cloudflare Pages → Edit**，並取得該帳號的 Account ID。這兩項只用於部署程序，不放入 `PUBLIC_*` 變數、前端程式或提交檔案。

先複製 `.env.example` 為專案根目錄的 `.env`。Windows：

```powershell
Copy-Item .env.example .env
```

Linux：

```bash
cp .env.example .env
```

用文字編輯器填寫 `.env`，例如下列佔位值；已有 `.env` 時直接編輯，勿重新複製覆蓋：

```dotenv
CLOUDFLARE_API_TOKEN=your-pages-edit-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_PROJECT_NAME=financial-dashboard
```

確認專案名稱後執行首次設定腳本：

```powershell
pwsh -File .\scripts\setup-pages.ps1 -DryRun
pwsh -File .\scripts\setup-pages.ps1
```

```bash
bash scripts/setup-pages.sh --dry-run
bash scripts/setup-pages.sh
```

`setup-pages` 只建立 Direct Upload 專案並指定正式分支 `main`，不執行測試、建置或上傳網站。乾跑不要求 Token、不呼叫 Cloudflare；成功建立後再執行下一節的遠端部署。已有專案則略過 setup，確認其正式分支為 `main`；重複建立或認證失敗會保留 Wrangler 原始錯誤及退出碼，不假裝成功。

建立及遠端部署腳本共用 `scripts/pages.mjs` 與 `scripts/pages-config.mjs`，無論從哪個目錄啟動，都讀取專案根目錄 `.env`。優先順序為：**非空白的終端環境變數 → `.env`**；兩者未指定專案名稱時才使用 `wrangler.jsonc` 的 `name`。空白字串不覆寫下一層設定。`.env` 不存在時仍可完全使用終端變數；缺少憑證只會提示變數名稱。

解析使用 Node.js 24 內建 `util.parseEnv`，支援註解、引號與 CRLF，只採用上述三個 Cloudflare 設定，不載入 `.env.local`／`.env.production`，也不執行 Bash `source`、PowerShell 表達式或 `$VAR` 展開。值含 `#` 或空格時請加引號。`wrangler.jsonc` 的輸出仍為 `./dist`；自訂名稱須與 GitHub Variable 一致。

`.env` 已被 Git 忽略，`.env.example` 只保存空白憑證範本。載入值不寫回終端、不作為命令列參數、不輸出 Token；僅以子程序環境交給 Wrangler，npm 測試及建置的啟動環境不帶 Cloudflare 設定。不要將憑證改名為 `PUBLIC_*` 或複製至 `public/`。不要執行已填真實 Token 的 `.env` 作為 shell 腳本。

不要為同一專案另開 Cloudflare Git 整合的自動建置，以免與這份 Actions 流程重複部署。

### 2. 設定 GitHub Actions

Repository → **Settings → Secrets and variables → Actions**：

| 類型 | 名稱 | 內容 |
| --- | --- | --- |
| Repository Secret | `CLOUDFLARE_API_TOKEN` | 目標帳號的 Pages Edit Token |
| Repository Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| Repository Variable（選用） | `CLOUDFLARE_PROJECT_NAME` | 實際 Pages 專案名稱，未設時讀取 wrangler.jsonc |

`.github/workflows/deploy.yml` 執行 Node.js 24 安裝、合成資料測試、部署腳本驗證及正式建置：

- 推送至 `main`：驗證成功後部署正式環境。
- PR 目標為 `main`：只驗證，不讀取部署憑證、不上傳，包括 fork PR。
- Actions → **Validate and deploy Cloudflare Pages → Run workflow**：選 `main` 才會部署；其他分支只驗證。

正式部署排隊執行，不同 PR 的驗證互不阻塞。缺少 Secrets 會使部署步驟失敗；CI 不會靜默跳過並報成功。Wrangler 回報成功後會列出實際部署網址，主要站點通常為 `https://<專案名稱>.pages.dev`。設定檔與變更須先經人工審核合併至 `main`，此流程才會生效。

### 3. 本機手動部署與乾跑

腳本從自己的位置找到專案根目錄，可由其他目錄透過絕對路徑呼叫。遠端部署先執行 `npm test`、`npm run build`，再將 `dist/` 發布至 **main 正式環境**；任何一步失敗均立即停止並傳回非零退出碼。部署的是本機目前的程式碼，請先確認工作目錄及變更內容。

Windows：

```powershell
# 不要求憑證，也不呼叫 Cloudflare；仍會執行測試及建置
pwsh -File .\scripts\deploy-remote.ps1 -DryRun
# 自動讀取根目錄 .env（終端同名非空白設定優先），實際發布
pwsh -File .\scripts\deploy-remote.ps1
```

Linux：

```bash
bash scripts/deploy-remote.sh --dry-run
bash scripts/deploy-remote.sh
```

不要用 Wrangler 的 `pages project create` 或任何真正部署命令驗證乾跑；上述 DryRun 是腳本提供的離線模式，不是 Wrangler 的選項。

若另外設定過終端憑證，使用後可移除：PowerShell 執行 `Remove-Item Env:CLOUDFLARE_API_TOKEN, Env:CLOUDFLARE_ACCOUNT_ID`；Bash 執行 `unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID`。腳本不修改呼叫端的終端環境；`.env` 中手動填寫的設定仍保留於本機。

### 4. 本機模擬 Pages

不需 Token；預覽腳本不加入部署憑證載入步驟。每次重新建置後在 `127.0.0.1:8788` 提供本機服務，不上傳任何資源。按 Ctrl+C 停止。

```powershell
pwsh -File .\scripts\deploy-local.ps1
pwsh -File .\scripts\deploy-local.ps1 -Port 8790
```

```bash
bash scripts/deploy-local.sh
bash scripts/deploy-local.sh --port 8790
```

開發介面使用 `npm run dev`；只需預覽靜態建置也可使用 `npm run preview`。

### 5. 排查、回復與資料隔離

| 問題 | 處理方式 |
| --- | --- |
| npm ci 失敗 | 確認 Node 24、lockfile 與 package.json 一致，SheetJS 官方 CDN 可連線，並帶上 `--allow-remote=root` |
| 找不到 Wrangler | 不要只安裝 production 依賴；重新執行 `npm ci --allow-remote=root` |
| 驗證或建置失敗 | 先修復最早失敗的測試／型別錯誤；不跳過檢查上傳舊 dist |
| 缺少憑證、認證錯誤 | 本機檢查根目錄 .env 與終端覆寫；CI 檢查 Secrets。確認 Token 未過期，Account ID 與 Token 的帳號範圍一致 |
| Pages 專案不存在 | 先執行 setup-pages 腳本；檢查 CLOUDFLARE_PROJECT_NAME 的拼字及帳號 |
| 修改 .env 後目標仍沒改變 | 檢查終端是否已有同名非空白變數，優先度高於 .env |
| 部署被判為 preview | 確認 Pages 專案的 production branch 為 main；本流程明確傳入 `--branch main` |
| 本機埠已占用 | 使用 `-Port`／`--port` 指定其他 1024–65535 埠 |
| Wrangler 原生執行檔無法執行 | 檢查作業系統／架構與 npm 可選依賴、安裝腳本限制；重新安裝依賴，不要改用未固定的全域 CLI |

需要回復網站時，在 Cloudflare **Workers & Pages → 專案 → Deployments** 選擇先前成功的正式部署，再使用 **Rollback to this deployment**。回復只切換雲端版本；後續 main 推送仍會重新部署程式碼，請同步以 Git revert 修正要保留的版本。參考 [Cloudflare 回復文件](https://developers.cloudflare.com/pages/configuration/rollbacks/)。

財務資料仍只保存在使用者瀏覽器。localStorage 依 origin（協定、網域與埠）隔離：localhost、pages.dev、自訂網域及不同預覽網址不共用紀錄，切換網址需重新匯入。同一 origin 的一般部署不會主動清除既有財務紀錄。

部署腳本的離線整合測試可執行 `npm run test:deploy`。它使用含空白的暫存專案、合成 `.env` 與替身 npm／Wrangler，不連線建立或發布；Linux 驗證 Bash，Windows 驗證 PowerShell，並在有 WSL Node 24 或 Git Bash 時加驗 Bash。WSL 可透過 `PAGES_TEST_LINUX_NODE` 指定 Linux Node 的完整路徑。

## 操作

1. 在來源 Excel 填寫月末餘額，保留年份、月份、分類及必要表頭。
2. 點選「匯入 Excel」或將檔案拖入頁面，一次最多 20 份、每份最多 10 MB。
3. 檢查預覽；有效檔案可個別取消勾選。確認後載入並嘗試存到 localStorage。
4. 切換月份查看摘要、配置、趨勢及帳戶明細。保險由來源檔案選單獨立切換。
5. 切換家庭或修正已有月份時，點選「清除紀錄」，再匯入正確檔案。

來源範本只有欄位與公式，沒有填寫餘額；直接匯入會顯示無有效資料，這是預期行為。網站沒有預載假資料，也不公開原始範本。

## 支援的 Excel 格式

- 一份檔案包含唯一一張名稱含「資產負債」的工作表。
- 年份使用 `2024年` 形式（1900–2199）；月份使用 `1月` 至 `12月`。
- 必要欄位為「類型」「帳戶」「功能」「目標/用途」。
- 類型依序包括流動資產1、流動資產2、非流動資產、流動負債、非流動負債。合併儲存格分類向下沿用到小計或下一個分類。
- 可更改帳戶名稱、增加分類內明細列；重名帳戶仍為獨立列。不支援任意試算表映射。
- 金額接受數值或正確千分位數字字串，含負值與小數；單筆絕對值上限一兆。外幣請自行換算新臺幣。
- 公式明細只讀取有效數值快取，不執行公式；缺少快取或有錯誤時須在 Excel 修正、重算與儲存。
- 每張工作表上限 5,001 列、101 欄；解析在 Worker 中執行，20 秒逾時即停止。

## 計算與合併

- 每個年月為一份快照。全空白月份略過；明確填寫 `0` 會建立月份，已填月份內其他空白帳戶視為零。
- 總資產 = 現金資產 + 投資資產 + 非流動資產。總負債 = 流動負債 + 非流動負債。淨值 = 總資產 − 總負債。
- 忽略 Excel 的小計、總計與橫向 Total，修正來源範本總資產未包含現金的問題。
- 負債占資產 = 總負債 ÷ 總資產；總資產為零時顯示無法計算。
- 重複年月保留原資料，同批依預覽順序先到先保留。新資料不覆蓋舊月份。
- 趨勢按年月排序，缺漏月份為斷點；摘要比較上一筆有資料月份並標示年月。

### 歷史累計與當月統計

財務總覽上方的「歷史累計統計」加總所有有效月份，顯示涵蓋期間與月份數；這是歷史餘額的加總，同一資產可能重複計入，不代表目前持有金額。累計資產負債比使用累計負債除以累計資產，不平均各月比例。

「當月統計」的四張卡片、圓餅圖與分類長條圖均對應標題所示年月。使用放大的「報表月份」選單切換月份，不會改變歷史累計數字。

兩區各一張資產／負債圓餅圖，以總資產與總負債合計為分母；這與卡片的「負債 ÷ 資產」比例不同。圖旁保留金額及占比明細。兩項皆零或任一總額為負數時不繪圖，顯示原因；不將負數轉成正數。單一正值則顯示 100%。

## 保險資料

選讀名稱含「保險概況」的工作表。依人壽、產物及政府保險區段與「種類」表頭辨識。只有險種名稱、其他欄位全空白的預設列不計入。

每份來源保留獨立保險快照，匯入時間只記錄操作時間，不表示盤點日期。保費保留原始文字與格式，不假定月繳或年繳、不加總、不年化。保險不計入資產負債餘額。重複匯入同一檔案會另建一份保險快照。

## 隱私與儲存

僅在 `jiayi.finance.v1` 儲存版本化的月份、帳戶、保險欄位、來源檔名與檢視偏好。原始檔案、位元組、公式與工作簿不儲存。沒有資料上傳、追蹤、第三方字型或外部 API。

檔案解析後立即終止 Worker 並釋放原始資料參照。本機儲存不是備份，也不是加密保管庫；瀏覽器清除網站資料後需重新匯入。損壞紀錄不自動覆寫，須清除後重新嘗試；配額或權限問題會顯示警告，本次頁面的記憶體資料仍可查看。清除只移除此應用程式的鍵。

## 結構

`src/config` 管理品牌與分類；`src/layouts` 與 `src/pages` 為靜態頁面；`src/components` 為 UI；`src/types` 定義資料契約；`src/lib` 分離解析、計算、儲存；`tests` 提供行為測試。所有跨目錄匯入使用 `@/*`。

架構與驗證紀錄見 [docs/architecture/financial-dashboard.md](docs/architecture/financial-dashboard.md)。
