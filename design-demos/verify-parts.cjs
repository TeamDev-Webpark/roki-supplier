'use strict';
/* Part master and schedule: create / edit / delete a part, import from CSV (preview, errors, updates),
   create schedules from parts, supplier read-only view, and that nothing here ever sends a notification. */
const {run,store,reset,login,approveRequestAndSend,assert}=require('./_env.cjs');
const CSV=[
 'part_code,part_name,format,supplier_code,rtp_code,drawing,annual_qty,components,review_months,next_review',
 '17999-TST-0001,SAMPLE COVER,Single Part,40110020,S001571-099-01,M206-F-26,"25,000",,3,2027-01-15',
 '17999-TST-0002,SAMPLE CASE ASSY,assy,40110020,S001571-099-02,04,2400,17999-TST-0001:1;17222-K1Z-J000:2,1,',
 '17230-KWN-9000,IJ COVER AIR/C,Single Part,40110020,,,30000,,,',
 ',NO CODE,Single Part,40110020,,,,,,',
 '17999-TST-0003,BAD SUPPLIER,Single Part,99999999,,,,,,',
 '17999-TST-0004,BAD FORMAT,Plastic,40110020,,,,,,',
 '17999-TST-0001,DUPLICATE ROW,Single Part,40110020,,,,,,',
 '17999-TST-0005,BAD DATE,Single Part,40110046,,,,,,31/02/2027',
 '17230-KWN-9000,FORMAT CLASH,Assembly,40110046,,,,,,',
 '17999-TST-0006,BAD COMPONENT,Assembly,40110046,,,,17999-TST-0006:1,,'
].join('\r\n');
run('verify-parts',async({base,context})=>{
  const roki=await context.newPage();
  await reset(roki,base,'roki');await login(roki,base,'roki','r-issue','parts');
  const notifications=async()=>(await store(roki)).notifications.length;
  const n0=await notifications();

  /* seeded structure: GUARD ELEMENT lists its two sub-parts, one pair has no schedule yet */
  assert.match(await roki.locator('tbody tr',{hasText:'GUARD ELEMENT'}).innerText(),/Components \(2\)/);
  assert.match(await roki.locator('tbody tr',{hasText:'S001571-036-04'}).innerText(),/Not scheduled/);

  /* validation */
  await roki.locator('[data-action="add-part"]').click();
  await roki.locator('[data-action="save-part"]').click();
  assert.match(await roki.locator('#toast').innerText(),/part code and a part name/);
  await roki.locator('#pf-code').fill('17999-NEW-0001');await roki.locator('#pf-name').fill('NEW BRACKET');
  await roki.locator('[data-action="save-part"]').click();
  assert.match(await roki.locator('#toast').innerText(),/Select a supplier/);
  await roki.locator('#pf-supplier').selectOption('s2');
  await roki.locator('#pf-children').fill('17999-NEW-0001, 1');await roki.locator('[data-action="save-part"]').click();
  assert.match(await roki.locator('#toast').innerText(),/itself/);
  await roki.locator('#pf-code').fill('17230-KWN-9000');await roki.locator('#pf-format').selectOption('Assembly');await roki.locator('#pf-children').fill('');
  await roki.locator('[data-action="save-part"]').click();
  assert.match(await roki.locator('#toast').innerText(),/different format/,'Existing code must keep its format');
  await roki.locator('#pf-code').fill('17230-KWN-9000');await roki.locator('#pf-format').selectOption('Single Part');await roki.locator('#pf-supplier').selectOption('s1');
  await roki.locator('[data-action="save-part"]').click();
  assert.match(await roki.locator('#toast').innerText(),/already linked/);

  /* create a part with a second supplier, scheduled, with components */
  await roki.locator('#pf-code').fill('17999-NEW-0001');await roki.locator('#pf-name').fill('NEW BRACKET');await roki.locator('#pf-format').selectOption('Assembly');await roki.locator('#pf-supplier').selectOption('s2');
  await roki.locator('#pf-qty').fill('12000');assert.equal(await roki.locator('#pf-cadence, #pf-next, #pf-sched').count(),0,'Schedule fields are set on the first review cycle page');
  await roki.locator('#pf-children').fill('17230-KWN-9000, 2\n17999-PURCHASED, 1');
  await roki.locator('[data-action="save-part"]').click();
  await roki.locator('.dialog').waitFor({state:'detached'});
  let data=await store(roki);const created=data.items.find(i=>i.code==='17999-NEW-0001');
  assert(created&&created.supplier==='s2'&&created.next==null&&created.cadence===3&&created.price==null);
  assert.deepEqual(created.children,[{code:'17230-KWN-9000',qty:2},{code:'17999-PURCHASED',qty:1}]);
  assert.equal(await notifications(),n0,'Creating a part never notifies');

  /* edit: name applies to all suppliers of the code; unused pair can be deleted */
  await roki.locator('tbody tr',{hasText:'17253-KWN-9000'}).first().locator('[data-edit-part]').click();
  assert.equal(await roki.locator('#pf-code').getAttribute('readonly'),'');assert.equal(await roki.locator('#pf-supplier').isDisabled(),true);
  assert.equal(await roki.locator('[data-action="delete-part"]').count(),0,'A pair with quotations cannot be deleted');
  await roki.locator('#pf-name').fill('TUBE AIR CONN (RENAMED)');await roki.locator('[data-action="save-part"]').click();await roki.locator('.dialog').waitFor({state:'detached'});
  data=await store(roki);assert.equal(data.items.filter(i=>i.code==='17253-KWN-9000'&&i.name==='TUBE AIR CONN (RENAMED)').length,2);
  await roki.locator('tbody tr',{hasText:'17999-NEW-0001'}).locator('[data-edit-part]').click();
  await roki.locator('[data-action="delete-part"]').click();await roki.locator('[data-action="confirm-delete-part"]').click();await roki.locator('.dialog').waitFor({state:'detached'});
  assert.equal((await store(roki)).items.some(i=>i.code==='17999-NEW-0001'),false,'Unused pair deleted');

  /* import: preview with row-level results, nothing saved until confirmed */
  await roki.locator('[data-action="import-parts"]').click();
  assert.equal(await roki.locator('#import-go').isDisabled(),true);
  await roki.locator('#import-file').setInputFiles({name:'parts.xlsx',mimeType:'application/vnd.ms-excel',buffer:Buffer.from('x')});
  assert.match(await roki.locator('#import-preview').innerText(),/CSV UTF-8/,'Excel files are explained, not parsed');
  await roki.locator('#import-file').setInputFiles({name:'parts.csv',mimeType:'text/csv',buffer:Buffer.from(CSV,'utf8')});
  await roki.locator('.import-summary').waitFor();
  const summary=await roki.locator('.import-summary').innerText();
  assert.match(summary,/2 new/);assert.match(summary,/1 updates/);assert.match(summary,/7 errors/);
  const text=await roki.locator('#import-preview').innerText();
  for(const msg of ['Part code is required.','Unknown supplier code.','Format must be Single Part or Assembly.','Duplicate of an earlier row in this file.','Date must be YYYY-MM-DD or DD/MM/YYYY.','This part code already exists in a different format.','A part cannot be a component of itself.'])assert(text.includes(msg),'Missing error: '+msg);
  assert.equal((await store(roki)).items.some(i=>i.code==='17999-TST-0001'),false,'Preview must not save');
  await roki.locator('#import-go').click();await roki.locator('.dialog').waitFor({state:'detached'});
  data=await store(roki);
  const cover=data.items.find(i=>i.code==='17999-TST-0001'),assy=data.items.find(i=>i.code==='17999-TST-0002'),updated=data.items.find(i=>i.code==='17230-KWN-9000');
  assert(cover&&cover.qty===25000&&cover.next==='2027-01-15'&&cover.cadence===3,'Quantity with thousands separator, explicit date');
  assert(assy&&assy.format==='Assembly'&&assy.cadence===1&&assy.next&&assy.children.length===2&&assy.children[1].qty===2,'Format alias, cadence → schedule, components');
  assert(updated.qty===30000&&updated.next==='2026-11-01'&&updated.rtp==='S001571-004-01','Update keeps empty cells');
  assert.equal(data.items.some(i=>/^17999-TST-000[3-6]$/.test(i.code)),false,'Error rows are skipped');
  assert.equal(await notifications(),n0,'Import never notifies');
  assert.match(await roki.locator('#toast').innerText(),/Imported 3 rows \(2 new, 1 updated\)\. 7 skipped\./);

  /* schedule: create from parts */
  await roki.goto(base+'roki.html#schedule');await roki.locator('[data-action="add-schedule"]').waitFor();
  const before=(await store(roki)).items.filter(i=>i.next).length;
  await roki.locator('[data-action="add-schedule"]').click();
  assert.match(await roki.locator('#sa-count').innerText(),/^1 item–supplier pairs selected/,'Only the unscheduled pair is pre-selected');
  await roki.locator('#sa-search').fill('MESH');
  assert.equal(await roki.locator('[data-sa-row]:visible').count(),2,'Search filters the list');
  await roki.locator('#sa-supplier').selectOption('s1');assert.equal(await roki.locator('[data-sa-row]:visible').count(),1);
  await roki.locator('#sa-cadence').selectOption('1');await roki.locator('#sa-next').fill('2026-12-10');
  await roki.locator('[data-action="save-schedule-add"]').click();await roki.locator('.dialog').waitFor({state:'detached'});
  data=await store(roki);const mesh=data.items.find(i=>i.id==='i9');
  assert(mesh.next==='2026-12-10'&&mesh.cadence===1);assert.equal(data.items.filter(i=>i.next).length,before+1);
  assert.equal(data.items.find(i=>i.id==='i8').next,'2027-02-01','Hidden/unchecked rows are untouched');
  assert.equal(await notifications(),n0,'Scheduling never notifies');
  await roki.locator('tbody tr',{hasText:'S001571-036-04'}).count();
  /* remove from schedule */
  await roki.locator('[data-schedule="i9"]').click();await roki.locator('[data-action="remove-schedule"]').click();await roki.locator('.dialog').waitFor({state:'detached'});
  assert.equal((await store(roki)).items.find(i=>i.id==='i9').next,null);

  /* approving a quotation moves the next review date by the interval */
  /* supplier view is read-only and limited to its own pairs */
  const supplier=await context.newPage();
  await login(supplier,base,'supplier','s2-issue','parts');
  assert.equal(await supplier.locator('[data-action="add-part"],[data-action="import-parts"],[data-edit-part]').count(),0,'Suppliers cannot create or edit parts');
  assert.equal(await supplier.getByText('17221-K1Z-J100',{exact:false}).count(),0,'Other suppliers’ pairs are hidden');
  await supplier.goto(base+'supplier.html#schedule');
  assert.match(await supplier.locator('.content').innerText(),/unavailable/,'Suppliers have no schedule page');

  /* suppliers see every assigned part but can only quote once ROKI sends a request for it */
  await supplier.evaluate(()=>sessionStorage.removeItem('roki-session-supplier'));await supplier.reload();
  await login(supplier,base,'supplier','s1-issue','parts');
  assert.match(await supplier.locator('tbody tr',{hasText:'S001571-036-04'}).innerText(),/No request/);
  await supplier.goto(base+'supplier.html#new');
  assert.match(await supplier.locator('.content').innerText(),/start from a price update request/,'No quotation without a request');
  assert.equal(await supplier.locator('[data-action="new"]').count(),0,'No “new quotation” button for suppliers');
  /* ROKI schedules i9 and sends the request */
  await roki.goto(base+'roki.html#schedule');await roki.locator('[data-action="add-schedule"]').click();
  await roki.locator('#sa-all').uncheck();await roki.locator('[data-sa="i9"]').check();await roki.locator('[data-action="save-schedule-add"]').click();await roki.locator('.dialog').waitFor({state:'detached'});
  await roki.locator('[data-select="i9"]').check();await roki.locator('[data-action="notify"]').click();await approveRequestAndSend(roki,base);await roki.locator('.dialog').waitFor({state:'detached'});
  assert.equal(await notifications(),n0+1,'Notification only after ROKI sends it');
  /* the supplier now sees the request in My parts and Price update requests */
  await supplier.goto(base+'supplier.html#parts');await supplier.reload();
  const row=supplier.locator('tbody tr',{hasText:'S001571-036-04'});
  assert.match(await row.innerText(),/Request open/);
  await row.locator('[data-request]').click();
  await supplier.locator('#quote-form').waitFor();
  assert.equal(await supplier.locator('#item').isDisabled(),true,'The requested part is fixed');
  assert.equal(await supplier.locator('#item option').count(),1);
  assert.match(await supplier.locator('.form-grid input[readonly]').last().inputValue(),/—/,'No previous price');
  await supplier.locator('#effective').fill('2026-11-18');await supplier.locator('#remark').fill('First quotation for the second source.');
  await supplier.locator('[data-tab="material"]').click();
  await supplier.locator('[data-cost="0"][data-field="name"]').fill('16 MESH WIRE');await supplier.locator('[data-cost="0"][data-field="rate"]').fill('320');await supplier.locator('[data-cost="0"][data-field="weight"]').fill('0.0066');
  await supplier.locator('[data-tab="process"]').click();
  await supplier.locator('[data-cost="0"][data-field="name"]').fill('Blank');await supplier.locator('[data-cost="0"][data-field="rate"]').fill('0.15');await supplier.locator('[data-cost="0"][data-field="time"]').fill('8');
  await supplier.locator('button[type="submit"]').click();await supplier.locator('.status-strip').waitFor();
  assert.match(await supplier.locator('.q-change').innerText(),/First quotation for this part/);
  const qid=(await supplier.evaluate(()=>location.hash)).split('/')[1];
  await supplier.goto(base+'supplier.html#requests');await supplier.reload();
  assert.match(await supplier.locator('[data-request-row]',{hasText:'17211-K16-9022'}).last().innerText(),/Supplier approval/,'Request shows the quotation status');
  assert.equal(await supplier.locator('[data-request-row]',{hasText:'17211-K16-9022'}).locator('[data-request]').count(),0,'A submitted request cannot be answered twice');
  await supplier.goto(base+'supplier.html#quote/'+qid);
  await supplier.goto(base+'supplier.html#quotes');
  assert.match(await supplier.locator('tbody tr',{hasText:qid}).innerText(),/New/,'List shows New instead of a change %');
  for(const account of ['s1-approve']){await supplier.locator('[data-action="logout"]').click();await supplier.locator('#demo-account').selectOption(account);await supplier.locator('[data-action="login"]').click();}
  await supplier.goto(base+'supplier.html#quote/'+qid);await supplier.locator('[data-transition="advance"]').click();await supplier.locator('#confirm-action').check();await supplier.locator('[data-action="confirm-transition"]').click();
  for(const account of ['r-issue','r-check','r-approve']){
    await roki.evaluate(a=>sessionStorage.setItem('roki-session-roki',a),account);await roki.goto(base+'roki.html#quote/'+qid);await roki.reload();
    await roki.locator('[data-transition="advance"]').click();await roki.locator('#confirm-action').check();await roki.locator('[data-action="confirm-transition"]').click();await roki.locator('.dialog').waitFor({state:'detached'});
  }
  data=await store(roki);const approved=data.items.find(i=>i.id==='i9');
  assert(approved.price>0,'Approval sets the first approved price');
  assert.equal(approved.next,'2027-02-18','Approval moves the next review to the next cycle');
  /* a scheduled pair moves to its next cycle (interval from the approval date) once its quotation is approved */
  assert.equal(data.items.find(i=>i.id==='i4').next,'2026-11-15');
  await roki.evaluate(a=>sessionStorage.setItem('roki-session-roki',a),'r-approve');await roki.goto(base+'roki.html#quote/Q-2026-0104');await roki.reload();await roki.evaluate(()=>{db.quotes.find(q=>q.id==='Q-2026-0104').effective=TODAY;persist()});
  await roki.locator('[data-transition="advance"]').click();await roki.locator('#confirm-action').check();await roki.locator('[data-action="confirm-transition"]').click();await roki.locator('.dialog').waitFor({state:'detached'});
  assert.equal((await store(roki)).items.find(i=>i.id==='i4').next,'2027-02-18','Next review = approval date + 3 months');
});
