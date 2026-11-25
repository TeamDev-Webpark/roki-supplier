'use strict';
const fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm');
const {run,switchTo,assert}=require('./_env.cjs');

// Every shared global function has one owner, instead of depending on which
// script happened to load last. Check the exact script lists used by both portals.
for(const portal of ['roki','supplier']){
 const html=fs.readFileSync(path.join(__dirname,portal+'.html'),'utf8');
 const files=[...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
 assert.equal(new Set(files).size,files.length,portal+' must load each module once');
 const owners=new Map();
 for(const file of files){
  const source=fs.readFileSync(path.join(__dirname,file),'utf8');
  new vm.Script(source,{filename:file});
  for(const match of source.matchAll(/^(?:async )?function\s+(\w+)\s*\(/gm)){
   const name=match[1];
   assert(!owners.has(name),`${portal}: ${name} is defined by both ${owners.get(name)} and ${file}`);
   owners.set(name,file);
  }
 }
 assert.equal(owners.get('workflowOverview'),'dashboard.js');
 assert.equal(owners.get('activeScheduleView'),'schedule-register.js');
 assert.equal(owners.get('printView'),'quotation-sheet.js');
}

async function snapshot(page){
 // Let translation and table/form decorators finish before comparing renders.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('#app > .layout').count(),1);
 assert.equal(await page.locator('.main > .content').count(),1);
 assert.equal(await page.getByText('This view could not be loaded.',{exact:false}).count(),0);
 return page.locator('.main > .content').evaluate(el=>({
  text:el.innerText,
  headings:[...el.querySelectorAll('h1,h2')].map(n=>n.textContent),
  tables:[...el.querySelectorAll('table')].map(n=>({class:n.className,heads:[...n.querySelectorAll('th')].map(th=>th.textContent)})),
  dashboard:!!el.querySelector('.dash-hero'),
  schedule:!!el.querySelector('#schedule-advanced'),
  sheet:el.querySelector('[data-quotation-sheet]')?.dataset.quotationSheet||null
 }));
}

run('one consistent view on initial load, reload and navigation',async({base,context})=>{
 const page=await context.newPage();let checked=0;
 await page.goto(base+'roki.html');
 for(const [portal,account] of [['roki','r-issue'],['roki','r-check'],['roki','r-approve'],...['s1','s2','s3'].flatMap(s=>[['supplier',s+'-issue'],['supplier',s+'-approve']])]){
  await switchTo(page,base,portal,account,'overview');
  await page.evaluate(()=>I18N.set('th'));
  await page.reload();
  assert.equal(await page.locator('.dash-hero').count(),1,account+' must load the current dashboard immediately');
  const routes=await page.evaluate(()=>{
   const routes=navs().map(([,id])=>id),item=currentItems()[0];
   if(item)routes.push('part/'+item.id);
   const notice=db.notifications.find(n=>portal==='roki'||n.supplier===user.supplier);
   if(notice){
    routes.push('request-detail/'+notice.id+'/'+notice.items[0]);
    if(notice.forms?.[notice.items[0]])routes.push('print/preview~'+notice.id+'~'+notice.items[0]);
   }
   for(const format of ['Single Part','Assembly']){
    const q=visibleQuotes().find(q=>q.format===format);
    if(q)routes.push('quote/'+q.id,'print/'+q.id);
   }
   return [...new Set(routes)];
  });
  for(const route of routes){
   await page.goto(base+portal+'.html#'+route);
   const first=await snapshot(page);
   await page.evaluate(()=>render());
   assert.deepEqual(await snapshot(page),first,account+' #'+route+' initial load must match later rendering');
   await page.reload();
   assert.deepEqual(await snapshot(page),first,account+' #'+route+' reload must keep the same view');
   checked++;
  }
 }
 console.log(`Verified ${checked} routes across all nine accounts.`);
 await page.close();
}).catch(e=>{console.error(e);process.exitCode=1});
