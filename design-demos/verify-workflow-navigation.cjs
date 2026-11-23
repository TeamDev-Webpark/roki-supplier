'use strict';
const {run,reset,login,switchTo,store,approveStep,approveRequestAndSend,assert}=require('./_env.cjs');
run('verify-workflow-navigation',async({base,context,shot})=>{
 const r=await context.newPage(),s=await context.newPage();
 await reset(r,base,'roki');await login(r,base,'roki','r-issue','request-new');
 // Unscheduled parts can be requested without inventing a review date.
 await r.evaluate(()=>{db.items.find(i=>i.id==='i2').next=null;persist();render()});
 const initial=(await store(r)).notifications.length;
 await r.locator('[data-select="i2"]').check();
 await r.locator('[data-action="notify"]').click();
 assert.equal((await store(r)).notifications.length,initial);
 await r.locator('[data-action="close"]').first().click();
 await r.locator('[data-action="notify"]').click();
 await approveRequestAndSend(r,base);
 assert.equal(await r.evaluate(()=>location.hash),'#request-tracking',await r.locator('#toast').innerText());
 console.log('  Request sent and tracking opened');
 const n=(await store(r)).notifications.at(-1),row=r.locator(`[data-request-row="${n.id}"]`);
 assert.match(await row.innerText(),/Waiting for supplier/);
 await r.goto(base+'roki.html#request-new');
 assert(await r.locator('[data-select="i2"]').isDisabled(),'No duplicate unfinished request');
 await switchTo(r,base,'roki','r-check','request-new');
 assert.equal(await r.locator('[data-select="i3"]').count(),0,'Checker cannot access creation UI');
 await r.evaluate(()=>{selected.add('i3');sendNotifications()});
 assert.equal((await store(r)).notifications.length,initial+1,'Role guard also enforced by handler');

 console.log('  Duplicate and sender role guards checked');
 await login(s,base,'supplier','s2-issue','requests');
 await s.locator(`[data-request="${n.id}"]`).click();
 await s.locator('#remark').fill('Navigation acceptance: same price confirmed after review.');
 await s.locator('[data-action="save-draft"]').click();
 const qid=(await s.evaluate(()=>location.hash)).split('/')[1];
 await s.goto(base+'supplier.html#approvals');
 assert(await s.locator(`[href="#quote/${qid}"]`).count()>0,'Issuer preparation queue includes drafts');
 await s.goto(base+'supplier.html#sent');
 assert.equal(await s.locator(`[href="#quote/${qid}"]`).count(),0,'Drafts are not submitted quotations');
 await r.goto(base+'roki.html#request-tracking');
 assert.match(await row.innerText(),/Supplier preparing/);
 assert.equal(await row.locator(`[href="#quote/${qid}"]`).count(),0,'ROKI cannot open supplier internal drafts');
 await s.goto(base+'supplier.html#quote/'+qid);
 await s.locator('[data-edit]').first().click();await s.locator('button[type="submit"]').click();
 await switchTo(s,base,'supplier','s2-approve','quote/'+qid);await approveStep(s);
 await r.goto(base+'roki.html#request-tracking');
 assert.match(await row.innerText(),/WEBPARK reviewing/);
 await s.goto(base+'supplier.html#sent');
 assert(await s.locator(`[href="#quote/${qid}"]`).count()>0,'Submitted quote appears in supplier sent page');

 console.log('  Supplier submission tracked by both portals');
 // Return flows stay linked to the request and remain in sent history.
 await switchTo(r,base,'roki','r-issue','quote/'+qid);
 await r.locator('[data-transition="revert"]').click();await r.locator('#action-reason').fill('Please confirm the unchanged material rate.');await r.locator('[data-action="confirm-transition"]').click();
 await r.goto(base+'roki.html#request-tracking');assert.match(await row.innerText(),/Supplier correcting/);
 await switchTo(s,base,'supplier','s2-issue','quote/'+qid);
 await s.locator('[data-edit]').first().click();await s.locator('button[type="submit"]').click();
 await switchTo(s,base,'supplier','s2-approve','quote/'+qid);await approveStep(s);
 for(const account of ['r-issue','r-check','r-approve']){await switchTo(r,base,'roki',account,'quote/'+qid);await approveStep(r)}
 await r.goto(base+'roki.html#request-tracking');assert.match(await row.innerText(),/Completed/);
 assert.equal((await store(r)).items.find(i=>i.id==='i2').next,null,'One-off request does not create a recurring schedule');
 await switchTo(r,base,'roki','r-issue','request-new');assert(!(await r.locator('[data-select="i2"]').isDisabled()),'Completed pairs can start another cycle');
 console.log('  Returned quotation corrected and approved through all roles');
 // A rejected quotation can be replaced; an older request must then stop offering a retry.
 await r.locator('[data-select="i2"]').check();await r.locator('[data-action="notify"]').click();await approveRequestAndSend(r,base);
 const retryRequest=(await store(r)).notifications.at(-1);
 await switchTo(s,base,'supplier','s2-issue','requests');await s.locator(`[data-request="${retryRequest.id}"]`).click();
 await s.locator('#remark').fill('Replacement cycle acceptance check.');await s.locator('button[type="submit"]').click();
 const rejectedId=(await s.evaluate(()=>location.hash)).split('/')[1];
 await switchTo(s,base,'supplier','s2-approve','quote/'+rejectedId);await approveStep(s);
 await r.goto(base+'roki.html#quote/'+rejectedId);await r.locator('[data-transition="reject"]').click();await r.locator('#action-reason').fill('Please prepare a new commercial offer.');await r.locator('[data-action="confirm-transition"]').click();
 await r.goto(base+'roki.html#request-tracking');assert.match(await r.locator(`[data-request-row="${retryRequest.id}"]`).innerText(),/new quote needed/);
 await r.goto(base+'roki.html#request-new');await r.locator('[data-select="i2"]').check();await r.locator('[data-action="notify"]').click();await approveRequestAndSend(r,base);
 await switchTo(s,base,'supplier','s2-issue','requests');
 const retired=s.locator(`[data-request-row="${retryRequest.id}"]`);assert.match(await retired.innerText(),/Replaced by a newer request/);assert.equal(await retired.locator('[data-request]').count(),0);
 await r.goto(base+'roki.html#request-new');
 await r.locator('[data-lang="th"]').click();
 assert.match(await r.locator('h1').innerText(),/สร้างคำขอเสนอราคา/);
 await shot(r,'roki-request-new-th.png');
 await r.goto(base+'roki.html#request-tracking');await shot(r,'roki-request-tracking-th.png');
 await s.goto(base+'supplier.html#sent');await s.locator('[data-lang="th"]').click();await shot(s,'supplier-submitted-th.png');
 for(const [p,routes,portal] of [[r,['request-new','request-tracking','quotes'],'roki'],[s,['requests','sent','approvals'],'supplier']]){
  await p.setViewportSize({width:390,height:844});
  for(const route of routes){await p.goto(base+portal+'.html#'+route);await p.locator('.content h1').waitFor();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile '+portal+' '+route)}
 }
});
