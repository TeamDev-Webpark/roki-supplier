'use strict';
const {run,login,store,assert}=require('./_env.cjs');
run('first-time page sets the schedule; the review interval is chosen on the schedule form',async({base,context})=>{
 const p=await context.newPage();await login(p,base,'roki','r-issue','request-new');await p.evaluate(()=>I18N.set('th'));
 assert.match(await p.locator('.side-nav a.active').innerText(),/กำหนดรอบทบทวน/);
 assert.equal(await p.locator('[data-first-cadence]').count(),0,'No interval or review date on the list');
 const id=await p.locator('[data-plan-item]').first().getAttribute('data-plan-item');
 await p.locator(`[data-select="${id}"]`).check();await p.locator('[data-action="notify"]').click();
 await p.locator('[data-request-formula]').first().waitFor();assert.match(await p.locator('h1').innerText(),/ตั้งกำหนดการทบทวนราคา/);
 await p.locator(`[data-request-cadence="${id}"]`).selectOption('6');
 assert.equal(await p.locator(`[data-request-formula="${id}"]`).isDisabled(),true,'Formula comes from the part master');
 await p.locator('#rfq-purpose').fill('First quotation for a newly introduced part.');
 await p.locator('[data-action="send-notifications"]').click();
 assert.equal((await store(p)).items.find(i=>i.id===id).cadence,6,'Interval chosen on the form is saved');
 await p.goto(base+'roki.html#parts');await p.locator('[data-action="add-part"]').first().click();
 assert.equal(await p.locator('#pf-cadence, #pf-next, #pf-sched').count(),0,'Add-part form has no schedule fields');
});
