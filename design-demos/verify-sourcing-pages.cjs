'use strict';
const {run,login,switchTo,assert}=require('./_env.cjs');
run('direct sourcing menus for all nine accounts',async({base,context,shot})=>{
 const p=await context.newPage();await p.goto(base+'roki.html');let count=0;
 for(const lang of ['en','th'])for(const [portal,account]of [['roki','r-issue'],['roki','r-check'],['roki','r-approve'],...['s1','s2','s3'].flatMap(s=>[['supplier',s+'-issue'],['supplier',s+'-approve']])]){
  await switchTo(p,base,portal,account,'overview');await p.evaluate(lang=>I18N.set(lang),lang);
  const routes=await p.locator('.side-nav a').evaluateAll(els=>els.map(e=>e.hash));assert(routes.length<=10);
  assert(!routes.includes('#internal-pending')&&!routes.includes('#request-review')&&!routes.includes('#request-dispatch'),'No pre-send approval queues');
  for(const route of [...routes,'#reports','#history','#outbox',...(portal==='roki'?['#suppliers','#exports']:[])]){
   await p.goto(base+portal+'.html'+route);await p.locator('.content h1').waitFor();
   assert.equal(await p.getByText('This view could not be loaded.',{exact:true}).count(),0);assert.equal(await p.getByText('This page is unavailable in this portal.',{exact:false}).count(),0);count++;
  }
 }
 await switchTo(p,base,'roki','r-issue','schedule');await p.evaluate(()=>I18N.set('th'));await shot(p,'webpark-direct-review-schedule-th.png',{fullPage:false});
 await p.locator('[data-desk-filter="cadence"][data-desk-key="schedule"]').selectOption('1');const id=await p.evaluate(()=>db.items.find(i=>i.demoScenario==='direct-1').id);await p.locator(`[data-select="${id}"]`).check();await p.locator('[data-action="notify"]').click();await shot(p,'webpark-direct-request-form-th.png',{fullPage:false});
 await p.locator('[data-rfq-cancel]').click();   /* the request form is a page now: Cancel returns to where it was opened */await p.goto(base+'roki.html#formulas');await shot(p,'webpark-formula-library-th.png',{fullPage:false});
 for(const route of ['#schedule','#request-register','#formulas','#records']){
  await p.setViewportSize({width:390,height:844});await p.goto(base+'roki.html'+route);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Mobile '+route);
 }
 console.log(`${count} role/menu/language screens; max 10 menu entries; mobile layouts passed.`);
}).catch(e=>{console.error(e);process.exitCode=1});
