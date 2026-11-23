'use strict';
/* Calculation formulas: ROKI edits formulas, each save is a new version with a reason,
   issued quotations keep their version, locks reach the supplier editor, invalid formulas cannot be saved. */
const {run,store,reset,login,assert}=require('./_env.cjs');
run('verify-formulas',async({base,context})=>{
  const roki=await context.newPage();
  await reset(roki,base,'roki');

  /* only ROKI Approve can edit */
  await login(roki,base,'roki','r-check','formulas');
  assert.equal(await roki.locator('[data-fp="sections.2.expr"]').isDisabled(),true,'Check role is read-only');
  assert.match(await roki.locator('.highlight-note').first().innerText(),/Only WEBPARK Approve/);
  await roki.evaluate(()=>sessionStorage.setItem('roki-session-roki','r-approve'));await roki.reload();
  assert.equal(await roki.locator('[data-fp="sections.2.expr"]').isDisabled(),false);
  assert.match(await roki.locator('.highlight-note').first().innerText(),/v1/);

  /* untouched draft reproduces the stored totals exactly */
  const quote=async id=>(await store(roki)).quotes.find(q=>q.id===id);
  const before=(await quote('Q-2026-0046')).total;
  assert.equal(await roki.locator('#fm-save').isDisabled(),true,'Nothing to save yet');

  /* invalid formulas are explained and block saving */
  const expr=roki.locator('[data-fp="sections.2.expr"]');
  await roki.locator('#fm-reason').fill('Test');
  await expr.fill('rate*time/nope');
  assert.match(await roki.locator('#fm-errors').innerText(),/“nope”/);assert.equal(await roki.locator('#fm-save').isDisabled(),true);
  await expr.fill('rate*time/(');
  assert.match(await roki.locator('#fm-errors').innerText(),/brackets|incomplete|unexpected/i);
  await expr.fill('rate*time/cavity; drop');
  assert.match(await roki.locator('#fm-errors').innerText(),/unexpected symbol/);
  await expr.fill('rate*time/cavity*1.1');
  assert.equal(await roki.locator('#fm-errors .fm-errors').count(),0);
  assert.match(await roki.locator('#fm-errors').innerText(),/Draft is valid/);
  assert.equal(await roki.locator('#fm-save').isDisabled(),false);
  const row=await roki.locator('#fm-preview tr',{hasText:'Process'}).first().innerText();
  assert.match(row,/\+/,'Live check shows the increase');

  /* save → version 2 with reason; old quotations keep their numbers */
  await roki.locator('#fm-reason').fill('Process charge now includes a 10% handling factor.');
  await roki.locator('#fm-save').click();
  await roki.locator('.highlight-note').first().waitFor();
  let data=await store(roki);
  assert.equal(data.formulas.current,2);assert.equal(data.formulas.versions.length,2);
  assert.equal(data.formulas.versions[1].reason,'Process charge now includes a 10% handling factor.');
  assert(data.formulas.versions[1].changes.some(c=>c[0]==='Single Part'&&c[2]==='Formula changed'));
  assert.equal((await quote('Q-2026-0046')).total,before,'Stored totals are unchanged');
  assert.equal(await roki.evaluate(()=>totals((db.quotes.find(q=>q.id==='Q-2026-0046')).costs).total),before,'Issued quotation recalculates with its own version');
  assert.equal(await roki.evaluate(()=>totals(blankCosts('Single Part')).total),0,'New quotations bind to v2');
  assert.equal(await roki.evaluate(()=>blankCosts('Single Part').fv),2);
  const v2total=await roki.evaluate(()=>{const c=adaptCosts(db.quotes.find(q=>q.id==='Q-2026-0046').costs,'Single Part');return totals(c).total});
  assert(v2total>before,'Same costs give a higher price under v2: '+v2total+' > '+before);
  assert.match(await roki.locator('.highlight-note').first().innerText(),/v2/);
  assert.match(await roki.locator('tbody',{hasText:'handling factor'}).innerText(),/Process/);

  /* lock profit & admin at 12% for Assembly; add a fixed fee to the total; a column with a rule */
  await roki.locator('[data-fm-tab="Assembly"]').click();
  await roki.locator('[data-fp="profit.percent"]').fill('12');
  await roki.locator('[data-fp="profit.lock"]').uncheck();
  await roki.locator('[data-fp="total"]').fill('subtotal+profit+spare+0.5');
  await roki.locator('[data-fm-add-field="2"]').click();
  await roki.locator('[data-fp="sections.2.fields.5.0"]').fill('yield');await roki.locator('[data-fp="sections.2.fields.5.1"]').fill('Yield');
  await roki.locator('[data-fr="sections.2.fields.5"]').selectOption('positive');await roki.locator('[data-fp="sections.2.fields.5.4.def"]').fill('1');
  await roki.locator('[data-fp="sections.2.expr"]').fill('rate*time/cavity/yield');
  assert.equal(await roki.locator('#fm-errors .fm-errors').count(),0,await roki.locator('#fm-errors').innerText());
  await roki.locator('#fm-reason').fill('Fixed profit 12% for assemblies, 0.50 THB handling, yield column in process.');
  await roki.locator('#fm-save').click();await roki.locator('.fm-tabs').waitFor();
  data=await store(roki);assert.equal(data.formulas.current,3);
  const asm=data.formulas.versions[2].formats.Assembly;
  assert(asm.profit.lock&&asm.profit.percent===12);assert.equal(asm.total,'subtotal+profit+spare+0.5');
  assert.equal(asm.sections[2].fields[5][0],'yield');assert.equal(asm.sections[2].fields[5][4].positive,true);
  const t3=await roki.evaluate(()=>{const c=blankCosts('Assembly');c.components=[{partNo:'x',name:'x',origin:'Local',rate:10,qty:1}];c.process=[{name:'p',machine:'',cavity:1,time:10,rate:1,yield:2}];return totals(c)});
  assert.equal(t3.C,5,'Yield column is used by the process formula');
  assert.equal(t3.profit,0.6,'12% of process 5.00');
  assert.equal(t3.total,r(10*1.005+5+0.6+0.5),'Total formula adds the fixed amount');
  function r(v){return Math.round(v*100)/100}

  /* supplier editor follows the new version: locked profit, new column */
  const supplier=await context.newPage();
  await login(supplier,base,'supplier','s1-issue','quote/Q-2026-0105');
  await supplier.locator('[data-edit]').first().click();
  assert.equal(await supplier.locator('#profit').getAttribute('readonly'),'','Locked profit is read-only');
  assert.equal(await supplier.locator('#profit').inputValue(),'12');assert.equal(await supplier.locator('#basis').isDisabled(),true);
  await supplier.locator('[data-tab="process"]').click();
  assert.equal(await supplier.locator('[data-field="yield"]').count(),1,'New column appears in the editor');
  assert.match(await supplier.locator('.cost-formula').innerText(),/yield/);
  await supplier.locator('#remark').fill('Reissued under the new formulas.');
  await supplier.locator('button[type="submit"]').click();await supplier.locator('.status-strip').waitFor();
  const issued=(await store(roki)).quotes.find(q=>q.id==='Q-2026-0105');
  assert.equal(issued.costs.fv,3,'Reissued quotation is bound to the current version');
  assert.equal(issued.costs.profit,12);
  assert.equal(issued.baseline.costs.fv||1,1,'Its baseline keeps the version it was approved under');

  /* restore v1 as a new version */
  await roki.reload();
  await roki.locator('[data-fm-load="1"]').click();
  await roki.locator('#fm-reason').fill('Back to the original formulas.');await roki.locator('#fm-save').click();await roki.locator('.fm-tabs').waitFor();
  data=await store(roki);assert.equal(data.formulas.current,4);
  assert.equal(JSON.stringify(data.formulas.versions[3].formats),JSON.stringify(data.formulas.versions[0].formats),'v4 equals v1');
  assert(data.audit.some(a=>a.action.startsWith('Saved calculation formulas · version 4')));
});
