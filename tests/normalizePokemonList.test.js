const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('        const FULLWIDTH_CHAR_MAP');
const end = html.indexOf('        const normalizeSearchQuery', start);
if (start === -1 || end === -1) throw new Error('Unable to locate normalizePokemonList source block');

const source = html.slice(start, end).replace(/^        /gm, '');
const moduleSource = `${source}\nmodule.exports = { normalizePokemonList };`;
const mod = { exports: {} };
new Function('module', 'exports', moduleSource)(mod, mod.exports);
const { normalizePokemonList } = mod.exports;

const cases = [
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

if (failures > 0) process.exit(1);
