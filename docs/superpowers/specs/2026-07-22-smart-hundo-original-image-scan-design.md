# 百神原圖智能掃描設計

日期：2026-07-22

## 目標與範圍

在不改變普通截圖、Firebase、GAS、表單與文案行為的前提下，為搜尋條件精確等於 `傳說的寶可夢,幻,究極異獸&4*` 的 `HUNDO_LEGENDARY_SCREEN` 建立獨立掃描路徑。第一階段仍以既有 1000px、JPEG 0.7 圖片逐張分類；分類完成後，只有精確命中的圖片才重新讀取原始 `File`，以 `detail: high` 做一次卡片層級的結構化辨識。

## 採用方案

新增一個不依賴 DOM 的小型 helper 模組，承載搜尋條件正規化、精確路由、智能卡片結果正規化、卡片合併與既有 `pokemon_list` 轉換。`index.html` 保留 OpenAI、表單、Firebase 與 GAS 整合，只串接新 helper 與智能掃描執行期。

此方案比直接在單一 HTML 內堆疊更多純函式更容易進行確定性測試，也比全面拆分現有頁面模組更符合最小改動原則。helper 以瀏覽器全域與 CommonJS 相容包裝提供，瀏覽器不新增第三方依賴，測試環境也能直接載入相同實作。

## 元件與責任

### 圖片工作物件

每個上傳檔案先轉成：

```js
{
  index,
  file,
  classificationDataUrl,
  classification
}
```

`classificationDataUrl` 只由既有 resize 流程產生。原始 `file` 保留到路由完成，智能百神路徑才透過 `FileReader.readAsDataURL()` 讀取；不使用 canvas、不改尺寸、不轉碼。

### 分類與路由

所有工作先獨立分類，再用 `isSmartHundoClassification()` 分割成：

- `normalJobs`：只用壓縮圖執行既有 quick scan 與必要欄位複檢。
- `smartHundoJobs`：不進 ordinary quick/full `pokemon_list` 抽值與必要欄位複檢；每張以自己的原圖執行一次 `smartHundoScan()`。

搜尋字串先做 NFKC、相關標點半形化與去空白。只有分類型別與正規化後完整查詢同時精確符合才進智能路徑。

### OpenAI 智能百神請求

沿用既有 Chat Completions endpoint、`gpt-4.1-mini`、API key UI/儲存方式與網路 retry wrapper。request helper 新增可選的 image detail 參數；普通路徑預設仍為 `auto`，智能百神明確使用 `high`。

智能 schema 對每張卡要求位置、官方名稱、可見標籤、物種信心、三種獨立狀態與信心、辨識狀態，所有物件均為 strict 且禁止額外欄位。Prompt 已知圖片類型與精確查詢，不重做分類；以外觀辨識物種為主、標籤為輔，並要求完整枚舉、卡片歸屬與保守不確定處理。

### 正規化與輸出

智能結果會：

- 使用既有數字規則正規化 `hundo_leg`。
- 依 `order` 排序，只移除相同位置且內容完全相同的重複卡片。
- 僅正規化 `official_name`，永不以 `visible_label` 補值。
- 保留 shiny、purified、shadow、信心與辨識狀態供 runtime audit 使用。
- 將沒有可靠官方名稱或辨識狀態不可靠的卡片排除於 `pokemon_list`，並計入人工確認數。
- 輸出前綴固定為 `色違`、`暗影`；`淨化` 永不顯示，但仍留在 audit。
- 透過既有重複合併規則產生 `名稱*數量`，不產生 `*1`。

多張智能百神圖各自保留原始 index 與 cards。所有可靠卡片最後一次性轉成同一份 `pokemon_list`。`hundo_leg` 採第一個有效值；衝突只記錄狀態與安全 console 訊息，不相加。

### 錯誤與 UI

不支援的原始格式會要求使用 PNG 或 JPEG，不會退回壓縮分類圖。智能請求失敗時不呼叫舊 full scan、不寫入既有使用者編輯的 `pokemon_list`，但普通掃描若已完成則仍套用其欄位。部分卡片不確定時，填入可靠卡片並在 `#aiAutoStatus` 顯示人工確認數。

`window.lastSmartHundoScanResult` 只保留圖片 index、數量、正規化 cards、人工確認數與衝突/失敗摘要；不保留 API key、Authorization header 或原圖 data URL，也不寫入 Firebase/GAS。

## 測試設計

以無付費 API 呼叫的確定性測試覆蓋：

- NFKC 搜尋正規化與精確路由。
- 原圖讀取、普通 resize、image detail 差異與 request payload。
- shiny/purified/shadow 輸出規則、重複合併與不確定卡片。
- 多圖 smart 合併、`hundo_leg` 衝突與 audit 保留。
- ordinary merge、禁止舊 full scan 覆寫、Firebase `newItem` 欄位與 `generateText()` 格式的靜態/執行期回歸。

由於目前 repository 沒有 package/test framework，且本機沒有 Node.js，測試採無第三方依賴的瀏覽器 deterministic harness，mock `fetch`/OpenAI 回應並由本機 HTTP server 執行；另做 HTML/JavaScript 語法檢查與瀏覽器 console 檢查。

## 非目標

不新增裁切、每隻寶可夢一次 API 呼叫、後端代理、Firebase 欄位、GAS 變更、自動儲存、模型升級或普通圖片高解析度處理。舊 `fullHundoScan()` 若無其他呼叫者則移除。
