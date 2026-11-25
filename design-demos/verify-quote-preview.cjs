'use strict';
const {run,login,switchTo,assert}=require('./_env.cjs');
/* The request detail page opens the quotation as a document: the blank sheet before the Supplier fills anything, the real one afterwards. */
run('request detail previews the quotation form before and after cost entry',async({base,context})=>{
 const p=await context.newPage();await login(p,base,'roki','r-issue','approvals');
 const t=await p.evaluate(()=>{const n=db.notifications.find(n=>n.forms&&n.items.some(id=>n.forms[id]&&!db.quotes.some(q=>q.item===id&&q.requestedBy===n.id)));const item=n.items.find(id=>n.forms[id]&&!db.quotes.some(q=>q.item===id&&q.requestedBy===n.id));
  const withQ=db.quotes.find(q=>q.requestedBy&&q.status==='ROKI Check');return {n:n.id,item,quote:withQ.id,qn:withQ.requestedBy,qi:withQ.item}});
 await p.evaluate(id=>{const n=db.notifications.find(n=>n.id===id);db.notifications.push({...structuredClone(n),id:'N-FOREIGN',supplier:n.supplier==='s3'?'s2':'s3',priceRequestId:null});persist()},t.n);
 await p.goto(base+`roki.html#request-detail/${t.n}/${t.item}`);
 await p.locator('[data-quote-form="preview"]').click();await p.locator('.qt-form').waitFor();
 assert.match(await p.locator('.no-print .highlight-note').innerText(),/blank|พรีวิว|Preview/i);
 assert(await p.locator('.qt-form .qt-sign').count()>=5,'Signature boxes present');
 assert.equal(await p.locator('.qt-title small').innerText()!=='','true'==='true');
 await p.goBack();await p.locator('[data-quote-form]').first().waitFor();
 await p.goto(base+`roki.html#request-detail/${t.qn}/${t.qi}`);
 const link=p.locator(`[data-quote-form="${t.quote}"]`);await link.click();await p.locator('.qt-form').waitFor();
 assert(( await p.locator('.qt-title small').innerText()).startsWith(t.quote));
 await p.setViewportSize({width:1123,height:794});await p.emulateMedia({media:'print'});
 for(const [format,id] of [['portrait','Q-2026-0046'],['landscape','Q-2026-0015']]){
  await p.goto(base+'roki.html#print/'+id);await p.locator('.qs-a4-'+format).waitFor();
  assert.equal(await p.locator('.qs-summary').isVisible(),false,'Summary is screen-only');
  assert(await p.locator('[data-signature-version="current"]').isVisible());
  if(format==='portrait'){
   assert.equal(await p.locator('.qt-cols .qt-col').count(),2,'Original and Revised are both present');
   assert.equal(await p.locator('[data-signature-version="original"]').count(),1);
   await p.setViewportSize({width:794,height:1123});
   assert(await p.locator('.qt-col .qt-table').evaluateAll(tables=>tables.every(table=>table.getBoundingClientRect().right<=table.closest('.qt-col').getBoundingClientRect().right+1)),'Cost tables fit inside their own columns at portrait width');
  }
  const pdf=await p.pdf({preferCSSPageSize:true,printBackground:true,...(process.env.QUOTE_PRINT_SAMPLE?{path:__dirname+'/previews/webpark-quotation-a4-'+format+'.pdf'}:{})});
  const source=pdf.toString('latin1'),sizes=[...source.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
  const dimensions=format==='portrait'?[595,842]:[842,595];
  assert(sizes.length&&sizes.every(([,w,h])=>Math.abs(Number(w)-dimensions[0])<2&&Math.abs(Number(h)-dimensions[1])<2),`All pages must be A4 ${format}`);
  if(format==='portrait')assert.equal(sizes.length,1,'Customer Unit Part comparison fits one A4 sheet');
 }
 // A long comparison keeps A4 page sizing instead of shrinking rows to fit one sheet.
 await p.goto(base+'roki.html#print/Q-2026-0046');
 await p.evaluate(()=>{
  const q=db.quotes.find(q=>q.id==='Q-2026-0046'),line=q.costs.material[0];
  q.costs.material=Array.from({length:70},(_,index)=>({...line,name:'Print carryover '+(index+1)}));render();
 });
 const longPdf=await p.pdf({preferCSSPageSize:true,printBackground:true,...(process.env.QUOTE_PRINT_LONG?{path:process.env.QUOTE_PRINT_LONG}:{})});
 assert((longPdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length>1,'A long comparison continues on another sheet');
 await p.emulateMedia({media:'screen'});await p.setViewportSize({width:1500,height:1100});
 await switchTo(p,base,'supplier','s1-issue','approvals');
 const own=await p.evaluate(()=>db.notifications.find(n=>n.supplier==='s1'&&n.forms&&Object.keys(n.forms).length&&n.id!=='N-FOREIGN')?.id);
 if(own){const item=await p.evaluate(id=>Object.keys(db.notifications.find(n=>n.id===id).forms)[0],own);await p.goto(base+`supplier.html#print/preview~${own}~${item}`);await p.locator('.qt-form').waitFor();}
 const foreign=await p.evaluate(()=>db.notifications.find(n=>n.id==='N-FOREIGN'&&n.supplier!=='s1'));
 await p.goto(base+`supplier.html#print/preview~${foreign.id}~${Object.keys(foreign.forms)[0]}`);assert.equal(await p.locator('.qt-form').count(),0,'Another supplier’s form is not available');
});
