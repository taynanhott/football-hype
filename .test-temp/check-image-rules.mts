import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {worldStateSchema} from '../packages/shared/src/index.ts';
import {playNextBatch} from '../packages/domain/src/index.ts';
const state=worldStateSchema.parse(JSON.parse(gunzipSync(readFileSync(new URL('../apps/server/.local/real-leagues/c577ec70-6a85-4ddf-b651-b8f9f514bf79.json.gz',import.meta.url))).toString()).state);
for(const id of ['serie-a','serie-b','serie-c'])assert.equal(state.fixtures.filter(f=>f.competitionId===id).length,380);
for(const id of ['libertadores','sul-americana','conferencia','europa'])assert.equal(state.fixtures.filter(f=>f.competitionId===id).length,96);
assert.equal(state.cups.filter(n=>n.competitionId==='copa-brasil').length,31);
let replay={...state,fixtures:[],cups:state.cups.filter(n=>n.competitionId==='copa-brasil'),results:[]} as typeof state;
for(let step=0;step<8&&replay.status!=='finished';step++){const next=playNextBatch(replay,Date.now()+step*100000);if(!next.ok)throw new Error(next.error.message);replay=next.value;}
assert.equal(replay.status,'finished');assert.equal(replay.results.length,32);const penalties=replay.results.filter(r=>r.penalties);assert.ok(penalties.length>0);assert.ok(penalties.every(r=>r.penalties!.home!==r.penalties!.away));
console.log(`Saved career validated: A/B/C 38 rounds, three continental groups plus European tournament; Copa do Brasil simulated to completion in 32 games, ${penalties.length} penalty shootouts. Saved season was not advanced.`);
