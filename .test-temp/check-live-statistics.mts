import assert from 'node:assert/strict';
import { liveMatchStatistics } from '../apps/client/src/features/matches/live-statistics.ts';
import { createWorld, playNextBatch } from '../packages/domain/src/index.ts';
import { IDS, unwrap } from '../tests/fixtures/domain.ts';
const now = Date.parse('2026-10-27T15:00:00Z');
const state = unwrap(playNextBatch(unwrap(createWorld({id:IDS.league,userId:IDS.user,name:'Check',mode:'offline',now})),now));
const result=state.results[0]!;
let prior=liveMatchStatistics(result,0);
for(let minute=1;minute<90;minute++){
 const current=liveMatchStatistics(result,minute);
 for(const side of ['home','away'] as const){
  for(const key of ['shots','passes','corners','fouls','xg'] as const)assert.ok(current[side][key]>=prior[side][key]);
  assert.equal(current[side].shots,(result.actions??[]).filter(a=>a.type==='shot'&&a.side===side&&a.minute<=minute).length);
 }
 assert.equal(current.home.possession+current.away.possession,100);
 prior=current;
}
assert.deepEqual(liveMatchStatistics(result,90),result.statistics);
console.log('Live counters follow visible actions; no future shots; possession totals 100%; final statistics preserved.');
