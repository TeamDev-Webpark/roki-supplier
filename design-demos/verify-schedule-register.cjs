'use strict';
const {run,login,assert}=require('./_env.cjs');
/* "All review schedules": every part is listed, and each filter narrows the list exactly as the data says. */
run('all review schedules register and its advanced filters',async({base,context})=>{
 const p=await context.newPage();await p.setViewportSize({width:1500,height:1100});await login(p,base,'roki','r-issue','schedule-active');
 const total=await p.evaluate(()=>currentItems().length);
 assert.equal(await p.locator('[data-desk-section="schedule-register"] .count').innerText(),String(total),'Every part is in the register');
 const heading=async()=>Number(await p.locator('[data-desk-section="schedule-register"] .count').innerText());
 const filters=p.locator('#schedule-advanced'),toggle=p.locator('[data-reg-toggle]');
 const status=p.locator('[data-desk-filter="stage"]'),apply=filters.locator('button[type="submit"]');
 assert(await filters.isHidden(),'Advanced filters start collapsed');
 for(const k of ['new','upcoming','processing']){
  await status.selectOption(k);assert.equal(await heading(),await p.evaluate(k=>currentItems().filter(i=>regStateOf(i)===k).length,k),'status '+k);
  assert(await p.locator('[data-plan-item]').evaluateAll((els,k)=>els.every(e=>e.dataset.scheduleState===k),k));
 }
 await status.selectOption('active');assert.equal(await heading(),total);
 await toggle.click();
 await filters.locator('[name="supplier"]').selectOption('s2');
 await filters.locator('[name="cadence"]').selectOption('3');
 assert.equal(await heading(),total,'Changes wait for Apply');
 await apply.click();
 assert.equal(await heading(),await p.evaluate(()=>currentItems().filter(i=>i.supplier==='s2'&&(i.cadence||3)===3).length));
 assert.equal(await toggle.locator('.desk-count').textContent(),'2');
 await toggle.click();
 assert(await filters.isHidden(),'Applied filters can be collapsed');
 assert.equal(await p.locator('[data-reg-chips] [data-reg-clear]').count(),3,'Two filters + clear all');
 await p.locator('[data-reg-clear="cadence"]').click();await p.locator('[data-reg-clear="supplier"]').click();assert.equal(await heading(),total,'Chips clear one filter each');
 await toggle.click();
 await p.locator('[data-reg-preset="90"]').click();
 await apply.click();
 const win=await p.evaluate(()=>{const lim=regAdd(90);return currentItems().filter(i=>i.next&&i.next>=TODAY&&i.next<=lim).length});
 assert.equal(await heading(),win,'Next 90 days');assert(await p.locator('[data-reg-preset="90"].active').count());
 await p.locator('[data-reg-clear-advanced]').click();assert.equal(await heading(),total);
 /* text search and price range */
 const code=await p.evaluate(()=>currentItems().find(i=>i.price!=null).code);
 await p.locator('[data-desk-query="schedule-active"]').fill(code);assert((await heading())>=1);assert(await p.locator('[data-plan-item]').first().innerText().then(t=>t.includes(code)));
 await p.locator('[data-desk-query="schedule-active"]').fill('');
 await filters.locator('[name="pmin"]').fill('50');
 await filters.locator('[name="pmax"]').fill('49');
 await apply.click();
 assert(await filters.getByRole('alert').isVisible(),'Invalid price range is explained');
 assert.equal(await heading(),total,'Invalid price range does not change results');
 await filters.locator('[name="pmax"]').fill('');
 await apply.click();
 assert.equal(await heading(),await p.evaluate(()=>currentItems().filter(i=>i.price!=null&&i.price>=50).length),'Price from');
 await p.locator('[data-reg-clear="*"]').click();
 /* no match + export */
 await p.locator('[data-desk-query="schedule-active"]').fill('zzzz-no-such-part');assert.equal(await p.locator('.desk-empty').count(),1);
 await p.locator('[data-desk-query="schedule-active"]').fill('');
 const [dl]=await Promise.all([p.waitForEvent('download'),p.locator('[data-reg-export]').click()]);
 assert.match(dl.suggestedFilename(),/review-schedules-.*\.csv/);
 for(const w of [390]){await p.setViewportSize({width:w,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Mobile layout');}
});
