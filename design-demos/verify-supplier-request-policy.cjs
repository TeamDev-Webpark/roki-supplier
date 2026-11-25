'use strict';
const {run,login,switchTo,store,assert}=require('./_env.cjs');
run('single Supplier selection and direct review actions',async({base,context,shot})=>{
 const p=await context.newPage();await login(p,base,'roki','r-issue','request-new');
 const ids=await p.evaluate(()=>{const parts=deskNewParts(),a=parts.find(i=>parts.some(j=>j!==i&&j.supplier===i.supplier)),b=parts.find(i=>i!==a&&i.supplier===a.supplier),other=parts.find(i=>i.supplier!==a.supplier);return {a:a.id,b:b.id,other:other.id,supplier:a.supplier}});
 await p.locator(`[data-single-request="${ids.a}"]`).click();await p.locator('#rfq-purpose').waitFor();assert.deepEqual(await p.evaluate(()=>[...selected]),[ids.a]);assert.equal(await p.locator('[data-request-formula]').count(),1);assert(await p.locator('.request-recipient-summary').innerText());await p.locator('[data-rfq-cancel]').click();   /* the request form is a page now: Cancel returns to where it was opened */
 await p.locator('[data-desk-clear]').click();await p.locator(`[data-select="${ids.a}"]`).check();assert.equal(await p.locator(`[data-select="${ids.other}"]`).isDisabled(),true);assert.equal(await p.locator(`[data-select="${ids.b}"]`).isEnabled(),true);
 await p.locator('#select-all').check();assert.equal(await p.evaluate(supplier=>[...selected].every(id=>db.items.find(i=>i.id===id).supplier===supplier),ids.supplier),true);
 await p.locator('[data-desk-clear]').click();assert.equal(await p.locator(`[data-select="${ids.other}"]`).isEnabled(),true);
 await p.evaluate(({a,other})=>{selected=new Set([a,other]);rfqDraftDialog()},ids);assert.equal(await p.locator('.dialog').count(),0,'Mixed-company selection cannot open the request dialog');
 const blocked=await p.evaluate(({a,other})=>{const count=db.notifications.length;let threw=false;try{dispatchCostRequest({items:[a,other]})}catch{threw=true}return threw&&db.notifications.length===count},ids);assert(blocked,'Dispatch policy rejects mixed companies before side effects');
 await p.evaluate(()=>{selected.clear();render()});await p.locator(`[data-select="${ids.a}"]`).check();await p.locator(`[data-select="${ids.b}"]`).check();await p.locator('[data-action="notify"]').click();
 await p.locator('#rfq-purpose').fill('Review two parts for the same Supplier in one request.');
 const before=(await store(p)).notifications.length;
 await p.evaluate(id=>selected.add(id),ids.other);await p.locator('[data-action="rfq-save-submit"]').click();assert.equal((await store(p)).notifications.length,before,'Save independently rejects injected mixed-company selection');assert(await p.locator('.rfq-form-page').count(),'The request form stays open');
 await p.evaluate(id=>selected.delete(id),ids.other);await p.locator('[data-action="rfq-save-submit"]').click();await p.locator('[data-quotation-history]').first().waitFor();
 const rid=await p.evaluate(()=>route().split('/')[1]),db=await store(p),notes=db.notifications.filter(n=>n.priceRequestId===rid);assert.equal(notes.length,1);assert.deepEqual(notes[0].items.sort(),[ids.a,ids.b].sort());assert.equal(notes[0].supplier,ids.supplier);
 await switchTo(p,base,'supplier',ids.supplier+'-issue','request-detail/'+notes[0].id);assert.equal(await p.locator('[data-cycle-item]').count(),2);assert.equal(await p.locator('[data-blank-form]').count(),2);
 await switchTo(p,base,'roki','r-issue','schedule-active');if(await p.locator('[data-desk-filter="stage"] option[value="due"]').count())await p.locator('[data-desk-filter="stage"]').selectOption('due');const due=await p.evaluate(()=>deskDueParts().find(i=>!deskDraftFor(i.id))?.id);if(due){assert(await p.locator(`[data-single-request="${due}"]`).count());await p.locator(`[data-single-request="${due}"]`).click();await p.locator('#rfq-purpose').waitFor();assert.deepEqual(await p.evaluate(()=>[...selected]),[due]);await p.locator('[data-rfq-cancel]').click()}
 await p.goto(base+'roki.html#schedule');await p.evaluate(()=>I18N.set('th'));await shot(p,'webpark-single-supplier-review-actions-th.png',{fullPage:false});
 await switchTo(p,base,'roki','r-check','schedule-active');assert.equal(await p.locator('[data-single-request]').count(),0,'Check cannot send requests');
 console.log('Single-item actions, same-company multi-selection, select-all, clear/unlock, mixed-company save and dispatch rejection, one delivery with two forms, and role permissions passed.');
}).catch(e=>{console.error(e);process.exitCode=1});
