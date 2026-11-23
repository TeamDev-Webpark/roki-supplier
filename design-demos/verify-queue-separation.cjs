'use strict';
const {run,reset,login,switchTo,store,approveStep,assert}=require('./_env.cjs');
run('internal approvals and Supplier waiting are separate queues',async({base,context,shot})=>{
 const p=await context.newPage(),s=await context.newPage();
 // Populated presentation: counts must match actual rows and exclude other owners.
 await login(p,base,'roki','r-issue','internal-pending');
 const records=await store(p),internal=records.priceRequests.filter(r=>r.approvalStatus.startsWith('Pending')&&r.deliveryStatus==='NotSent');
 assert.equal(await p.locator('[data-rfq-row]').count(),internal.length);
 for(const r of internal)assert.equal(await p.locator(`[data-rfq-row="${r.id}"]`).count(),1);
 await p.goto(base+'roki.html#supplier-waiting');
 const waiting=await p.locator('[data-request-row]').evaluateAll(rows=>rows.map(r=>({notice:r.dataset.requestRow,item:r.dataset.itemRow})));
 assert(waiting.length>0);
 for(const row of waiting){
  const n=records.notifications.find(n=>n.id===row.notice),r=records.priceRequests.find(r=>r.id===n.priceRequestId),q=records.quotes.filter(q=>q.requestedBy===n.id&&q.item===row.item).at(-1);
  assert.equal(r.deliveryStatus,'Sent');assert.equal(r.approvalStatus,'Approved');
  assert(!q||['Draft','Supplier approval','Reverted','Rejected'].includes(q.status),'WEBPARK reviews and completed offers are excluded');
 }
 const options=await p.locator('#status-filter option').evaluateAll(opts=>opts.map(o=>o.value));
 assert.deepEqual(options,['','waiting','preparing','correction','retry']);
 assert(!options.includes('review')&&!options.includes('done'));
 await p.goto(base+'roki.html#overview');
 assert.equal(await p.locator('[data-home-queue="internal"] [data-home-rfq]').count(),Math.min(5,internal.length));
 assert.equal(await p.locator('.side-nav [href="#internal-pending"] .count').innerText(),String(internal.length));
 assert.equal(await p.locator('.side-nav [href="#supplier-waiting"] .count').innerText(),String(waiting.length));
 await p.evaluate(()=>I18N.set('th'));await shot(p,'webpark-separated-queues-th.png');
 await p.setViewportSize({width:390,height:844});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await shot(p,'webpark-separated-queues-mobile-th.png',{fullPage:false});
 await p.setViewportSize({width:1500,height:1100});

 // Real transitions: internally approved is not waiting for Supplier until Issue sends.
 await reset(p,base,'roki');await login(p,base,'roki','r-issue','request-new');
 await p.locator('[data-select="i2"]').check();await p.locator('[data-action="notify"]').click();
 await p.locator('#rfq-purpose').fill('Verify the two queues move only at the correct handoff.');
 await p.locator('[data-action="rfq-save-submit"]').click();
 const id=(await p.evaluate(()=>location.hash)).split('/')[1];
 await p.goto(base+'roki.html#internal-pending');assert.equal(await p.locator(`[data-rfq-row="${id}"]`).count(),1);
 await p.goto(base+'roki.html#supplier-waiting');assert.equal(await p.locator('[data-item-row="i2"]').count(),0);
 const act=async action=>{await p.locator(`[data-rfq="${action}"]`).click();await p.locator('#rfq-confirm').check();await p.locator('[data-action="rfq-confirm"]').click()};
 await switchTo(p,base,'roki','r-check','request-register/'+id);await act('advance');
 await switchTo(p,base,'roki','r-approve','internal-pending');assert.equal(await p.locator(`[data-rfq-row="${id}"]`).count(),1);
 await p.goto(base+'roki.html#request-register/'+id);await act('advance');
 await p.goto(base+'roki.html#internal-pending');assert.equal(await p.locator(`[data-rfq-row="${id}"]`).count(),0);
 await p.goto(base+'roki.html#supplier-waiting');assert.equal(await p.locator('[data-item-row="i2"]').count(),0);
 await switchTo(p,base,'roki','r-issue','request-dispatch');assert.equal(await p.locator(`[data-rfq-row="${id}"]`).count(),1);
 await p.goto(base+'roki.html#request-register/'+id);await act('send');
 const n=(await store(p)).notifications.at(-1);
 await p.goto(base+'roki.html#supplier-waiting');assert.equal(await p.locator(`[data-request-row="${n.id}"]`).count(),1);
 await login(s,base,'supplier','s2-issue','requests');await s.locator(`[data-request="${n.id}"]`).click();
 await s.locator('#remark').fill('Supplier confirmation for queue handoff.');await s.locator('button[type="submit"]').click();
 const qid=(await s.evaluate(()=>location.hash)).split('/')[1];
 await p.reload();assert.equal(await p.locator(`[data-request-row="${n.id}"]`).count(),1,'Supplier internal approval remains with Supplier');
 assert.equal(await p.locator(`[href="#quote/${qid}"]`).count(),0,'Supplier draft remains private');
 await switchTo(s,base,'supplier','s2-approve','quote/'+qid);await approveStep(s);
 await p.reload();assert.equal(await p.locator(`[data-request-row="${n.id}"]`).count(),0,'Submitted offer leaves Supplier waiting');
 await p.goto(base+'roki.html#approvals');assert.equal(await p.locator(`[data-open="${qid}"]`).count(),1);
 await p.goto(base+'roki.html#quote/'+qid);await p.locator('[data-transition="revert"]').click();
 await p.locator('#action-reason').fill('Supplier must clarify the material rate.');await p.locator('[data-action="confirm-transition"]').click();
 await p.goto(base+'roki.html#supplier-waiting');assert.equal(await p.locator(`[data-request-row="${n.id}"]`).count(),1,'Return re-enters Supplier waiting');
 await p.goto(base+'roki.html#internal-pending');assert.equal(await p.locator(`[data-rfq-row="${id}"]`).count(),0,'Sent request never re-enters internal request approval');
 await s.goto(base+'supplier.html#internal-pending');assert.equal(await s.locator('[data-rfq-row]').count(),0);
});
