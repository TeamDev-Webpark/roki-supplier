'use strict';
/* Read-only audit of customer-form gaps. Changes below live only in an isolated browser context. */
const fs=require('node:fs'),path=require('node:path');
const {run,login,switchTo,store,assert}=require('./_env.cjs');
run('customer form evidence audit',async({base,context,shot})=>{
 const p=await context.newPage();await login(p,base,'roki','r-issue','parts');const result={};
 result.formulaCoverage=await p.evaluate(()=>({formats:FORMULAS.versions[0].formats,sets:FORMULAS.sets.map(s=>({name:s.name,formats:s.formats}))}));
 result.excelInjection=await p.evaluate(()=>{
  const c=blankCosts('Single Part');Object.assign(c,{material:[{code:'EKC0006-016-D10',name:'TTR-50',origin:'Local',weight:.135,scrap:.013,rate:56}],components:[{partNo:'17213-KWN-9001',name:'SEAL,DUCTCOVER',origin:'Local',qty:1,rate:2.1}],process:[{name:'Injection',machine:'450T',cavity:2,time:350,rate:.194},{name:'Inspection',machine:'',cavity:1,time:10,rate:.01},{name:'Checking',machine:'',cavity:1,time:10,rate:.015},{name:'Finishing',machine:'',cavity:1,time:15,rate:.015},{name:'Assy',machine:'',cavity:1,time:10,rate:.01}],packing:[{name:'Rack',amount:100000,qty:250000},{name:'Foam sheet',amount:.5,qty:1}],equipment:[{name:'Injection mold',origin:'Local',cavity:4,amount:1000000,volume:250000}]});
  const defaultValue=totals(c);c.componentLoss=3;c.spare=15;return {defaultTotal:defaultValue.total,withCustomerPercentages:totals(c),excelCachedUnrounded:62.20839000000001,excelDisplay2:62.21};
 });
 await p.locator('[data-action="add-part"]').click();await p.locator('#pf-code').fill('AUDIT-FIRST-TIME');await p.locator('#pf-name').fill('Audit new part with missing customer headers');await p.locator('#pf-supplier').selectOption('s1');await p.locator('#pf-format').selectOption('Single Part');await p.locator('[data-action="save-part"]').click();
 const id=await p.evaluate(()=>db.items.find(i=>i.code==='AUDIT-FIRST-TIME').id);await p.goto(base+'roki.html#request-new');await p.locator(`[data-single-request="${id}"]`).click();
 result.newRequestDefaults=await p.evaluate(id=>({rtp:db.items.find(i=>i.id===id).rtp,quantity:document.querySelector(`[data-request-qty="${id}"]`).value,drawing:document.querySelector(`[data-request-drawing="${id}"]`).value,requestAttachmentInputs:document.querySelectorAll('.dialog input[type="file"]').length}),id);
 await p.locator('#rfq-purpose').fill('Audit: demonstrate missing metadata can still be dispatched.');await p.locator('[data-action="rfq-save-submit"]').click();await p.locator('[data-quotation-history]').first().waitFor();
 const rid=await p.evaluate(()=>route().split('/')[1]),note=(await store(p)).notifications.find(n=>n.priceRequestId===rid);result.dispatchAcceptedWithMissingMaster={request:rid,form:note.forms[id]};
 result.newAssemblyBom=await p.evaluate(()=>{const i={...db.items.find(i=>i.format==='Assembly'),id:'audit-assembly',children:[{code:'AUDIT-CHILD-1',qty:2},{code:'AUDIT-CHILD-2',qty:1}]};return {masterChildren:i.children,generatedRows:blankRequestCosts(i,{formulaVersion:1}).components}});
 await switchTo(p,base,'supplier','s1-issue','request-detail/'+note.id+'/'+id);await p.locator(`[data-request="${note.id}"]`).first().click();
 result.supplierEditable=await p.evaluate(()=>({quantity:!document.querySelector('#quantity').readOnly,effective:!document.querySelector('#effective').readOnly,drawing:!document.querySelector('#drawing').readOnly,profit:!document.querySelector('#profit').readOnly,spare:!document.querySelector('#spare').readOnly,profitBase:!document.querySelector('#basis').disabled,endingInput:!!document.querySelector('#ending')}));
 await p.evaluate(()=>{const c=window.formCosts;c.material=[{code:'',name:'Audit material without code',origin:'Local',weight:.1,scrap:0,rate:100}];c.components=[];c.process=[];c.packing=[];c.equipment=[];c.materialLoss=0;c.componentLoss=0;c.pm=0;c.profit=99;c.spare=0;c.basis='subtotal';render()});
 result.validationWithoutMaterialCodeOrProcess=await p.evaluate(()=>validateCosts(window.formCosts));
 await p.locator('#quantity').fill('999');await p.locator('#drawing').fill('SUPPLIER-CHANGED');await p.locator('#effective').fill('2020-01-01');await p.locator('#remark').fill('Audit changed requested header and unlocked formula parameters.');await p.locator('#quote-form button[type="submit"]').click();await p.locator('[data-timeline-phase="after"]').waitFor();
 result.submission=await p.evaluate(()=>{const q=db.quotes.find(q=>q.id===route().split('/')[1]);return {status:q.status,quantity:q.quantity,drawing:q.drawing,effective:q.effective,profit:q.costs.profit,total:q.total,materialCode:q.costs.material[0].code,formulaVersion:q.costs.fv}});
 assert.equal(result.submission.status,'Supplier approval');assert.equal(result.submission.profit,99);assert.equal(result.submission.quantity,999);assert.equal(result.submission.effective,'2020-01-01');
 await p.goto(base+'supplier.html#print/'+await p.evaluate(()=>db.quotes.at(-1).id));await shot(p,'audit-system-quotation-print.png',{fullPage:true});
 fs.writeFileSync(path.join(__dirname,'previews/customer-form-audit-evidence.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({newRequestDefaults:result.newRequestDefaults,excel:{defaultTotal:result.excelInjection.defaultTotal,configuredTotal:result.excelInjection.withCustomerPercentages.total,sourceDisplay:result.excelInjection.excelDisplay2},bom:result.newAssemblyBom,supplierEditable:result.supplierEditable,submission:result.submission},null,2));
});
