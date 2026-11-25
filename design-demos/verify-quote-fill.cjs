'use strict';
const {run,login,switchTo,assert}=require('./_env.cjs');
/* The sample-data button produces valid, plausible, different costs for every formula set and form category. */
run('sample costs are valid, realistic and random for every formula set',async({base,context})=>{
 const p=await context.newPage();await login(p,base,'roki','r-issue','approvals');
 const cases=await p.evaluate(()=>{const out=[];for(const i of db.items.filter(i=>i.demoScenario?.startsWith('first-'))){
  const v=formulaSetCurrent(i),spec={formulaVersion:v,quantity:i.qty,drawing:i.drawing||'A',effective:addMonths(TODAY,1),qtyPeriod:'year'};
  const costs=applySupplied(blankRequestCosts(i,spec),spec),id=uid('N');
  db.notifications.push({id,supplier:i.supplier,items:[i.id],forms:{[i.id]:{...spec,costs,itemSnapshot:partIdentity(i)}},flowVersion:2,due:addDays(TODAY,14),message:'Demo',created:timestamp(),by:'Demo',read:false,priceRequestId:null,referencePrices:{},terms:null});
  out.push({item:i.id,supplier:i.supplier,note:id,code:i.code})}persist();return out});
 assert(cases.length>=8,'one first-quotation part per formula set');
 for(const c of cases){
  await switchTo(p,base,'supplier',c.supplier+'-issue','approvals');
  await p.evaluate(c=>newQuote(c.item,c.note),c);await p.locator('#quote-form').waitFor();
  const totals=[];
  for(let k=0;k<2;k++){
   await p.locator('[data-demo-fill="quote"]').click();
   const r=await p.evaluate(()=>{const c=window.formCosts;return {err:validateCosts(c),total:totals(c).total,mat:(c.material||[]).map(m=>[m.weight,m.rate]).slice(0,1)}});
   assert.equal(r.err,'',c.code+' valid');assert(r.total>0&&r.total<5000,c.code+' plausible unit price '+r.total);totals.push(r.total);
  }
  assert.notEqual(totals[0],totals[1],c.code+' is random');
 }
});
