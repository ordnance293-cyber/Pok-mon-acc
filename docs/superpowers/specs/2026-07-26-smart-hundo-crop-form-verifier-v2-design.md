# Smart Hundo Crop Form Verifier V2 設計

## 目標

為 Smart Hundo 的三個基礎物種加入獨立第二階段型態複核：

- 帝牙盧卡：`dialga_standard`、`dialga_origin`、`uncertain`
- 帕路奇亞：`palkia_standard`、`palkia_origin`、`uncertain`
- 奈克洛茲瑪：`necrozma_base`、`necrozma_dusk_mane`、`necrozma_dawn_wings`、`uncertain`

Stage 1 繼續使用完整原始截圖列舉卡片、辨識基礎物種、型態與五維狀態。Stage 2 不採信 Stage 1 的型態結論；它只把三個目標 family 的寶可夢本體裁切、放大並合併為 contact sheet，再以有限候選集合做型態複核。通過 JavaScript 的物種、對應、可見度、信心與完整身體結構 tuple 驗證後，Stage 2 可覆寫 Stage 1 的錯誤型態。

若目標卡片沒有可用裁切、影像太小、複核不確定、格式不完整、證據不符或請求失敗，該卡片最終型態必須是 `uncertain`、canonical name 必須為空，並從 `pokemon_list` 省略。絕不退回 Stage 1 的普通／基礎型態。

## 已驗證基線

- `origin/main`：`81fc3abcd6e4c43db0beef31cded90b444c0f1c1`
- PR #35 merge：`8e01e8f24e0c4c72cc787199f58b8d55fe29832a`
- PR #35、PR #38 與目前 `origin/main` tree：
  `d2aea23557ed99e87632bf4393b0a8d9d98a3bed`
- PR #35 到 `origin/main` 的 tracked-file diff：0
- baseline：33 個 source regression checks、169 個 browser test groups、0 個 live OpenAI requests

開發只在 `feat/smart-hundo-crop-form-verifier-v2` 隔離 worktree 進行，不修改 `main`。

## 不可變邊界

下列行為不得改變：

- application model：`const OPENAI_MODEL = 'gpt-4.1-mini';`
- OpenAI endpoint、API-key storage、ordinary image resize/JPEG path
- 精確 Smart Hundo query routing：`傳說的寶可夢,幻,究極異獸&4*`
- Hundo count schema、prompt、裁切、驗證與合併
- Stage 1 card enumeration、五維 state recognition 與一次 structural replacement retry
- Galarian birds、Zacian、Zamazenta、Zygarde、Kyurem 的 PR #35 型態邏輯
- shiny、lucky、favorite、rocket、background 的 Stage 1 判斷
- display prefix 順序：`色違` → `暗影` → `紀念背卡`／`特別背卡` → canonical name
- lucky、favorite、purified 不顯示文字 prefix
- ordinary scan、trainer team、Firebase、GAS、copywriting、manual save、special survey、Fusion、Mega
- 既有 23 個 canonical form names

本版不加入 OpenCV、外部依賴、web search、reference-image library、per-Pokémon API request 或私人圖片資產。

## 檔案責任

### `smart-hundo-form-verifier.js`

純 JavaScript helper，不讀 DOM、不做 canvas、不持有 API key、不呼叫 `fetch`：

- 三個 target-family constants 與有限候選集合
- bbox 嚴格正規化與幾何驗證
- Stage 2 candidate 與最多六張的 batch plan
- `REQUIRED_VERIFIED_FORM_EVIDENCE`
- verifier result 正規化、結構完整性與 deterministic evidence 驗證
- Stage 1／Stage 2 merge、fail-closed manual reasons
- verifier-specific safe diagnostic value shaping

以 classic-script UMD 模式公開 `globalThis.SmartHundoFormVerifier`，並保留
`module.exports` 供語法／純函式測試使用。

### `index.html`

只保留 browser/runtime 責任：

- 載入新 helper
- Stage 1 bbox schema 與 prompt
- `HUNDO_FORM_VERIFY_MODEL`
- verifier schema 與 prompt
- 原圖載入、crop canvas、contact-sheet PNG
- verifier API request 與一次 structural retry
- `smartHundoScan()` 的 Stage 2 runtime
- session-safe status 與 root/per-screenshot metrics

### `smart-hundo-helpers.js`

繼續是 canonical form-name、一般 form/state/display/grouping/overlap 與 session diagnostics 的唯一既有來源。只做必要接線：

- 保留 normalized bbox 欄位
- 接受 Stage 2 verified override 已產生的 final form
- 加入 verifier reason messages
- overlap identity 加入 `verified_form_id`
- safe diagnostics allowlist 加入 Stage 2 欄位

不在此重複 target evidence map 或 candidate logic。

### 測試與文件

- 新增 `tests/smart-hundo-form-verifier.test.html`，專測 helper、schema、prompt、crop、request 與 runtime contract。
- `tests/smart-hundo.test.html` 只調整 Stage 1 bbox fixture、真實 module export 與受影響的既有 runtime expectations。
- `tests/run_browser_tests.py` 將新頁面加入本機 headless runner。
- `tests/verify_regressions.py` 鎖定新邊界並保留所有 ordinary/count/team/persistence snapshots。
- `docs/manual-tests/smart-hundo-crop-form-verifier-v2.md` 只記錄去識別化 oracle；不存圖片。

## 完整資料流

```text
uploaded File
→ resized JPEG classification
→ exact Smart Hundo routing
→ fileToOriginalDataUrl()
→ Stage 1 full-original count + cards requests
→ Stage 1 structural retry replacement（若必要）
→ normalizeSmartHundoResult()
→ normalizeSmartHundoCard()（含 bbox）
→ validateHundoPokemonForm()（保留 primary 結果）
→ validateHundoCardStates()（五維 state 完成且不再改動）
→ planTargetFormVerification()
→ load original image once
→ crop/enlarge eligible target bodies
→ batch up to six crops per contact sheet
→ one verifier request per contact sheet
→ optional one structural verifier retry per sheet
→ deterministic verifier validation
→ Stage 2 override or fail-closed uncertain
→ cross-screenshot overlap merge
→ buildHundoDisplayName()
→ smartHundoCardsToPokemonList()
→ session-owned g_hundos write
→ safe diagnostics/status
```

Stage 2 必須在 Stage 1 的最終 structural result 之後，並在跨截圖 overlap 與 list conversion 之前。第二次 Stage 1 structural result 完整取代第一次；不同 attempt 的 cards 絕不 union。

## Stage 1 Bounding Box contract

每張 Smart Hundo card 新增四個 required fields：

```js
card_bbox: {
  x_min: integer, // 0..1000
  y_min: integer, // 0..1000
  x_max: integer, // 0..1000
  y_max: integer  // 0..1000
},
pokemon_bbox: {
  x_min: integer,
  y_min: integer,
  x_max: integer,
  y_max: integer
},
bbox_confidence: number, // 0..1
bbox_visibility:
  'clear' |
  'partially_visible' |
  'cropped' |
  'not_visible' |
  'uncertain'
```

兩個 bbox schema 都是 `additionalProperties: false`，四個座標全部 required。所有座標相對完整原始截圖，左上為 `(0,0)`、右下為 `(1000,1000)`。

JavaScript 另做 schema 無法表達的 fail-closed 驗證：

1. bbox 必須是非 array object，且四個值皆為 finite primitive integer。
2. 每個值在 0–1000。
3. `x_min < x_max`、`y_min < y_max`。
4. `pokemon_bbox` 必須和 `card_bbox` 相交。
5. `pokemon_bbox` 中心點必須位於 `card_bbox`，邊界視為位於內部。
6. malformed string、boolean、array、`NaN`、Infinity、缺值與額外欄位不得通過。
7. `bbox_confidence` 只能是 finite primitive number；numeric string、boolean、array 不得通過。

正規化失敗時 bbox 以 `null` 保存，confidence 以 0 保存，並由 candidate planner 產生 controlled reason；不得把錯誤座標猜成全卡或固定 grid。

## Stage 1 bbox prompt

`buildSmartHundoPrompt()` 新增獨立 `【卡片與寶可夢本體座標】`。規則明定：

- 每張卡片都回傳 `card_bbox` 與 `pokemon_bbox`
- 以完整原圖的 0–1000 相對座標輸出
- `card_bbox` 包含同卡 CP、本體、圖示、名稱與 HP 線，但不得跨相鄰卡
- `pokemon_bbox` 只框同卡寶可夢本體
- 排除 CP、名稱、暱稱、151515、96%、地名、星星、背卡與狀態圖示
- 不得以文字擴大 `pokemon_bbox`
- 明確定義五個 visibility 值
- `bbox_confidence` 只描述座標信心，不描述型態信心

## Target candidate selection

只有正規化後 `base_species` 精確等於下列值才進入 Stage 2：

```js
Object.freeze(['帝牙盧卡', '帕路奇亞', '奈克洛茲瑪'])
```

候選 prerequisite：

1. `recognition_status` 是 `recognized`，或是具有精確可用 base species 的 `partial`
2. finite primitive `species_confidence >= 0.80`
3. bbox pair 通過幾何驗證
4. finite primitive `bbox_confidence >= 0.80`
5. `bbox_visibility` 是 `clear` 或 `partially_visible`

每張 target card 先保存：

```text
primary_form_id
primary_effective_form_id
primary_form_confidence
primary_form_evidence
```

然後在 Stage 2 完成前先清空 final authority：

```text
effective_form_id = uncertain
canonical_official_name = ''
verified_form_id = uncertain
verification_confidence = 0
verification_status = pending / not_requested / failed / invalid / uncertain / verified
```

Stage 1 的 form validation reasons 在 eligible target 上由 Stage 2 結論取代；species 與五維 state reasons 保留。非 target cards 完全不進入此流程。

Target card 的失敗分類：

- bbox 缺失、型別錯誤或幾何非法：`form_crop_missing`
- bbox confidence 未達 0.80 或 visibility 非 clear/partial：`form_crop_not_clear`
- 原始 `pokemon_bbox` 任一像素維度小於 64：`form_crop_too_small`

上述三種卡片不送 verifier，Stage 1 型態不得 fallback。

## Crop math

每張 candidate 使用完整 `originalDataUrl` 對應的原始 `Image`，整張圖只載入一次：

1. 把 0–1000 `pokemon_bbox` 換算成原圖 pixel coordinates。
2. 以 `longestSide = max(bodyWidth, bodyHeight)`。
3. 四邊各增加 `0.12 * longestSide` padding。
4. clamp 到 `[0, sourceWidth] × [0, sourceHeight]`。
5. minimum-size gate 使用未加 padding 的 visible body：寬與高都必須至少 64 px。
6. 使用 320×320 canvas tile image area。
7. `scale = min(320/cropWidth, 320/cropHeight)`，保持比例、置中。
8. `imageSmoothingEnabled = true`、`imageSmoothingQuality = 'high'`。
9. 不 sharpen、不 recolor、不改 hue/saturation。
10. 輸出 `canvas.toDataURL('image/png')`。

crop canvas 只畫原圖像素；不畫 CP、visible label、species、form、nickname 或預期答案。

## Contact sheet

每張 contact sheet 最多六格：

- 2 columns
- 1–3 rows
- tile 360×380
- image area 320×320
- header 只畫 `T1` 到 `T6`
- image area 水平與垂直置中
- lossless PNG

同一張 screenshot 的 crop 依 Stage 1 card order 穩定排序。每張 sheet 的 tile ID 從 `T1` 重新開始，並以獨立 `contact_sheet_id` 消除跨 sheet 歧義。圖片 header 絕不包含物種、candidate form、CP、visible label、帳號或答案；base species 與候選集合只存在 prompt text。

Batch planner：

```text
0 candidates  → 0 sheets / 0 requests
1..6          → 1 sheet / 1 request
7..12         → 2 sheets / 2 requests
N             → ceil(N / 6)
```

不得建立 per-card request。

## Verifier model 與 request

新增獨立常數：

```js
const HUNDO_FORM_VERIFY_MODEL = 'gpt-4.1-mini';
```

`requestSmartHundoFormVerification()` 只傳：

- dedicated Traditional Chinese verifier prompt
- contact-sheet PNG data URL
- tile ID／card ID／base species／limited candidates mapping

request 固定：

```text
model = HUNDO_FORM_VERIFY_MODEL
detail = high
temperature = 0.1
Structured Outputs = true
reasoning_effort = absent
```

完整原始截圖、獨立 crop data URL、CP、label 與 account information 不送入 verifier request。HTTP 429／5xx 沿用既有 safe API retry；semantic structural retry 每張 sheet 最多一次，且只在 missing cards、duplicate tile/card IDs、JSON truncation 或 schema/required fields 不完整時觸發。低信心或 `uncertain` 不重試。

## Verifier schema

schema name：

```text
pokemon_go_smart_hundo_form_verifier_v2
```

top-level：

```js
{
  cards: [{
    tile_id,
    card_id,
    base_species,
    verified_form_id,
    verification_confidence,
    crop_visibility,
    body_plan,
    limb_layout,
    fusion_host,
    decisive_feature,
    key_features_visible
  }]
}
```

每個 object 都是 `additionalProperties: false`，所有欄位 required，`cards` 不設定低於六的 maximum。

`verified_form_id` enum：

```text
uncertain
dialga_standard
dialga_origin
palkia_standard
palkia_origin
necrozma_base
necrozma_dusk_mane
necrozma_dawn_wings
```

`crop_visibility` enum：

```text
clear
partially_visible
cropped
not_visible
uncertain
```

`body_plan` enum：

```text
uncertain
dialga_stocky_wide_quadruped
dialga_elongated_equine_quadruped
palkia_upright_biped_with_arms
palkia_centaur_quadruped
necrozma_upright_crystalline
necrozma_quadruped_lion
necrozma_wide_moon_wings
```

`limb_layout` enum：

```text
uncertain
four_standard_legs
four_long_legs
two_arms_two_legs
four_legs_no_standard_arms
upright_crystalline_limbs
quadruped_lion
giant_wings_no_lion_body
```

`fusion_host` enum：

```text
not_applicable
none
solgaleo
lunala
uncertain
```

`decisive_feature` enum：

```text
uncertain
dialga_standard_stocky_neck_chest
dialga_origin_elongated_neck_chest
palkia_standard_visible_arms
palkia_origin_centaur_body
necrozma_base_crystal_body
necrozma_dusk_mane_lion_crystal_armor
necrozma_dawn_wings_moon_wings
```

## Verifier prompt authority

prompt 明定 verifier 只做放大 crop 的型態辨識，不做：

- CP、name、shiny、lucky、favorite、rocket、background
- card count
- nickname、151515、96%、地名或殘留文字判斷

只能依整體身體結構、直立／四足姿態、四肢配置、手臂、寬高比、頸胸、獅型／月翼型／結晶型、fusion host 與專屬部位。顏色只能輔助，絕不單獨決定。圖片小、裁切、遮擋或關鍵部位不清楚時必須回 `uncertain`；不得從 base species 自動回 standard/base。

每個 tile 在 prompt 只得到其 base species 與 2–3 個有效 form candidates 加 `uncertain`。不得接受跨 species form。

## Immutable deterministic evidence map

`smart-hundo-form-verifier.js` 定義且 outer/nested 全部 freeze：

```js
const REQUIRED_VERIFIED_FORM_EVIDENCE = Object.freeze({
  dialga_standard: Object.freeze({
    base_species: '帝牙盧卡',
    body_plan: 'dialga_stocky_wide_quadruped',
    limb_layout: 'four_standard_legs',
    fusion_host: 'not_applicable',
    decisive_feature: 'dialga_standard_stocky_neck_chest'
  }),
  dialga_origin: Object.freeze({
    base_species: '帝牙盧卡',
    body_plan: 'dialga_elongated_equine_quadruped',
    limb_layout: 'four_long_legs',
    fusion_host: 'not_applicable',
    decisive_feature: 'dialga_origin_elongated_neck_chest'
  }),
  palkia_standard: Object.freeze({
    base_species: '帕路奇亞',
    body_plan: 'palkia_upright_biped_with_arms',
    limb_layout: 'two_arms_two_legs',
    fusion_host: 'not_applicable',
    decisive_feature: 'palkia_standard_visible_arms'
  }),
  palkia_origin: Object.freeze({
    base_species: '帕路奇亞',
    body_plan: 'palkia_centaur_quadruped',
    limb_layout: 'four_legs_no_standard_arms',
    fusion_host: 'not_applicable',
    decisive_feature: 'palkia_origin_centaur_body'
  }),
  necrozma_base: Object.freeze({
    base_species: '奈克洛茲瑪',
    body_plan: 'necrozma_upright_crystalline',
    limb_layout: 'upright_crystalline_limbs',
    fusion_host: 'none',
    decisive_feature: 'necrozma_base_crystal_body'
  }),
  necrozma_dusk_mane: Object.freeze({
    base_species: '奈克洛茲瑪',
    body_plan: 'necrozma_quadruped_lion',
    limb_layout: 'quadruped_lion',
    fusion_host: 'solgaleo',
    decisive_feature: 'necrozma_dusk_mane_lion_crystal_armor'
  }),
  necrozma_dawn_wings: Object.freeze({
    base_species: '奈克洛茲瑪',
    body_plan: 'necrozma_wide_moon_wings',
    limb_layout: 'giant_wings_no_lion_body',
    fusion_host: 'lunala',
    decisive_feature: 'necrozma_dawn_wings_moon_wings'
  })
});
```

## Deterministic verifier validation

門檻：

```js
const HUNDO_FORM_VERIFY_CONFIDENCE_THRESHOLD = 0.90;
const HUNDO_FORM_VERIFY_PARTIAL_THRESHOLD = 0.95;
```

只有全部成立才接受：

1. `tile_id` 存在於該 request。
2. `card_id` 與 job 完全相同。
3. `base_species` 與 job 完全相同。
4. `verified_form_id` 位於該 base species 的 limited candidates。
5. `verification_confidence` 是 finite primitive number。
6. visibility 是 clear 或 partially_visible。
7. clear confidence >= 0.90；partial confidence >= 0.95。
8. `key_features_visible === true`。
9. `body_plan`、`limb_layout`、`fusion_host`、`decisive_feature` 全部與 immutable tuple 完全一致。

cross-species form 一律 `form_verifier_species_mismatch`。tuple 任一欄不符一律
`form_verifier_evidence_mismatch`。low confidence 不重試；cropped/not-visible/uncertain 不接受。

## Stage 1／Stage 2 merge

Stage 2 是三個 target family 的 final form authority：

| 情況 | final effective form | canonical | reason |
| --- | --- | --- | --- |
| valid Stage 2 | `verified_form_id` | 既有 canonical map | 無 |
| Stage 1/2 相同 | Stage 2 | 既有 canonical map | 無 |
| Stage 1/2 不同、Stage 2 valid | Stage 2 | 既有 canonical map | 無 |
| verifier 回 uncertain | `uncertain` | `''` | `form_verifier_uncertain` |
| confidence 不足 | `uncertain` | `''` | `form_verifier_low_confidence` |
| species/form mismatch | `uncertain` | `''` | `form_verifier_species_mismatch` |
| tuple mismatch | `uncertain` | `''` | `form_verifier_evidence_mismatch` |
| mapping/schema/duplicate invalid | `uncertain` | `''` | `form_verifier_invalid_result` |
| required cards missing after retry | `uncertain` | `''` | `form_verifier_structural_incomplete` |
| request failure | `uncertain` | `''` | `form_verification_request_failed` |

structural retry 的第二份 result 完整取代第一份。若 retry 後整張 sheet 仍不完整，該 sheet 的 jobs 全部 fail closed；缺卡情況同時保留 structural-incomplete 原因。卡片可以有多個 reason，但 `review_card_count` 以 `card_id` 去重。

Stage 2 只改 form 欄位；以下 Stage 1 值原樣保留：

```text
cp
visible_label
shiny/lucky/favorite raw + evidence + effective
rocket raw + evidence + effective
background raw + evidence + effective
recognition status
species confidence
```

## Canonical naming、grouping 與 overlap

final canonical name 只讀既有 `HUNDO_FORM_CANONICAL_NAMES`：

```text
dialga_standard → 帝牙盧卡
dialga_origin → 起源帝牙盧卡
palkia_standard → 帕路奇亞
palkia_origin → 起源帕路奇亞
necrozma_base → 奈克洛茲瑪
necrozma_dusk_mane → 奈克洛茲瑪（黃昏之鬃）
necrozma_dawn_wings → 奈克洛茲瑪（拂曉之翼）
```

先建立 final display name，再依完全相同字串分組：

```text
帝牙盧卡,起源帝牙盧卡*2
帕路奇亞,起源帕路奇亞
奈克洛茲瑪,奈克洛茲瑪（黃昏之鬃）,奈克洛茲瑪（拂曉之翼）
```

overlap signature 保留既有 CP、normalized label、base species、五維 effective states，並包含：

```text
verified_form_id
effective_form_id
canonical_official_name
```

仍須至少兩張連續 boundary identities 完全一致才移除 overlap；不得弱化。

## Controlled manual-review reasons

唯一 verifier mapping：

```js
Object.freeze({
  form_crop_missing: '找不到可用的寶可夢本體裁切區域',
  form_crop_not_clear: '寶可夢本體裁切不完整，型態需人工確認',
  form_crop_too_small: '寶可夢本體像素太小，型態需人工確認',
  form_verifier_uncertain: '放大型態複核仍無法確定',
  form_verifier_low_confidence: '放大型態複核信心不足',
  form_verifier_species_mismatch: '型態複核物種與原卡片不一致',
  form_verifier_evidence_mismatch: '型態複核結果與身體結構證據不一致',
  form_verifier_invalid_result: '型態複核回傳格式或卡片對應錯誤',
  form_verifier_structural_incomplete: '型態複核未回傳全部候選卡片',
  form_verification_request_failed: '型態複核請求失敗'
})
```

## Safe diagnostics

每張 target card 只 allowlist：

```text
card_id
base_species
primary_form_id
primary_effective_form_id
primary_form_confidence
primary_form_evidence
card_bbox
pokemon_bbox
bbox_confidence
bbox_visibility
crop_source_size
contact_sheet_id
tile_id
verified_form_id
verification_confidence
verification_evidence
effective_form_id
canonical_official_name
manual_review_reasons
```

root 與 screenshot summary：

```text
target_candidate_count
contact_sheet_count
verifier_request_count
verifier_structural_retry_count
form_verify_model
```

diagnostics 永不包含：

- API key、Authorization、Bearer
- original/crop/contact-sheet data URLs
- `File`
- raw request payload、complete raw response
- Firebase/GAS credentials

production logs 只寫既有 safe error summary 與非敏感 metrics。

## Status

成功時補充 verified count：

```text
百神掃描完成：辨識7張卡片；型態複核3張
```

有 unresolved target 時補充 unique-card count：

```text
百神掃描完成：辨識6張卡片；1張型態需人工確認
```

verifier request failure：

```text
百神清單已完成部分辨識；特殊型態複核失敗，請人工確認
```

request failure 只影響該 sheet target cards；non-target Smart Hundo cards、Hundo count 與 ordinary fields 照常完成。

## Session ownership

每次 await 原圖、crop/contact-sheet 或 verifier result 後都檢查既有 current-run predicate。過期 scan 不再發下一張 sheet 的 request，也不 publish diagnostics/status 或寫入表單。Stage 2 不新增另一套 ownership state。

## Automated test strategy

全部使用 synthetic canvas/image 與 mocked API：

- bbox primitive types、幾何與 intersection/center
- candidate gates 與 0／1–6／7+ batching
- source coordinate mapping、12% padding/clamp、64×64 gate
- 320×320 aspect-preserving PNG crop
- contact sheet 只有 T IDs，最多六格
- schema recursive strictness 與 exact enums
- prompt detailed discriminators、no label/CP/color fallback
- 七個 exact evidence tuples
- mismatch、cross species、threshold、visibility、duplicate/missing
- Stage 2 correction、uncertain no fallback、request failure isolation
- state preservation、canonical display、grouping、overlap
- safe diagnostics/status、zero image URL/key/Authorization
- request count與最多一次 structural retry
- 既有 169 PR #35 groups、ordinary/count/team/persistence regressions

測試 fetch 必須攔截正式 OpenAI endpoint 並斷言 `nativeFetchAttemptCount === 0`；runner 的文案不是零 live request 的唯一證據。

## Manual acceptance boundary

本機未發現三張私人 reference screenshots，因此真實圖片驗收狀態記為 `NOT RUN`，不得捏造 PASS。manual document 仍完整列出 Necrozma、Dialga、Palkia 的 CP locator oracles；CP 只作匿名位置識別，不得作 form feature。

若日後在本機取得圖片，只可本地測試並記錄去識別化 image ID、CP locator、commit、bbox、tile、evidence tuple 與 final result。不得 commit 原圖、derived crop、data URL 或內容 hash。

## 風險與限制

- Stage 2 仍依賴 Stage 1 提供正確 base species。
- 錯誤 bbox、低 bbox confidence 或小於 64×64 的本體會阻止複核。
- contact sheet 放大改善可見性，但模型仍可能回 `uncertain`；JavaScript 只驗證結構 tuple，不能自行做像素分類。
- 本 PR 沒有 local reference-image library。
- 其他 Pokémon families 仍使用 PR #35 generic form logic。
- 私人 reference screenshots 不納入 git，也不構成 automated evidence。
