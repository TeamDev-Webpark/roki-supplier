'use strict';
/* Formula library: worked examples, form template + live preview, save gating, effective date, retire. */
const {run,store,reset,login,assert}=require('./_env.cjs');
run('verify-formula-library',async({base,context})=>{
  const roki=await context.newPage();
  await reset(roki,base,'roki');
  await login(roki,base,'roki','r-approve','formulas');
  /* examples panel shows customer sheets, all matching on an untouched draft */
  const val=await roki.locator('#formula-set option').evaluateAll(o=>(o.find(x=>/injection/i.test(x.textContent))||o[0]).value);
  await roki.locator('#formula-set').selectOption(val);
  const ex=roki.locator('#fm-examples');await ex.waitFor();
  assert.match(await ex.innerText(),/examples match|ตัวอย่างตรงกัน/);
  assert.equal(await ex.locator('.badge.red,.status-red').count(),0);
  /* form preview and template panel exist */
  assert.ok((await roki.locator('#fm-form-preview').innerText()).length>20,'form preview renders');
  /* changing a rate-affecting formula breaks examples and gates saving */
  const expr=roki.locator('[data-fp="sections.2.expr"]');
  await roki.locator('#fm-reason').fill('Test change');
  await expr.fill('rate*time/cavity*2');
  assert.equal(await roki.locator('#fm-save').isDisabled(),false);
  await roki.locator('#fm-save').click();
  assert.match(await roki.locator('.toast, #toast').first().innerText(),/examples|ตัวอย่าง/);
  /* a past effective date is refused */
  await roki.locator('#fm-ex-ack').check();
  await roki.locator('#fm-effective').evaluate(e=>{e.removeAttribute('min');e.value='2020-01-01'});
  await roki.locator('#fm-save').click();
  assert.match(await roki.locator('.toast, #toast').first().innerText(),/past|ย้อนหลัง/);
  /* a future date saves a scheduled version that is not yet current */
  await roki.locator('#fm-effective').evaluate(e=>{e.value='2027-01-01'});
  await roki.locator('#fm-save').click();
  const db=await store(roki),cur=db.formulas.sets.find(s=>s.id==='standard').current,latest=Math.max(...db.formulas.versions.map(v=>v.version));
  assert.ok(latest>cur,'scheduled version is not current');
});
