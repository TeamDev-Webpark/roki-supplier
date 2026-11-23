'use strict';
const {run,reset,login,switchTo,store,approveStep,assert}=require('./_env.cjs');
const fs=require('node:fs');
run('price validity, immutable originals, equivalent parts and document tracking',async({base,context,shot})=>{
 const p=await context.newPage();await reset(p,base,'roki');await login(p,base,'roki','r-issue','process');
 assert.equal(await p.locator('.process-phases article').count(),3);
 assert.equal(await p.evaluate(()=>bangkokDay(new Date('2026-11-22T18:00:00Z'))),'2026-11-23','Bangkok midnight boundary');
 assert.equal(await p.evaluate(()=>TODAY),'2026-11-23','Live day comes from Bangkok clock');
 await p.evaluate(()=>I18N.set('th'));await shot(p,'webpark-process-overview-th.png');await p.evaluate(()=>I18N.set('en'));

 // Actual part form: link equivalent items with different codes; adding never sends.
 await p.goto(base+'roki.html#parts');const notices=(await store(p)).notifications.length;
 await p.locator('[data-action="add-part"]').click();
 await p.locator('#pf-code').fill('ALT-TUBE-001');await p.locator('#pf-name').fill('Equivalent tube');
 await p.locator('#pf-supplier').selectOption('s1');await p.locator('#pf-family').fill('17253-KWN-9000');
 await p.locator('[data-action="save-part"]').click();
 const alternate=(await store(p)).items.find(i=>i.code==='ALT-TUBE-001');assert(alternate);
 assert.equal((await store(p)).notifications.length,notices);
 await p.goto(base+'roki.html#part/'+alternate.id);assert(await p.locator('[href="#part/i2"]').count());
 await p.goto(base+'roki.html#process/'+alternate.id);
 assert.match(await p.locator('.process-owner').innerText(),/create a price request/);
 await p.goto(base+'roki.html#reports/17253-KWN-9000');
 assert.equal(await p.evaluate(()=>historyItems().filter(i=>familyMatches(i,reportCode)).length),3);

 // Editing a returned quotation preserves the original header independently of the new header.
 await switchTo(p,base,'supplier','s1-issue','quote/Q-2026-0105');
 const original=await p.evaluate(()=>{const q=db.quotes.find(q=>q.id==='Q-2026-0105');return db.quotes.find(b=>b.id===q.baseline.quote)});
 await p.locator('[data-edit]').first().click();
 await p.locator('#quantity').fill('987654');await p.locator('#drawing').fill('NEW-DRAWING');
 await p.locator('#remark').fill('Changed volume and drawing; retain the original header.');
 await p.locator('button[type="submit"]').click();
 await p.goto(base+'supplier.html#print/Q-2026-0105');
 const columns=await p.locator('.qt-col').allTextContents();
 assert(columns[0].includes(original.drawing));assert(columns[0].includes(Number(original.quantity).toLocaleString('en-US')));
 assert(!columns[0].includes('NEW-DRAWING')&&!columns[0].includes('987,654'));
 assert(columns[1].includes('NEW-DRAWING')&&columns[1].includes('987,654'));
 const issued=(await store(p)).quotes.find(q=>q.id==='Q-2026-0105');assert(issued.itemSnapshot&&issued.versions[0].drawing);
 await p.evaluate(()=>{db.items.find(i=>i.id===db.quotes.find(q=>q.id==='Q-2026-0105').item).name='MASTER RENAMED';persist()});
 await p.reload();assert(!(await p.locator('.qt-form').innerText()).includes('MASTER RENAMED'),'Issued identity is immutable');

 // A future approval is not the active price; old approved versions remain historical.
 await switchTo(p,base,'roki','r-approve','quote/Q-2026-0104');
 const previous=await p.evaluate(()=>{const q=db.quotes.find(q=>q.id==='Q-2026-0104');q.effective=addMonths(TODAY,2);return activeQuote(q.item).total});
 await approveStep(p);
 assert.equal(await p.evaluate(()=>priceValidity(db.quotes.find(q=>q.id==='Q-2026-0104'))),'scheduled');
 assert.equal((await store(p)).items.find(i=>i.id==='i4').price,previous);
 await p.reload();assert.equal((await store(p)).items.find(i=>i.id==='i4').price,previous);
 await p.goto(base+'roki.html#quotes');await p.locator('#price-filter').selectOption('scheduled');assert.equal(await p.locator('tbody tr').count(),1);await p.goto(base+'roki.html#exports');
 const pending=p.waitForEvent('download');await p.locator('[data-action="export"]').click();
 const csv=fs.readFileSync(await (await pending).path(),'utf8');
 assert(!csv.includes('Q-2026-0104')&&!csv.includes('Q-2023-0003'),'Future and superseded prices excluded');
 assert(csv.includes('Q-2025-0041'),'Latest effective approval exported');
 const unique=await p.evaluate(()=>{const active=db.quotes.filter(q=>priceValidity(q)==='active');return active.length===new Set(active.map(q=>q.item)).size});assert(unique);

 // Reaching an effective date activates an approved quotation without a second approval.
 await p.evaluate(()=>{const q=db.quotes.find(q=>q.id==='Q-2026-0104');q.effective=TODAY;persist()});
 await p.reload();assert.equal(await p.evaluate(()=>priceValidity(db.quotes.find(q=>q.id==='Q-2026-0104'))),'active');
 assert.equal((await store(p)).items.find(i=>i.id==='i4').price,(await store(p)).quotes.find(q=>q.id==='Q-2026-0104').total);

 // Populate current scenarios to test links and isolation on real connected document chains.
 await p.evaluate(()=>{delete db.demoDataVersion;db=populateDemoData(db);prepareLifecycleData();persist()});
 await p.reload();
 const q=await p.evaluate(()=>db.quotes.find(q=>q.status==='ROKI Check'&&q.requestedBy&&detailSentRequest(q)?.priceRequestId));
 await p.goto(base+'roki.html#quote/'+q.id);
 assert(await p.locator('.source-links [href="#part/'+q.item+'"]').count());
 const n=(await store(p)).notifications.find(n=>n.id===q.requestedBy);
 assert(await p.locator('.source-links [href="#request-register/'+n.priceRequestId+'"]').count());
 await p.locator('.source-links [href="#process/'+q.item+'/'+q.id+'"]').click();
 assert.match(await p.locator('.process-owner').innerText(),/Check/);
 assert.equal(await p.locator('.process-steps [aria-current="step"]').count(),1);
 await p.evaluate(()=>I18N.set('th'));await shot(p,'webpark-document-chain-th.png');
 await p.setViewportSize({width:390,height:844});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile chain fits');
 await shot(p,'webpark-document-chain-mobile-th.png',{fullPage:false});
 await switchTo(p,base,'supplier','s2-issue','process');
 const foreign=(await store(p)).items.find(i=>i.supplier==='s1');
 await p.goto(base+'supplier.html#process/'+foreign.id);assert.equal(await p.locator('.process-steps').count(),0,'Foreign source hidden');
 await p.goto(base+'supplier.html#process');assert.equal(await p.locator('[href^="#request-register/"]').count(),0,'Internal requests hidden from Supplier');
},{clock:'2026-11-23T03:00:00Z'});
