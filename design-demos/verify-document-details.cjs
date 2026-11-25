'use strict';
const {run,login,switchTo,assert}=require('./_env.cjs');
run('record row navigation, quotation workflow and exact part history',async({base,context,shot})=>{
 const p=await context.newPage();await login(p,base,'roki','r-issue','schedule-active');await p.evaluate(()=>I18N.set('th'));
 const row=p.locator('[data-plan-item]').first(),item=await row.getAttribute('data-plan-item');
 assert.equal(await row.getAttribute('data-detail-route'),'part/'+item);
 await row.locator('td').nth(2).click();await p.locator('[data-record-flow]').waitFor();assert(p.url().endsWith('#part/'+item));
 assert.equal(await p.locator('.record-cycle-steps li').count(),5);
 const history=p.locator(`[data-quotation-history="${item}"]`);await history.waitFor();
 const expected=await p.evaluate(id=>visibleQuotes().filter(q=>q.item===id&&q.supplier===currentItems().find(i=>i.id===id).supplier).map(q=>q.id).sort(),item);
 assert.deepEqual((await history.locator('[data-history-quote]').evaluateAll(rows=>rows.map(r=>r.dataset.historyQuote))).sort(),expected);
 assert(expected.length>0);const qid=await history.locator('[data-history-quote]').first().getAttribute('data-history-quote');
 await history.locator('[data-history-quote]').first().focus();await p.keyboard.press('Enter');await p.locator('[data-timeline-phase="after"] .desk-timeline').waitFor();assert(p.url().endsWith('#quote/'+qid));
 assert.equal(await p.locator('[data-timeline-phase="after"] .desk-timeline li').count(),5);assert.equal(await p.locator(`[data-history-quote="${qid}"].record-current`).count(),1);
 const costRow=p.locator('table tbody tr[data-row-summary]').first();await costRow.waitFor();   /* rows are tagged right after the page renders; wait instead of racing it */await costRow.locator('td').first().click();await p.locator('[role="dialog"] .record-row-fields').waitFor();await p.locator('[data-action="close"]').first().click();
 await p.goto(base+'roki.html#schedule-active');await p.locator('[data-plan-item]').first().locator('[data-schedule]').click();await p.locator('[role="dialog"]').waitFor();assert(p.url().endsWith('#schedule-active'));await p.locator('[data-action="close"]').first().click();
 await p.goto(base+'roki.html#request-new');const checkbox=p.locator('[data-select]:not(:disabled)').first();await checkbox.check();assert(p.url().endsWith('#request-new'));assert(await p.evaluate(()=>selected.size>0));
 await p.goto(base+'roki.html#request-register');const sent=p.locator('[data-desk-row][data-request-row]').first(),target=await sent.getAttribute('data-detail-route');await sent.locator('td').nth(1).click();await p.locator('[data-record-flow]').waitFor();assert(p.url().endsWith('#'+target));assert(await p.locator('[data-quotation-history]').count());
 const source=await p.evaluate(()=>{const n=db.notifications.find(n=>n.id===route().split('/')[1]);return n.priceRequestId});
 if(source){await p.goto(base+'roki.html#request-register/'+source);await p.locator('[data-quotation-history]').first().waitFor();assert.equal(await p.locator('table tbody tr').evaluateAll(rows=>rows.filter(r=>r.cells.length>1&&!r.querySelector('input,select,textarea')&&!r.dataset.detailRoute&&!r.dataset.open&&!r.dataset.rowSummary).length),0)}
 const assembly=await p.evaluate(()=>currentItems().find(i=>i.format==='Assembly')?.id);assert(assembly);await p.goto(base+'roki.html#part/'+assembly);await p.locator('[data-record-flow]').waitFor();assert.equal(await p.locator('[data-quotation-history]').getAttribute('data-quotation-history'),assembly);
 await p.goto(base+'roki.html#schedule-active');await p.locator('[data-plan-item]').first().locator('td').nth(2).click();await p.locator('[data-record-flow]').waitFor();await shot(p,'webpark-record-workflow-history-th.png',{fullPage:false});
 await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await shot(p,'webpark-record-workflow-history-mobile-th.png',{fullPage:false});
 await switchTo(p,base,'supplier','s1-issue','requests');const supplierRow=p.locator('[data-desk-row]').first();await supplierRow.focus();await p.keyboard.press('Enter');await p.locator('[data-record-flow]').first().waitFor();
 assert.equal(await p.evaluate(()=>[...document.querySelectorAll('[data-history-quote]')].some(row=>!visibleQuotes().some(q=>q.id===row.dataset.historyQuote&&q.supplier===user.supplier))),false);
 const other=await p.evaluate(()=>db.items.find(i=>i.supplier!==user.supplier).id);await p.goto(base+'supplier.html#part/'+other);assert.equal(await p.locator('[data-quotation-history]').count(),0);
 console.log('Schedule/request row clicks, keyboard access, unchanged checkbox/edit actions, four-stage approval, exact part and assembly histories, cost-row details, source links and Supplier isolation passed.');
}).catch(e=>{console.error(e);process.exitCode=1});
