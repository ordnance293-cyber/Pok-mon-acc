const assert = require('assert');
const scheduler = require('../ai-scan-scheduler');
const helpers = require('../smart-hundo-helpers');
const deferred = () => { let resolve; let reject; const promise = new Promise((a,b)=>{resolve=a;reject=b}); return {promise,resolve,reject}; };
(async () => {
  let active=0,max=0; const gates=[deferred(),deferred(),deferred(),deferred()];
  const pending=scheduler.settleMapWithConcurrency([0,1,2,3],2,async value=>{active++;max=Math.max(max,active);try{return await gates[value].promise}finally{active--}});
  await Promise.resolve(); assert.equal(max,2); gates[1].reject(new Error('expected')); gates[0].resolve('a'); await Promise.resolve(); await Promise.resolve(); gates[2].resolve('c'); gates[3].resolve('d');
  const results=await pending; assert.deepEqual(results.map(x=>x.status),['fulfilled','rejected','fulfilled','fulfilled']); assert.equal(max,2); assert.equal(results[0].value,'a');
  let current=true,started=[]; const staleGate=deferred(); const stale=scheduler.settleMapWithConcurrency([0,1,2],1,async i=>{started.push(i);await staleGate.promise},{shouldContinue:()=>current}); await Promise.resolve(); current=false; staleGate.resolve(); await stale; assert.deepEqual(started,[0]);
  const card=(id,confidence=.9)=>({card_id:id,order:+id,row:1,column:+id,recognition_status:'recognized',base_species:'Mewtwo',canonical_official_name:'超夢',species_confidence:confidence,effective_form_id:'not_applicable',effective_shiny_state:'no',effective_lucky_state:'no',effective_favorite_state:'no',effective_rocket_state:'normal',effective_background_type:'none'});
  const healthy={card_operation_succeeded:true,structure:{structurally_complete:true},finish_reason:'stop',count:{valid:true,hundo_leg:'4'},card_result:{detected_card_count:4,enumeration_confidence:.95,cards:[1,2,3,4].map(String).map(card)}};
  assert.equal(scheduler.evaluateSmartHundoQuality(healthy,helpers).passed,true);
  assert.equal(scheduler.evaluateSmartHundoQuality({...healthy,structure:{structurally_complete:false}},helpers).passed,false);
  const small={...healthy,count:{valid:true,hundo_leg:'2'},card_result:{detected_card_count:2,enumeration_confidence:.95,cards:[card('1'),card('2')]}}; assert.equal(scheduler.evaluateSmartHundoQuality(small,helpers).passed,true);
  let cardRuns=0,countRuns=0; const retried=await scheduler.runSmartHundoJobWithQualityRetry({helpers,runCount:async()=>{countRuns++;return small.count},runCards:async()=>{cardRuns++;return cardRuns===1?null:small},combine:(cs,rs)=>rs.value||{...small,structure:{structurally_complete:false}},}); assert.equal(countRuns,1); assert.equal(cardRuns,2); assert.equal(retried.quality_passed,true);
  const shots=[{index:0,smartQueueIndex:0,cards:[card('1'),card('2')]},{index:2,smartQueueIndex:2,cards:[card('1'),card('2')]}]; const merged=scheduler.mergeSmartHundoScreenshotsAdjacent(shots,helpers); assert.equal(merged.cards.length,4); assert.equal(merged.overlap_decisions.length,0);
  console.log('AI scan scheduler, quality gate, retry, and adjacent merge tests passed.');
})().catch(error=>{console.error(error);process.exit(1)});
