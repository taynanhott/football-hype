const fs=require('fs'), path=require('path');
const {chromium}=require('@playwright/test');
const vite=require.resolve('vite',{paths:['./apps/client']});
const esbuild=require(require.resolve('esbuild',{paths:[path.dirname(vite)]}));
(async()=>{
const source=`
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createWorld, executeCommand, applyEvent, stableId} from '@football/domain';
import {ClubCalendar} from './features/competitions/club-calendar';
import {TicketPricing} from './features/finance/ticket-pricing';
import {useGameStore} from './store/game-store';
const initial=createWorld({id:stableId(2,1),userId:stableId(2,2),name:'Visual',mode:'offline',now:Date.parse('2026-10-26T15:00:00Z')}).value;
const clubId=initial.participants[0].clubId;
const fixture=initial.fixtures.find(f=>f.homeId===clubId&&!f.group);
initial.cups=[];initial.fixtures=[fixture,{...fixture,id:'future-home',scheduledAt:fixture.scheduledAt+7*86400000}];initial.lastProcessedAt=fixture.scheduledAt-12*3600000;
function App(){const [state,setState]=useState(initial);useGameStore.setState({connected:true,busy:false,send:command=>{const result=executeCommand(state,command,state.administratorId,initial.createdAt,stableId(3,state.revision+1));if(!result.ok)throw Error(result.error.message);const next=applyEvent(state,result.value);if(!next.ok)throw Error(next.error.message);setState(next.value);}});return <main style={{padding:16}}><div className="dashboard-middle"><section className="arena-card"><div className="arena-canvas"/></section><ClubCalendar state={state} clubId={clubId}/></div><TicketPricing state={state} clubId={clubId}/></main>};
createRoot(document.getElementById('root')).render(<App/>);
`;
const result=await esbuild.build({stdin:{contents:source,resolveDir:path.resolve('apps/client/src'),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},logLevel:'silent'});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://localhost/calendar-test',route=>route.fulfill({contentType:'text/html',body:'<html><head><style>'+fs.readFileSync('apps/client/src/ui/styles.css','utf8')+'</style></head><body><div id="root"></div></body></html>'}));
await page.goto('http://localhost/calendar-test');
await page.addScriptTag({content:result.outputFiles[0].text});
await page.locator('.club-calendar-event').first().click();
await page.locator('dialog[open]').waitFor();
const labels=await page.locator('.game-probability-labels').innerText();
if(!labels.includes('Vitória')||!labels.includes('Derrota'))throw Error('Missing odds');
await page.screenshot({path:'.test-temp/game-details.png'});
await page.keyboard.press('Escape');
await page.locator('dialog').waitFor({state:'detached'});
const slider=page.getByRole('slider',{name:/Preço do ingresso/});
const minimum=Number(await slider.getAttribute('min'));
const maximum=Number(await slider.getAttribute('max'));if(Number(await slider.getAttribute('step'))!==2500)throw Error('Ticket increment is not R');if((await page.locator('.ticket-slider-limits').innerText()).includes('100%'))throw Error('Sellout price remains visible');
if(await page.locator('.ticket-pricing select').count())throw Error('Per-game selector remains');
if(await page.getByRole('button',{name:'Salvar preço'}).count())throw Error('Manual save remains');
await slider.focus();await slider.press('Home');
await page.waitForFunction(()=>document.querySelector('.ticket-price-status').textContent.includes('salvo automaticamente')&&document.querySelector('.ticket-price-status').textContent.includes(document.querySelector('.home-ticket-slider > label strong').textContent));
if(!(await page.locator('.ticket-forecast small').first().innerText()).includes('100%'))throw Error('Minimum does not show 100%');
await page.getByRole('slider').focus();await page.getByRole('slider').press('End');
await page.waitForFunction(()=>document.querySelector('.ticket-price-status').textContent.includes('salvo automaticamente')&&document.querySelector('.ticket-price-status').textContent.includes(document.querySelector('.home-ticket-slider > label strong').textContent));
if(!(await page.locator('.ticket-forecast small').first().innerText()).startsWith('1%'))throw Error('Maximum does not show 1%');
if((await page.locator('.ticket-forecast strong').nth(2).innerText())!=='1%')throw Error('Global price does not apply to all fixtures');
const formatted=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(maximum/100);
await page.locator('.club-calendar-event').first().click();
if(!(await page.locator('.game-details-facts').innerText()).includes(formatted))throw Error('Automatically saved global price missing in modal');
await page.keyboard.press('Escape');
console.log('PASS automatic slider saving:',minimum,maximum);
if(await page.getByText('Rotina sugerida entre jogos · Placares: mandante à esquerda',{exact:true}).count())throw Error('Legend remains');
if(!await page.locator('.training-day .club-calendar-routine-icon svg').count())throw Error('Gym icon missing');
await page.screenshot({path:'.test-temp/ticket-pricing.png',fullPage:true});
for(const width of [1600,1100,390]){
await page.setViewportSize({width,height:1000});
const dimensions=await page.evaluate(()=>{const a=document.querySelector('.arena-card'),c=document.querySelector('.club-calendar');return{same:a.offsetHeight===c.offsetHeight&&a.offsetWidth===c.offsetWidth,overflow:c.scrollHeight>c.clientHeight,clipped:[...document.querySelectorAll('.club-calendar-day')].filter(e=>e.scrollHeight>e.clientHeight).length};});
console.log('layout',width,dimensions);if(!dimensions.same||dimensions.overflow||dimensions.clipped)throw Error('Calendar layout regression');}
if(errors.length)throw Error(errors.join('\n'));
console.log('PASS: calendar modal, Escape, odds, price preview, save, refreshed price, legend removal, icons, responsive sizing');
} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});




