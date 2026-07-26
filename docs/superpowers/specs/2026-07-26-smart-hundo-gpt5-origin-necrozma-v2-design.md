# 百神 GPT-5 Mini 與起源雙龍／奈克洛茲瑪型態辨識 V2 設計修訂

## 目標

本設計是 PR #35「Smart Hundo Pokémon Form Recognition V1」之增量修訂，不取代或回退 V1。它同時完成兩件事：

1. 保留所有一般掃描於 `gpt-4.1-mini`，只有完整 Smart Hundo 卡片／物種／型態／狀態 request 使用 `gpt-5-mini`。
2. 在 V1 的 `visual_signature`、confidence、visibility 與 label 關係之外，為帝牙盧卡、帕路奇亞及奈克洛茲瑪七個型態加入可由 JavaScript 精確比對的身體結構證據。

基線為 `origin/main` 的 PR #35 merge commit：

```text
8e01e8f24e0c4c72cc787199f58b8d55fe29832a
Merge pull request #35 from ordnance293-cyber/feat/smart-hundo-form-recognition-v1
```

本版維持 10 個 form families、23 個 canonical form names，且使用者核准名稱完全不變。

## 根本原因

V1 可以拒絕 schema 錯誤、物種／型態不相容、低信心、主要區域不可見、label-only 及 `visual_signature !== form_id`。但模型仍可能對錯誤型態同時回傳一致的 `form_id` 與 `visual_signature`，形成「結構化結果自洽、圖片判斷卻錯誤」的 false positive。

此外，所有 OpenAI request 目前由單一 `OPENAI_MODEL` 固定為 `gpt-4.1-mini`。整體改成較昂貴模型會不必要地影響分類、數字抽取、trainer-team 與其他一般掃描；因此模型選擇必須成為單一 request 的具名 option，而非全域替換。

## 不可變邊界

以下行為保持不變：

- 精確 Smart Hundo query：`傳說的寶可夢,幻,究極異獸&4*`
- first-stage classification、一般欄位、資源、profile level/XP、stardust、hundo count、trainer-team 與所有非 Smart Hundo request 使用 `gpt-4.1-mini`
- hundo-count schema、prompt、原生 PNG 裁切、驗證與合併
- Smart Hundo 完整原圖、`detail: high`、超過 10 張列舉
- 結構重試最多一次，第二次完整 replacement
- ordinary 1000px / JPEG 0.7 壓縮
- Chat Completions endpoint 與 structured output
- Firebase schema/path、GAS payload、generated copywriting、manual save、API-key storage、special survey、Fusion/Mega 欄位
- trainer-team fixed-UI evidence 與 ownership
- 五維 state validation、overlap safety、multiple screenshot merge
- 不新增第二個 form-verification request，不做 per-card crop request

## 模型分工與常數

`index.html` 保留既有 default，新增兩個具名常數：

```js
const OPENAI_MODEL = 'gpt-4.1-mini';
const HUNDO_SMART_MODEL = 'gpt-5-mini';
const HUNDO_SMART_REASONING_EFFORT = 'low';
```

`requestOpenAiJsonSchema()` 使用：

```js
const requestModel = options.model || OPENAI_MODEL;
```

一般 payload：

```js
{
  model: 'gpt-4.1-mini',
  temperature: 0.1,
  messages,
  response_format
}
```

Smart Hundo card payload：

```js
{
  model: 'gpt-5-mini',
  reasoning_effort: 'low',
  messages,
  response_format
}
```

`gpt-5-mini` payload 不送 `temperature`。本變更不遷移 Responses API、不更改 endpoint，也不將 raw model 字串散落到 callers。

只有 `requestSmartHundoExtractionV2()` 傳入：

```js
{
  model: HUNDO_SMART_MODEL,
  reasoningEffort: HUNDO_SMART_REASONING_EFFORT,
  imageDetail: HUNDO_SMART_IMAGE_DETAIL,
  includeMetadata: true
}
```

結構重試只會再次呼叫同一 wrapper，因此第一輪與重試都固定使用 `gpt-5-mini`、`low`、`high` 與完整 `originalDataUrl`。

## 無靜默 fallback

Smart Hundo card request 的 4xx、5xx、未授權、不支援或其他 request failure 不會改送 `gpt-4.1-mini`。失敗沿用既有獨立 settlement：

- hundo count 若成功，仍可更新總數。
- card list 不被不完整或舊 AI 結果覆寫。
- diagnostics 加入 `smart_hundo_model_request_failed`。
- UI 顯示「百神智慧卡片辨識請求失敗」。
- ordinary extraction settlement 不受影響。

`requestOpenAiJsonSchema()` 仍只對既有 429／5xx 條件依目前 retry 規則重試同一 payload；重試不改變 model。

## 安全 metadata

當 `includeMetadata` 為 `true` 時，wrapper 只回傳 allowlisted metadata：

```js
{
  result,
  requested_model,
  returned_model,
  reasoning_effort,
  finish_reason
}
```

- `requested_model` 來自 `requestModel`。
- `returned_model` 只取 API response 的頂層 `model` 並轉為字串。
- `reasoning_effort` 只記錄本次實際 request option；一般 request 為空字串。
- `finish_reason` 沿用現有安全字串。

不得儲存 API key、Authorization、完整 payload、image data URL、`File`、raw response 或 response body。

`window.lastSmartHundoDiagnostics` 增加 session-level：

```js
models: {
  classification: 'gpt-4.1-mini',
  hundo_count: 'gpt-4.1-mini',
  smart_cards: 'gpt-5-mini',
  smart_cards_reasoning_effort: 'low'
}
```

每張 screenshot 另保存 allowlisted requested/returned model 與 reasoning effort；若 response 未提供 returned model，保留空字串，不推測或偽造。

## form_evidence V2 契約

保留 V1 五欄：

```text
region_visibility
recognition_basis
visual_signature
key_features_visible
label_relationship
```

新增四個 required 欄位：

```text
body_plan
limb_layout
fusion_host
decisive_feature
```

`form_evidence` 的所有 properties 仍 required，`additionalProperties: false`。

### body_plan enum

```text
not_applicable
uncertain
other
dialga_standard_stocky_quadruped
dialga_origin_elongated_equine_quadruped
palkia_standard_upright_bipedal_dragon
palkia_origin_centaur_quadruped
necrozma_base_upright_crystalline
necrozma_dusk_mane_quadruped_lion
necrozma_dawn_wings_giant_moon_wing
```

### limb_layout enum

```text
not_applicable
uncertain
other
four_standard_legs
four_long_legs
two_arms_two_legs
four_legs_no_standard_arms
upright_crystalline_limbs
quadruped_lion
giant_wings_no_lion_body
```

### fusion_host enum

```text
not_applicable
uncertain
none
solgaleo
lunala
```

### decisive_feature enum

```text
not_applicable
uncertain
other
standard_dialga_stocky_neck_chest
origin_dialga_elongated_neck_chest
standard_palkia_visible_arms
origin_palkia_centaur_body
base_necrozma_crystal_body
dusk_mane_lion_crystal_armor
dawn_wings_moon_wings_crystal_armor
```

只有 schema 中的 exact values 可通過正規化；任意文字例如 `horse`、`moon`、`looks origin` 一律成為 `uncertain`。

## 唯一專用證據 mapping

`smart-hundo-helpers.js` 定義並匯出唯一 immutable mapping：

```js
const REQUIRED_SPECIALIZED_FORM_EVIDENCE = Object.freeze({
  dialga_standard: Object.freeze({
    body_plan: 'dialga_standard_stocky_quadruped',
    limb_layout: 'four_standard_legs',
    fusion_host: 'not_applicable',
    decisive_feature: 'standard_dialga_stocky_neck_chest'
  }),
  dialga_origin: Object.freeze({
    body_plan: 'dialga_origin_elongated_equine_quadruped',
    limb_layout: 'four_long_legs',
    fusion_host: 'not_applicable',
    decisive_feature: 'origin_dialga_elongated_neck_chest'
  }),
  palkia_standard: Object.freeze({
    body_plan: 'palkia_standard_upright_bipedal_dragon',
    limb_layout: 'two_arms_two_legs',
    fusion_host: 'not_applicable',
    decisive_feature: 'standard_palkia_visible_arms'
  }),
  palkia_origin: Object.freeze({
    body_plan: 'palkia_origin_centaur_quadruped',
    limb_layout: 'four_legs_no_standard_arms',
    fusion_host: 'not_applicable',
    decisive_feature: 'origin_palkia_centaur_body'
  }),
  necrozma_base: Object.freeze({
    body_plan: 'necrozma_base_upright_crystalline',
    limb_layout: 'upright_crystalline_limbs',
    fusion_host: 'none',
    decisive_feature: 'base_necrozma_crystal_body'
  }),
  necrozma_dusk_mane: Object.freeze({
    body_plan: 'necrozma_dusk_mane_quadruped_lion',
    limb_layout: 'quadruped_lion',
    fusion_host: 'solgaleo',
    decisive_feature: 'dusk_mane_lion_crystal_armor'
  }),
  necrozma_dawn_wings: Object.freeze({
    body_plan: 'necrozma_dawn_wings_giant_moon_wing',
    limb_layout: 'giant_wings_no_lion_body',
    fusion_host: 'lunala',
    decisive_feature: 'dawn_wings_moon_wings_crystal_armor'
  })
});
```

outer mapping 與每個 nested tuple 都凍結。其餘 16 個 supported forms、所有非白名單物種及控制 form 值的四欄都必須是 `not_applicable`。

## deterministic specialized validator

純函式：

```js
validateSpecializedFormEvidence(formId, evidence)
// => { valid: boolean, reasons: string[] }
```

七個專用 form 逐欄比對唯一 mapping；非專用 form 若四欄任一不是 `not_applicable`，加入單一 `form_specialized_evidence_unexpected`。

欄位 mismatch reason：

```text
form_body_plan_mismatch
form_limb_layout_mismatch
form_fusion_host_mismatch
form_decisive_feature_mismatch
form_specialized_evidence_unexpected
```

中文訊息：

```text
型態身體結構與判斷不一致
型態四肢結構與判斷不一致
奈克洛茲瑪合體母體與判斷不一致
型態關鍵外觀特徵與判斷不一致
非專用型態不應包含雙龍／奈克洛茲瑪專用證據
```

`validateHundoPokemonForm()` 先保留並完成全部 V1 gates，再執行 specialized validator。白名單 supported form 在 V1 gates 通過後執行；非白名單物種的精確 `form_id='not_applicable'`／`visual_signature='not_applicable'` 控制路徑也必須在接受前執行，避免一般物種夾帶雙龍／奈克洛茲瑪證據。任一 specialized reason 會令：

```text
effective_form_id = uncertain
canonical_official_name = ''
```

該卡保留在 diagnostics，卻不進入 `pokemon_list`。同卡多個理由仍由既有 `card_id` set 在 `review_card_count` 只計一次。

## prompt 修訂

`buildSmartHundoPrompt()` 增加：

- `【B2-D1. 帝牙盧卡普通型態與起源型態】`
- `【B2-D2. 帕路奇亞普通型態與起源型態】`
- `【B2-N1. 普通奈克洛茲瑪】`
- `【B2-N2. 奈克洛茲瑪（黃昏之鬃）】`
- `【B2-N3. 奈克洛茲瑪（拂曉之翼）】`

每節列出核准的 body plan、limb layout、fusion host、decisive feature 與「看不清則 `form_id=uncertain`」規則。

負向 label 規則明定：

```text
帝牙盧卡
帕路奇亞
奈克洛茲瑪
```

只能證明 base species，不能證明 `dialga_standard`、`palkia_standard` 或 `necrozma_base`。

Zamazenta regression 強調 `zamazenta_crowned` 必須有巨大盾牌式鬃甲及正面頭／頸／胸盾裝；普通紅藍狼身、顏色或 generic label 不足。

Galarian Zapdos regression 強調橘紅身體、極長強腿與直立奔跑鳥 body plan；label「閃電鳥」不能覆蓋視覺型態。

非專用 form 的四個新欄一律回傳 `not_applicable`。

## production data flow

```text
1000px/JPEG classification → gpt-4.1-mini
                           ├─ ordinary extraction → gpt-4.1-mini
                           ├─ trainer-team fixed UI → gpt-4.1-mini
                           └─ exact Smart Hundo
                              ├─ native count crop → gpt-4.1-mini
                              └─ full original image → gpt-5-mini / low / high
                                 → normalize form evidence
                                 → V1 form validation
                                 → specialized evidence validation
                                 → state validation
                                 → structural retry with same model/options if needed
                                 → overlap/group/display/diagnostics
```

## 測試與人工驗收

所有 browser tests 使用 strict mocked fetch；允許的唯一 endpoint 是現有 Chat Completions URL，OpenAI requests 總數必須為 0（mocked）。

自動測試涵蓋：

- 四種普通 routes 的 `gpt-4.1-mini`／`temperature: 0.1`／無 reasoning effort
- Smart card 與 structural retry 的 `gpt-5-mini`／`low`／`high`／無 temperature
- 無模型 fallback、安全 metadata、HTTP failure
- 四個 enums、正規化、immutable mapping、七種 form 正負 tuple
- 非專用 form 的 `not_applicable` 規則
- reason/UI/review-card 去重、safe diagnostics
- 四個真實截圖 oracle 的 mocked deterministic fixtures
- canonical output、不同 form 不合併、state prefix 與 hidden states

`docs/manual-tests/smart-hundo-gpt5-origin-necrozma-v2.md` 記錄四個真實 screenshot oracles，但不包含私人圖片。每次人工測試須記錄 full commit SHA、匿名 image ID、requested/returned model、reasoning effort、四個 specialized evidence 欄位及最終結果。

Mocked tests 只證明 routing、data flow 與 deterministic validation，不證明真實圖片視覺準確度。未取得並實際測試私人截圖前，人工驗收狀態保持「待人工執行」。
