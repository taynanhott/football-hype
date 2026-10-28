import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createWorld,groupFixtures,qualifyCupGroups,cupGroupTables,advanceBracket} from '../packages/domain/src/index.ts';
import {IDS,unwrap} from '../tests/fixtures/domain.ts';
import {CupBracket} from '../apps/client/src/features/competitions/cup-bracket.tsx';
import {StandingsTable} from '../apps/client/src/features/competitions/standings-table.tsx';
const require=createRequire(new URL('../apps/client/package.json',import.meta.url));
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const now=Date.parse('2026-10-27T15:00:00Z');let state=unwrap(createWorld({id:IDS.league,userId:IDS.user,name:'Preview',mode:'offline',now}));
const ids=state.clubs.ids.filter(id=>state.clubs.byId[id]?.division==='A').slice(0,16);
const fixtures=groupFixtures(ids,'libertadores',Array.from({length:6},(_,i)=>now+i*86400000));
const result=(fixtureId,homeId,awayId,homeGoals,awayGoals)=>({fixtureId,homeId,awayId,homeGoals,awayGoals,seed:1,scorers:[],attendance:0,revenue:0,status:'finished'});
state=qualifyCupGroups({...state,fixtures,cups:[],results:fixtures.map(f=>result(f.id,f.homeId,f.awayId,2,1))});
for(let round=0;round<2;round++)for(const node of state.cups.filter(n=>n.round===round)){
state.results.push(result(`${node.id}:first`,node.homeId,node.awayId,2,0),result(node.id,node.awayId,node.homeId,1,1));
state={...state,cups:[...unwrap(advanceBracket(state.cups,node.id,node.homeId!))]};}
const final=state.cups.find(n=>n.round===2)!;state.results.push(result(`${final.id}:first`,final.homeId,final.awayId,2,0));
const group=cupGroupTables(state,'libertadores')[0]!;
const html=renderToStaticMarkup(React.createElement('main',{style:{maxWidth:1000,margin:'24px auto',padding:16}},React.createElement(StandingsTable,{state,table:group.table,competitionId:'libertadores',clubId:ids[0],group:group.group}),React.createElement('div',{style:{marginTop:24}},React.createElement(CupBracket,{state,competitionId:'libertadores',clubId:ids[0]}))));
writeFileSync(new URL('./cup-preview.html',import.meta.url),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${readFileSync(new URL('../apps/client/src/ui/styles.css',import.meta.url),'utf8')}</style><body>${html}</body></html>`);
console.log('Rendered group table and quarterfinals, semifinals, final with both legs.');
