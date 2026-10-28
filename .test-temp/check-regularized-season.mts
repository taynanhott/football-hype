import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {worldStateSchema,SERIE_C_2026,isSerieC2026} from '../packages/shared/src/index.ts';
import {playNextBatch} from '../packages/domain/src/index.ts';
const file=new URL('../apps/server/.local/real-leagues/d172ec20-9126-4fb4-af4a-c0649b79a7a5.json.gz',import.meta.url);
const saved=JSON.parse(gunzipSync(readFileSync(file)).toString());
let state=worldStateSchema.parse(saved.state);
const clubs=Object.values(state.clubs.byId).filter(c=>c.country==='BR'&&c.division==='C');
assert.equal(clubs.length,20);assert.ok(clubs.every(c=>isSerieC2026(c.name)));assert.ok(SERIE_C_2026.every(name=>clubs.some(c=>c.name===name)));
assert.equal(state.fixtures.filter(f=>f.competitionId==='serie-c').length,190);
assert.ok(!state.fixtures.some(f=>f.competitionId.startsWith('estadual')));
for(const id of ['copa-norte','copa-nordeste','copa-verde','copa-sul-sudeste']){
 const fixtures=state.fixtures.filter(f=>f.competitionId===id);assert.equal(fixtures.length,96);const ids=new Set(fixtures.flatMap(f=>[f.homeId,f.awayId]));assert.equal(ids.size,32);for(const team of ids)assert.equal(fixtures.filter(f=>f.homeId===team||f.awayId===team).length,6);
}
for(let step=0;step<8&&!state.results.some(r=>r.fixtureId.startsWith('serie-c:'));step++){
 const result=playNextBatch(state,Date.now()+step*100000);if(!result.ok)throw new Error(result.error.message);state=result.value;
}
const matches=state.results.filter(r=>r.fixtureId.startsWith('serie-c:'));assert.equal(matches.length,10);
console.log(`Career validated: 20 official Série C clubs, 190 fixtures; first round simulated with ${matches.length} matches. Regional cups each have 32 clubs and six group games. Saved career was not advanced by this check.`);
