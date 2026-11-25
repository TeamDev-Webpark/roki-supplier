'use strict';
/* Assemblies and sub-parts: a new cost form gets one row per BOM component, sub-part prices are linked from the approved
   quotations (unrounded total, as in the Excel sheets), missing prices block issuing, and the cost form handles the new
   customer-sheet columns (Yes/No choices, repayment, per-line maintenance). */
const {run,login,store,switchTo,assert}=require('./_env.cjs');
run('verify-bom-links',async({base,context})=>{
  const p=await context.newPage();await login(p,base,'roki','r-issue','parts');
  const steel=await p.evaluate(()=>FORMULAS.sets.find(s=>s.id==='steel').current);

  /* GUARD ELEMENT = PLATE + MESH (same supplier): rows exist, prices come from their approved quotations */
  const guard=await p.evaluate(v=>{
    const i=db.items.find(i=>i.code==='17211-K16-9000-H1'),c=blankRequestCosts(i,{formulaVersion:v});
    const approved=code=>latestApproved(db.items.find(x=>x.code===code&&x.supplier===i.supplier).id);
    return {fv:c.fv,rows:c.components,expected:i.children.map(ch=>{const q=approved(ch.code);return {partNo:ch.code,qty:ch.qty,quote:q.id,price:q.totalRaw??q.total}})};
  },steel);
  assert.equal(guard.fv,steel);assert.equal(guard.rows.length,2,'One row per BOM component, no duplicates');
  for(const e of guard.expected){
    const row=guard.rows.find(r=>r.partNo===e.partNo);
    assert(row,'Row for '+e.partNo);assert.equal(row.qty,e.qty);assert.equal(row.link,e.partNo);assert.equal(row.linkQuote,e.quote);assert.equal(row.rate,e.price,'Linked price');assert(!row.linkMissing);
  }
  /* an assembly whose components are not managed parts still gets its rows, with prices left for the Supplier */
  const assy=await p.evaluate(()=>{const i=db.items.find(i=>i.format==='Assembly'&&i.children.length),c=blankRequestCosts(i,{formulaVersion:6});return {rows:c.components.map(r=>({partNo:r.partNo,qty:r.qty,rate:r.rate,link:r.link||null})),kids:i.children.length,format:c.format}});
  assert.equal(assy.format,'Assembly');assert.equal(assy.rows.length,assy.kids);assert(assy.rows.every(r=>r.link===null&&r.rate===null),'Unmanaged components are priced by the Supplier');
  /* no approved price yet: the row is flagged, issuing is blocked, and refreshing picks the price up once approved */
  const missing=await p.evaluate(()=>{
    const child={id:'i-test-child',code:'ZZ-TEST-CHILD',name:'TEST CHILD',supplier:'s1',format:'Single Part',children:[],price:null,last:null,next:null,cadence:3};
    db.items.push(child);
    const i={...structuredClone(db.items.find(i=>i.code==='17211-K16-9000-H1')),id:'x-bom',supplier:'s1',children:[{code:'ZZ-TEST-CHILD',qty:2}]};
    const c=blankRequestCosts(i,{formulaVersion:1}),before={missing:c.components[0].linkMissing,message:missingLinks(c)};
    const twice=(syncComponents(c,i),syncComponents(c,i),c.components.length);
    db.quotes.push({id:'Q-TEST-LINK',item:child.id,supplier:'s1',status:'Approved',effective:'2026-01-01',total:12.5,totalRaw:12.4963,costs:{format:'Single Part',fv:1},trail:[],versions:[]});
    const n=refreshLinks(c,'s1'),after=c.components[0];db.quotes.pop();db.items.pop();
    return {before,twice,n,rate:after.rate,quote:after.linkQuote,flag:after.linkMissing,message:missingLinks(c)};
  });
  assert.equal(missing.before.missing,true);assert.match(missing.before.message,/no approved price yet/);assert.equal(missing.twice,1,'Syncing twice never duplicates rows');
  assert.equal(missing.n,1);assert.equal(missing.rate,12.4963);assert.equal(missing.quote,'Q-TEST-LINK');assert.equal(missing.flag,undefined);assert.equal(missing.message,'');

  /* supplier cost form: linked rows are read-only, can be refreshed or unlinked; choice and per-line columns work */
  await p.evaluate(v=>{
    const i=db.items.find(i=>i.code==='17211-K16-9000-H1');
    db.notifications.push({id:'N-BOM-1',supplier:'s3',items:[i.id],created:timestamp(),by:'Somchai K.',due:'2026-12-31',message:'BOM link check',read:false,
      forms:{[i.id]:{formulaVersion:v,quantity:1000,drawing:'D1',effective:'2027-01-01',costs:blankRequestCosts(i,{formulaVersion:v}),itemSnapshot:partIdentity(i)}}});
    persist();
  },steel);
  const s=await context.newPage();
  await login(s,base,'supplier','s3-issue','overview');
  await s.evaluate(()=>{const i=db.items.find(i=>i.code==='17211-K16-9000-H1');newQuote(i.id,'N-BOM-1')});
  await s.locator('#quote-form').waitFor();
  await s.locator('[data-tab="components"]').click();
  assert.equal(await s.locator('.cost-table tbody tr').count(),2);
  assert.equal(await s.locator('[data-field="rate"][readonly]').count(),2,'Linked prices are read-only');
  assert.match(await s.locator('.link-note').first().innerText(),/Linked price · Q-/);
  const shown=await s.locator('[data-field="rate"]').first().inputValue();
  await s.locator('[data-action="refresh-links"]').click();assert.match(await s.locator('#toast').innerText(),/Updated 2 linked part prices/);
  await s.locator('[data-unlink="0"]').click();
  assert.equal(await s.locator('[data-field="rate"][readonly]').count(),1,'Unlinked row can be priced by hand');
  assert.equal(await s.locator('[data-field="rate"]').first().inputValue(),shown,'Unlinking keeps the price');
  assert.equal(await s.evaluate(()=>missingLinks(window.formCosts)),'');
  await s.evaluate(()=>{window.formCosts.components[1].linkMissing=true});
  assert.match(await s.evaluate(()=>missingLinks(window.formCosts)),/no approved price/);
  /* equipment line of the Steel sheet: investment type, repayment choice, per-line maintenance % */
  await s.locator('[data-tab="equipment"]').click();await s.locator('[data-action="add-cost"]').click();
  assert.deepEqual(await s.locator('select[data-field="repaid"] option').allInnerTexts(),['Not repaid','Repaid']);
  assert.deepEqual(await s.locator('select[data-field="invType"] option').allInnerTexts(),['New investment','Common tool']);
  await s.locator('[data-cost="0"][data-field="amount"]').fill('1000000');await s.locator('[data-cost="0"][data-field="volume"]').fill('250000');
  assert.equal(await s.locator('[data-expense="0"]').innerText(),'4.20','4.00 tool cost + 5% interest');
  await s.locator('select[data-field="repaid"]').selectOption('Repaid');
  assert.equal(await s.locator('[data-expense="0"]').innerText(),'0.20','A repaid tool keeps only its interest');
  assert.equal(await s.evaluate(()=>window.formCosts.equipment[0].repaid),'Repaid');

  /* adding an assembly can also create its missing component parts for the supplier */
  await p.goto(base+'roki.html#parts');await p.reload();
  await p.locator('[data-action="add-part"]').click();
  await p.locator('#pf-code').fill('BOM-ASSY-001');await p.locator('#pf-name').fill('BOM TEST ASSY');await p.locator('#pf-format').selectOption('Assembly');await p.locator('#pf-formula-set').selectOption({index:1});await p.locator('#pf-supplier').selectOption('s2');
  await p.locator('#pf-children').fill('17253-KWN-9000, 2\nBOM-NEW-CHILD, 1');await p.locator('#pf-create-children').check();
  await p.locator('[data-action="save-part"]').click();await p.locator('.dialog').waitFor({state:'detached'});
  const d=await store(p),kids=d.items.filter(i=>i.supplier==='s2'&&['17253-KWN-9000','BOM-NEW-CHILD'].includes(i.code));
  assert.equal(kids.length,2,'Missing components exist as parts of the supplier');
  assert.equal(kids.find(i=>i.code==='BOM-NEW-CHILD').name,'BOM-NEW-CHILD');
  assert.equal(d.items.filter(i=>i.code==='17253-KWN-9000'&&i.supplier==='s2').length,1,'An existing pair is not duplicated');
  assert.deepEqual(d.items.find(i=>i.code==='BOM-ASSY-001').children,[{code:'17253-KWN-9000',qty:2},{code:'BOM-NEW-CHILD',qty:1}]);
});
