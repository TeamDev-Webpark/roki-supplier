'use strict';
const {run,login,switchTo,assert}=require('./_env.cjs');
run('operational queues, schedules and current workflow',async({base,context,shot})=>{
 const p=await context.newPage();await login(p,base,'roki','r-issue','schedule');await p.evaluate(()=>I18N.set('th'));
 const model=await p.evaluate(()=>({due:deskDueParts().map(i=>i.id),sent:deskSentPairs().filter(r=>!r.phase.historical&&r.phase.key==='waiting').map(r=>r.i.id),new:deskNewParts().map(i=>i.id),draft:rfqDrafts().map(r=>r.id),latest:deskLatestNotice('i6')?.id}));
 assert(!model.due.some(id=>model.sent.includes(id)));assert(!model.new.some(id=>model.due.includes(id)));
 assert.equal(model.latest,'N-DEMO-001','Actual send dates outrank fixture insertion order');
 assert.equal(await p.locator('.side-nav [href="#request-drafts"]').count(),0);assert.equal(await p.locator('.side-nav [href="#schedule-active"]').count(),1,'All review schedules is in the menu');assert.equal(await p.locator('.side-nav [href="#approvals"]').first().evaluate(el=>el===document.querySelector('.side-nav a')),true,'My tasks is the first menu');assert.equal(await p.locator('.side-nav [href="#request-new"]').count(),1);
 assert.equal(await p.locator('[data-desk-section="due"] [data-plan-item]').count(),Math.min(model.due.length,12));
 assert.equal(await p.locator('[data-desk-row]').count(),Math.min(await p.evaluate(()=>deskVisibleRows(deskRows(),'active').length),12),'Request follow-up lists the requests in progress');assert.equal(await p.locator('button[data-desk-stage="history"]').count(),1,'Stage tabs live on the follow-up page');assert.equal(await p.locator('.side-nav [href="#request-register"]').count(),0,'No separate All requests page');
 const displayed=await p.locator('[data-desk-section="due"] [data-plan-item]').evaluateAll(els=>els.map(el=>el.dataset.planItem));assert(displayed.every(id=>model.due.includes(id)));
 await p.evaluate(()=>{window.__deskSidebar=document.querySelector('.sidebar');window.__deskNav=document.querySelector('.side-nav')});
 await p.locator('.desk-totals [href="#schedule-active"]').click();await p.locator('[data-desk-table="schedules"]').waitFor();
 assert.equal(await p.evaluate(()=>document.querySelector('.sidebar')===window.__deskSidebar&&document.querySelector('.side-nav')===window.__deskNav),true,'Sidebar containers survive navigation');
 await p.locator('[data-desk-filter="stage"]').selectOption('upcoming');
 const future=await p.locator('[data-plan-item]').evaluateAll(els=>els.map(el=>el.dataset.scheduleState));assert(future.every(s=>s==='upcoming'));
 await p.goto(base+'roki.html#request-new');const fresh=await p.locator('[data-plan-item]').evaluateAll(els=>els.map(el=>el.dataset.planItem));assert(fresh.every(id=>model.new.includes(id)));
 await p.goto(base+'roki.html#request-register');
 assert.equal(await p.evaluate(()=>{const a=deskRows().length;return a===deskRows().length&&a===deskRows().length}),true,'Repeated model reads never append saved records to the sent-cycle cache');
 for(const group of ['supplier','issue','check','approve','history']){
  await p.locator(`button[data-desk-stage="${group}"]`).click();
  const expected=await p.evaluate(group=>deskVisibleRows(deskRows(),group).length,group),rows=await p.locator('[data-desk-row]').count();assert.equal(rows,Math.min(12,expected));
  assert.equal(Number(await p.locator(`button[data-desk-stage="${group}"]>span`).innerText()),expected);
  const bad=await p.locator('[data-desk-row]').evaluateAll((els,group)=>els.filter(el=>group==='history'?false:el.dataset.deskStage!==group).length,group);assert.equal(bad,0);
  assert.equal(await p.locator('[data-desk-row] .desk-actions .button').count(),rows,'Exactly one action per row');
  assert.equal(await p.locator('[data-desk-row] .desk-stage .badge').count(),rows,'Exactly one stage badge per row');
  if(['issue','check','approve'].includes(group))assert.equal(await p.locator('[data-desk-row] .desk-late').count(),0,'Supplier deadline does not flag WEBPARK review as late');
 }
 await p.locator('button[data-desk-stage="supplier"]').click();
 const privateRow=await p.evaluate(()=>deskVisibleRows(deskRows(),'supplier').find(r=>r.phase.q&&['Draft','Supplier approval'].includes(r.phase.q.status))?.phase.q.id);
 if(privateRow)assert.equal(await p.locator(`[data-quote-access="${privateRow}"]`).count(),0,'Supplier drafts remain private');
 await p.locator('[data-desk-query="request-register"]').fill('N-DEMO-001');assert.equal(await p.locator('[data-desk-row]').count(),1,'Search includes original sent request ID');
 await p.locator('[data-desk-query="request-register"]').fill('');
 await switchTo(p,base,'roki','r-check','request-register');await p.locator('button[data-desk-stage="check"]').click();
 const href=await p.locator('[data-desk-row] .desk-actions .primary').first().getAttribute('href');assert(href?.startsWith('#quote/'));
 await p.locator('[data-desk-row] .desk-actions .primary').first().click();await p.locator('[data-timeline-phase="after"] .desk-timeline').waitFor();assert.equal(await p.locator('[data-timeline-phase="after"] .desk-timeline li').count(),5);
 const owners=await p.locator('[data-timeline-phase="after"] .desk-timeline li strong').allTextContents();assert.equal(owners.length,5);assert(owners[0].includes('Issue'));assert(owners[1].includes('Approve'));assert(owners[2].includes('Issue'));assert(owners[3].includes('Check'));assert(owners[4].includes('Approve'));
 assert.equal(await p.locator('.side-nav a.active').getAttribute('href'),'#approvals');
 await p.goto(base+'roki.html#quote/Q-2026-0011');assert.equal(await p.locator('[data-timeline-phase="after"] .desk-timeline li').count(),5,'Imported older quote uses current workflow presentation');
 assert.equal(await p.locator('[data-timeline-phase="before"] .desk-legacy-history').count(),1,'Earlier internal approvals are retained in collapsed history');
 await switchTo(p,base,'supplier','s1-issue','requests');assert.equal(await p.locator('button[data-desk-stage="unsent"]').count(),0);
 const leaks=await p.evaluate(()=>deskRows().some(r=>r.n.supplier!==user.supplier));assert.equal(leaks,false);
 await switchTo(p,base,'roki','r-issue','request-register');await p.evaluate(()=>I18N.set('th'));await p.locator('button[data-desk-stage="supplier"]').click();await shot(p,'webpark-operations-request-queue-th.png',{fullPage:false});
 await p.goto(base+'roki.html#schedule');await shot(p,'webpark-operations-due-sent-th.png',{fullPage:false});
 await p.goto(base+'roki.html#schedule-active');await shot(p,'webpark-operations-active-schedules-th.png',{fullPage:false});
 await p.goto(base+'roki.html#quote/Q-2026-0011');await shot(p,'webpark-operations-current-timeline-th.png',{fullPage:false});
 for(const path of ['schedule','schedule-active','request-new','request-register','quotes']){await p.setViewportSize({width:390,height:844});await p.goto(base+'roki.html#'+path);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Mobile '+path)}
 console.log('Verified disjoint planning lists, chronological latest requests, queue counts, privacy, single row actions, no false overdue, five-step price approval, and stable sidebar.');
}).catch(e=>{console.error(e);process.exitCode=1});
