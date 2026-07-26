# Smart Hundo GPT-5 Mini／起源雙龍／奈克洛茲瑪 V2 人工驗收

## 驗收狀態與隱私界線

- 真實私人截圖狀態：`NOT RUN`。此儲存庫沒有取得或執行使用者的私人圖片。
- 不得提交使用者的私人截圖；只記錄匿名圖片 ID、受控欄位與最終文字結果。
- mocked tests do not prove visual accuracy。
- 自動化 mocked fixtures 只證明請求路由、schema、正規化、決定論驗證、顯示與診斷流程；不能證明模型能從真實圖片正確看出型態。
- 下列「完整 commit SHA」是目前待驗收的 production implementation commit：`138cc3646226735653a5517c822bbc883b849fb8`。若後續 production code 改動，實際人工執行時必須改填當次完整 SHA。

## 固定模型預期

- 分類：`gpt-4.1-mini`
- 百神總數：`gpt-4.1-mini`
- 百神完整卡片、物種、型態及狀態 requested_model：`gpt-5-mini`
- reasoning_effort：`low`
- returned_model 必須抄錄實際安全 metadata，不得由 requested_model 推測。

## CASE 1 — 七張卡片

可見卡片：

1. 固拉多
2. ordinary 藏瑪然特
3. 帝牙盧卡
4. 色違蓋歐卡
5. 闇黑酋雷姆
6. 蓋歐卡
7. 帝牙盧卡

預期 `pokemon_list`：

`固拉多,藏瑪然特,帝牙盧卡*2,色違蓋歐卡,闇黑酋雷姆,蓋歐卡`

禁止輸出：`藏瑪然特劍盾型態`

| 欄位 | 待驗收紀錄 |
|---|---|
| 完整 commit SHA | `138cc3646226735653a5517c822bbc883b849fb8` |
| 匿名圖片 ID | `private-oracle-01` |
| requested_model | `gpt-5-mini` |
| returned_model | `待人工執行時由安全 metadata 填入` |
| reasoning_effort | `low` |
| visible_label | `固拉多；藏瑪然特；帝牙盧卡；蓋歐卡；酋雷姆；蓋歐卡；帝牙盧卡` |
| base_species | `固拉多；藏瑪然特；帝牙盧卡；蓋歐卡；酋雷姆；蓋歐卡；帝牙盧卡` |
| raw form_id | `not_applicable；zamazenta_standard；dialga_standard；not_applicable；kyurem_black；not_applicable；dialga_standard` |
| form confidence | `待人工執行時逐卡填入` |
| body_plan | 帝牙盧卡兩張均應為 `dialga_standard_stocky_quadruped`；其他非專用型態為 `not_applicable` |
| limb_layout | 帝牙盧卡兩張均應為 `four_standard_legs`；其他非專用型態為 `not_applicable` |
| fusion_host | 全部為 `not_applicable` |
| decisive_feature | 帝牙盧卡兩張均應為 `standard_dialga_stocky_neck_chest`；其他非專用型態為 `not_applicable` |
| effective_form_id | `not_applicable；zamazenta_standard；dialga_standard；not_applicable；kyurem_black；not_applicable；dialga_standard` |
| canonical name | `固拉多；藏瑪然特；帝牙盧卡；蓋歐卡；闇黑酋雷姆；蓋歐卡；帝牙盧卡` |
| final pokemon_list | `固拉多,藏瑪然特,帝牙盧卡*2,色違蓋歐卡,闇黑酋雷姆,蓋歐卡` |
| pass/fail | `NOT RUN` |
| failure summary | `尚未以私人圖片人工執行，不能判定 PASS` |

## CASE 2 — 五張卡片

可見卡片：

1. 固拉多
2. 起源帝牙盧卡
3. 色違帕路奇亞
4. 烈空坐
5. 拉帝歐斯

預期 `pokemon_list`：

`固拉多,起源帝牙盧卡,色違帕路奇亞,烈空坐,拉帝歐斯`

第二張卡片的必要結果：

- `base_species = 帝牙盧卡`
- `form_id = dialga_origin`
- `body_plan = dialga_origin_elongated_equine_quadruped`
- `limb_layout = four_long_legs`
- `decisive_feature = origin_dialga_elongated_neck_chest`
- `effective_form_id = dialga_origin`
- `canonical_official_name = 起源帝牙盧卡`

| 欄位 | 待驗收紀錄 |
|---|---|
| 完整 commit SHA | `138cc3646226735653a5517c822bbc883b849fb8` |
| 匿名圖片 ID | `private-oracle-02` |
| requested_model | `gpt-5-mini` |
| returned_model | `待人工執行時由安全 metadata 填入` |
| reasoning_effort | `low` |
| visible_label | 第二張預期可只顯示 `帝牙盧卡`，不得藉此推定普通型態 |
| base_species | 第二張必須為 `帝牙盧卡` |
| raw form_id | 第二張必須為 `dialga_origin` |
| form confidence | `待人工執行時填入` |
| body_plan | `dialga_origin_elongated_equine_quadruped` |
| limb_layout | `four_long_legs` |
| fusion_host | `not_applicable` |
| decisive_feature | `origin_dialga_elongated_neck_chest` |
| effective_form_id | `dialga_origin` |
| canonical name | `起源帝牙盧卡` |
| final pokemon_list | `固拉多,起源帝牙盧卡,色違帕路奇亞,烈空坐,拉帝歐斯` |
| pass/fail | `NOT RUN` |
| failure summary | `尚未以私人圖片人工執行，不能判定 PASS` |

## CASE 3 — 七張卡片

可見／預期卡片：

1. 闇黑酋雷姆
2. 固拉多
3. 鳳王
4. 蒼響
5. 雷電雲
6. 色違爆肌蚊
7. 藏瑪然特劍盾型態

預期 `pokemon_list`：

`闇黑酋雷姆,固拉多,鳳王,蒼響,雷電雲,色違爆肌蚊,藏瑪然特劍盾型態`

此案例確認合法的 `zamazenta_crowned` 與 `kyurem_black` 仍被保留。

| 欄位 | 待驗收紀錄 |
|---|---|
| 完整 commit SHA | `138cc3646226735653a5517c822bbc883b849fb8` |
| 匿名圖片 ID | `private-oracle-03` |
| requested_model | `gpt-5-mini` |
| returned_model | `待人工執行時由安全 metadata 填入` |
| reasoning_effort | `low` |
| visible_label | `酋雷姆；固拉多；鳳王；蒼響；雷電雲；爆肌蚊；藏瑪然特` |
| base_species | 第一張 `酋雷姆`；第七張 `藏瑪然特` |
| raw form_id | 第一張 `kyurem_black`；第七張 `zamazenta_crowned` |
| form confidence | `待人工執行時逐卡填入` |
| body_plan | 兩個回歸型態皆為 `not_applicable` |
| limb_layout | 兩個回歸型態皆為 `not_applicable` |
| fusion_host | 兩個回歸型態皆為 `not_applicable` |
| decisive_feature | 兩個回歸型態皆為 `not_applicable` |
| effective_form_id | 第一張 `kyurem_black`；第七張 `zamazenta_crowned` |
| canonical name | 第一張 `闇黑酋雷姆`；第七張 `藏瑪然特劍盾型態` |
| final pokemon_list | `闇黑酋雷姆,固拉多,鳳王,蒼響,雷電雲,色違爆肌蚊,藏瑪然特劍盾型態` |
| pass/fail | `NOT RUN` |
| failure summary | `尚未以私人圖片人工執行，不能判定 PASS` |

## CASE 4 — 六張卡片

可見卡片：

1. 伽勒爾閃電鳥
2. 拉帝歐斯
3. 蒼響
4. 鳳王
5. 雷電雲
6. 奈克洛茲瑪（黃昏之鬃）

預期 `pokemon_list`：

`伽勒爾閃電鳥,拉帝歐斯,蒼響,鳳王,雷電雲,奈克洛茲瑪（黃昏之鬃）`

第一張必須是 `zapdos_galarian`。第六張必須使用黃昏之鬃的完整專用證據。

| 欄位 | 待驗收紀錄 |
|---|---|
| 完整 commit SHA | `138cc3646226735653a5517c822bbc883b849fb8` |
| 匿名圖片 ID | `private-oracle-04` |
| requested_model | `gpt-5-mini` |
| returned_model | `待人工執行時由安全 metadata 填入` |
| reasoning_effort | `low` |
| visible_label | 第一張可只顯示 `閃電鳥`；第六張可只顯示 `奈克洛茲瑪` |
| base_species | 第一張 `閃電鳥`；第六張 `奈克洛茲瑪` |
| raw form_id | 第一張 `zapdos_galarian`；第六張 `necrozma_dusk_mane` |
| form confidence | `待人工執行時逐卡填入` |
| body_plan | 第一張 `not_applicable`；第六張 `necrozma_dusk_mane_quadruped_lion` |
| limb_layout | 第一張 `not_applicable`；第六張 `quadruped_lion` |
| fusion_host | 第一張 `not_applicable`；第六張 `solgaleo` |
| decisive_feature | 第一張 `not_applicable`；第六張 `dusk_mane_lion_crystal_armor` |
| effective_form_id | 第一張 `zapdos_galarian`；第六張 `necrozma_dusk_mane` |
| canonical name | 第一張 `伽勒爾閃電鳥`；第六張 `奈克洛茲瑪（黃昏之鬃）` |
| final pokemon_list | `伽勒爾閃電鳥,拉帝歐斯,蒼響,鳳王,雷電雲,奈克洛茲瑪（黃昏之鬃）` |
| pass/fail | `NOT RUN` |
| failure summary | `尚未以私人圖片人工執行，不能判定 PASS` |

## 人工執行程序

1. 使用與「完整 commit SHA」一致的部署版本，先清除瀏覽器快取或以無痕環境確認版本。
2. 只在本機載入對應私人截圖，不複製到儲存庫、不附加到 issue 或 PR。
3. 從 `window.lastSmartHundoDiagnostics` 抄錄 requested_model、returned_model、reasoning_effort 與逐卡受控欄位。
4. 比對最終 `pokemon_list` 與上述 oracle。
5. 只有真實圖片輸出與全部必要欄位均吻合，才把 pass/fail 改成 `PASS`；否則填 `FAIL` 並寫明 failure summary。
