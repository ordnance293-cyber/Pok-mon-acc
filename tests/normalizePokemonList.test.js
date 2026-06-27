const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('        const FULLWIDTH_CHAR_MAP');
const end = html.indexOf('        const normalizeSearchQuery', start);
if (start === -1 || end === -1) throw new Error('Unable to locate normalizePokemonList source block');

const source = html.slice(start, end).replace(/^        /gm, '');
const moduleSource = `${source}\nmodule.exports = { normalizePokemonList, derivePokemonListFromCardEvidence, deriveHundoPokemonNameFromEvidence, normalizePokemonCardEvidence };`;
const mod = { exports: {} };
new Function('module', 'exports', moduleSource)(mod, mod.exports);
const { normalizePokemonList, derivePokemonListFromCardEvidence, deriveHundoPokemonNameFromEvidence } = mod.exports;

const cases = [

  {
    name: 'Shiny should not be confused with lucky',
    input: 'shiny Kyurem, lucky Kyurem',
    expected: '色違酋雷姆,酋雷姆'
  },
  {
    name: 'Purified should not become special background',
    input: 'Lugia with purified sparkle, Registeel with blue/cyan purified sparkle',
    expected: '洛奇亞,雷吉斯奇魯'
  },
  {
    name: 'Special background should remain special background',
    input: 'Palkia with blue snowflake marker at lower-right, Dialga with blue flower marker at lower-right',
    expected: '特別背卡帕路奇亞,特別背卡帝牙盧卡'
  },
  {
    name: 'Global background should remain commemorative background',
    input: 'Rayquaza with globe background, Necrozma with location background',
    expected: '紀念背卡烈空坐,紀念背卡奈克洛茲瑪'
  },
  {
    name: 'Shadow should remain shadow',
    input: 'Kyogre with purple flame at lower-left, shadow Lugia',
    expected: '暗影蓋歐卡,暗影洛奇亞'
  },
  {
    name: 'Different preserved states should not merge',
    input: 'Kyurem, shiny Kyurem, shadow Kyurem, special background Kyurem, Kyurem with globe background, purified Kyurem',
    expected: '酋雷姆*2,色違酋雷姆,暗影酋雷姆,特別背卡酋雷姆,紀念背卡酋雷姆'
  },
  {
    name: 'Shiny',
    input: ['色違酋雷姆', '異色酋雷姆', 'shiny Kyurem'].join('\n'),
    expected: '色違酋雷姆*3'
  },
  {
    name: 'Shadow',
    input: ['暗影蓋歐卡', 'shadow Kyogre', '暗影洛奇亞', 'Shadow Lugia'].join('\n'),
    expected: '暗影蓋歐卡*2,暗影洛奇亞*2'
  },
  {
    name: 'Purified removal',
    input: ['淨化皮卡丘', 'purified Pikachu', '淨化洛奇亞', 'purified Lugia'].join('\n'),
    expected: '皮卡丘*2,洛奇亞*2'
  },
  {
    name: 'Purified merges with normal',
    input: ['洛奇亞', '淨化洛奇亞', 'purified Lugia'].join('\n'),
    expected: '洛奇亞*3'
  },
  {
    name: 'Special background',
    input: ['special background Kyurem', '特別背卡帕路奇亞', 'special backdrop Dialga'].join('\n'),
    expected: '特別背卡酋雷姆,特別背卡帕路奇亞,特別背卡帝牙盧卡'
  },
  {
    name: 'Global / commemorative background',
    input: ['globe background Rayquaza', '全球背卡烈空坐', 'location background Necrozma'].join('\n'),
    expected: '紀念背卡烈空坐*2,紀念背卡奈克洛茲瑪'
  },
  {
    name: 'Status + background',
    input: ['shiny Kyurem with special background', 'shadow Kyogre with globe background', 'purified Lugia with special background'].join('\n'),
    expected: '色違特別背卡酋雷姆,暗影紀念背卡蓋歐卡,特別背卡洛奇亞'
  },
  {
    name: 'Ignored descriptors',
    input: ['lucky Kyurem', 'favorite Dialga', '收藏帝牙盧卡', '亮晶晶酋雷姆'].join('\n'),
    expected: '酋雷姆*2,帝牙盧卡*2'
  },
  {
    name: 'Non-merge variants',
    input: ['酋雷姆', '色違酋雷姆', '暗影酋雷姆', '特別背卡酋雷姆', '紀念背卡酋雷姆', '色違特別背卡酋雷姆', '暗影紀念背卡酋雷姆'].join('\n'),
    expected: '酋雷姆,色違酋雷姆,暗影酋雷姆,特別背卡酋雷姆,紀念背卡酋雷姆,色違特別背卡酋雷姆,暗影紀念背卡酋雷姆'
  }
];

let failures = 0;
for (const testCase of cases) {
  const actual = normalizePokemonList(testCase.input);
  if (actual !== testCase.expected) {
    failures += 1;
    console.error(`FAIL ${testCase.name}\nexpected: ${testCase.expected}\nactual:   ${actual}`);
  } else {
    console.log(`PASS ${testCase.name}: ${actual}`);
  }
}


const emptyIcon = () => ({ present: false, position: '', color: '', shape: '' });
const card = (raw_name_label, visual_evidence = {}, guessed_sprite_name = '') => ({
  raw_name_label,
  canonical_name: '',
  guessed_sprite_name,
  final_output_name: '',
  visual_evidence: {
    shiny: emptyIcon(),
    shadow: emptyIcon(),
    purified: emptyIcon(),
    special_background: emptyIcon(),
    commemorative_background: emptyIcon(),
    ignored_icons: [],
    ...visual_evidence
  }
});

const evidenceCases = [
  {
    name: 'Evidence real hundo failure case',
    actual: () => derivePokemonListFromCardEvidence([
      { raw_name_label: '基格爾德', ignored_icons: ['white buddy icon', 'yellow favorite star'], shiny: false, shadow: false, purified: false, special_background: false, commemorative_background: false },
      { raw_name_label: '帝牙盧卡', shiny: false, shadow: false, purified: false, special_background: false, commemorative_background: false },
      { raw_name_label: '眷戀雲', shiny: false, shadow: false, purified: false, special_background: false, commemorative_background: false },
      { raw_name_label: '酋雷姆', ignored_icons: ['yellow lucky sparkles'], shiny: false, shadow: false, purified: false, special_background: false, commemorative_background: false },
      { raw_name_label: '帕路奇亞', ignored_icons: ['yellow favorite star'], shiny: false, shadow: false, purified: false, special_background: false, commemorative_background: false },
      { raw_name_label: '卡璞・鳴鳴', ignored_icons: ['yellow favorite star'], shiny: false, shadow: false, purified: false, special_background: false, commemorative_background: false },
      { raw_name_label: '席多藍恩', ignored_icons: ['yellow favorite star'], shiny: false, shadow: false, purified: false, special_background: false, commemorative_background: false },
      { raw_name_label: '克雷色利亞', purified: { present: true, position: 'lower-left', color: 'blue/cyan', shape: 'single purified sparkle' }, shiny: false, shadow: false, special_background: false, commemorative_background: false },
      { raw_name_label: '雷吉斯奇魯', purified: { present: true, position: 'lower-left', color: 'blue/cyan', shape: 'single purified sparkle' }, shiny: false, shadow: false, special_background: false, commemorative_background: false }
    ]),
    expected: '基格爾德,帝牙盧卡,眷戀雲,酋雷姆,帕路奇亞,卡璞・鳴鳴,席多藍恩,克雷色利亞,雷吉斯奇魯'
  },
  {
    name: 'Evidence lower-left blue/cyan purified is not special background',
    actual: () => deriveHundoPokemonNameFromEvidence(card('Lugia', { purified: { present: true, position: 'lower-left', color: 'blue/cyan', shape: 'single sparkle' } })),
    expected: '洛奇亞'
  },
  {
    name: 'Evidence lower-right blue snowflake is special background',
    actual: () => deriveHundoPokemonNameFromEvidence(card('Palkia', { special_background: { present: true, position: 'lower-right', color: 'blue', shape: 'snowflake flower radial marker' } })),
    expected: '特別背卡帕路奇亞'
  },
  {
    name: 'Evidence top-left dark blue double sparkle is shiny',
    actual: () => deriveHundoPokemonNameFromEvidence(card('Kyurem', { shiny: { present: true, position: 'top-left', color: 'dark blue', shape: 'double four-point diamond sparkle' } })),
    expected: '色違酋雷姆'
  },
  {
    name: 'Evidence yellow favorite star is ignored',
    actual: () => deriveHundoPokemonNameFromEvidence(card('Tapu Koko', { ignored_icons: ['yellow favorite star'] })),
    expected: '卡璞・鳴鳴'
  },
  {
    name: 'Evidence yellow lucky sparkles are ignored',
    actual: () => deriveHundoPokemonNameFromEvidence(card('Kyurem', { ignored_icons: ['yellow lucky sparkles'] })),
    expected: '酋雷姆'
  },
  {
    name: 'Evidence white buddy icon is ignored',
    actual: () => deriveHundoPokemonNameFromEvidence(card('Zygarde', { ignored_icons: ['white buddy icon'] })),
    expected: '基格爾德'
  },
  {
    name: 'Evidence final output label from AI is not trusted over deterministic evidence',
    actual: () => deriveHundoPokemonNameFromEvidence({
      raw_name_label: '克雷色利亞',
      canonical_name: '克雷色利亞',
      final_output_name: '特別背卡克雷色利亞',
      purified: { present: true, position: 'lower-left', color: 'blue/cyan', shape: 'single purified sparkle' },
      shiny: false,
      shadow: false,
      special_background: false,
      commemorative_background: false
    }),
    expected: '克雷色利亞'
  },
  {
    name: 'Evidence visible name label wins over sprite guess',
    actual: () => deriveHundoPokemonNameFromEvidence(card('眷戀雲', {}, '蒼響')),
    expected: '眷戀雲'
  }
];

for (const testCase of evidenceCases) {
  const actual = testCase.actual();
  if (actual !== testCase.expected) {
    failures += 1;
    console.error(`FAIL ${testCase.name}\nexpected: ${testCase.expected}\nactual:   ${actual}`);
  } else {
    console.log(`PASS ${testCase.name}: ${actual}`);
  }
}

if (failures > 0) process.exit(1);
