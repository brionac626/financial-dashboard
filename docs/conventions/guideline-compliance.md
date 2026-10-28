# 規範修正交付

修正位於 `.worktrees/codex`，分支為 `codex/guideline-compliance`，基線為 `b86e904`。`main` 尚無新增提交，因此無須 rebase。Worktree 已配置 Agent-Codex 獨立身分。

## 變更與驗證

- 手機基底樣式搭配向上擴展斷點，保持現有布局與焦點行為。
- Worker 協調抽至 lib，共用訊息型別與生命週期測試。
- 單元測試與 QA 使用共用合成資料，原始範本相容性改為獨立命令。
- 驗證結果與限制詳見架構文件的「本次修正驗證結果」。

## 審核與提交前提

原工作目錄已有未提交變更，本次已逐檔備份至 `.worktrees/baseline/` 並帶入隔離目錄。沒有自動提交或合併任何變更；分支尚無新增提交，直接 merge 不會帶入未提交檔案。

`.worktrees/guideline-compliance.patch` 僅包含此次修正相對於任務開始狀態的差異，可供獨立審核。原工作目錄可先用 `git apply --check .worktrees/guideline-compliance.patch` 檢查適用性；不要將整個 Worktree 的差異誤認為此次新增內容。

由工程師先處理並提交既有工作、整合此次 patch，再將此次修正提交於工作分支。若期間 main 有更新，在乾淨工作分支 rebase main，並重新執行測試及建置。完成審核與工作分支提交後，回到乾淨 main 手動合併：

```powershell
git merge --no-ff codex/guideline-compliance -m "refactor: align dashboard with repository guidelines"
```

手機截圖位於 Worktree 的 `tests/.generated/mobile-compliance.png`；QA 資料及截圖不納入正式輸出。
