# 百神智能掃描狀態管線 V2 設計

## 目標

只讓正規化後精確等於 `傳說的寶可夢,幻,究極異獸&4*` 的 Pokémon GO 搜尋截圖進入 dedicated smart-hundo workflow。每張命中圖片分開執行百神總數抽取與完整卡片抽取，保留物種、五維狀態、視覺證據、有效狀態與人工確認原因，再跨圖片保守處理重疊並建立 `pokemon_list`。

本改動不得影響普通分類、資源、商店、個人檔案、寶可夢詳情、隊伍顏色、Firebase、GAS、產生文案、手動儲存、特殊調查、融合、Mega、普通圖片壓縮或普通圖片 detail。

## 已確認方案

採用「純 helper V2＋薄整合層」。

- `smart-hundo-helpers.js` 保存可在無 DOM、無網路環境測試的資料契約、正規化、驗證、顯示、分組、百神數合併、完整性判定與重疊偵測。
- `index.html` 只保存 strict JSON Schema、prompt、圖片轉換、OpenAI transport、工作階段、表單回填與狀態訊息。
- `tests/smart-hundo.test.html` 使用真實 helper 與經過 mock 的真實 page module；所有 OpenAI-shaped responses 都由本機 `fetch` mock 回傳。
- `tests/verify_regressions.py` 靜態鎖住普通掃描與 persistence 邊界。

不採用另外兩個方案：

1. 將所有邏輯留在 `index.html`：修改檔案較少，但狀態驗證、重疊與 session 行為難以純函式測試。
2. 新增完整 runtime controller 模組：元件邊界最乾淨，但會擴大目前單頁架構的載入與初始化變更面。

## 實作順序硬性閘門

新功能依下列順序完成。後一階段不得在前一階段測試通過前接入。

### 階段一：狀態資料契約與純 helper

先新增失敗測試，再建立五維狀態模型、legacy adapter、raw/effective 欄位、人工確認原因、display name 與 grouping。

此階段不加入任何顏色、形狀或位置判定，也不替換 production smart-hundo request。

為避免未完成契約提前進入 production：

- 現有 schema 暫時更名為 `HUNDO_SMART_SCHEMA_V1`，現有 request 暫時繼續使用它。
- 新契約使用最終名稱 `HUNDO_SMART_SCHEMA` 並只由 deterministic contract tests 讀取。
- 現有 production 暫時呼叫明確的 legacy normalization/conversion adapter。
- 最後 production cutover 完成後刪除 V1 schema 與暫時 adapter，不留下雙管線 dead code。

第一階段必須先證明：

1. 七種功能狀態可由五個維度完整表達。
2. rocket state 在資料結構上不可能同時為 shadow 與 purified。
3. background type 在資料結構上不可能同時為 commemorative 與 special。
4. `global` 會成為 `uncertain`，不會轉成 commemorative。
5. lucky、favorite、purified 保存在內部但不進 display name。
6. shiny、shadow、commemorative、special 依固定順序顯示。
7. 隱藏狀態在 display name 建立後合併。
8. 可見狀態不同時維持不同項目。
9. 單一項目不輸出 `*1`。
10. raw model state 不得直接形成 prefix。

### 階段二：視覺證據與 deterministic validation

只有階段一通過後，才依序加入：

1. shiny evidence validator
2. lucky evidence validator
3. favorite evidence validator
4. rocket-state evidence derivation
5. background-type evidence derivation
6. confidence thresholds
7. `validateHundoCardStates()`

每一組規則都先寫失敗測試、確認正確失敗，再寫最小實作。狀態不確定本身不觸發模型重試。

### 階段三：百神數、完整列舉、多圖與工作階段

完成 dedicated count schema、lossless header representation、證據驗證、投票合併、card enumeration completeness、finish reason、單次結構重試、跨圖重疊與 hundo AI provenance。

### 階段四：production cutover

只有新 schema、normalization、evidence validation、effective states、display conversion、grouping、review reasons 與 browser regression tests 全部通過後，才讓 `smartHundoScan()` 使用 V2。

Cutover 後移除 V1 schema、舊 `shadow_state`/`purified_state` prompt 格式、直接信任 raw state 的 converter，以及舊的第一個非空 count 合併。

## 查詢正規化與路由

`normalizeSearchQuery()` 使用：

1. `String(value || '').normalize('NFKC')`
2. 將相關全形標點正規化為 `,`、`&`、`*`
3. 移除所有 Unicode whitespace

三個指定變體都輸出：

`傳說的寶可夢,幻,究極異獸&4*`

`normalizeAiClassification()` 以正規化 query 為 canonical routing authority。只要 query 精確命中，就將 canonical `image_type` 設為 `HUNDO_LEGENDARY_SCREEN`，即使模型原本回傳 `OTHER` 或其他錯誤類型。

`partitionImageJobs()` 對每個 job 保留：

```js
{
  index,
  file,
  classificationDataUrl,
  classification
}
```

所有精確命中的 job 都進 `smartHundoJobs`。不完整 query、`&異色` query 或沒有精確 query 的 `OTHER` 不得進 smart path。

## 五維狀態資料模型

七種功能狀態由五個欄位表達：

```js
{
  shiny_state: "yes" | "no" | "uncertain",
  lucky_state: "yes" | "no" | "uncertain",
  favorite_state: "yes" | "no" | "uncertain",
  rocket_state: "normal" | "shadow" | "purified" | "uncertain",
  background_type: "none" | "commemorative" | "special" | "uncertain"
}
```

- 色違由 `shiny_state` 表達。
- 亮晶晶由 `lucky_state` 表達。
- 我的最愛由 `favorite_state` 表達。
- 暗影與淨化由互斥的 `rocket_state` 表達。
- 紀念背卡與特別背卡由互斥的 `background_type` 表達。
- shiny、lucky、favorite 是獨立維度。
- shadow 與 purified 是單一 rocket 維度的互斥值。
- commemorative 與 special 是單一 background 維度的互斥值。
- 不定義 `global`、`global_background` 或 `全球背卡`。
- legacy 或測試輸入若含 `global`，raw 值仍保留供診斷，normalized 與 effective 值都是 `uncertain`；不得自動映射成 `commemorative`。

每張 normalized card 保存：

```js
{
  screenshot_index: 2,
  order: 1,
  row: 1,
  column: 1,
  cp: "3104",
  visible_label: "GLO蒼響151515",
  official_name: "蒼響",
  recognition_status: "recognized",
  species_confidence: 0.98,

  shiny_state: "yes",
  shiny_confidence: 0.98,
  shiny_evidence: { /* strict normalized evidence */ },

  lucky_state: "yes",
  lucky_confidence: 0.97,
  lucky_evidence: { /* strict normalized evidence */ },

  favorite_state: "yes",
  favorite_confidence: 0.99,
  favorite_evidence: { /* strict normalized evidence */ },

  rocket_state: "purified",
  rocket_confidence: 0.98,
  rocket_evidence: { /* strict normalized evidence */ },

  background_type: "special",
  background_confidence: 0.96,
  background_evidence: { /* strict normalized evidence */ },

  effective_shiny_state: "yes",
  effective_lucky_state: "yes",
  effective_favorite_state: "yes",
  effective_rocket_state: "purified",
  effective_background_type: "special",

  raw: {
    states: {},
    confidences: {},
    evidence: {}
  },
  manual_review_reasons: []
}
```

`raw` 只包含模型回傳的狀態、confidence 與 enum evidence；不含圖片、File、data URL、prompt 或 credentials。

`normalizeSmartHundoCard()` 不把 raw state 當作 effective state。未經 validator 的 effective state 預設為 `uncertain`。`smartHundoCardsToPokemonList()` 只讀 `effective_*`。

## Legacy adapter

`adaptLegacyRocketState()` 僅供舊 response 過渡與 deterministic tests 使用，不出現在新 prompt 或 V2 schema。

| 舊 shadow_state | 舊 purified_state | rocket_state |
|---|---|---|
| yes | 非 yes | shadow |
| 非 yes | yes | purified |
| yes | yes | uncertain |
| no | no | normal |
| 缺值、非法值或其他衝突 | 任意 | uncertain |

舊結果沒有 lucky、favorite 或 background 時，一律正規化為 `uncertain`，不得猜測，也不得加入可見 prefix。

## Strict evidence schema

V2 `HUNDO_SMART_SCHEMA` 不含 `hundo_leg`。root properties：

```js
{
  detected_card_count,
  scan_complete,
  bottom_edge_checked,
  enumeration_confidence,
  cards
}
```

每個 object 都是 `additionalProperties: false`，所有 properties 都列入 `required`。cards 不設 `maxItems`。

狀態 evidence 使用受控 enums：

```js
shiny_evidence: {
  present: boolean,
  region_visibility: "clear" | "partially_occluded" | "cropped" | "not_visible" | "uncertain",
  position: "none" | "cp_area" | "lower_left" | "upper_right" | "around_pokemon" | "other" | "uncertain",
  color: "none" | "dark_blue" | "blue_black" | "teal_blue" | "dark_blue_teal" | "light_cyan" | "yellow" | "purple" | "other" | "uncertain",
  shape: "none" | "multiple_four_point_sparkles" | "single_radial_sparkle" | "five_point_star" | "flame_or_smoke" | "other" | "uncertain"
}

lucky_evidence: {
  present: boolean,
  region_visibility: "clear" | "partially_occluded" | "cropped" | "not_visible" | "uncertain",
  position: "none" | "behind_pokemon" | "other" | "uncertain",
  appearance: "none" | "large_gold_shimmering_background" | "other" | "uncertain"
}

favorite_evidence: {
  present: boolean,
  region_visibility: "clear" | "partially_occluded" | "cropped" | "not_visible" | "uncertain",
  position: "none" | "upper_right" | "other" | "uncertain",
  appearance: "none" | "filled_yellow_five_point_star" | "other" | "uncertain"
}

rocket_evidence: {
  present: boolean,
  region_visibility: "clear" | "partially_occluded" | "cropped" | "not_visible" | "uncertain",
  position: "none" | "lower_left" | "lower_side" | "around_pokemon" | "other" | "uncertain",
  color: "none" | "light_blue" | "light_cyan" | "purple" | "other" | "uncertain",
  shape: "none" | "single_radial_sparkle" | "purification_starburst" | "flower_like_symbol" | "purple_flame" | "purple_smoke" | "shadow_aura" | "other" | "uncertain"
}

background_evidence: {
  present: boolean,
  region_visibility: "clear" | "partially_occluded" | "cropped" | "not_visible" | "uncertain",
  position: "none" | "near_pokemon_or_card_background" | "other" | "uncertain",
  badge_type: "none" | "commemorative_location_badge" | "special_background_badge" | "other" | "uncertain",
  appearance: "none" | "location_style_background" | "event_special_background" | "other" | "uncertain"
}
```

`region_visibility` 是每一個 evidence object 的 required property。effective `no`、`normal` 或 `none` 只允許由 `region_visibility === "clear"`、`present === false` 與該 evidence 其餘欄位的負向值共同建立；其他 visibility 值不能建立負向狀態。

## 視覺驗證

門檻常數集中於 helper 並附註用途：

- `HUNDO_COUNT_CONFIDENCE_THRESHOLD = 0.85`
- `SPECIES_CONFIDENCE_THRESHOLD = 0.80`
- `STATE_YES_CONFIDENCE_THRESHOLD = 0.85`
- `STATE_NEGATIVE_CONFIDENCE_THRESHOLD = 0.75`
- `ENUMERATION_CONFIDENCE_THRESHOLD = 0.85`

低於門檻、raw/evidence 互相矛盾或 evidence pattern 不合法時，effective state 為 `uncertain`，不能成為可見 prefix。

所有負向狀態都需要正向的「區域可判讀」證據：

- shiny/lucky/favorite 的 effective `no`，必須確認該狀態的相關區域完整可見且 clear，並且沒有相符符號或背景證據。
- rocket 的 effective `normal`，必須確認 Pokémon 下側、左下與身體周圍相關區域完整可見且 clear，沒有暗影或淨化證據。
- background 的 effective `none`，必須確認卡片背景與 badge 相關區域完整可見且 clear，沒有紀念或特別背卡證據。
- 相關區域被遮擋、模糊、位於截圖裁切邊緣或不可見時，無論 raw model 回傳 `no`、`normal` 或 `none`，effective state 都必須是 `uncertain`。
- 「沒有看到符號」本身不足以判定負向狀態；validator 必須先證明應檢查的區域 clear。

### Shiny

`yes` 必須同時具備同卡、CP area、dark-blue/blue-black/teal-blue 顏色，以及 multiple four-point sparkles。身體顏色不足。

lower-left、light-cyan、single radial sparkle 是淨化 pattern，不是 shiny。若 raw shiny 為 yes 但只有此證據，effective shiny 為 uncertain，effective rocket 可為 purified。

### Lucky

`yes` 必須是寶可夢後方的大面積金黃閃爍背景。單一黃色星星不是 lucky。

### Favorite

`yes` 必須是同卡 upper-right 的 filled yellow five-point star。多個深藍四角星不是 favorite。

### Rocket

- purified：lower-left/lower-side、light-blue/light-cyan、單一 radial/starburst/flower-like purification symbol。
- shadow：lower-left/around Pokémon、purple flame/smoke/aura。
- 紫色身體本身不足。
- raw state 與 evidence 指向不同 rocket 值時為 uncertain，不在兩者間猜測。

### Background

- commemorative：實際 commemorative/location badge 與相符背景。
- special：實際 special-event badge 與 event-themed background。
- 顏色本身不足。
- 單一欄位保證兩者不會同時成立。

## 顯示名稱與分組

`buildHundoDisplayName()` 只接受 species recognized、官方名稱非空且 species confidence 達標的卡片。

只顯示：

1. `effective_shiny_state === "yes"` → `色違`
2. `effective_rocket_state === "shadow"` → `暗影`
3. `effective_background_type === "commemorative"` → `紀念背卡`
4. `effective_background_type === "special"` → `特別背卡`
5. `official_name`

不顯示但保留：

- lucky
- favorite
- purified

例如：

```text
shiny=yes + lucky=yes + favorite=yes + purified + special + 超夢
→ 色違特別背卡超夢
```

先為每張卡建立 display name，再依完全相同的 display name 依第一次出現順序計數。數量大於 1 才輸出 `*N`。

```text
普通固拉多 + 淨化固拉多 + 亮晶晶固拉多
→ 固拉多*3

普通固拉多 + 色違固拉多 + 特別背卡固拉多
→ 固拉多,色違固拉多,特別背卡固拉多
```

若 species recognized 但某狀態 uncertain，保留沒有該 prefix 的 species display name，並加入該維度人工確認原因。species 本身 uncertain 時不進清單，也不以 `visible_label` fallback。

## 人工確認原因

使用穩定 reason codes，狀態文案由單一 mapping 產生：

- `species_uncertain`
- `shiny_uncertain`
- `lucky_uncertain`
- `favorite_uncertain`
- `rocket_state_uncertain`
- `background_uncertain`
- `incomplete_card_enumeration`
- `hundo_count_uncertain`
- `hundo_count_conflict`
- `screenshot_overlap_uncertain`
- `smart_hundo_request_failed`

卡片保存自己的 reasons；同一卡片可以同時有多個 reason，例如 shiny 與 background 都 uncertain。screenshot 與 session 保存分項彙總。

人工確認細項可重複計數不同 reason，但「需人工確認的卡片總數」必須以穩定 card identity 去重；同一卡片即使有三個 reason，卡片總數仍只計一次。UI 同時顯示分項數量與去重後卡片總數，不再只顯示沒有原因拆解的「N 張卡片需人工確認」。

normalized card 的 `card_id` 定義為 `${screenshot_index}:${order}:${row}:${column}`。V2 schema 要求 order、row、column 都是從 1 開始的整數；同一 screenshot 若模型輸出重複座標，結果視為 structurally incomplete，而不是以陣列索引猜測 identity。完成 structural replacement 與 overlap removal 後，manual-review summary 只對仍保留的 cards 以 `card_id` 建立 `Set`，因此同卡多個 reasons 只貢獻一個 review-card total。

## Dedicated 百神數管線

每張 smart screenshot 執行獨立 count operation，不從 card schema 或 cards 推導。

### 圖片表示

由原始 data URL 在本機 canvas 解碼，裁取原始寬度與上方約 42% 高度，輸出 lossless PNG。不得走 1000px/JPEG 0.7 ordinary compressor。count request 使用 `detail: high`。

此區域涵蓋 active 寶可夢 tab、其搜尋結果摘要、搜尋 input 與鄰近 egg tab，並避免以卡片數量干擾 count。

- 原圖上方約 42% 只是預設的聚焦輸入，不是固定 UI 座標或百神數判定規則。
- 不得因數字位於特定高度、特定像素位置或特定顏色，就判定為百神數。
- 合法性仍完全由 active Pokémon tab、Pokémon search-result summary、parentheses、relative position 與 slash exclusion 驗證。
- 若裁切圖沒有完整包含 active Pokémon tab、其搜尋結果摘要，以及足以排除 egg tab 的相鄰 UI，count result 必須是 `uncertain`、validated `hundo_leg` 必須留空、加入 `hundo_count_uncertain`。
- 裁切資訊不足時不得 fallback 到 `cards.length`、`detected_card_count`、可見卡片數、egg `9/12` 或任何其他附近數字。

### Count schema

`HUNDO_COUNT_SCHEMA`：

```js
{
  hundo_leg: "3",
  raw_count_text: "(3)",
  active_tab: "pokemon" | "egg" | "unknown",
  count_source: "pokemon_search_result_summary" | "other" | "uncertain",
  relative_position: "associated_with_active_pokemon_tab" | "other" | "uncertain",
  has_parentheses: true,
  has_slash: false,
  confidence: 0.99
}
```

strict schema、root `additionalProperties: false`、全部 properties required。

prompt 只依 active Pokémon tab 的語意關係與相對位置辨識 parenthesized result summary；顏色不是必要或決定性訊號。明確排除 egg `9/12`、storage `142/450`、CP、clock、battery、query `4*`、visible card count、detected count、`cards.length` 與 screenshot count。

### Deterministic count validation

`validateHundoCountEvidence()` 同時要求：

1. classification query 精確命中。
2. active tab 是 pokemon。
3. source 是 Pokémon search-result summary。
4. relative position 與 active Pokémon tab 關聯。
5. parentheses true。
6. slash false。
7. NFKC 後 raw text 完全符合一個 parenthesized integer。
8. `hundo_leg` 等於 raw text 解析出的標準十進位整數。
9. confidence 至少 0.85。

失敗回傳空 validated count 與 `hundo_count_uncertain`，不得使用 card count 或前次 AI count。

### 多圖 count merge

- 所有 valid 值相同：採共同值。
- 只有一個 valid：採該值。
- 衝突：採出現次數最多者。
- 最高次數同票：採該組中 confidence 最高者。
- 最高 confidence 仍同票：
  - validated `hundo_leg = ""`
  - 加入 `hundo_count_conflict`
  - 加入 `hundo_count_uncertain`
  - 在安全 diagnostics 保留所有候選值與各自 confidence
  - 要求人工確認
- 完全平手時禁止使用數值大小、upload order、screenshot index、`cards.length`、`detected_card_count` 或可見卡片數選出百神數。
- 任一不同 valid 值都保留 conflict diagnostic；最高 confidence 仍同票時 count 必須 unresolved。
- 永不加總。

## 完整卡片管線

每張 smart screenshot 使用完整、未 resize、未 JPEG 0.7 重壓的原始 data URL，`detail: high`，一個 logical card/state operation；不為每張 Pokémon 個別呼叫。

prompt 要求全圖由上到下、每列由左到右、超過 10 張繼續、檢查 bottom edge、所有 full/partial visible cards 各自輸出、合法重複卡不合併。

root completeness fields：

```js
{
  detected_card_count: 15,
  scan_complete: true,
  bottom_edge_checked: true,
  enumeration_confidence: 0.98,
  cards: []
}
```

`finish_reason` 從 `choices[0]` 解析並只存安全字串。以下任一條件使結果 structurally incomplete：

- detected count 不等於 normalized cards length
- scan complete 不是 true
- bottom edge checked 不是 true
- finish reason 表示 length/truncation

只有 structurally incomplete 可進行一次 controlled structural retry。若執行重試，第二次結果是該 screenshot 的 replacement result：正規化、驗證、顯示、重疊判斷與 diagnostics 都只使用第二次結果；不得把第一次與第二次的 `cards[]` 串接、加總或共同轉成清單。第一次結果只可在安全 diagnostics 記錄「曾觸發重試」及觸發原因，不保存其 cards。

狀態 uncertain、species uncertain 或低 enumeration confidence 不自動重試；低 enumeration confidence 只加入人工確認。

## 物種與型態

物種主要依身體輪廓、頭、四肢、翅膀、尾巴、角、裝甲與 form-specific features。visible label 只作次要證據。

`GLO蒼響151515` 不得成為 official name；可靠視覺證據可輸出 `蒼響`。保存可辨識型態，例如焰白／闇黑酋雷姆、蒼響劍王、藏瑪然特盾王、起源與融合型態。

無法可靠辨識時：

- `official_name = ""`
- `recognition_status = "uncertain"`
- 不 fallback visible label
- 不進 `pokemon_list`

partial visible card 仍保留在 cards array。

## 多圖與 overlap

每張卡保存 screenshot index、order、row、column、CP、visible label、official name、raw states、effective states 與 review reasons。

`detectScreenshotOverlap()` 比較一圖 suffix 與另一圖 prefix，且雙向檢查，因此不依 upload order 判斷上下捲動關係。

card signature 包含：

- CP
- official name
- NFKC/whitespace-normalized visible label
- 五個 effective states

只有至少兩張連續 signature 相同且順序一致才移除 overlap prefix。單一相同卡不移除。多個互相矛盾的 overlap 或只有單卡弱證據時保留全部並加入 `screenshot_overlap_uncertain`。

不得因 official name、CP、label 或 states 單獨相同就全域去重。

## Hundo scan session

`beginSmartHundoScanSession()` 建立 monotonic session ID，立即清除上一個 session 的安全 audit。

只追蹤 `st_hundo_leg` 與 `g_hundos` 的 AI ownership：

- AI 寫入時記錄 session ID 與寫入值。
- input 事件若改變該值，移除 AI marker。
- 新 smart scan 只清除仍與 marker 值相同的舊 AI 結果。
- 手動值在新 validated replacement 完成前保留。
- count 與 list 獨立 replacement；count 失敗不阻止完整 card list，card 失敗不阻止 validated count。
- 套用結果前確認 session ID 仍是目前 session；晚到的舊結果不得覆寫新 scan。
- 不呼叫 general `resetForm()`。

## 安全 diagnostics

公開 `window.lastSmartHundoDiagnostics`，並以同一安全物件相容更新 `window.lastSmartHundoScanResult`。

允許：

- session ID
- screenshot indexes
- canonical classifications/query
- raw count text、validated count、source、confidence、conflicts
- completeness fields、cards length、finish reason
- raw enum states/evidence
- effective states
- review reasons
- overlap decisions
- final `pokemon_list`

禁止：

- OpenAI/API key
- Authorization/Bearer
- original/cropped/resized data URL
- File
- Firebase/GAS credentials
- account/password

console 只記固定 stage、index、count 與 reason codes。OpenAI HTTP error 不把完整 response body或完整 Error object送到 console。

## 測試策略

### Red-green 順序

每個階段：

1. 在 `tests/smart-hundo.test.html` 新增具名 test group。
2. 跑 `python tests/run_browser_tests.py` 並確認因缺少目標行為而失敗。
3. 實作最小 production/helper code。
4. 重跑 browser tests。
5. 跑 `python tests/verify_regressions.py`。
6. 該階段綠燈後才提交。

所有 OpenAI requests 使用 `fetch` mock。mock 僅允許既有 endpoint；未知 URL/schema 立即使測試失敗。測試不使用真 key、真圖片或付費 API。

### 必要 deterministic coverage

- 三種 query normalization。
- exact-query canonical routing 與任意 upload order 的兩張 smart 圖。
- 五維狀態契約、legacy adapter、global invalid。
- display prefix、hidden/visible grouping、no `*1`、raw/effective 隔離。
- 五種 evidence validators 與 confidence/contradiction。
- purified Groudon 不成 shiny；valid shiny、favorite、lucky、shadow、shiny+shadow、兩種背景。
- 12 與 15 cards、partial card、structural mismatch、finish reason truncation、單次 retry。
- structural retry 的第二次 cards 完全替換第一次 cards，兩輪 cards 不得 append。
- count `(3)`、full-width parentheses、slash/storage rejection、3/3/9 merge 與 tie。
- suffix-prefix overlap 至少兩卡去重、單卡不去重、ambiguous review。
- 同一卡片同時有三個 manual-review reasons 時，分項原因保留三項，review-card total 等於 1。
- AI provenance、manual edit preservation、stale session rejection。
- diagnostics/log 禁止 sensitive sentinels。
- ordinary route/compression/detail/prompts、newItem、GAS、copywriting、manual save、team、resource、profile regression。

## 人工驗收

新增 `docs/manual-tests/smart-hundo-state-pipeline-v2.md`，記錄下列案例而不宣稱由 mock 驗證真實視覺準確度：

1. 精確 count/card 驗收：

   ```text
   百神搜尋摘要：(3)
   蛋：9/12
   卡片：鳳王、哲爾尼亞斯、淨化雷吉奇卡斯

   hundo_leg = 3
   pokemon_list = 鳳王,哲爾尼亞斯,雷吉奇卡斯
   ```

2. 藏瑪然特、拉帝亞斯、蒼響、淨化固拉多、藏瑪然特、酋雷姆 → `藏瑪然特*2,拉帝亞斯,蒼響,固拉多,酋雷姆`。
3. 鳳王、鳳王、閃電鳥、蒼響、蓋歐卡、炎帝 → `鳳王*2,閃電鳥,蒼響,蓋歐卡,炎帝`。
4. 12 張以上 full/partial cards 全部有 card object。
5. 垂直 overlap 至少兩張連續卡移除，合法重複仍保留。

以下兩個 display/grouping 驗收同樣必須精確保留：

```text
普通固拉多＋淨化固拉多＋亮晶晶固拉多
→ 固拉多*3

普通固拉多＋色違固拉多＋特別背卡固拉多
→ 固拉多,色違固拉多,特別背卡固拉多
```

## 驗證與交付

完成前執行：

```text
python tests/run_browser_tests.py
python tests/verify_regressions.py
git diff --check
```

另執行新增的任何 test command、JavaScript syntax validation、secret/data URL log scan 與 diff scope review。

只有全部 deterministic tests 通過後才提交最終 production cutover、推送 `feat/smart-hundo-state-pipeline-v2` 並建立 PR。PR 不自動 merge。
