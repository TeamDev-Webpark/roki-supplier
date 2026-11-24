'use strict';
/* Request details required by the customer forms (review items 1–10):
   formula set from the part master, volume period, Beginning–Ending, response deadline before the effective date,
   RTP code, components supplied by ROKI, commercial terms, required material, and a Supplier who cannot change
   what ROKI fixed (header values and company percentages). */
const {run,login,store,switchTo,assert}=require('./_env.cjs');
run('verify-request-details',async({base,context})=>{
  const p=await context.newPage();await login(p,base,'roki','r-issue','parts');
  const T=await p.evaluate(()=>TODAY);
  const steel=await p.evaluate(()=>FORMULAS.sets.find(s=>s.id==='steel').current);

  /* 1. part master carries the formula set; only sets of the chosen category are offered */
  await p.locator('[data-action="add-part"]').click();
  await p.locator('#pf-format').selectOption('Assembly');
  const asmSets=await p.locator('#pf-formula-set option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
  assert(asmSets.includes('assembly-qt')&&!asmSets.includes('injection'),'Assembly offers assembly sets only');
  await p.locator('#pf-format').selectOption('Single Part');
  await p.locator('#pf-code').fill('REQ-TEST-001');await p.locator('#pf-name').fill('REQUEST DETAIL TEST');await p.locator('#pf-supplier').selectOption('s3');
  await p.locator('#pf-formula-set').selectOption('steel');await p.locator('#pf-drawing').fill('D-01');await p.locator('#pf-qty').fill('5000');
  await p.locator('#pf-children').fill('17211-KZL-9300-21, 1');
  await p.locator('[data-action="save-part"]').click();await p.locator('.dialog').waitFor({state:'detached'});
  const id=await p.evaluate(()=>db.items.find(i=>i.code==='REQ-TEST-001').id);
  assert.equal((await store(p)).items.find(i=>i.id===id).formulaSet,'steel');
  /* seeded parts follow their customer sheet */
  assert.equal(await p.evaluate(()=>suggestedFormula(db.items.find(i=>i.code==='17230-KWN-9000'&&i.supplier==='s1'))),await p.evaluate(()=>FORMULAS.sets.find(s=>s.id==='injection').current));
  /* a part without a formula set gets no silent default */
  assert.equal(await p.evaluate(()=>{const i={...db.items[0],id:'x',formulaSet:null};return suggestedFormula(i)}),'');

  /* open the request form for the new part */
  await p.evaluate(id=>{selected=new Set([id]);rfqDraftDialog()},id);await p.locator('.rfq-form-page').waitFor();
  assert.equal(await p.locator(`[data-request-formula="${id}"]`).inputValue(),String(steel),'Formula from the part master');
  /* 2–5. defaults */
  assert.equal(await p.locator(`[data-request-qty-period="${id}"]`).inputValue(),'year','Unit Part volume is per year');
  const eff=await p.locator(`[data-request-effective="${id}"]`).inputValue(),ending=await p.locator(`[data-request-ending="${id}"]`).inputValue();
  assert(ending>eff,'Ending defaults after the effective date');
  const due=await p.locator('#response-due').inputValue();assert(due<eff,'Response deadline defaults before the effective date');
  assert.equal(await p.locator(`[data-request-rtp="${id}"]`).inputValue(),'');
  await p.locator('#rfq-purpose').fill('Request detail check');
  const send=async()=>{await p.locator('[data-action="rfq-save-submit"]').click();await p.waitForTimeout(150)};
  const notes=async()=>(await store(p)).notifications.length,n0=await notes();
  /* RTP is required for a Unit Part */
  await send();assert.match(await p.locator('#toast').innerText(),/RTP/);assert.equal(await notes(),n0);
  await p.locator(`[data-request-rtp="${id}"]`).fill('LOU0099-001-J21');
  /* Ending must follow the effective date */
  await p.locator(`[data-request-ending="${id}"]`).fill(eff);await send();assert.match(await p.locator('#toast').innerText(),/after the effective date/);
  await p.locator(`[data-request-ending="${id}"]`).fill(ending);
  /* deadline before effective date */
  await p.locator('#response-due').fill(eff);await send();assert.match(await p.locator('#toast').innerText(),/before the requested effective date/);
  await p.locator('#response-due').fill(due);
  /* 6. supplied component needs a price */
  await p.locator(`[data-request-supply="${id}"]`).check();await send();assert.match(await p.locator('#toast').innerText(),/price of each component/);
  await p.locator(`[data-request-supply-price="${id}"]`).fill('4');
  /* 7. payment term required; 8. material */
  await p.locator('#request-payment').fill('');await send();assert.match(await p.locator('#toast').innerText(),/payment term/);
  await p.locator('#request-payment').fill('Credit 60 days');await p.locator('#request-terms-notes').fill('Tooling repaid over 10 years');
  await p.locator(`[data-request-material="${id}"]`).fill('SGCC 0.4 mm');
  await p.locator(`[data-request-qty-period="${id}"]`).selectOption('2years');
  await p.locator('[data-action="rfq-save-submit"]').click();await p.waitForFunction(()=>location.hash.startsWith('#request-register/'));
  let d=await store(p);const n=d.notifications.at(-1),spec=n.forms[id];
  assert.equal(n.items[0],id);assert.equal(spec.qtyPeriod,'2years');assert.equal(spec.ending,ending);assert.equal(spec.rtp,'LOU0099-001-J21');assert.equal(spec.material,'SGCC 0.4 mm');
  assert.deepEqual(spec.supplied,[{code:'17211-KZL-9300-21',price:4}]);
  assert.deepEqual(n.terms,{vat:'excluded',payment:'Credit 60 days',notes:'Tooling repaid over 10 years'});
  assert.equal(d.items.find(i=>i.id===id).rtp,'LOU0099-001-J21','Empty master RTP is filled from the request');
  const row=spec.costs.components.find(r=>r.partNo==='17211-KZL-9300-21');assert.equal(row.origin,'Supply');assert.equal(row.rate,4);assert.equal(row.supplied,true);

  /* 9–10. Supplier sees what ROKI fixed and cannot change it */
  await switchTo(p,base,'supplier','s3-issue','requests');
  await p.evaluate(([id,nid])=>newQuote(id,nid),[id,n.id]);await p.locator('#quote-form').waitFor();
  for(const sel of ['#quantity','#drawing','#effective'])assert.equal(await p.locator(sel).getAttribute('readonly'),'',sel+' is fixed by the request');
  assert.match(await p.locator('label[for="quantity"]').innerText(),/2 years/);
  const info=await p.locator('.request-info').innerText();
  for(const s of ['SGCC 0.4 mm','17211-KZL-9300-21','Credit 60 days','Tooling repaid over 10 years'])assert(info.includes(s),'Request info shows '+s);
  assert.equal(await p.locator('#profit').getAttribute('readonly'),'','Profit & admin is fixed by the company');
  assert.equal(await p.locator('#basis').isDisabled(),true);assert.equal(await p.locator('#spare').getAttribute('readonly'),'');
  await p.locator('[data-tab="components"]').click();
  {const idx=await p.evaluate(()=>window.formCosts.components.findIndex(r=>r.partNo==='17211-KZL-9300-21'));assert(idx>=0);assert.equal(await p.locator(`[data-cost="${idx}"][data-field="rate"]`).getAttribute('readonly'),'','Supplied price is read-only')}
  /* fill the costs, then try to tamper with fixed values before issuing */
  await p.locator('[data-tab="material"]').click();await p.locator('[data-cost="0"][data-field="name"]').fill('SGCC');await p.locator('[data-cost="0"][data-field="weight"]').fill('0.068');await p.locator('[data-cost="0"][data-field="rate"]').fill('46');
  await p.locator('[data-tab="process"]').click();await p.locator('[data-cost="0"][data-field="name"]').fill('Press');await p.locator('[data-cost="0"][data-field="time"]').fill('10');await p.locator('[data-cost="0"][data-field="rate"]').fill('0.1');
  await p.locator('#remark').fill('First quotation for the request detail check.');
  await p.evaluate(()=>{document.getElementById('quantity').value='1';document.getElementById('effective').value='2030-01-01';window.formCosts.profit=99;window.formCosts.spare=50;window.formCosts.components.find(r=>r.supplied).rate=1});
  await p.locator('#quote-form button[type="submit"]').click();await p.waitForFunction(()=>/#quote\//.test(location.hash),null,{timeout:10000}).catch(()=>{});
  d=await store(p);const q=d.quotes.filter(q=>q.item===id).at(-1);
  assert(q,'Quotation issued');
  assert.equal(q.quantity,5000);assert.equal(q.effective,spec.effective);assert.equal(q.ending,spec.ending);assert.equal(q.qtyPeriod,'2years');
  assert.equal(q.costs.profit,15,'Locked profit cannot be changed');assert.equal(q.costs.spare,15,'Locked spare cannot be changed');
  assert.equal(q.costs.components.find(r=>r.partNo==='17211-KZL-9300-21').rate,4,'Supplied price cannot be changed');
  assert.deepEqual(q.terms,n.terms);
  /* print form shows Ending, the volume period and the terms */
  await p.goto(base+'supplier.html#print/'+q.id);   /* ROKI sees it only after Supplier approval */await p.locator('.qt-form').waitFor();
  const printed=await p.locator('.qt-form').innerText();
  assert(/Ending/.test(printed),'Ending on the print');assert(/2 years/.test(printed),'Volume period on the print');assert(printed.includes('Credit 60 days'),'Terms on the print');
  assert.equal(T.length,10);
});
