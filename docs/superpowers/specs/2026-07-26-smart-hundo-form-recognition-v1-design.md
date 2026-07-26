# 百神寶可夢型態自動辨識 V1 設計

## 目標

在已合併的 Smart Hundo State Pipeline V2 上，為既有完整原圖 card/state operation 增加結構化寶可夢型態辨識。圖片模型仍直接查看完整原始截圖，一次列舉全部卡片；JavaScript 不辨識像素，只負責白名單、物種／型態相容性、confidence、可見程度、證據一致性、canonical name、狀態前綴、分組、重疊與人工確認。

本版精確支援 10 個基礎物種、23 個 canonical display names。未列入白名單的物種沿用 V2 official-name 路徑；白名單物種若型態不可靠，必須保留診斷但不加入 `pokemon_list`，不得靜默退回普通型態。

## 基線與不可變邊界

基線是最新 `origin/main`：

- PR #33 `Smart Hundo State Pipeline V2` merge commit：`e2518e70edbaad9e9716e96cf0b16f97286ca35d`
- PR #34 `trainer team fixed-UI recognition` merge commit：`fc16deefe0c8a559d0d29596fdc56ed10e169a3b`

本功能保留：

- 精確 query routing：`傳說的寶可夢,幻,究極異獸&4*`
- 獨立 hundo-count 與 card/state requests
- 完整原始圖片、`detail: high`、完整卡片列舉與 10 張以上支援
- 一次結構重試且第二次完整替換第一次
- 多截圖保守 overlap、scan-session ownership、安全 diagnostics
- shiny、lucky、favorite、rocket、background 五維有效狀態
- 可見前綴順序：`色違` → `暗影` → `紀念背卡`／`特別背卡`
- 隱藏狀態：亮晶晶、我的最愛、淨化
- trainer-team 固定 UI 證據流程

不得改變：

- hundo-count schema、prompt、圖片裁切、驗證與合併
- hundo query routing、卡片列舉、一般與結構重試 request 數
- ordinary classifier/extractor、一般壓縮、模型、endpoint、API-key storage
- Firebase schema/path、GAS payload、generated copywriting、manual save
- special-survey、Fusion、Mega 欄位
- trainer-team helper、schema、prompt、crop、request、ownership 與 UI

不增加外部依賴，不增加 OpenCV、contour、template matching 或另一套傳統 CV，也不建立每隻 Pokémon 一次 API request。

## 已確認架構

沿用 V2 的「純 helper＋薄整合層」：

- `smart-hundo-helpers.js`
  - 唯一 canonical form-name map
  - 唯一 species/form compatibility map
  - form/base aliases
  - 純正規化、legacy adaptation、form validation、canonical name
  - display/grouping、overlap signature、manual-review summary、安全 diagnostics
- `index.html`
  - 擴充既有 `HUNDO_SMART_SCHEMA`
  - 擴充既有 `buildSmartHundoPrompt()`
  - 在原本 full-image card request 的正規化流程套用 form validation
  - status UI 顯示 form review counts
- `tests/smart-hundo.test.html`
  - 純 helper 與真實 page-module browser contracts
  - OpenAI-shaped responses 全部由 mock 提供
- `tests/verify_regressions.py`
  - 鎖住 hundo-count、ordinary、trainer-team、persistence、model/endpoint 與秘密資料邊界
- `docs/manual-tests/smart-hundo-form-recognition-v1.md`
  - 真實圖片驗收紀錄模板，不存放私人截圖

## 唯一 canonical form-name table

`smart-hundo-helpers.js` 定義並匯出：

```js
const HUNDO_FORM_CANONICAL_NAMES = Object.freeze({
  articuno_standard: '急凍鳥',
  articuno_galarian: '伽勒爾急凍鳥',
  zapdos_standard: '閃電鳥',
  zapdos_galarian: '伽勒爾閃電鳥',
  moltres_standard: '火焰鳥',
  moltres_galarian: '伽勒爾火焰鳥',
  zacian_standard: '蒼響',
  zacian_crowned: '蒼響劍盾型態',
  zamazenta_standard: '藏瑪然特',
  zamazenta_crowned: '藏瑪然特劍盾型態',
  dialga_standard: '帝牙盧卡',
  dialga_origin: '起源帝牙盧卡',
  palkia_standard: '帕路奇亞',
  palkia_origin: '起源帕路奇亞',
  zygarde_10: '基格爾德（10%形態）',
  zygarde_50: '基格爾德（50%形態）',
  zygarde_complete: '基格爾德（完全體形態）',
  necrozma_base: '奈克洛茲瑪',
  necrozma_dusk_mane: '奈克洛茲瑪（黃昏之鬃）',
  necrozma_dawn_wings: '奈克洛茲瑪（拂曉之翼）',
  kyurem_base: '酋雷姆',
  kyurem_white: '焰白酋雷姆',
  kyurem_black: '闇黑酋雷姆'
});
```

canonical display names 不得散落到 prompt 以外的多個 JavaScript 轉換函式。prompt 可以列出 form IDs 與視覺指引；JavaScript 最終名稱只讀此 mapping。

## 物種／型態相容性

`smart-hundo-helpers.js` 定義並匯出一個 immutable mapping：

```js
const HUNDO_FORMS_BY_BASE_SPECIES = Object.freeze({
  急凍鳥: Object.freeze(['articuno_standard', 'articuno_galarian']),
  閃電鳥: Object.freeze(['zapdos_standard', 'zapdos_galarian']),
  火焰鳥: Object.freeze(['moltres_standard', 'moltres_galarian']),
  蒼響: Object.freeze(['zacian_standard', 'zacian_crowned']),
  藏瑪然特: Object.freeze(['zamazenta_standard', 'zamazenta_crowned']),
  帝牙盧卡: Object.freeze(['dialga_standard', 'dialga_origin']),
  帕路奇亞: Object.freeze(['palkia_standard', 'palkia_origin']),
  基格爾德: Object.freeze(['zygarde_10', 'zygarde_50', 'zygarde_complete']),
  奈克洛茲瑪: Object.freeze([
    'necrozma_base',
    'necrozma_dusk_mane',
    'necrozma_dawn_wings'
  ]),
  酋雷姆: Object.freeze(['kyurem_base', 'kyurem_white', 'kyurem_black'])
});
```

完整白名單是上述 23 個 key；控制值另有：

- `not_applicable`
- `uncertain`
- `unsupported`

## 型態資料契約

每個 `HUNDO_SMART_SCHEMA.cards.items` 保留全部 V2 欄位並新增：

```js
{
  base_species: string,
  form_id: FormId,
  form_confidence: number,
  form_evidence: {
    region_visibility:
      'clear' |
      'partially_occluded' |
      'cropped' |
      'not_visible' |
      'uncertain',
    recognition_basis:
      'direct_visual_match' |
      'visual_and_label' |
      'label_only' |
      'uncertain',
    visual_signature:
      SupportedFormId |
      'not_applicable' |
      'other' |
      'uncertain',
    key_features_visible: boolean,
    label_relationship:
      'exact_form' |
      'base_species_only' |
      'custom_nickname' |
      'conflicting' |
      'unreadable' |
      'not_applicable' |
      'uncertain'
  }
}
```

`form_id` enum 只能包含 23 個 supported IDs 與三個控制值。`visual_signature` 只能包含 23 個 supported IDs 與 `not_applicable`、`other`、`uncertain`。所有 properties required；每個 object `additionalProperties: false`；cards 不設 `maxItems`。

`official_name` 繼續保留供 backward compatibility 與安全 diagnostics。白名單物種不得使用 raw `official_name` 建立最終名稱。

## 正規化與 legacy adapter

新增純函式：

```text
normalizeHundoBaseSpecies(value, normalizeOfficialName)
normalizeHundoFormId(value)
normalizeHundoFormEvidence(value)
adaptLegacyHundoForm(card, normalizeOfficialName)
validateHundoPokemonForm(card)
buildHundoCanonicalOfficialName(card, normalizeOfficialName)
```

正規化流程：

1. 先移除 V2 已知 display-state prefixes。
2. 使用精確 form/base alias map 正規化基礎物種。
3. 在安全情況下再套用既有 `normalizePokemonBaseName` callback。
4. 將 callback 結果再經 alias map，避免 callback 保留 legacy form name。
5. 非法 `form_id` 正規化為 `uncertain`。
6. 不完整／非法 evidence 欄位落到 schema 對應的 `uncertain`、`other` 或 `false` 安全值。

精確 alias 至少涵蓋：

- `伽勒爾急凍鳥` → `急凍鳥`
- `伽勒爾閃電鳥` → `閃電鳥`
- `伽勒爾火焰鳥` → `火焰鳥`
- `蒼響劍王`、`蒼響（劍之王）`、`蒼響劍盾型態` → `蒼響`
- `藏瑪然特盾王`、`藏瑪然特（盾之王）`、`藏瑪然特劍盾型態` → `藏瑪然特`
- `帝牙盧卡（起源形態）`、`起源型態帝牙盧卡`、`起源帝牙盧卡` → `帝牙盧卡`
- `帕路奇亞（起源形態）`、`起源型態帕路奇亞`、`起源帕路奇亞` → `帕路奇亞`
- 三個 Zygarde canonical names → `基格爾德`
- 兩個 fusion Necrozma canonical names → `奈克洛茲瑪`
- `焰白酋雷姆`、`炎白酋雷姆`、`闇黑酋雷姆` → `酋雷姆`

alias 可以正規化 `base_species`。只有精確 legacy form alias 在 structured fields 缺失時可以提供一個 transitional candidate `form_id`；它仍缺少可信的 structured visual evidence，因此不能獨立通過 validation。泛稱 `火焰鳥`、`蒼響`、`奈克洛茲瑪` 等絕不推導 standard/base form。

## normalized card

`normalizeSmartHundoCard()` 保留：

```js
{
  base_species,
  form_id,
  form_confidence,
  form_evidence,
  effective_form_id: 'uncertain',
  canonical_official_name: '',
  raw: {
    states,
    confidences,
    evidence,
    form: {
      base_species,
      form_id,
      form_confidence,
      form_evidence
    }
  },
  manual_review_reasons
}
```

normalize 階段不信任 raw form。所有卡片先以 `effective_form_id='uncertain'`、`canonical_official_name=''` 進入 validation。非白名單物種只在 validation 確認其不需要 V1 form support 後成為 `effective_form_id='not_applicable'`。

## deterministic form validation

門檻：

```js
const FORM_CONFIDENCE_THRESHOLD = 0.85;
const FORM_PARTIAL_VISIBILITY_THRESHOLD = 0.93;
```

既有 `SPECIES_CONFIDENCE_THRESHOLD = 0.80` 不變。

### 白名單物種

`validateHundoPokemonForm(card)` 只有在全部條件成立時才設定有效型態：

1. `base_species` 正規化後精確命中 compatibility key。
2. `form_id` 位於該物種 allowed array。
3. `form_id` 不是 `not_applicable`、`uncertain`、`unsupported`。
4. `form_evidence.visual_signature === form_id`。
5. `key_features_visible === true`。
6. `recognition_basis` 是 `direct_visual_match` 或 `visual_and_label`。
7. `recognition_basis !== label_only`。
8. `label_relationship !== conflicting`。
9. `species_confidence >= 0.80`。
10. visibility 與 form confidence 規則通過。

visibility：

- `clear`：`form_confidence >= 0.85`
- `partially_occluded`：`form_confidence >= 0.93`、`recognition_basis=direct_visual_match`、`key_features_visible=true`
- `cropped`、`not_visible`、`uncertain`：不能通過

有效時：

```text
effective_form_id = form_id
canonical_official_name = HUNDO_FORM_CANONICAL_NAMES[form_id]
```

### 非白名單物種

非白名單物種：

- `effective_form_id = 'not_applicable'`
- `canonical_official_name` 走既有 sanitized official-name path
- raw `form_id` 只保留在 diagnostics
- 不因未支援型態辨識而新增 form review reason

這個規則保留 Mewtwo、Groudon、Kyogre、Ho-Oh、Xerneas 與其他普通物種的現有結果。

### unsupported

白名單物種的 `form_id='unsupported'`：

```text
effective_form_id = uncertain
canonical_official_name = ''
manual_review_reasons += unsupported_form
```

例如 Ultra Necrozma 不得 fallback 成 `奈克洛茲瑪`。

### mismatch 與不確定

白名單物種的 incompatible form：

```text
base_species = 火焰鳥
form_id = dialga_origin
effective_form_id = uncertain
canonical_official_name = ''
manual_review_reasons += form_species_mismatch
```

raw `form_id='uncertain'`、缺少關鍵特徵、證據基礎不可靠或其他無法分類情況，最終名稱留空且至少加入合適的 form reason。泛稱 label 或 raw `official_name` 不得成為 standard form fallback。

## controlled manual-review reasons

單一 mapping 加入：

```js
form_uncertain: '型態需人工確認',
form_species_mismatch: '物種與型態結果衝突',
form_region_not_clear: '型態主要外觀區域看不清楚',
form_confidence_low: '型態辨識信心不足',
form_label_only: '型態只有文字證據，需人工確認',
form_signature_mismatch: '型態與視覺證據不一致',
unsupported_form: '此型態尚未納入支援範圍'
```

原因可以同卡並存，但 `review_card_count` 仍以 `card_id` 去重。status UI 將 form reasons 視為 card reasons，逐項顯示數量；只有一張 `form_uncertain` 時可輸出：

```text
百神掃描完成：總數8，辨識7張卡片；1張型態需人工確認
```

拒絕路徑必須有可見的人工確認原因，不得只把 canonical name 清空：

- raw `form_id='uncertain'`、`key_features_visible=false`、`recognition_basis='uncertain'` → `form_uncertain`
- incompatible species/form 或 `label_relationship='conflicting'` → `form_species_mismatch`
- cropped、not-visible、uncertain visibility，或 partially-occluded 未通過其附加規則 → `form_region_not_clear`
- clear `<0.85` 或 partially-occluded `<0.93` → `form_confidence_low`
- `recognition_basis='label_only'` → `form_label_only`
- `visual_signature !== form_id` → `form_signature_mismatch`
- `form_id='unsupported'` → `unsupported_form`
- `species_confidence <0.80` → 既有 `species_uncertain` 加 `form_uncertain`

## canonical name、狀態與 display order

處理順序固定為：

```text
base_species
→ effective_form_id
→ canonical_official_name
→ effective shiny
→ effective rocket
→ effective background
→ final display name
```

`buildHundoDisplayName()` 的名稱部分只讀 `canonical_official_name`。可見 prefix 規則不變：

1. `色違`
2. `暗影`
3. `紀念背卡` 或 `特別背卡`
4. `canonical_official_name`

亮晶晶、我的最愛、淨化保持 hidden。

必要結果：

```text
伽勒爾火焰鳥
色違伽勒爾火焰鳥
特別背卡伽勒爾火焰鳥
色違特別背卡伽勒爾火焰鳥
色違暗影蒼響劍盾型態
紀念背卡起源帝牙盧卡
闇黑酋雷姆
```

## grouping

先完成完整 display name，再依完全相同字串與首次出現順序計數。不同 form 的 canonical name 不同，因此不能合併。count 大於 1 才輸出 `*N`。

必要結果：

```text
火焰鳥,伽勒爾火焰鳥
蒼響,蒼響劍盾型態*2
帝牙盧卡,起源帝牙盧卡,帕路奇亞,起源帕路奇亞
基格爾德（10%形態）*2,基格爾德（50%形態）,基格爾德（完全體形態）
酋雷姆,焰白酋雷姆*2,闇黑酋雷姆
```

沒有任何 `*1`。

## overlap signature

保留 V2 signature：

- CP
- normalized visible label
- effective shiny
- effective lucky
- effective favorite
- effective rocket
- effective background

加入：

- `base_species`
- `effective_form_id`
- `canonical_official_name`

不再以 raw `official_name` 作為白名單 identity authority。仍只允許至少兩張連續 boundary signatures 完全相同時移除 overlap；同圖不去重、單卡不足、ambiguous 保留全部並加入 `screenshot_overlap_uncertain`。

## safe diagnostics

`window.lastSmartHundoDiagnostics.cards[]` 以 allowlist 加入：

```text
base_species
raw_form_id
form_confidence
form_evidence
effective_form_id
canonical_official_name
manual_review_reasons（包含 form reasons）
```

禁止內容不變：

- API key、Authorization、Bearer
- image data URL、`File`
- 完整 request/response body
- Firebase/GAS credentials
- account/password

`raw.form` 不直接 spread 到 diagnostics；diagnostic shaper 逐欄 enum/clamp/sanitize。

## schema 與 prompt integration

只擴充現有 `HUNDO_SMART_SCHEMA` 與 `buildSmartHundoPrompt()`：

- 不改 `HUNDO_COUNT_SCHEMA`
- 不改 `buildHundoCountPrompt()`
- 不新增 request function
- 不新增 per-card request
- `requestSmartHundoExtractionV2()` 繼續傳入完整 `originalDataUrl`
- 保留 `detail: HUNDO_SMART_IMAGE_DETAIL`
- normal call count 與 structural retry 上限不變

prompt 新增獨立 `【B2. 基礎物種與型態辨識】` 與 `【B3. form_evidence】`，逐一列出 10 個 families、23 個 IDs、完整視覺指引、Moltres 實例、label-only rejection、visibility 規則、unsupported 與 no-silent-standard-fallback。

模型可以使用整體外觀、身體結構、頭、翼、尾、四肢、武器、裝甲、姿勢、比例、顏色分布、型態部位與 visible label 次要證據；不得只抄 label 或只看單色。

## production data flow

每張 screenshot 的 card path：

```text
existing full-image card request
→ normalizeSmartHundoResult()
→ normalizeSmartHundoCard()
→ validateHundoPokemonForm()
→ validateHundoCardStates()
→ validateSmartHundoStructure() / existing retry replacement
→ cross-screenshot overlap
→ build canonical display names
→ grouping
→ review summary
→ safe diagnostics/status/session-owned form write
```

form validation 在 state display conversion 前完成。結構重試仍由 raw/normalized card count、scan flags、coordinates 與 finish reason 決定；form uncertain 不觸發額外 request。

## TDD 與測試策略

五個 production phases 都遵循 RED → GREEN → commit：

1. 純 form contract
2. form validation
3. display/grouping/overlap/review/diagnostics
4. schema/prompt integration
5. production cutover

browser tests 使用完整 literal fixtures 與 mock OpenAI responses，絕不發 live/paid request。每個新測試先確認因缺少 production behavior 正確失敗，再加入最小實作。

必要 deterministic coverage：

- 23-ID 完整 mapping 與 compatibility exclusivity
- aliases、not-applicable、unsupported、illegal combination、no fallback
- clear、generic label、nickname、label-only、cropped、partial 0.93、signature mismatch、confidence
- 兩種 Galarian bird separation 與 Galarian Moltres 真實需求
- Crowned、Origin、Zygarde、Necrozma、Kyurem canonical output
- state prefix、hidden purified、grouping、no `*1`
- unresolved omission、reason counts、review-card dedupe
- form-aware overlap、safe diagnostics
- schema exact enum/required/additionalProperties/no maxItems
- prompt 10 families/23 IDs/label-only/no fallback/full original image
- hundo-count、V2 state、trainer-team、persistence、ordinary behavior regressions

## regression locks

Phase 1 將「整個 smart-hundo helper 必須等於舊 main」的過渡性 hash 改為更精準的不可變邊界 snapshots：

- hundo-count helper span
- hundo-count schema/prompt span
- ordinary prompts、resize、model/endpoint/API storage
- Firebase/GAS/save/copywriting
- trainer-team helper與固定 UI schema/prompt/request/ownership

Phase 5 可增加新 form contract 的 final hash/fragment locks，但不能以 source-text checks 取代可觀察行為測試。

## 人工驗收

`docs/manual-tests/smart-hundo-form-recognition-v1.md` 記錄 A–K：

- 三隻 Galarian birds
- Crowned Zacian/Zamazenta
- Origin Dialga/Palkia
- 三個 Zygarde
- 三個 supported Necrozma
- 三個 Kyurem
- 使用者三卡：蒼響／奈克洛茲瑪／伽勒爾火焰鳥

每列記錄：

- full commit SHA
- anonymized screenshot ID
- visible label
- base_species
- raw form_id
- form confidence/evidence
- effective form_id
- canonical official name
- final `pokemon_list`
- pass/fail/failure summary

repository 不包含私人圖片、data URLs 或 raw API bodies。若沒有提供真實圖片，所有 case 明確標示「待人工執行」；mock tests 不宣稱證明真實圖片辨識準確度。

## 交付

完成五階段提交、完整測試、syntax、headless console/unhandled rejection、secret/data-URL scan、whole-branch diff review與獨立 code review後，推送：

```text
feat/smart-hundo-form-recognition-v1
```

建立 targeting `main` 的 open PR；不得 merge 或啟用 auto-merge。
