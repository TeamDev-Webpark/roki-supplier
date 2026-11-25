'use strict';
const fs=require('node:fs');
const {run,login,switchTo,assert}=require('./_env.cjs');

run('report filters, complete CSV export and Supplier data scope',async({base,context,shot})=>{
 const page=await context.newPage();await login(page,base,'roki','r-issue','records');
 const filter=key=>page.locator(`[data-report-filter="${key}"]`);
 const report=key=>page.locator(`[data-report-view="${key}"]`);
 const table=page.locator('.report-data tbody tr');
 const exportButton=page.locator('[data-report-export]');
 assert.equal(await report('prices').getAttribute('aria-pressed'),'true');
 await filter('supplier').selectOption('s1');
 await filter('format').selectOption('Single Part');
 const initial=await page.evaluate(()=>reportResult().rows);
 assert(initial.length>12,'Fixture includes multiple pages after filtering');
 assert(initial.every(r=>r.supplier==='s1'&&r.format==='Single Part'));
 await page.locator('[data-report-page="2"]').click();
 assert.equal(await page.evaluate(()=>reportState().page),2);
 const [file]=await Promise.all([page.waitForEvent('download'),exportButton.click()]);
 const csv=fs.readFileSync(await file.path(),'utf8');
 assert(csv.startsWith('\uFEFF'));assert.equal(csv.trim().split('\r\n').length,initial.length+1);
 assert(!csv.includes('Pathumthani Rubber'),'Filtered data is the only data exported');
 await filter('query').fill('no such part xyz');assert.equal(await table.count(),0);assert(await exportButton.isDisabled());
 await page.locator('[data-report-reset]').click();
 await filter('from').fill('2026-12-01');await filter('to').fill('2026-01-01');
 assert(await page.locator('.report-invalid').isVisible());assert(await exportButton.isDisabled());
 await page.locator('[data-report-reset]').click();
 const limit=initial[0].day;await filter('from').fill(limit);await filter('to').fill(limit);
 assert(await page.evaluate(day=>reportResult().rows.length>0&&reportResult().rows.every(r=>r.day===day),limit));
 await page.locator('[data-report-reset]').click();
 for(const key of ['requests','quotes','schedules','suppliers','activity','notifications']){
  await report(key).click();assert(await table.count(),`${key} renders data`);
 }
 await report('requests').click();await filter('sla').selectOption('overdue');assert(await page.evaluate(()=>reportResult().rows.every(r=>r.late&&!r.response)));
 await page.locator('[data-report-reset]').click();await page.evaluate(()=>I18N.set('th'));await report('prices').click();
 await shot(page,'webpark-report-center-th.png',{fullPage:false});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Report layout stays within mobile viewport');
 await switchTo(page,base,'supplier','s2-approve','records');
 assert.equal(await filter('supplier').count(),0);
 for(const key of ['prices','requests','quotes','schedules','suppliers','activity','notifications']){
  await report(key).click();
  assert(await page.evaluate(()=>reportResult().rows.every(row=>row.supplier===user.supplier||!row.supplier)),`Supplier report isolation: ${key}`);
 }
}).catch(error=>{console.error(error);process.exitCode=1});
