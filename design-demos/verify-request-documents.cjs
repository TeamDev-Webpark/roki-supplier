'use strict';
const {run,login,switchTo,store,approveStep,assert}=require('./_env.cjs');
run('RFQ target prices, reference snapshots and quotation links at every step',async({base,context})=>{
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 const p=await context.newPage();await login(p,base,'roki','r-issue','request-new');
 const parts=await p.evaluate(()=>['s1','s2'].map(supplier=>{const i=db.items.find(i=>i.supplier===supplier&&activeQuote(i.id)&&!wfActive(i.id)&&!rfqReserved(i.id));return {id:i.id,quote:activeQuote(i.id).id,price:activeQuote(i.id).total,supplier}}));
 for(const i of parts)await p.locator(`[data-select="${i.id}"]`).check();
 await p.locator('[data-action="notify"]').click();assert.equal(await p.locator('[data-rfq-target]').count(),2);
 for(const i of parts)assert.equal(await p.locator(`.dialog [data-quote-access="${i.quote}"]`).count(),1);
 await p.locator('#rfq-purpose').fill('Review material increases against the approved baseline; internal targets support negotiation.');
 await p.locator('.dialog [data-rfq-preview]').first().click();await p.locator('.quotation-preview .qt-form').waitFor();
 await p.locator('[data-close-preview]').click();assert.equal(await p.locator('#rfq-purpose').inputValue(),'Review material increases against the approved baseline; internal targets support negotiation.','Preview preserves unsaved request fields');
 const target=p.locator(`[data-rfq-target="${parts[0].id}"]`),count=(await store(p)).priceRequests.length;
 for(const value of ['-5','0','12.345']){
  await target.fill(value);await p.locator('[data-action="send-notifications"]').click();assert.equal((await store(p)).priceRequests.length,count,'Invalid target must not save');
 }
 await target.fill('12.34');await p.locator('[data-action="send-notifications"]').click();
 const id=await p.evaluate(()=>location.hash.split('/')[1]),record=async()=>(await store(p)).priceRequests.find(r=>r.id===id);
 assert.equal((await record()).priceLines[parts[0].id].targetPrice,12.34);assert.equal((await record()).priceLines[parts[1].id].targetPrice,null);
 for(const i of parts){const line=(await record()).priceLines[i.id];assert.equal(line.referenceQuote,i.quote);assert.equal(line.referencePrice,i.price)}
 await p.reload();assert.equal(await p.locator('.rfq-price-table [data-document-kind="reference"] [data-quote-access]').count(),2);
 await p.locator(`[href="#request-new/${id}"]`).click();await p.locator('[data-action="notify"]').click();
 assert.equal(await p.locator(`[data-rfq-target="${parts[0].id}"]`).inputValue(),'12.34');
 await p.locator(`[data-rfq-target="${parts[0].id}"]`).fill('11.75');await p.locator('[data-action="rfq-save-submit"]').click();
 assert.equal((await record()).versions.at(-1).priceLines[parts[0].id].targetPrice,12.34,'Previous target retained in version');
 const reference=structuredClone((await record()).priceLines);
 const act=async action=>{await p.locator(`[data-rfq="${action}"]`).click();await p.locator('#rfq-confirm').check();await p.locator('[data-action="rfq-confirm"]').click()};
 for(const account of ['r-check','r-approve']){
  await switchTo(p,base,'roki',account,'request-register/'+id);
  assert.equal(await p.locator('[data-rfq-target]').count(),0,'Reviewer does not edit targets');
  assert.equal(await p.locator('.rfq-price-table [data-document-kind="reference"] [data-quote-access]').count(),2);
  await act('advance');assert.deepEqual((await record()).priceLines,reference,'Approval retains reference snapshot');
 }
 await switchTo(p,base,'roki','r-issue','request-dispatch');
 assert.equal(await p.locator(`[data-rfq-row="${id}"] [data-quote-access]`).count(),2);
 await p.goto(base+'roki.html#request-register/'+id);await act('send');
 const notes=(await store(p)).notifications.filter(n=>n.priceRequestId===id);assert.equal(notes.length,2);
 for(const n of notes){assert.equal(n.priceLines,undefined);assert.equal(n.targetPrice,undefined);for(const id of n.items){assert.equal(n.referencePrices[id].referenceQuote,reference[id].referenceQuote);assert.equal(n.referencePrices[id].referencePrice,reference[id].referencePrice);assert.equal(n.referencePrices[id].targetPrice,undefined)}}
 const n=notes.find(n=>n.supplier==='s1');
 await switchTo(p,base,'supplier','s1-issue','request-detail/'+n.id+'/'+parts[0].id);
 assert.equal(await p.locator('.rfq-price-table,[data-rfq-target]').count(),0,'Internal targets stay out of Supplier UI');
 assert.equal(await p.locator('[data-document-kind="reference"] [data-quote-access]').count(),1);
 await p.locator(`[data-request="${n.id}"]`).first().click();await p.locator('#remark').fill('Material quotation reviewed; existing rates retained for the next production quarter.');
 await p.locator('[data-action="save-draft"]').click();const qid=await p.evaluate(()=>location.hash.split('/')[1]);
 assert((await store(p)).quotes.some(q=>q.id===qid&&q.status==='Draft'),'Supplier draft created');
 await switchTo(p,base,'roki','r-check','request-register/'+id);
 assert.equal(await p.locator(`[data-document-kind="response"] [data-quote-access="${qid}"]`).count(),0,'Supplier draft remains private');
 await switchTo(p,base,'supplier','s1-issue','quote/'+qid);await p.locator('[data-edit]').first().click();await p.locator('#quote-form button[type="submit"]').click();
 await switchTo(p,base,'supplier','s1-approve','quote/'+qid);await approveStep(p);
 for(const account of ['r-issue','r-check','r-approve']){
  await switchTo(p,base,'roki',account,'request-register/'+id);
  assert.equal(await p.locator(`[data-document-kind="response"] [data-quote-access="${qid}"]`).count(),1,'New quotation reachable at '+account);
  await p.locator(`[data-document-kind="response"] [data-quote-access="${qid}"]`).click();await p.locator(`a[href="#print/${qid}"]`).first().click();await p.locator('.qt-form').waitFor();
 }
 await p.setViewportSize({width:390,height:844});await p.goto(base+'roki.html#request-register/'+id);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Small-screen tables scroll within panels');
 console.log('Validated optional/invalid prices, per-part snapshots, revision history, internal approvals, split dispatch, Supplier privacy and old/new quotation links.');
}).catch(e=>{console.error(e);process.exitCode=1});
