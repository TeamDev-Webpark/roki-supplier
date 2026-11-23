'use strict';
/* End-to-end workflow across both portals:
   manual notification → supplier request → Issue → Supplier Approve → ROKI Issue → Check → Approve,
   plus supplier isolation, role gates, e-sign trail, history, emails, schedule edits and mobile layout. */
const {run,store,reset,login,approveStep,approveRequestAndSend,assert}=require('./_env.cjs');
run('verify-workspace',async({base,context,shot})=>{
  const roki=await context.newPage(),supplier=await context.newPage();
  const switchAccount=async(page,account)=>{await page.locator('[data-action="logout"]').click();await page.locator('#demo-account').selectOption(account);await page.locator('[data-action="login"]').click();await page.locator('.content').waitFor()};

  /* --- manual notification: selecting or scheduling never sends --- */
  await reset(roki,base,'roki');await login(roki,base,'roki','r-issue','schedule');
  await roki.getByRole('heading',{name:'Price update schedule',exact:true}).waitFor();
  const before=(await store(roki)).notifications.length,emailsBefore=(await store(roki)).emails.length;
  assert.equal(before,1);
  await roki.locator('[data-select="i2"]').check();
  assert.equal((await store(roki)).notifications.length,before,'Selecting must never send');
  await roki.locator('[data-action="notify"]').click();await approveRequestAndSend(roki,base);
  await roki.getByText('Sent in demo',{exact:true}).first().waitFor();
  const afterSend=await store(roki);assert.equal(afterSend.notifications.length,before+1);
  assert(afterSend.emails.length>emailsBefore,'Sending queues email notifications');

  /* --- supplier sees only its own request --- */
  await login(supplier,base,'supplier','s2-issue','requests');
  assert.equal(await supplier.locator('[data-request]').count(),1);
  assert.equal(await supplier.getByText('17230-KWN-9000',{exact:false}).count(),0,'Other supplier’s part must not be visible');
  await supplier.locator('[data-request]').click();
  assert.match(await supplier.locator('#cost-summary').innerText(),/Last approved/,'Editor starts from the last approved quotation');
  await supplier.locator('#remark').fill('Verified end-to-end cost revision for the selected supplier request.');
  await supplier.locator('button[type="submit"]').click();await supplier.locator('.status-strip').waitFor();
  assert.match(await supplier.locator('.status-strip').innerText(),/Supplier approval/);
  const qid=(await supplier.evaluate(()=>location.hash)).split('/')[1];assert(/^Q-2026-\d{4}$/.test(qid),'Sequential quotation number: '+qid);
  assert.equal(await supplier.locator('[data-transition="advance"]').count(),0,'Issuer must not approve');

  /* --- five stages, each with its own account --- */
  await switchAccount(supplier,'s2-approve');
  await supplier.locator('[data-transition="advance"]').click();await supplier.locator('[data-action="confirm-transition"]').click();
  assert.equal(await supplier.locator('.dialog').count(),1,'Confirmation required');
  await supplier.locator('#confirm-action').check();await supplier.locator('[data-action="confirm-transition"]').click();
  await supplier.locator('.status-strip').getByText('Awaiting issue',{exact:true}).waitFor();
  for(const [account,status] of [['r-issue','Awaiting check'],['r-check','Awaiting approval'],['r-approve','Approved']]){
    await roki.goto(`${base}roki.html#quote/${qid}`);await switchAccount(roki,account);await roki.goto(`${base}roki.html#quote/${qid}`);
    await approveStep(roki);await roki.locator('.status-strip').getByText(status,{exact:true}).waitFor();
  }
  const done=await store(roki),quote=done.quotes.find(q=>q.id===qid);
  assert.equal(quote.status,'Approved');
  assert.deepEqual(quote.trail.map(t=>t.stage).filter(Boolean),['S-Issue','S-Approve','R-Issue','R-Check','R-Approve']);
  assert(done.history.some(h=>h.quote===qid),'Approved price is added to the price history');
  assert.equal(done.items.find(i=>i.id===quote.item).price,quote.total,'Current price updated on approval');
  assert(done.emails.some(m=>m.subject.includes(qid)&&m.subject.includes('approved by WEBPARK')),'Supplier is emailed on approval');

  /* --- printable form carries the signatures --- */
  await roki.goto(`${base}roki.html#print/${qid}`);await roki.locator('.qt-form').waitFor();
  assert.equal(await roki.locator('.qt-signed.esign').count(),3,'Three ROKI e-signatures');
  assert.equal(await roki.locator('.qt-signed:not(.esign):not(.pending)').count(),2,'Two supplier confirmations');

  /* --- another supplier cannot open it --- */
  await switchAccount(supplier,'s1-issue');await supplier.goto(`${base}supplier.html#quote/${qid}`);
  await supplier.getByText('Quotation unavailable for this account.',{exact:false}).waitFor();

  /* --- schedule edits never notify --- */
  await switchAccount(roki,'r-issue');
  await roki.goto(`${base}roki.html#schedule`);await roki.locator('[data-schedule="i1"]').click();
  const n=(await store(roki)).notifications.length;
  await roki.locator('#next-review').fill('2026-12-20');await roki.locator('[data-action="save-schedule"]').click();
  assert.equal((await store(roki)).notifications.length,n,'Schedule edits must not send');
  await shot(roki,'roki-schedule-workspace.png');
  await roki.goto(`${base}roki.html#quotes`);await shot(roki,'roki-live-workspace.png');
  await supplier.goto(`${base}supplier.html#quotes`);await shot(supplier,'supplier-live-workspace.png');

  /* --- mobile --- */
  await roki.setViewportSize({width:390,height:844});
  for(const hash of ['schedule','quotes','reports','outbox',`quote/${qid}`,`print/${qid}`]){
    await roki.goto(`${base}roki.html#${hash}`);await roki.locator('.content h1, .qt-form').first().waitFor();
    assert.equal(await roki.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No horizontal overflow on mobile: ${hash}`);
    if(hash==='schedule')await shot(roki,'roki-mobile-workspace.png',{fullPage:false});
  }
});
