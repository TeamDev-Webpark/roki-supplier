'use strict';
const {run,reset,login,switchTo,store,approveStep,approveRequestAndSend,assert}=require('./_env.cjs');
run('verify-record-details',async({base,context,shot})=>{
 const r=await context.newPage(),s=await context.newPage();
 await reset(r,base,'roki');await login(r,base,'roki','r-issue','request-tracking');
 await r.locator('[data-request-row="N-DEMO-001"] td').nth(2).click();
 assert.match(await r.evaluate(()=>location.hash),/^#request-detail\/N-DEMO-001\/i6$/);
 assert.equal(await r.locator('h1').innerText(),'N-DEMO-001','Waiting request has a real detail page');
 assert(await r.getByRole('heading',{name:'Before sending to Supplier',exact:true}).count());
 assert(await r.getByRole('heading',{name:'After sending to Supplier',exact:true}).count());
 assert.equal(await r.locator('[data-request]').count(),0,'ROKI cannot prepare Supplier quotations');
 await r.locator('[data-detail-route="part/i6"]').focus();await r.keyboard.press('Enter');assert.equal(await r.evaluate(()=>location.hash),'#part/i6');
 await r.goto(base+'roki.html#parts');await r.locator('[data-detail-route="part/i2"] td').nth(1).click();assert.equal(await r.evaluate(()=>location.hash),'#part/i2');
 await r.goto(base+'roki.html#schedule');await r.locator('[data-select="i2"]').check();assert.equal(await r.evaluate(()=>location.hash),'#schedule','Checkbox selection does not navigate');
 await r.locator('[data-action="notify"]').click();await r.keyboard.press('Escape');assert.equal(await r.locator('.dialog').count(),0);
 await r.goto(base+'roki.html#suppliers');await r.locator('[data-detail-route="account/s1-issue"] td').first().click();assert.equal(await r.evaluate(()=>location.hash),'#account/s1-issue');
 await r.goto(base+'roki.html#reports');await r.locator('[data-detail-route^="price-record/"]').first().locator('td').first().click();assert.match(await r.evaluate(()=>location.hash),/^#price-record\//);

 await r.goto(base+'roki.html#formulas');await r.locator('[data-detail-route="formula-version/1"] td').nth(1).click();assert.equal(await r.evaluate(()=>location.hash),'#formula-version/1');
 // Create a linked request and quotation so both timeline phases use real records.
 await r.goto(base+'roki.html#request-new');await r.locator('[data-select="i2"]').check();await r.locator('[data-action="notify"]').click();await approveRequestAndSend(r,base);
 const n=(await store(r)).notifications.at(-1);
 await login(s,base,'supplier','s2-issue','requests');
 await s.locator(`[data-request-row="${n.id}"] td`).nth(2).click();assert.match(await s.evaluate(()=>location.hash),/^#request-detail\//);
 await s.locator('[data-request]').click();await s.locator('#remark').fill('Timeline and detail navigation acceptance.');await s.locator('button[type="submit"]').click();
 const qid=(await s.evaluate(()=>location.hash)).split('/')[1];
 await switchTo(s,base,'supplier','s2-approve','quote/'+qid);await approveStep(s);
 assert.equal(await s.locator('[href^="#request-register/"]').count(),0,'Supplier cannot open internal ROKI approvals');
 await r.goto(base+'roki.html#quote/'+qid);
 const before=r.locator('[data-timeline-phase="before"]'),after=r.locator('[data-timeline-phase="after"]');
 assert.match(await before.innerText(),/WEBPARK Issue prepares the request/);assert.match(await before.innerText(),/WEBPARK Approve authorizes the request/);
 assert.doesNotMatch(await before.innerText(),/Supplier Issue prepares/);
 assert.match(await after.innerText(),/Supplier Issue prepares/);assert.match(await after.innerText(),/WEBPARK Check verifies quotation costs/);
 assert.equal(await before.locator(`[href="#request-register/${n.priceRequestId}"]`).count(),1);
 await r.goto(base+'roki.html#quote/Q-2026-0105');assert.match(await r.locator('[data-timeline-phase="before"]').innerText(),/no linked internal request approval record/,'Older records do not get invented approvals');
 await r.goto(base+'roki.html#request-new');await r.locator('[data-select="i3"]').check();await r.locator('[data-action="notify"]').click();await r.locator('#rfq-purpose').fill('Visible internal review action check.');await r.locator('[data-action="rfq-save-submit"]').click();
 const rfqid=(await r.evaluate(()=>location.hash)).split('/')[1];
 await switchTo(r,base,'roki','r-check','request-register');
 assert.equal(await r.locator(`[data-rfq-row="${rfqid}"] a.button.primary`).count(),1,'Internal-review open action is a prominent blue primary button');
 assert.doesNotMatch(await r.locator('.side-nav').innerText(),/^\s*\d+\./m,'Sidebar has no numbered labels');
 await r.locator(`[data-rfq-row="${rfqid}"] td`).nth(3).click();assert.equal(await r.evaluate(()=>location.hash),'#request-register/'+rfqid);await r.goto(base+'roki.html#request-register');
 await r.locator('[data-lang="th"]').click();await shot(r,'roki-internal-review-primary-th.png');
 await r.goto(base+'roki.html#quote/'+qid);await shot(r,'roki-split-quotation-timeline-th.png');
 await switchTo(s,base,'supplier','s1-issue','request-detail/'+n.id+'/i2');assert.equal(await s.locator('[data-request]').count(),0);assert.match(await s.locator('.content').innerText(),/unavailable|ไม่มีสิทธิ์/,'Other supplier request remains inaccessible');
 await r.setViewportSize({width:390,height:844});
 for(const route of ['quote/'+qid,'request-detail/'+n.id+'/i2','part/i2','account/s1-issue','supplier/s1','price-record/0']){await r.goto(base+'roki.html#'+route);assert.equal(await r.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile details '+route)}
});
