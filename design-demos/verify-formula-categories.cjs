'use strict';
const {run,login,store,switchTo,assert}=require('./_env.cjs');
run('two form categories from master data to formula selection',async({base,context,shot})=>{
 const p=await context.newPage();await login(p,base,'roki','r-issue','formulas');await p.evaluate(()=>I18N.set('th'));
 const initial=await store(p);assert.equal(await p.locator('[data-fm-tab]').count(),2);
 for(const format of ['Single Part','Assembly']){
  await p.locator(`[data-fm-tab="${format}"]`).click();
  assert.equal(await p.evaluate(()=>fmFormat),format);
  const options=await p.locator('#formula-set option').evaluateAll(options=>options.map(o=>o.value));
  const expected=await p.evaluate(format=>FORMULAS.sets.filter(s=>s.formats.includes(format)).map(s=>s.id),format);assert.deepEqual(options,expected);
 }
 await p.locator('[data-create-formula]').click();assert.equal(await p.locator('#formula-scope').inputValue(),'Assembly');await p.locator('#formula-name').fill('Assy category audit formula');await p.locator('[data-save-formula-set="new"]').click();
 const created=await p.evaluate(()=>selectedFormulaSet().id);assert.deepEqual((await store(p)).formulas.sets.find(s=>s.id===created).formats,['Assembly']);assert.equal(await p.evaluate(()=>fmFormat),'Assembly');
 await p.locator('[data-fp="sections.0.expr"]').fill('rate*qty*1.01');await p.locator('[data-fm-tab="Single Part"]').click();assert.equal(await p.evaluate(()=>fmFormat),'Assembly','Dirty changes cannot be silently discarded by switching category');
 await p.locator('[data-fm-discard]').click();await p.locator('[data-fm-tab="Single Part"]').click();assert.equal(await p.locator(`#formula-set option[value="${created}"]`).count(),0);
 assert.deepEqual((await store(p)).quotes,initial.quotes,'Grouping and adding sets preserve existing quotations');
 await shot(p,'webpark-formula-categories-single-th.png',{fullPage:false});await p.locator('[data-fm-tab="Assembly"]').click();await shot(p,'webpark-formula-categories-assy-th.png',{fullPage:false});
 await p.goto(base+'roki.html#parts');await p.locator('[data-action="add-part"]').click();assert.equal(await p.locator('#pf-format').inputValue(),'');await p.locator('#pf-code').fill('CATEGORY-ASSY-001');await p.locator('#pf-name').fill('Category Assembly Test');await p.locator('#pf-supplier').selectOption('s1');await p.locator('[data-action="save-part"]').click();assert(await p.locator('#pf-format').count(),'Category is required');await p.locator('#pf-format').selectOption('Assembly');await p.locator('[data-action="save-part"]').click();
 const id=await p.evaluate(()=>db.items.find(i=>i.code==='CATEGORY-ASSY-001').id);await p.goto(base+'roki.html#request-new');await p.locator(`[data-single-request="${id}"]`).click();assert((await p.locator(`[data-spec-item="${id}"]`).innerText()).includes('QT-ASSY'));
 const valid=await p.evaluate(id=>[...document.querySelector(`[data-request-formula="${id}"]`).options].every(o=>formulaSetOf(FORMULAS.versions.find(v=>v.version===Number(o.value))).formats.includes('Assembly')),id);assert(valid);await p.locator('[data-rfq-cancel]').click();   /* the request form is a page now: Cancel returns to where it was opened */
 await p.goto(base+'roki.html#formulas');await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await switchTo(p,base,'roki','r-check','formulas');assert.equal(await p.locator('[data-fm-tab]').count(),2);assert.equal(await p.locator('[data-create-formula]').count(),0);
 console.log('Two categories, compatible sets, category-specific creation, dirty-change protection, required master category, compatible request versions, preserved quotations and read-only Check access passed.');
}).catch(e=>{console.error(e);process.exitCode=1});
