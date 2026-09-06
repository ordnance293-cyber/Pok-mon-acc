(function (global) {
    'use strict';

    const record = (base_species, family, silhouette, decisive_parts, reference_colors, comparison, prohibited_shortcuts, visibility) =>
        Object.freeze({ base_species, family, silhouette, decisive_parts, reference_colors, comparison, prohibited_shortcuts, visibility });

    const FORM_RULES = Object.freeze({
        zacian_standard: record('蒼響', 'zacian', '四足狼、細長腿、狼形口鼻，頭頸身側有尖長毛束。', '嘴與肩背清楚時：沒有與口部相接的實體長劍，也沒有成對高聳金色刀刃武裝。', '藍色本體、粉橘編繩狀長毛僅供參考；色違可改色。', '普通本來就有醒目長毛；華麗不等於劍之王。', '不得因未見劍或尾毛顏色就判普通。', '嘴部或肩背遮住時保留 uncertain。'),
        zacian_crowned: record('蒼響', 'zacian', '武裝四足狼，上半身較高較寬。', '嘴部相接的細長直線尖端實體長劍，加頭頸與肩背成對高聳外張刀刃／翼狀武裝。', '藍與粉橘僅供參考；色違長毛可偏藍。', '劍方向隨姿勢改變；橫向長劍不是血條、尾巴或鄰卡線條。', 'four_armored_wolf_legs 是武裝四足狼的現有代碼，不要求金甲包住每條腿。', '長劍與頭頸武裝必須有足夠且一致的可見證據。'),
        zamazenta_standard: record('藏瑪然特', 'zamazenta', '厚實四足狼、口鼻前突，本來就有蓬鬆厚鬃毛。', '狼頭、頸胸與毛束清楚，沒有形成連續大型金色盾面。', '紅深藍毛束、灰白身側僅供參考；色違可桃紅或洋紅。', '厚鬃毛或胸前大不等於盾之王。', '不得從單見腿或後段推定前方無盾。', '頭頸胸不清楚時保留 uncertain。'),
        zamazenta_crowned: record('藏瑪然特', 'zamazenta', '四足狼，頭頸胸被連續大型盾狀裝甲包圍。', '左右分層尖角裝甲外伸成寬盾面，中央有向下尖形部分。', '金色盾甲配紅深藍僅供參考；色違可桃紅。', '硬質幾何分層邊緣與普通鬃毛不同。', '不要求嘴咬或手持獨立盾；最愛星、亮晶晶或單塊金色不是盾甲。', '需看到連續盾面結構，否則 uncertain。'),
        dialga_standard: record('帝牙盧卡', 'creation_trio', '粗腿支撐厚實軀幹的四足裝甲龍，頸直立、尾後伸。', '銀白胸甲中央寶石，肩背扇狀金屬板／長刺，寬足與爪端。', '深藍、青藍紋、銀白裝甲僅供參考；色違可青綠。', '與起源型的細長尖端肢體、橫向下頸結構對照。', '普通本來就有長頸、尖角、背刺，不可單憑其一判起源。', '胸肩與足端證據不足時 uncertain。'),
        dialga_origin: record('帝牙盧卡', 'creation_trio', '仍是四足；肢體細長稜角化，足端尖削。', '下頸／前胸有橫向突出帶寶石結構，身側有分叉／環帶外延。', '深藍、青藍紋、藍紫寶石僅供參考；色違可青綠。', '綜合四足架構、頸胸、足端與軀幹外延，對照普通厚實胸甲。', '正面縮圖瘦高不代表無足或雙足結晶柱；不可只因高、細、亮色判定。', '肢體重疊不等於不存在；關鍵結構不清楚時 uncertain。'),
        palkia_standard: record('帕路奇亞', 'creation_trio', '兩條粗壯後腿承重、軀幹直立，另有兩隻獨立手臂。', '可分肩、上臂、前臂／爪；肩珍珠、後上彎粗尾與背翼／鰭。', '灰白／淡銀配紫紋僅供參考；色違可粉紅紫紅。', '不是四條承重腿的半人馬型；珍珠、翼、尾、紫色不是普通獨有。', '不可將四條承重腿描述為普通型。', '手臂或下半身遮住時 uncertain。'),
        palkia_origin: record('帕路奇亞', 'creation_trio', '四足／半人馬式，下半身前後四腿，前方上半身抬高。', '沒有普通型的完整自由手臂；肩珍珠與環、尖細腿端、上揚長翼／鰭。', '白、淡紫、深紫環帶僅供參考；色違可粉紅紫紅。', '與普通的兩承重後腿加完整手臂對照。', '不可只因珍珠、淡紫或優雅判起源。', '「無普通手臂」必須由可見結構判斷，不可對遮住的手臂補想。'),
        kyurem_base: record('酋雷姆', 'kyurem', '駝背、頭前傾的不對稱冰龍，小手臂、粗後腿。', '未融合本體的冰晶頭頸、軀幹與翼狀冰晶。', '灰軀幹、淡藍／灰白冰晶僅供參考。', '不得把融合特徵遮住當成未融合證據。', '不可默認 base，也不可只靠顏色。', '融合相關部位不可見時 uncertain。'),
        kyurem_white: record('酋雷姆', 'kyurem', '萊希拉姆融合後肩臂、翼狀外突與蓬展羽片感結構。', '同時見酋雷姆冰晶頭頸與軀幹；尾可見時核對渦輪式融合輪廓。', '灰、白、淡藍與可能橙紅光區僅供參考；未發光不否定。', '闇黑也有淺色冰甲；需區分羽片感與粗壯稜角機械臂。', '不以整隻偏白分類，不可只寫「有尾巴」或「像白龍」。', '尾不可見時不得補寫尾部證據；用其他可見融合結構或 uncertain。'),
        kyurem_black: record('酋雷姆', 'kyurem', '捷克羅姆融合後粗壯、稜角／裝甲式肩臂。', '酋雷姆冰晶、龍頭、軀幹；尾可見時核對發電機式尾與連接。', '灰黑、深色粗臂、淡藍冰晶與可能藍光僅供參考。', '不可把單獨捷克羅姆當融合；燄白與闇黑都有深軀幹淺冰晶。', '不做黑白二分；藍光不是必要條件。', '尾不可見時不得補寫；融合結構不足時 uncertain。'),
        necrozma_base: record('奈克洛茲瑪', 'necrozma', '直立、稜角鮮明的結晶軀幹與長而不規則結晶臂／爪。', '未融合的結晶肢體與軀幹，沒有四足獅身或巨大月翼宿主。', '黑／深灰僅供參考；色違可不同。', '與索爾迦雷歐獅身、露奈雅拉月翼對照。', '不可只因很黑就判本體。', '結晶肢體或宿主輪廓不清楚時 uncertain。'),
        necrozma_dusk_mane: record('奈克洛茲瑪', 'necrozma', '索爾迦雷歐式四足獅身、獅頭與放射鬃毛。', '頭部／身體可見奈克洛茲瑪融合結晶裝甲。', '淺色獅身、亮鬃毛、深結晶僅供參考；色違可改色。', '沒有巨大月翼；需與未融合索爾迦雷歐區分。', '只有白獅子不足以證明融合。', '融合結晶裝甲不清楚時 uncertain。'),
        necrozma_dawn_wings: record('奈克洛茲瑪', 'necrozma', '露奈雅拉式巨大月牙／蝙蝠雙翼與小中央身體。', '月翼宿主上可見融合結晶結構。', '紫藍翼面、淺色翼骨／外緣、深結晶僅供參考。', '沒有四足獅身；翼面不是背卡徽章。', '只有大蝙蝠不足以證明融合。', '需看到融合結晶，否則與未融合露奈雅拉無法區分而 uncertain。'),
        articuno_standard: record('急凍鳥', 'legendary_birds', '一般急凍鳥鳥體、寬翼、頭頂尖羽冠與長帶狀尾羽。', '核對羽翼、頭冠、長尾與整體軀幹。', '藍色本體、淺胸羽僅供參考；色違可改色。', '伽勒爾也有長帶狀尾；需比較面罩眼部與後梳頭冠。', '長尾不是普通獨有，不可只靠尾長或藍色。', '頭冠、眼部、翼與尾證據不足時 uncertain。'),
        articuno_galarian: record('急凍鳥', 'legendary_birds', '鳥體、翼、頸胸與長帶狀尾部。', '外揚面罩式眼部、後梳頭冠，配合翼、頸胸與長尾。', '淡紫／紫本體、深色眼罩與頸胸僅供參考。', '普通與伽勒爾都有長尾，以眼罩與頭冠架構比較。', '不得強制短尾，也不可藍色就當普通。', '眼部或頭冠遮住時 uncertain。'),
        zapdos_standard: record('閃電鳥', 'legendary_birds', '頭冠、雙翼、尾部有強烈鋸齒／閃電尖羽，翼為主要外展輪廓。', '細長尖喙與鋸齒展翼。', '黃黑僅供參考；色違可改色。', '與伽勒爾長而強壯的奔跑腿、較小翼比較。', '普通是細長尖喙，不得要求短粗喙；不可只靠黃黑。', '翼腿比例或喙遮住時 uncertain。'),
        zapdos_galarian: record('閃電鳥', 'legendary_birds', '陸行鳥架構，長而強壯的奔跑／踢擊腿，較小翼部。', '比較翼腿比例與長腿奔跑姿態。', '橘紅本體、黑尖羽僅供參考。', '普通型以鋸齒外展翼為主；伽勒爾以腿與陸行架構為主。', '不可只看橘色；跳躍動作不代表普通。', '腿或翼遮住、比例不清楚時 uncertain。'),
        moltres_standard: record('火焰鳥', 'legendary_birds', '一般飛鳥軀幹，頭冠和翼尾有火焰式輪廓。', '核對鳥體、頭冠、展翼與翼尾火焰配置。', '黃橘本體、橙紅頭冠／翼緣／尾火僅供參考。', '伽勒爾有深色鳥體與紅／洋紅火焰式翼緣，但不可只靠色。', '本體火焰不是獨立暗影 UI；不可只靠顏色。', '鳥體與火焰邊緣配置不清楚時 uncertain。'),
        moltres_galarian: record('火焰鳥', 'legendary_birds', '鳥體、頭頸、展翼與火焰邊緣配置。', '核對紅／洋紅火焰式翼緣與尾部氣場在本體上的配置。', '黑／深本體、紅／洋紅火焰僅供參考；色違可不同。', '需從整體鳥身與火焰邊緣比較，不做黑色捷徑。', '自身火焰不是暗影；三神鳥都不得單靠顏色分形態。', '頭頸、展翼或火焰配置不足時 uncertain。'),
        zygarde_10: record('基格爾德', 'zygarde', '低而修長的四足犬型，尖耳、犬形口鼻、長尾。', '犬形完整構造與四足。', '深色身體、綠標記僅供參考。', '與50%蛇／眼鏡蛇與完全體人形架構對照。', '不可只靠綠色或六角形。', '必須有足夠犬形構造，局部不足時 uncertain。'),
        zygarde_50: record('基格爾德', 'zygarde', '蛇／眼鏡蛇軀幹，上半身抬高、頸側展開，下半身延續成蛇身尾。', '無腿的眼鏡蛇完整架構。', '黑綠與六角紋僅供參考。', '不是四足犬，也不是巨大直立人形。', '六角形本身不能決定形態。', '蛇身延續與頸側不清楚時 uncertain。'),
        zygarde_complete: record('基格爾德', 'zygarde', '巨大直立人形／機甲架構，寬厚軀幹、粗壯雙腿。', '兩側及背部大型延伸構造與人形整體架構。', '深色、綠色及部分紅藍僅供參考。', '與低矮四足犬和無腿蛇形對照。', '顏色不可取代人形架構；10%、50%不是 IV 或數量。', '未支援形態不可強行歸入三者；架構不足時 uncertain。')
    });

    const COMMON_RULES = Object.freeze([
        '先以本卡 CP、本體、名稱、血條與相對範圍定位；不得借用鄰卡的劍、尾、徽章、暗影火焰或光效。左右是卡片內相對位置。',
        '物種、形態、色違、亮晶晶、最愛、暗影／淨化、背卡分開判斷，不可互相推論。',
        '形態依肢體配置→整體輪廓→專屬部位→輔助顏色→可見名稱核對；比喻形容詞不能單獨決定。',
        '顏色只作參考；色違、光照、縮圖與光效可改變配色，不得用白＝燄白、黑＝闇黑、青綠＝起源等捷徑。',
        '看不見不等於沒有；不補想遮住或裁掉的部位。只有足夠且一致的決定性證據才確定，否則保留 uncertain／unsupported／not_applicable原語義。',
        '暱稱、100、98、66、刀盾、CP與排序不是形態或 IV 證據；搜尋「帝」可混入帝王拿波，不得放寬現有圖片准入。',
        'visible_label 只能作為次要證據；不得因為 visible_label 只顯示基礎物種，就退回 standard 或 base。',
        '帝牙盧卡必須從可見本體區分普通與起源；標籤只寫「帝牙盧卡」時，不得被 visible_label 帶回 dialga_standard。證據不足仍為 uncertain。',
        '有卡片但屬性不確定時保留卡位與待確認資訊；同名同 CP 仍可是不同卡，不可只靠 CP 去重；高信心不取代圖像證據。'
    ]);

    const FORM_VERIFICATION_RULES = Object.freeze([
        '先確認同一 tile 內本體與卡片邊界；不得把鄰卡線條或部位套到本卡。',
        '依肢體配置→整體輪廓→形態專屬部位→輔助顏色判斷；CP、暱稱、排序與基礎物種標籤不能決定形態。',
        '顏色只作參考，光照、縮圖與色違配色不能覆蓋本體結構證據。',
        '看不見不等於沒有；不補想遮住或裁掉的部位，決定性證據不足或矛盾時使用 uncertain。'
    ]);

    const BACKGROUND_RULES = Object.freeze({
        special: '特別背卡：同卡本體右側偏下、名稱上方的藍色多花形小徽章；多個中心，實心圓頭橢圓／水滴花瓣各自環繞中心、花瓣間留空、外形不規則，無連續圓框或經緯網。不因藍色／放射／雪花感就判定；淨化單中心星芒、色違四角星、粉紅極巨化 X 都不是。代碼必須一致：special_flower_badge + special_background_badge + event_special_background。',
        commemorative: '紀念背卡：同卡本體右側偏下、名稱上方的淺藍／青藍線框球小徽章；連續圓外緣內有縱向弧線與橫線交叉的經緯網，格內留空。不是實心多花瓣或單一星芒；不要求大陸、城市照片、粉紅或大片背景。代碼必須一致：location_globe_badge + commemorative_location_badge + location_style_background。',
        contrast: 'event_special_background 與 location_style_background 是現有 evidence appearance 代碼，在清單 UI 不要求詳情頁大幅場景。花形、網格或歸屬不清時 uncertain；只有徽章區清楚且無真實徽章才支持 none。極巨化、淨化或其他標記既不證明也不否定另一個真實背卡。'
    });

    const ICON_RULES = Object.freeze({
        shiny: '色違：主要證據是同卡 CP 附近／身體左上多個大小不一的尖角四角星，參考色深藍／藍黑／藍綠。不是黃色五角最愛星、圓頭淨化光芒或多花形背卡。標記區遮住時不可單靠本體色差確定。',
        shadow: '暗影：同卡左下獨立紫色火焰／煙霧 UI，有不規則波浪邊與向上火舌。深色本體、紅眼、自身火焰不能單獨證明；伽勒爾火焰鳥自身火焰不是暗影 UI。',
        purified: '淨化：同卡左下淺青／淺藍單中心光芒，向外伸粗短圓頭放射線。不是多中心花群或圓框經緯球；不因本體發白判定。左下淨化可與右下背卡共存；暗影與淨化互斥，矛盾不可同時確定。',
        other: '亮晶晶是本體後方較大金色圓形光斑／閃光，不是紀念背卡。最愛是同卡右上黃色實心五角星，不是色違或形態。名稱旁灰標籤、夥伴徽章、表情泡泡、拖動箭頭、浮動按鈕、綠血條不是身體或背卡。粉紅極巨化 X 不是背卡；不猜未支援細分或新前綴。'
    });

    const visualRuleForForm = formId => {
        const item = FORM_RULES[formId];
        if (!item) throw new Error(`missing Smart Hundo visual rule: ${formId}`);
        return [`${item.base_species}：${item.silhouette}`, item.decisive_parts, item.reference_colors, item.comparison, item.prohibited_shortcuts, item.visibility].join(' ');
    };
    const familyRulesForFormIds = formIds => {
        const seen = new Set();
        return formIds.filter(id => id !== 'uncertain').map(id => {
            const item = FORM_RULES[id];
            if (!item) throw new Error(`missing Smart Hundo visual rule: ${id}`);
            if (seen.has(item.family)) return '';
            seen.add(item.family);
            return Object.keys(FORM_RULES).filter(key => FORM_RULES[key].family === item.family)
                .map(key => `${key}：${visualRuleForForm(key)}`).join('\n');
        }).filter(Boolean).join('\n');
    };
    const buildPrimaryVisualRules = () => `【共通身份、可見度與不確定規則】\n${COMMON_RULES.join('\n')}\n\n【清單 UI 背卡與狀態圖示】\n${Object.values(BACKGROUND_RULES).join('\n')}\n${Object.values(ICON_RULES).join('\n')}\n\n【支援形態視覺比較】\n${familyRulesForFormIds(Object.keys(FORM_RULES))}`;
    const validateCoverage = expectedIds => {
        const actual = Object.keys(FORM_RULES);
        const missing = expectedIds.filter(id => !FORM_RULES[id]);
        const extra = actual.filter(id => !expectedIds.includes(id));
        if (missing.length || extra.length) throw new Error(`Smart Hundo visual rule coverage mismatch; missing=${missing.join(',')}; extra=${extra.join(',')}`);
        return true;
    };

    const api = Object.freeze({ FORM_RULES, COMMON_RULES, FORM_VERIFICATION_RULES, BACKGROUND_RULES, ICON_RULES, visualRuleForForm, familyRulesForFormIds, buildPrimaryVisualRules, validateCoverage });
    global.SmartHundoVisualRules = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
