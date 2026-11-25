'use strict';
const {run,login,store,assert}=require('./_env.cjs');
run('sample-data buttons fill the long forms',async({base,context})=>{
 const p=await context.newPage();await p.addInitScript(()=>{try{Object.defineProperty(crypto,'randomUUID',{value:undefined})}catch{}});   /* plain-http LAN address: no crypto.randomUUID */
 await login(p,base,'supplier','s1-issue','approvals');
 const target=await p.evaluate(()=>{const n=db.notifications.find(n=>n.supplier==='s1'&&n.items.some(id=>!db.quotes.some(q=>q.item===id&&q.requestedBy===n.id)));return {n:n.id,item:n.items.find(id=>!db.quotes.some(q=>q.item===id&&q.requestedBy===n.id))}});
 await p.evaluate(t=>newQuote(t.item,t.n),target);await p.locator('#quote-form').waitFor();
 await p.locator('[data-demo-fill="quote"]').click();
 assert.notEqual(await p.locator('#remark').inputValue(),'');
 await p.locator('#quote-form button[type="submit"]').click();
 const q=(await store(p)).quotes.find(q=>q.item===target.item&&q.requestedBy===target.n);
 assert.equal(q?.status,'Supplier approval','Filled quotation passes validation and is issued');
 await login(p,base,'roki','r-issue','request-new');
 const id=await p.locator('[data-plan-item]').first().getAttribute('data-plan-item');
 await p.locator(`[data-select="${id}"]`).check();await p.locator('[data-action="notify"]').click();
 await p.locator('[data-demo-fill="request"]').click();
 assert.notEqual(await p.locator(`[data-request-formula="${id}"]`).inputValue(),'');assert.notEqual(await p.locator('#rfq-purpose').inputValue(),'');
 await p.locator('[data-action="send-notifications"]').click();
 assert((await store(p)).priceRequests.some(r=>r.items.includes(id)&&r.status==='Draft'),'Filled request saves');
 /* part page leads straight into the schedule form, and the fill button works repeatedly with different data */
 const titles=[];
 for(let k=0;k<3;k++){
  await p.goto(base+'roki.html#part/'+(await p.evaluate(()=>deskNewParts().find(i=>!deskDraftFor(i.id)).id)));
  await p.locator('[data-single-request]').click();await p.locator('[data-demo-fill="request"]').click();
  titles.push(await p.locator('#rfq-title').inputValue());
  await p.locator('[data-action="rfq-save-submit"]').click();await p.waitForFunction(()=>/sent to Supplier|ส่งให้ Supplier/i.test(document.querySelector('#toast')?.innerText||''));
 }
 assert.equal(new Set(titles).size,3,'Sample data differs every time');
 await p.goto(base+'roki.html#parts');await p.locator('[data-action="add-part"]').first().click();
 await p.locator('[data-demo-fill="dialog"]').click();assert.match(await p.locator('#pf-code').inputValue(),/^WP-DEMO-/);
 await p.locator('[data-action="save-part"]').click();await p.locator('.dialog').waitFor({state:'detached'});
});
