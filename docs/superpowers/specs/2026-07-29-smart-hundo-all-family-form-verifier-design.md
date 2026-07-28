# Smart Hundo 全型態家族二次複核設計

## 目標

在既有完整原圖 Smart Hundo 掃描後，只針對型態白名單中 `effective_form_id = uncertain` 的卡片啟動條件式二次裁切複核，降低普通／特殊型態的假性待確認，同時保留 fail-closed 行為。

## 範圍

支援既有 10 組基礎物種與 23 個 canonical form IDs：急凍鳥、閃電鳥、火焰鳥、蒼響、藏瑪然特、帝牙盧卡、帕路奇亞、基格爾德、奈克洛茲瑪、酋雷姆。

Stage 2 只能修改型態欄位，不得修改物種、CP、色違、亮晶晶、最愛、Rocket 狀態、背卡、卡片數量或順序。

## 架構

1. Stage 1 維持既有 GPT-5.4-mini 完整原圖掃描與 deterministic validation。
2. 從已驗證卡片挑選 `base_species` 位於型態白名單且 `effective_form_id = uncertain` 的候選。
3. Stage 1 必須提供每張卡片的 normalized `card_bbox` 與 `pokemon_bbox`。bbox 無效或裁切失敗時保留原結果，不猜測。
4. 從原始圖片裁切、放大候選寶可夢本體；每最多 6 張組成一張 PNG contact sheet。
5. 每張 contact sheet 只發出一次型態複核請求；額外請求數為 `ceil(candidate_count / 6)`。
6. 複核輸出以 `card_id` 對應，且每張卡只允許從該 `base_species` 的候選 form IDs 或 `uncertain` 中選擇。
7. 複核結果再次通過 deterministic validation 後，才覆蓋 Stage 1 的型態結果；不確定、低信心、候選越界、ID 缺漏或衝突一律保留 Stage 1 的 `待確認`。

## 驗證規則

Stage 2 必須回傳：`card_id`、`form_id`、`form_confidence`、`form_evidence`。

- `form_id` 必須屬於該卡片的 allowed forms 或 `uncertain`。
- `form_evidence.visual_signature === form_id`。
- `key_features_visible === true`。
- `recognition_basis = direct_visual_match`。
- `region_visibility = clear`。
- `form_confidence >= 0.90`。
- 不得使用文字標籤作為主要證據。

Stage 2 不得把 `uncertain` 自動退回 standard/base。

## 影像與批次

- contact sheet 每批最多 6 張。
- 每格顯示不可混淆的 `card_id` 與候選 form IDs。
- 保持原始比例，使用 padding，不拉伸寶可夢。
- 裁切來源必須是原始圖片，不使用分類階段的壓縮 JPEG。
- 私人圖片、data URL、API key 與原始模型回覆不得寫入 console 或 repository。

## 診斷

每張卡保留：

- `stage1_form_id`
- `stage1_form_confidence`
- `stage2_used`
- `stage2_reason`
- `stage2_candidate_forms`
- `stage2_form_id`
- `stage2_form_confidence`
- `stage2_validation_reasons`
- `effective_form_id`

bbox 僅能以 normalized 數值出現在安全 diagnostics，不得包含圖片資料。

## 錯誤處理

Stage 2 API 失敗、JSON 結構不完整、contact sheet 建立失敗或候選對應不完整時：

- 不影響 Stage 1 已成功辨識的其他卡片。
- 不修改其他狀態。
- 目標卡片維持原本 `待確認（CPxxxx）`。
- 加入受控診斷 reason，不顯示敏感資料。

## 測試與驗收

自動測試必須涵蓋：

- 0 候選不增加 API 請求。
- 1–6 候選 1 次請求；7–12 候選 2 次請求。
- 10 組物種候選白名單正確。
- 成功 Stage 2 只覆蓋型態。
- 低信心、錯誤 form、signature mismatch、缺卡、重複 card_id、裁切失敗均 fail closed。
- Stage 1 的 CP、物種與五維狀態不可被 Stage 2 修改。
- 現有 grouping、placeholder、Rocket display equivalence、overlap 與 request routing 不回歸。

真實圖片驗收至少包含普通藏瑪然特 CP3282 與一張盾王藏瑪然特；未實際執行不得宣稱 real-image PASS。