const fs = require('fs');
const ts = require('typescript');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (mod, path) => mod._compile(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, path);
const React = require('../apps/client/node_modules/react');
const { renderToStaticMarkup } = require('../apps/client/node_modules/react-dom/server');
const { chromium } = require('@playwright/test');

(async () => { const shared = await import('../packages/shared/dist/index.js');
 const Module = require('module'); const originalLoad = Module._load;
 Module._load = function(id, ...args) { return id === '@football/shared' ? shared : originalLoad.call(this, id, ...args); };
 const { ClubCalendar } = require('../apps/client/src/features/competitions/club-calendar.tsx');
 const browser = await chromium.launch({headless:true, channel:'msedge'});
 const page = await browser.newPage();
 for (const [width, month] of [[1600, 9], [1100, 7], [390, 7]]) {
 const at = Date.UTC(2026, month, 28, 15);
 const state = { lastProcessedAt: at, cups: [], results: [], clubs: { byId: {a:{name:'Atlético-MG',abbreviation:'CAM'}, b:{name:'Vasco',abbreviation:'VAS'}}}, fixtures:[{id:'match',homeId:'a',awayId:'b',competitionId:'serie-a',scheduledAt:at,round:0}]};
 const html = renderToStaticMarkup(React.createElement(ClubCalendar, {state,clubId:'a'}));
 await page.setViewportSize({width,height:800});
 await page.setContent('<style>'+fs.readFileSync('apps/client/src/ui/styles.css','utf8')+'</style><main style="padding:16px"><div class="dashboard-middle"><section class="arena-card"><div class="arena-canvas"></div></section>'+html+'</div></main>');
 const report = await page.evaluate(() => { const a=document.querySelector('.arena-card'),c=document.querySelector('.club-calendar'); return {arena:[a.offsetWidth,a.offsetHeight],calendar:[c.offsetWidth,c.offsetHeight],overflow:c.scrollHeight>c.clientHeight, clipped:[...document.querySelectorAll('.club-calendar-day')].filter(e=>e.scrollHeight>e.clientHeight).length}; });
 console.log(width, report);
 if(report.overflow || report.clipped || report.arena[0]!==report.calendar[0] || report.arena[1]!==report.calendar[1]) throw new Error('Layout mismatch');
 await page.screenshot({path:'.test-temp/calendar-'+width+'.png'});
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});




