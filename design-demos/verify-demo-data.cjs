'use strict';
const {run,login,switchTo,store,approveStep,assert}=require('./_env.cjs');
run('connected demo data, migration and all role menus',async({base,context})=>{
  // This check verifies offline app data; loading font glyphs is independent of the fixtures.
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  const p=await context.newPage();await login(p,base,'roki','r-issue','request-register');
  const first=await store(p);
  assert.equal(first.demoDataVersion,3);
  for(const status of ['Draft','Returned','Pending Check','Pending Approve','Approved','Rejected','Cancelled'])assert(first.priceRequests.some(r=>r.approvalStatus===status&&r.deliveryStatus==='NotSent'),status);
  for(const supplier of ['s1','s2','s3']){
    for(const status of ['Draft','Supplier approval','ROKI Issue','ROKI Check','ROKI Approve','Approved','Reverted','Rejected'])assert(first.quotes.some(q=>q.supplier===supplier&&q.status===status),supplier+' '+status);
    assert(first.notifications.some(n=>n.supplier===supplier&&!first.quotes.some(q=>q.requestedBy===n.id)),supplier+' unstarted request');
    assert(first.emails.some(m=>m.to.some(id=>id.startsWith(supplier+'-'))),supplier+' mail');
  }
  for(const collection of ['priceRequests','notifications','quotes','items','emails'])assert.equal(new Set(first[collection].map(r=>r.id)).size,first[collection].length,collection+' unique IDs');
  for(const q of first.quotes){
    const item=first.items.find(i=>i.id===q.item),n=first.notifications.find(n=>n.id===q.requestedBy),r=n&&first.priceRequests.find(r=>r.id===n.priceRequestId);
    assert(item&&n&&r,'Quotation provenance '+q.id);assert.equal(q.supplier,item.supplier);assert(n.items.includes(q.item));assert(r.items.includes(q.item));
    assert.equal(r.approvalStatus,'Approved');assert.equal(r.deliveryStatus,'Sent');
    assert.deepEqual(r.trail.slice(0,4).map(t=>t.action),['save','submit','advance','advance']);assert.equal(r.trail.at(-1).action,'send');
    assert(q.attachments.length,'Supporting document '+q.id);
    if(q.status==='Approved')assert(first.history.some(h=>h.quote===q.id&&h.price===q.total),'Approved history '+q.id);
    assert.equal(await p.evaluate(q=>Math.abs(totals(q.costs).total-q.total)<.001,q),true,'Cost consistency '+q.id);
  }
  await p.reload();assert.deepEqual(await store(p),first,'Refresh does not duplicate examples');
  // A preexisting browser receives fixtures additively, including records the user has changed.
  const migration=await p.evaluate(()=>{
    const old=seed();old.priceRequests=[{id:'RFQ-USER-9001',title:'User authored request',status:'Draft',items:[],trail:[],createdBy:'r-issue'}];
    old.quotes[0].remark='User changed this remark';old.items[0].qty=9876;
    const result=populateDemoData(old),once=JSON.stringify(result);
    return {originalUnchanged:old.priceRequests.length===1&&!old.demoDataVersion,request:result.priceRequests.find(r=>r.id==='RFQ-USER-9001'),remark:result.quotes[0].remark,qty:result.items[0].qty,repeat:JSON.stringify(populateDemoData(result))===once};
  });
  assert(migration.originalUnchanged);assert.equal(migration.request.title,'User authored request');assert.equal(migration.remark,'User changed this remark');assert.equal(migration.qty,9876);assert(migration.repeat);
  let count=0;
  for(const lang of ['en','th']){
    await p.evaluate(lang=>localStorage.setItem('roki-lang',lang),lang);
    for(const [portal,account] of [['roki','r-issue'],['roki','r-check'],['roki','r-approve'],...['s1','s2','s3'].flatMap(s=>[['supplier',s+'-issue'],['supplier',s+'-approve']])]){
      await switchTo(p,base,portal,account,'overview');
      const routes=await p.locator('.side-nav a').evaluateAll(els=>els.map(e=>e.getAttribute('href')));
      for(const route of routes){
        await p.goto(base+portal+'.html'+route);await p.locator('.content h1').waitFor();
        // An optional formula adjustment can correctly be absent; it is configuration, not a missing record.
        assert.equal(await p.locator('.content .empty').evaluateAll(els=>els.filter(e=>!e.closest('.fm-section')).length),0,lang+' '+account+' '+route+' has data');
        assert(await p.locator('.content .metric,.content tbody tr,.content .audit-entry,.content .notification-card,.content .fm-grid').count(),lang+' '+account+' '+route+' visible records');count++;
      }
      if(portal==='supplier'){
        const leak=await p.evaluate(()=>visibleQuotes().some(q=>q.supplier!==user.supplier));assert.equal(leak,false);
      }
    }
  }
  await switchTo(p,base,'roki','r-issue','request-dispatch');
  await p.locator('[data-rfq-row]').first().click();await p.locator('[data-rfq="send"]').waitFor();
  const toSend=await p.evaluate(()=>location.hash.split('/')[1]),beforeSend=(await store(p)).notifications.length;
  await p.locator('[data-rfq="send"]').click();await p.locator('#rfq-confirm').check();await p.locator('[data-action="rfq-confirm"]').click();
  const afterSend=await store(p),sent=afterSend.priceRequests.find(r=>r.id===toSend);
  assert.equal(sent.approvalStatus,'Approved');assert.equal(sent.deliveryStatus,'Sent');assert.equal(afterSend.notifications.length,beforeSend+1);
  const approval=first.quotes.find(q=>q.demoScenario==='s2-Supplier approval'&&q.status==='Supplier approval');
  await switchTo(p,base,'supplier','s2-approve','quote/'+approval.id);await approveStep(p);
  assert.equal((await store(p)).quotes.find(q=>q.id===approval.id).status,'ROKI Issue');
  for(const [role,status] of [['r-issue','ROKI Check'],['r-check','ROKI Approve'],['r-approve','Approved']]){
    await switchTo(p,base,'roki',role,'quote/'+approval.id);await approveStep(p);
    assert.equal((await store(p)).quotes.find(q=>q.id===approval.id).status,status);
  }
  assert((await store(p)).history.some(h=>h.quote===approval.id),'Approving sample creates a real local price-history record');
  const q=first.quotes.find(q=>q.demoScenario==='s1-ROKI Check'&&q.status==='ROKI Check');
  await p.goto(base+'roki.html#quote/'+q.id);assert.equal(await p.locator('[data-timeline-phase="before"] .workflow-row.done').count(),3);
  assert.equal(await p.locator('[data-timeline-phase="after"] .workflow-row.done').count(),3);
  const attachment=first.quotes[0].attachments[0];assert(Buffer.from(attachment.data.split(',')[1],'base64').toString().startsWith('%PDF-1.4'));
  console.log(`${count} populated account/menu/language views; ${first.priceRequests.length} requests, ${first.quotes.length} quotations, ${first.emails.length} notifications`);
}).catch(e=>{console.error(e);process.exitCode=1});
