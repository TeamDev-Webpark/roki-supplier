'use strict';
/* Columns that WEBPARK fixes in the request form cannot be changed by the Supplier. */
const {run,login,switchTo,store,assert}=require('./_env.cjs');
run('WEBPARK-fixed columns in the Supplier cost form',async({base,context})=>{
  const p=await context.newPage();await login(p,base,'roki','r-issue','overview');
  const info=await p.evaluate(()=>{const n=db.notifications.find(n=>n.forms&&Object.values(n.forms).some(f=>f.costs.format==='Single Part'&&f.costs.material));const id=Object.keys(n.forms).find(i=>n.forms[i].costs.format==='Single Part'&&n.forms[i].costs.material);return {n:n.id,supplier:n.supplier,item:id}});
  await switchTo(p,base,'supplier',info.supplier+'-issue','request-detail/'+info.n+'/'+info.item);
  const start=p.locator(`[data-request="${info.n}"]`).first();
  if(await start.count())await start.click();else await p.locator('[data-edit]').first().click();
  await p.locator('.cost-table').waitFor();
  const loss=p.locator('input[data-field="loss"]').first();assert.equal(await loss.isEnabled(),true,'readonly keeps it focusable? checked below');
  assert.equal(await loss.getAttribute('readonly')!==null,true,'Loss % is set by WEBPARK');
  assert.equal(await p.locator('input[data-field="rate"]').first().getAttribute('readonly'),null,'Cost per kg is entered by the Supplier');
  assert.equal(await p.locator('input[data-field="weight"]').first().getAttribute('readonly'),null);
  /* typing into the DOM or changing the model cannot survive saving */
  const before=await p.evaluate(()=>window.formCosts.material[0].loss);
  await p.evaluate(()=>{window.formCosts.material[0].loss=99});
  await p.evaluate(()=>{const c=window.formCosts;for(const s of sectionsOf(c))for(const r of c[s.key])for(const f of s.fields){if(f[2]==='number'&&r[f[0]]==null)r[f[0]]=20;if(f[2]!=='number'&&isRequired(f)&&!r[f[0]])r[f[0]]='x'}});
  await p.locator('[data-action="save-draft"]').click();
  const qid=await p.evaluate(()=>location.hash.split('/')[1]);
  assert.equal((await store(p)).quotes.find(q=>q.id===qid).costs.material[0].loss,before,'Saving restores the fixed value');
});
