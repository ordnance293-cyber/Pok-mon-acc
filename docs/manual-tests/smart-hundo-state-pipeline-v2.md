# Smart Hundo State Pipeline V2 人工驗收

## 驗收性質

本文件中的 Case A–E 與兩組顯示／分組案例都必須用真實 Pokémon GO 截圖人工驗收。`tests/smart-hundo.test.html` 使用 mock 回應，只能驗證 deterministic 行為、請求契約與狀態管線；mock 測試不證明真實圖片的視覺辨識準確度。

執行日期、版本、瀏覽器、驗收人與實際結果應記錄在獨立且已去識別化的驗收紀錄中。本文件只定義步驟與預期結果，不表示案例已通過。

## 設定與資料保護

1. 以待驗收版本開啟應用程式，使用支援的桌面瀏覽器與測試用 OpenAI API key。
2. 準備符合 Case A–E 的真實原始截圖；不要先縮圖、裁切卡片或重新壓縮。
3. 每個案例開始前清空表單、圖片選擇與 DevTools Network 紀錄，確保前一輪 AI 值或人工修改不會影響結果。
4. 只在本機查看真實截圖與 API 回應。不得把 API key、`Authorization` header、Firebase 設定、GAS URL／部署 token、帳號資料、原始圖片、data URL、完整 request／response body 或未遮蔽 HAR 加入 issue、commit、聊天或驗收附件。
5. 分享證據前遮蔽玩家名稱、帳號、位置等個資；Network 證據只記錄去識別化的 request 次數、階段、HTTP 狀態與是否發生 retry，不匯出原始 payload。

## Request 次數檢查

在 DevTools Network 以 OpenAI chat-completions endpoint 篩選每一輪請求，逐張 hundo 截圖記錄：

- 正常路徑：1 次分類、1 次上方 count-region 抽取、1 次整張原圖 cards 抽取，共 3 次。
- cards 結構不完整時：允許再增加 1 次整張原圖 cards structural retry；第二輪 cards 必須完整取代第一輪，不得 append。
- 不得出現逐卡、逐 Pokémon 或逐狀態的額外請求。
- 若 HTTP／網路層重試造成額外 request，另列重試原因與狀態，不得把它誤記為 cards structural retry。
- 多張圖逐張套用上述計數，再核對上傳順序不影響 canonical routing 與最終 scroll order。

## 人工案例

### [Manual] Case A — count 與 egg 數字隔離

輸入畫面：

- 百神搜尋摘要：`(3)`
- egg：`9/12`
- cards：`鳳王 / 哲爾尼亞斯 / 淨化雷吉奇卡斯`

預期：

```text
hundo_leg=3
pokemon_list=鳳王,哲爾尼亞斯,雷吉奇卡斯
```

確認 `9/12` 沒有成為百神數，且淨化狀態不改變這一案例的隱藏狀態分組名稱。

### [Manual] Case B — 合法非相鄰重複

輸入順序：

```text
藏瑪然特 / 拉帝亞斯 / 蒼響 / 淨化固拉多 / 藏瑪然特 / 酋雷姆
```

預期：

```text
藏瑪然特*2,拉帝亞斯,蒼響,固拉多,酋雷姆
```

兩張藏瑪然特都必須保留，且不得因物種相同而當成 overlap。

### [Manual] Case C — 相鄰合法重複

輸入順序：

```text
鳳王 / 鳳王 / 閃電鳥 / 蒼響 / 蓋歐卡 / 炎帝
```

預期：

```text
鳳王*2,閃電鳥,蒼響,蓋歐卡,炎帝
```

兩張相鄰鳳王都必須保留為不同卡片。

### [Manual] Case D — 12+ 張完整列舉

使用同一張畫面含至少 12 張 full／partial cards 的真實截圖。

預期：12+ full/partial cards all represented。每張完整或部分可見卡片都有獨立 card object；`detected_card_count` 等於 `cards.length`，且不因超過 10 張或卡片位於邊緣而遺漏。

### [Manual] Case E — 多圖邊界 overlap

使用兩張有垂直重疊的真實截圖，邊界至少有 2 張連續、完整 signature 相同的卡片，並在非 overlap 位置放入合法重複卡。

預期：strong two-card overlap removed; legitimate duplicates retained。只有 suffix-prefix 邊界中至少 2 張連續卡片被去重；單張邊界相同、非邊界相同物種或其他合法重複都必須保留。

## 顯示與分組

### [Manual] 隱藏狀態合併

輸入：

```text
普通固拉多＋淨化固拉多＋亮晶晶固拉多
```

預期：

```text
固拉多*3
```

### [Manual] 可見狀態分開

輸入：

```text
普通固拉多＋色違固拉多＋特別背卡固拉多
```

預期：

```text
固拉多,色違固拉多,特別背卡固拉多
```

## 驗收紀錄最小欄位

每個案例記錄版本／commit、去識別化的圖片代號、實際 `hundo_leg`、實際 `pokemon_list`、card object 數、OpenAI request 分階段次數、retry 原因、人工判定（通過／失敗）與失敗摘要。不得貼入上述敏感資料或未遮蔽的圖片與 Network payload。
