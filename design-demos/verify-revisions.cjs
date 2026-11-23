'use strict';
/* Quotation editor and revision rules: live calculation, validation, remarks kept across tabs,
   revision snapshots, mandatory return reason, persistence, comparison view and approved-only export. */
const {run,store,reset,login,assert}=require('./_env.cjs');
const fs=require('node:fs');
/* Q-2026-0105 is a returned Assembly quotation for supplier 1 (general chemicals). Its approved baseline is Q-2026-0015 at 51.03. */
run('verify-revisions',async({base,context,shot})=>{
  const page=await context.newPage();
  await reset(page,base,'supplier');await login(page,base,'supplier','s1-issue','quote/Q-2026-0105');

  /* editing a returned quotation: live calculation, then validation */
  await page.locator('[data-edit]').first().click();
  assert.equal(await page.locator('[data-total]').innerText(),'52.18');
  assert.match(await page.locator('#cost-summary').innerText(),/51\.03/,'Shows the last approved price');
  await page.locator('#remark').fill('Revised yearly production volume after ROKI correction request.');
  await page.locator('[data-tab="components"]').click();
  await page.locator('[data-cost="0"][data-field="rate"]').fill('20');
  assert.equal(await page.locator('[data-total]').innerText(),'54.19','Component A: (20+12)×1.005, B 11.33, C 8.00, D 1.00, E 0.50, F 1.20');
  await page.locator('[data-tab="process"]').click();
  await page.locator('[data-cost="0"][data-field="cavity"]').fill('0');
  await page.locator('button[type="submit"]').click();
  assert.equal(await page.locator('[data-cost="0"][data-field="cavity"]').evaluate(el=>el.checkValidity()),false,'Zero cavity is rejected');
  assert.match(await page.evaluate(()=>location.hash),/^#edit/,'Stays on the editor');
  await page.locator('[data-cost="0"][data-field="cavity"]').fill('1');
  await page.locator('[data-tab="components"]').click();
  assert.equal(await page.locator('#remark').inputValue(),'Revised yearly production volume after ROKI correction request.','Remark survives tab changes');
  await shot(page,'supplier-quotation-editor.png');

  /* issue: a returned quotation becomes the next revision and keeps the returned one as a snapshot */
  await page.locator('button[type="submit"]').click();await page.locator('.status-strip').waitFor();
  let q=(await store(page)).quotes.find(q=>q.id==='Q-2026-0105');
  assert.equal(q.revision,2);assert.equal(q.versions.length,1);assert.equal(q.versions[0].total,52.18);assert.equal(q.total,54.19);assert.equal(q.status,'Supplier approval');
  assert.equal(q.baseline.total,51.03,'Baseline stays the last approved quotation');
  await page.locator('[data-cmp-tab]').first().waitFor();
  assert.match(await page.locator('.compare-table').innerText(),/54\.19/);
  await page.locator('#compare-with').selectOption('v0');
  assert.match(await page.locator('.compare-table').innerText(),/52\.18/,'Can compare with the returned revision');

  /* supplier approver returns it: reason is mandatory */
  await page.locator('[data-action="logout"]').click();await page.locator('#demo-account').selectOption('s1-approve');await page.locator('[data-action="login"]').click();
  await page.locator('[data-transition="revert"]').click();await page.locator('[data-action="confirm-transition"]').click();
  assert.equal(await page.locator('.dialog').count(),1,'A reason is required to return');
  await page.locator('#action-reason').fill('Please attach the revised drawing.');await page.locator('[data-action="confirm-transition"]').click();
  await page.locator('.status-strip').getByText('Returned for correction',{exact:true}).waitFor();
  q=(await store(page)).quotes.find(q=>q.id==='Q-2026-0105');
  assert.equal(q.trail.at(-1).reason,'Please attach the revised drawing.');assert.equal(q.status,'Reverted');
  await page.reload();await page.locator('.status-strip').getByText('Returned for correction',{exact:true}).waitFor();
  assert((await store(page)).emails.some(m=>m.subject.includes('returned for correction')),'Returned quotation emails the supplier issuer');

  /* ROKI export contains approved quotations only */
  const roki=await context.newPage();
  await login(roki,base,'roki','r-approve','exports');
  const download=roki.waitForEvent('download');await roki.locator('[data-action="export"]').click();
  const csv=fs.readFileSync(await (await download).path(),'utf8');
  assert(csv.includes('Q-2026-0011'),'Approved quotation exported');
  assert(!csv.includes('Q-2026-0105')&&!csv.includes('Q-2026-0101'),'Quotations still in approval are not exported');

  /* mobile */
  await page.setViewportSize({width:390,height:844});await page.goto(base+'supplier.html#quote/Q-2026-0105');await page.locator('.content h1').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile page must not overflow');
});
