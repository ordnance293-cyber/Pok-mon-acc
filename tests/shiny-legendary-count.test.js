const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expression = name => {
  const marker = `const ${name} =`;
  const start = source.indexOf(marker); assert(start >= 0, `missing ${name}`);
  const end = source.indexOf('\n        };', start); assert(end > start, `unterminated ${name}`);
  return source.slice(start, end + 11);
};
const context = { SHINY_LEGENDARY_FILTER: '傳說的寶可夢,幻,究極異獸&異色', normalizeSearchQuery: value => String(value || '').replace(/\s/g, '') };
vm.createContext(context);
for (const name of ['normalizeParenthesizedSearchCount', 'normalizeShinyLegendaryEvidence', 'reconcileShinyLegendaryCounts', 'formatCountConsistencyReview']) {
  vm.runInContext(`${expression(name)}\nthis.${name}=${name};`, context);
}
const evidence = (raw, extra={}) => context.normalizeShinyLegendaryEvidence({
 visible_query: context.SHINY_LEGENDARY_FILTER, active_tab: 'pokemon', source_region: 'pokemon_tab_summary', raw_summary_text: raw, target_summary_readable: true, ...extra
}, { search_query: context.SHINY_LEGENDARY_FILTER });
assert.strictEqual(evidence('(15)').shiny_leg, '15'); // battery 49 and eggs 9/12 are absent from allowed evidence
assert.strictEqual(evidence('(49)').shiny_leg, '49');
assert.strictEqual(evidence('49').shiny_leg, '');
for (const raw of ['CP 49', '9/12', '12:49', '']) assert.strictEqual(evidence(raw).shiny_leg, '');
assert.strictEqual(evidence('（ ４９ ）').shiny_leg, '49');
assert.strictEqual(evidence('（０）').shiny_leg, '0');
assert.strictEqual(evidence('(15)', { active_tab: 'egg' }).shiny_leg, '');
assert.strictEqual(evidence('(15)', { visible_query: '異色' }).shiny_leg, '');
const task = (imageIndex, values) => ({ imageIndex, imageResult: values });
let r = context.reconcileShinyLegendaryCounts({ shiny: '28', shiny_leg: '49' }, [task(0,{shiny:'28'}),task(1,{shiny_leg:'49'})]);
assert.strictEqual(r.result.shiny_leg, ''); assert.strictEqual(r.result.shiny, ''); assert.strictEqual(r.conflicts.length, 1);
assert(context.formatCountConsistencyReview(r).includes('圖2'));
r = context.reconcileShinyLegendaryCounts({ shiny: '28', shiny_leg: '15' }, []);
assert.strictEqual(r.result.shiny_leg, '15'); assert.strictEqual(r.result.shiny, '28');
r = context.reconcileShinyLegendaryCounts({ shiny_leg: '49', legendary: '' }, []);
assert.strictEqual(r.result.shiny_leg, '49');
assert(source.includes("canvas.toDataURL('image/png')"));
assert(source.includes("classification.image_type !== 'SHINY_LEGENDARY_SCREEN'"));
console.log('Shiny legendary evidence and consistency tests passed; 0 live OpenAI requests.');
