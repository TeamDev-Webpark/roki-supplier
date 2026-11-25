'use strict';
/* Operational views derive from the same request/quotation records, never separate counters. */
const deskFilters=new Map();
let deskPairCache=null;
function deskNoticeTime(n){
 if(n.createdISO&&Number.isFinite(Date.parse(n.createdISO)))return Date.parse(n.createdISO);
 const value=String(n.created||''),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],named=value.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/),numeric=value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/),time=value.match(/(\d{1,2}):(\d{2})/);
 if(named&&months.includes(named[2].toLowerCase()))return Date.UTC(+named[3],months.indexOf(named[2].toLowerCase()),+named[1],+(time?.[1]||0)-7,+(time?.[2]||0));
 if(numeric)return Date.UTC(+numeric[3],+numeric[2]-1,+numeric[1],+(time?.[1]||0)-7,+(time?.[2]||0));
 return 0;
}
function deskLatestNotice(itemId,predicate=()=>true){return db.notifications.filter(n=>n.items.includes(itemId)&&predicate(n)).reduce((latest,n)=>!latest||!deskNoticeTime(n)||!deskNoticeTime(latest)||deskNoticeTime(n)>=deskNoticeTime(latest)?n:latest,null)}
function deskState(key=route().split('/')[0]){if(!deskFilters.has(key))deskFilters.set(key,{stage:'active',cadence:'',supplier:'',query:'',page:1,size:12});return deskFilters.get(key)}
function deskPhase(n,itemId,lookups){
 const q=lookups?lookups.quotes.get(n.id+':'+itemId):wfLatest(n,itemId),latest=lookups?lookups.latest.get(itemId):deskLatestNotice(itemId),historical=latest?.id!==n.id;
 const phases={
  waiting:{key:'waiting',group:'supplier',label:wfText('Awaiting cost entry','รอกรอกต้นทุน'),owner:'Supplier Issue',color:'amber',index:0},
  Draft:{key:'entry',group:'supplier',label:wfText('Entering costs','กำลังกรอกต้นทุน'),owner:'Supplier Issue',color:'amber',index:0},
  'Supplier approval':{key:'supplier-approve',group:'supplier',label:wfText('Supplier review','รอตรวจภายใน Supplier'),owner:'Supplier Approve',color:'amber',index:1},
  Reverted:{key:'correction',group:'supplier',label:wfText('Returned for correction','ส่งกลับแก้ไข'),owner:'Supplier Issue',color:'purple',index:0},
  Rejected:{key:'waiting',group:'supplier',label:wfText('Awaiting cost entry','รอกรอกต้นทุน'),owner:'Supplier Issue',color:'amber',index:0},
  'ROKI Issue':{key:'issue',group:'issue',label:wfText('Awaiting WEBPARK Issue','รอ WEBPARK Issue'),owner:'WEBPARK Issue',color:'blue',index:2},
  'ROKI Check':{key:'check',group:'check',label:wfText('Awaiting WEBPARK Check','รอ WEBPARK Check'),owner:'WEBPARK Check',color:'blue',index:3},
  'ROKI Approve':{key:'approve',group:'approve',label:wfText('Awaiting final approval','รออนุมัติราคาซื้อ'),owner:'WEBPARK Approve',color:'blue',index:4},
  Approved:{key:'completed',group:'completed',label:wfText('Price approved','อนุมัติราคาแล้ว'),owner:'',color:'green',index:5}
 };
 const p=phases[q?.status||'waiting']||{key:'unknown',group:'unknown',label:wfText('Review source record','ตรวจสอบข้อมูลต้นทาง'),owner:'WEBPARK Issue',color:'gray',index:1};
 const disclosed=q&&(portal==='supplier'?q.supplier===user.supplier:!['Draft','Supplier approval'].includes(q.status));
 return {...p,q,offer:disclosed?q:null,historical,late:!historical&&p.group==='supplier'&&!!n.due&&n.due<TODAY};
}
function deskSentPairs(){
 const key=portal+':'+user.id+':'+I18N.lang()+'|'+db.quotes.map(q=>q.id+q.status+q.total).join('|')+'|'+db.notifications.map(n=>n.id+n.due+n.created+n.createdISO+n.items.join(',')).join('|')+'|'+db.items.map(i=>i.id+i.code+i.name+i.next+i.cadence+i.supplier).join('|')+'|'+db.priceRequests.map(r=>r.id+r.status+r.deliveryStatus).join('|');
 if(deskPairCache?.db===db&&deskPairCache.key===key&&deskPairCache.quotes===db.quotes&&deskPairCache.items===db.items&&deskPairCache.requests===db.priceRequests)return deskPairCache.rows;
 const lookups={quotes:new Map(),latest:new Map()};for(const q of db.quotes)lookups.quotes.set(q.requestedBy+':'+q.item,q);for(const n of db.notifications)for(const id of n.items){const previous=lookups.latest.get(id);if(!previous||!deskNoticeTime(n)||!deskNoticeTime(previous)||deskNoticeTime(n)>=deskNoticeTime(previous))lookups.latest.set(id,n)}
 const rows=db.notifications.filter(n=>portal==='roki'||n.supplier===user.supplier).flatMap(n=>n.items.map(itemId=>{
 const r=db.priceRequests.find(r=>r.id===n.priceRequestId),snapshot=n.forms?.[itemId]?.itemSnapshot;
 const i=db.items.find(i=>i.id===itemId)||{id:itemId,code:snapshot?.code||itemId,name:snapshot?.name||wfText('Part master unavailable','ไม่พบชิ้นส่วนในทะเบียนปัจจุบัน'),supplier:n.supplier};
 return {key:n.id+':'+itemId,n,r,i,phase:deskPhase(n,itemId,lookups)};
}));deskPairCache={db,key,rows,quotes:db.quotes,items:db.items,requests:db.priceRequests};return rows;
}
function deskCurrentPair(itemId){return deskSentPairs().findLast(row=>row.i.id===itemId&&!row.phase.historical)}
function deskPendingPair(itemId){const row=deskCurrentPair(itemId);return row&&!['completed'].includes(row.phase.group)?row:null}
function deskDraftFor(itemId){return db.priceRequests.find(r=>r.items.includes(itemId)&&rfqDelivery(r)!=='Sent'&&!['Cancelled','Rejected'].includes(r.status))}
function deskFirstTime(i){return !db.quotes.some(q=>q.item===i.id)&&!db.notifications.some(n=>n.items.includes(i.id))}
function deskDueParts(){return db.items.filter(i=>i.next&&i.next<=TODAY&&!deskFirstTime(i)&&!deskPendingPair(i.id))}
function deskNewParts(){return db.items.filter(i=>deskFirstTime(i)&&!deskPendingPair(i.id))}
function deskRows(){return [...deskSentPairs()]}
/* saved requests that were never sent: shown on the first-time request page, not in request tracking */
function deskUnsentRows(){
 const rows=[];if(portal!=='roki')return rows;
 for(const r of db.priceRequests.filter(r=>rfqDelivery(r)!=='Sent'))for(const id of r.items){const i=db.items.find(i=>i.id===id);if(!i)continue;
  const closed=['Cancelled','Rejected'].includes(r.status);
  rows.push({key:r.id+':'+id,n:null,r,i,phase:{key:closed?'cancelled':'unsent',group:closed?'cancelled':'unsent',label:closed?wfText('Closed request','คำขอปิดแล้ว'):wfText('Not sent yet','ยังไม่ส่งคำขอ'),owner:closed?'':'WEBPARK Issue',color:'gray',index:0,historical:closed,late:false,q:null,offer:null}});
 }return rows;
}
function deskVisibleRows(rows,stage){return rows.filter(row=>stage==='all'?true:stage==='history'?row.phase.historical||row.phase.group==='completed'||row.phase.group==='cancelled':stage==='active'?!row.phase.historical&&!['completed','cancelled'].includes(row.phase.group):!row.phase.historical&&row.phase.group===stage)}
function deskFiltered(rows,state){const query=state.query.toLowerCase();return rows.filter(row=>(!state.supplier||(row.n?.supplier||row.i.supplier)===state.supplier)&&(!state.cadence||String(row.i.cadence)===state.cadence)&&(!query||[row.i.code,row.i.name,row.n?.id,row.r?.id,row.r?.title,supplierName(row.n?.supplier||row.i.supplier),row.phase.offer?.id].join(' ').toLowerCase().includes(query)))}
function deskPage(rows,state){const pages=Math.max(1,Math.ceil(rows.length/state.size));state.page=Math.max(1,Math.min(state.page,pages));return {items:rows.slice((state.page-1)*state.size,state.page*state.size),pages}}
function deskNavBadge(id){
 let count=null;if(portal==='roki'){
  if(id==='schedule')count=deskVisibleRows(deskRows(),'active').length;
  if(id==='request-new')count=deskNewParts().length;
  if(id==='schedule-active')count=deskDueParts().length;
  if(id==='approvals')count=visibleQuotes().filter(pendingForRole).length;
  if(id==='sent')count=visibleQuotes().filter(q=>['ROKI Issue','ROKI Check','ROKI Approve'].includes(q.status)).length;
 }else if(id==='approvals')count=visibleQuotes().filter(workflowQueue).length+(user.role==='Issue'?deskSentPairs().filter(r=>!r.phase.historical&&r.phase.key==='waiting').length:0);
 return count?`<b class="count">${count}</b>`:'';
}
function workflowNav(){
 const n=(icon,id,en,th,group)=>[icon,id,wfText(en,th),group];
 /* the role's own work comes first so it is the first thing seen after login */
 const task=portal==='roki'
  ?[n('check','approvals',({Issue:'Pending issues',Check:'Pending checks',Approve:'Pending approvals'})[user.role],({Issue:'รอ Issue',Check:'รอตรวจสอบ (Check)',Approve:'รออนุมัติ (Approve)'})[user.role],'task')]
  :[n('check','approvals',user.role==='Issue'?'Cost entry tasks':'Pending approvals',user.role==='Issue'?'งานกรอกต้นทุน':'รออนุมัติ (Approve)','task')];
 return portal==='roki'?[
 ...task,
 n('grid','overview','Overview','ภาพรวม',''),
 ...(user.role==='Issue'?[n('plus','request-new','Create review schedule','สร้างกำหนดรอบทบทวน','requests')]:[]),
 n('clock','schedule','Request follow-up','ติดตามคำขอ','requests'),
 n('compare','sent','Awaiting WEBPARK','รอดำเนินการภายใน','requests'),
 n('file','schedule-active','All review schedules','รายการกำหนดรอบทบทวนทั้งหมด','requests'),
 n('file','quotes','Quotations in use','ใบเสนอราคาที่กำลังใช้','requests'),
 n('box','parts','Parts & assemblies','ชิ้นส่วนและชุดประกอบ','reference'),n('settings','formulas','Formula library','คลังสูตรคำนวณ','reference'),n('chart','records','Reports & history','รายงานและประวัติ','reference')]:[
 ...task,
 n('grid','overview','Overview','ภาพรวม',''),
 ...(user.role==='Issue'?[]:[n('bell','requests','Request tracking','ติดตามคำขอ','requests')]),
 n('compare','sent','Sent to WEBPARK','ส่งแล้ว · รอ WEBPARK','requests'),
 n('file','quotes','Quotations in use','ใบเสนอราคาที่ใช้อยู่','requests'),
 n('box','parts','Assigned parts','ชิ้นส่วนที่รับผิดชอบ','reference'),n('chart','records','Reports & history','รายงานและประวัติ','reference')];
}
function workflowGroup(key){return ({task:wfText('My tasks','งานของฉัน'),overview:wfText('Overview','ภาพรวม'),approval:wfText('Checks and approvals','การตรวจสอบและอนุมัติ'),planning:wfText('Review planning','กำหนดรอบและสร้างคำขอ'),requests:wfText('Requests and purchase prices','คำขอและราคาซื้อ'),reference:wfText('Reference information','ข้อมูลอ้างอิง')})[key]||''}
function recordParentPage(page,id){
 const requestMenu=portal==='roki'?'schedule':user.role==='Issue'?'approvals':'requests';
 if(['requests','request-detail','process','request-register','request-tracking','supplier-waiting'].includes(page))return requestMenu;
 if(page==='request-form'||page==='request-new')return id?'schedule':'request-new';
 if(page==='new'||page==='edit')return 'approvals';
 if(page==='quote'||page==='print'){
  const q=visibleQuotes().find(q=>q.id===id);
  if(!q)return '';
  if(workflowQueue(q))return 'approvals';
  if(['ROKI Issue','ROKI Check','ROKI Approve'].includes(q.status))return 'sent';
  return q.status==='Approved'&&priceValidity(q)==='active'?'quotes':'records';
 }
 return ({part:'parts',supplier:'records',account:'records','price-record':'records','formula-version':'formulas',reports:'records',history:'records',outbox:'records',exports:'records',suppliers:'records'})[page]||page;
}
function workflowCanOpen(page){
 if(page==='requests')return portal==='supplier';
 if(['schedule','schedule-active'].includes(page))return portal==='roki';
 if(page==='request-new'||page==='request-form')return rfqCanCreate();
 if(['request-drafts','request-dispatch','internal-pending','request-review'].includes(page))return false;
 if(['supplier-waiting','request-tracking','suppliers','exports'].includes(page))return portal==='roki';
 return ['quote','print','process',...(portal==='roki'?['request-register']:[]),...recordDetailPages,'records','reports','history','outbox'].includes(page)||(['new','edit'].includes(page)?portal==='supplier'&&user.role==='Issue':navs().some(n=>n[1]===page));
}
function deskEmpty(text){return `<div class="desk-empty">${icon('check')}<p>${text}</p></div>`}
function deskSupplierOptions(value){return `<option value="">${wfText('All suppliers','Supplier ทั้งหมด')}</option>${suppliers.filter(s=>portal==='roki'||s.id===user.supplier).map(s=>`<option value="${s.id}" ${value===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}`}
function deskFiltersBar(key,{cadence=false,stage=false}={}){
 const state=deskState(key);
 return `<div class="desk-filters"><label class="desk-search">${icon('search')}<input data-desk-query="${key}" value="${esc(state.query)}" aria-label="${wfText('Search requests, parts or suppliers','ค้นหาคำขอ ชิ้นส่วน หรือ Supplier')}" placeholder="${wfText('Search request, part or supplier','ค้นหาคำขอ ชิ้นส่วน หรือ Supplier')}"></label>${cadence?`<select data-desk-filter="cadence" data-desk-key="${key}" aria-label="${wfText('Review interval','รอบทบทวน')}"><option value="">${wfText('1 and 3 month cycles','รอบ 1 และ 3 เดือน')}</option>${[1,3].map(n=>`<option value="${n}" ${state.cadence===String(n)?'selected':''}>${wfText('Every '+n+' month(s)','ทุก '+n+' เดือน')}</option>`).join('')}</select>`:''}<select data-desk-filter="supplier" data-desk-key="${key}" aria-label="Supplier">${deskSupplierOptions(state.supplier)}</select>${stage?`<select data-desk-filter="stage" data-desk-key="${key}" aria-label="${wfText('Schedule state','สถานะกำหนดการ')}">${[['active','All active schedules','กำหนดการทั้งหมด'],['upcoming','Upcoming','รอบถัดไป'],['due','Due, not sent','ถึงรอบแล้ว ยังไม่ส่ง'],['processing','Current cycle in progress','ส่งคำขอรอบนี้แล้ว']].map(([v,en,th])=>`<option value="${v}" ${state.stage===v?'selected':''}>${wfText(en,th)}</option>`).join('')}</select>`:''}</div>`;
}
function deskPager(key,total,pages){const s=deskState(key);return `<div class="desk-table-footer"><span>${total?`${(s.page-1)*s.size+1}–${Math.min(s.page*s.size,total)} / ${total}`:'0'} ${wfText('items','รายการ')}</span><div><button class="button" data-desk-page="${s.page-1}" data-desk-key="${key}" ${s.page<=1?'disabled':''}>${wfText('Previous','ก่อนหน้า')}</button><span>${s.page} / ${pages}</span><button class="button" data-desk-page="${s.page+1}" data-desk-key="${key}" ${s.page>=pages?'disabled':''}>${wfText('Next','ถัดไป')}</button></div></div>`}
function deskPart(i,requestId){return `<a class="desk-record" href="#part/${i.id}">${esc(i.code)}</a><span class="desk-secondary desk-part-name">${esc(i.name)}</span>${requestId?`<a class="desk-source" href="#request-register/${esc(requestId)}">${esc(requestId)}</a>`:''}`}
function deskPhaseCell(row){return `<div class="desk-stage">${statusPill(row.phase.label,row.phase.color)}${row.phase.owner?`<span class="desk-owner">${esc(row.phase.owner)}</span>`:''}${row.phase.historical?`<span class="desk-history-label">${wfText('Earlier cycle','รอบก่อน')}</span>`:''}</div>`}
function deskQuotationCell(row){
 const q=row.phase.offer,refId=row.n?.referencePrices?.[row.i.id]?.referenceQuote||row.r?.priceLines?.[row.i.id]?.referenceQuote||q?.baseline?.quote,ref=visibleQuotes().find(q=>q.id===refId)||activeQuote(row.i.id);
 return `<div class="desk-quotation">${q?`<a href="#quote/${q.id}" data-quote-access="${q.id}" class="desk-document">${icon('file')}${esc(q.id)}</a><strong class="desk-amount">${isIncompleteQuote(q)?wfText('Costs incomplete','ยังกรอกต้นทุนไม่ครบ'):cash(q.total)+` <small>${wfText('THB / pc','บาท/ชิ้น')}</small>`}</strong>`:`<span class="desk-secondary">${row.n?wfText('No submitted quotation yet','ยังไม่ได้รับใบเสนอราคา'):wfText('Not sent to Supplier','ยังไม่ส่งให้ Supplier')}</span>`}${ref&&ref.id!==q?.id?`<a class="desk-reference-link" data-quote-access="${ref.id}" href="#quote/${ref.id}">${wfText('View reference quotation','ดูใบเสนอราคาเดิม')}</a>`:''}</div>`;
}
function deskRowAction(row){
 const q=row.phase.offer;
 if(q&&pendingForRole(q))return `<a class="button primary" href="#quote/${q.id}">${portal==='roki'?(user.role==='Check'?wfText('Check costs','ตรวจต้นทุน'):wfText('Approve price','อนุมัติราคา')):wfText('Review quotation','ตรวจ / อนุมัติ')}</a>`;
 if(portal==='supplier'&&user.role==='Issue'&&!row.phase.historical){
  if(q&&canEdit(q))return `<button class="button primary" data-edit="${q.id}">${wfText('Edit costs','แก้ไขต้นทุน')}</button>`;
  if(row.n&&row.phase.key==='waiting')return `<button class="button primary" data-request="${row.n.id}" data-item="${row.i.id}">${wfText('Enter costs','กรอกต้นทุน')}</button>`;
 }
 if(!row.n&&row.r&&rfqEditable(row.r))return `<a class="button primary" href="#request-new/${row.r.id}">${wfText('Continue request','ดำเนินการต่อ')}</a>`;
 return `<a class="button" href="#${row.n?'request-detail/'+row.n.id+'/'+row.i.id:'request-register/'+row.r.id}">${wfText('View details','ดูรายละเอียด')}</a>`;
}
function deskRequestTable(rows,key,{pagination=true}={}){
 const state=deskState(key),page=pagination?deskPage(rows,state):{items:rows,pages:1};
 return `<div class="table-wrap desk-table-wrap"><table class="data-table desk-table desk-request-table" data-desk-table="requests"><thead><tr><th>${wfText('Part / source request','ชิ้นส่วน / คำขอต้นทาง')}</th><th>Supplier</th><th>${wfText('Current stage / owner','ขั้นตอนปัจจุบัน / ผู้รับผิดชอบ')}</th><th>${wfText('Supplier response due','กำหนด Supplier ตอบ')}</th><th>${wfText('Quotation','ใบเสนอราคา')}</th><th>${wfText('Action','ดำเนินการ')}</th></tr></thead><tbody>${page.items.map(row=>`<tr ${detailRowAttrs(row.n?'request-detail/'+row.n.id+'/'+row.i.id:'request-register/'+row.r.id)} data-desk-row="${esc(row.key)}" data-desk-stage="${row.phase.group}" ${row.n?`data-request-row="${row.n.id}" data-item-row="${row.i.id}"`:''}><td>${deskPart(row.i,row.r?.id)}${!row.r&&row.n?`<span class="desk-source">${esc(row.n.id)}</span>`:''}</td><td><span class="desk-supplier">${esc(supplierName(row.n?.supplier||row.i.supplier))}</span></td><td>${deskPhaseCell(row)}</td><td><time>${date(row.n?.due||row.r?.due)}</time>${row.phase.late?`<span class="desk-late">${wfText('Supplier overdue','Supplier เกินกำหนด')}</span>`:''}</td><td>${deskQuotationCell(row)}</td><td class="desk-actions">${deskRowAction(row)}</td></tr>`).join('')}</tbody></table></div>${!rows.length?deskEmpty(wfText('No items in this queue.','ไม่มีรายการในคิวนี้')):''}${pagination?deskPager(key,rows.length,page.pages):''}`;
}
function deskSelectionFooter(){const supplier=selectedRequestSupplier();return `<div class="desk-selection"><span><strong>${selected.size}</strong> ${wfText('parts in one schedule','ชิ้นส่วนในกำหนดการเดียว')}<small>${supplier?esc(supplierName(supplier)):wfText('Select parts from one Supplier','เลือกชิ้นส่วนจาก Supplier บริษัทเดียวกัน')}</small></span><div><button class="button" data-desk-clear ${!selected.size?'disabled':''}>${wfText('Clear selection / change Supplier','ล้างรายการ / เปลี่ยน Supplier')}</button><button class="button primary" data-action="notify" ${!selected.size?'disabled':''}>${wfText('Set schedule for selected parts','ตั้งกำหนดการรายการที่เลือก')}${icon('arrow')}</button></div></div>`}
function deskPartTable(parts,key,{selectable=false,request=null,schedules=false}={}){
 const state=deskState(key),page=deskPage(parts,state),selectedSupplier=selectedRequestSupplier(),first=!schedules&&!request;
 return `${selectable?requestSelectionContext():''}<div class="table-wrap desk-table-wrap"><table class="data-table desk-table desk-planning-table" data-desk-table="${schedules?'schedules':'selection'}"><thead><tr>${selectable?`<th class="desk-checkbox"><input id="select-all" type="checkbox" aria-label="${wfText('Select ready items on this page','เลือกรายการพร้อมส่งในหน้านี้')}"></th>`:''}<th>${wfText('Part / Supplier','ชิ้นส่วน / Supplier')}</th>${first?'':`<th>${wfText('Review interval','รอบทบทวน')}</th>`}${first?'':`<th>${wfText('Review date','วันที่ทบทวน')}</th>`}<th>${schedules?wfText('Current reference price','ราคาที่มีผลปัจจุบัน'):wfText('Default formula','สูตรเริ่มต้น')}</th><th>${wfText('Readiness','สถานะรายการ')}</th><th>${wfText('Action','ดำเนินการ')}</th></tr></thead><tbody>${page.items.map(i=>{
 const draft=deskDraftFor(i.id),pending=deskPendingPair(i.id),canSelect=rfqCanCreate()&&!pending&&(!draft||draft.id===request?.id)&&(!selectedSupplier||i.supplier===selectedSupplier||selected.has(i.id)),state=deskScheduleState(i);
 return `<tr ${detailRowAttrs('part/'+i.id)} data-plan-item="${i.id}" data-schedule-state="${state.key}">${selectable?`<td class="desk-checkbox"><input type="checkbox" data-select="${i.id}" aria-label="${esc(i.code+' '+supplierName(i.supplier))}" ${!canSelect?'disabled':''} ${selected.has(i.id)?'checked':''}></td>`:''}<td>${deskPart(i)}<span class="desk-supplier">${esc(supplierName(i.supplier))}</span></td>${first?'':`<td><span class="desk-interval">${i.cadence||3} ${wfText('months','เดือน')}</span></td>`}${first?'':`<td><time>${date(i.next)}</time>${i.next&&i.next<TODAY&&!pending?`<span class="desk-late">${wfText('Review date passed','ถึงกำหนดแล้ว')}</span>`:''}</td>`}<td>${schedules?`<strong class="desk-amount">${i.price==null?'—':cash(i.price)}</strong><span class="desk-secondary">${wfText('THB / pc','บาท/ชิ้น')}</span>`:`<span class="desk-formula-name">${esc(formulaLabel(suggestedFormula(i,request)))}</span>`}</td><td>${draft&&!request?statusPill(wfText('Prepared, not sent','จัดทำแล้ว ยังไม่ส่ง'),'gray'):statusPill(state.label,state.color)}</td><td class="desk-actions">${requestItemAction(i,{schedules,request})}</td></tr>`;
 }).join('')}</tbody></table></div>${!parts.length?deskEmpty(schedules?wfText('No configured schedules match these filters.','ไม่มีกำหนดการที่ตรงกับตัวกรอง'):wfText('No items awaiting a new request in this view.','ไม่มีรายการรอสร้างคำขอในมุมมองนี้')):''}${deskPager(key,parts.length,page.pages)}${selectable?deskSelectionFooter():''}`;
}
function deskScheduleState(i){
 const pair=deskPendingPair(i.id);if(pair)return {key:'processing',label:wfText('Request sent · in progress','ส่งคำขอแล้ว · อยู่ระหว่างดำเนินการ'),color:'blue'};
 if(deskFirstTime(i))return {key:'new',label:wfText('First quotation needed','รอเสนอราคาครั้งแรก'),color:'gray'};
 if(i.next&&i.next<=TODAY)return {key:'due',label:wfText('Due · sent by the system','ถึงรอบแล้ว · ระบบกำลังส่ง'),color:'amber'};
 return {key:'upcoming',label:wfText('Upcoming review','ยังไม่ถึงรอบ'),color:'green'};
}
function deskFilterParts(parts,state){return parts.filter(i=>(!state.supplier||i.supplier===state.supplier)&&(!state.cadence||String(i.cadence)===state.cadence)&&(!state.query||[i.code,i.name,supplierName(i.supplier)].join(' ').toLowerCase().includes(state.query.toLowerCase())))}
function deskPanel(title,sub,count,content,id){return `<section class="panel desk-panel" ${id?`data-desk-section="${id}"`:''}><header class="desk-panel-heading"><div><h2>${title} <span class="desk-count">${count}</span></h2><p>${sub}</p></div></header>${content}</section>`}
function dueReviewView(){
 if(portal!=='roki')return rfqDenied();const key='request-register',state=deskState(key),upcomingCount=db.items.filter(i=>i.next&&i.next>TODAY&&!deskFirstTime(i)).length,all=deskFiltered(deskRows(),state),waiting=all.filter(row=>!row.phase.historical&&row.phase.key==='waiting').length;
 return heading(wfText('Requests and purchase prices','คำขอและราคาซื้อ'),wfText('Request follow-up','ติดตามคำขอ'),wfText('Every request already sent to a Supplier, by stage. The system sends each review by itself when it is due; WEBPARK Issue takes over after the Supplier approves and returns the quotation.','คำขอทั้งหมดที่ส่งให้ Supplier แล้ว แยกตามขั้นตอน ระบบส่งคำขอทบทวนเองเมื่อถึงรอบ ฝ่าย WEBPARK Issue รับงานต่อหลัง Supplier อนุมัติและส่งกลับ'),rfqCanCreate()?wfLink('request-new','Create review schedule','สร้างกำหนดรอบทบทวน',true):'')+
 `<div class="desk-totals"><span><strong>${waiting}</strong>${wfText('sent, awaiting cost entry','ส่งแล้ว รอกรอกต้นทุน')}</span><span><strong>${upcomingCount}</strong>${wfText('upcoming reviews','รอบทบทวนที่กำลังมา')}</span><a href="#schedule-active">${wfText('View all active schedules','ดูกำหนดการที่ใช้งานทั้งหมด')}${icon('arrow')}</a></div>`+requestTrackingPanel(key);
}
function activeScheduleView(){
 if(portal!=='roki')return rfqDenied();const key='schedule-active',state=deskState(key),configured=currentItems().filter(i=>!!i.next),rows=deskFilterParts(configured,state).filter(i=>state.stage==='active'||deskScheduleState(i).key===state.stage);
 return heading(wfText('Review planning','กำหนดการทบทวนราคา'),wfText('Active review schedules','กำหนดการที่ใช้งาน'),wfText('The schedule register shows configured intervals and dates. Use Due for review to create a request; changing a schedule does not send anything.','ทะเบียนรอบและวันที่ทบทวนที่ตั้งใช้งานอยู่ การแก้กำหนดการไม่ใช่การส่งคำขอ เปิดหน้ารายการถึงรอบเพื่อดำเนินการส่ง'),wfLink('schedule','Go to due items','ไปยังรายการถึงรอบ'))+
 `<div class="desk-totals"><span><strong>${configured.length}</strong>${wfText('configured schedules','กำหนดการที่ตั้งไว้')}</span><span><strong>${configured.filter(i=>deskScheduleState(i).key==='upcoming').length}</strong>${wfText('upcoming','ยังไม่ถึงรอบ')}</span><span><strong>${configured.filter(i=>deskScheduleState(i).key==='processing').length}</strong>${wfText('cycle in progress','กำลังดำเนินการรอบนี้')}</span></div>`+deskPanel(wfText('Schedule register','ทะเบียนกำหนดการ'),wfText('One row per part and Supplier.','หนึ่งรายการต่อชิ้นส่วนและ Supplier'),rows.length,deskFiltersBar(key,{cadence:true,stage:true})+deskPartTable(rows,key,{schedules:true}),'active-schedules');
}
function rfqComposer(){
 if(!rfqCanCreate())return rfqDenied();if(route().split('/')[0]==='schedule')return dueReviewView();
 const id=route().split('/')[1],r=id?rfqRecords().find(r=>r.id===id):null;if(id&&(!r||!rfqEditable(r)))return rfqDenied();
 if(id&&requestSelectionFor!==id){selected=new Set(r.items);requestSelectionFor=id}
 const key=r?'request-edit':'request-new',state=deskState(key),items=deskFilterParts(r?db.items.filter(i=>r.items.includes(i.id)):deskNewParts(),state);
 return heading(wfText('Review planning','กำหนดการทบทวนราคา'),r?wfText('Complete and send the saved request','ตรวจแบบฟอร์มและส่งคำขอที่บันทึกไว้'):wfText('Create review schedule','สร้างกำหนดรอบทบทวน'),r?wfText('The request has not been sent. Review its selected items and complete the form before sending directly to Supplier.','คำขอนี้ยังไม่ส่ง ตรวจรายการและรายละเอียดแบบฟอร์มก่อนส่งตรงให้ Supplier'):wfText('Parts with no quotation yet. Select them to set the review schedule and send the first request; later reviews are sent by the system.','ชิ้นส่วนที่ยังไม่เคยเสนอราคา เลือกรายการเพื่อตั้งกำหนดการทบทวนและส่งคำขอแรก หลังจากนั้นระบบส่งรอบทบทวนให้เองอัตโนมัติ'),wfLink(r?'request-register':'schedule',r?'Request tracking':'Due review items',r?'กลับหน้าติดตามคำขอ':'ไปยังรายการทบทวนรอบเดิม'))+
 deskPanel(r?wfText('Selected request items','รายการในคำขอ'):wfText('Parts awaiting their first quotation','ชิ้นส่วนที่รอเสนอราคาครั้งแรก'),wfText('Each selected item can use its own formula and version.','กำหนดสูตรและเวอร์ชันแยกให้แต่ละรายการได้'),items.length,deskFiltersBar(key,{cadence:false})+deskPartTable(items,key,{selectable:true,request:r}),'first-time')+(r?'':deskDraftsPanel());
}
function deskDraftsPanel(){
 const rows=deskUnsentRows().filter(row=>row.phase.key==='unsent');
 return rows.length?deskPanel(wfText('Saved requests not yet sent','คำขอที่บันทึกไว้ ยังไม่ส่ง'),wfText('Continue a saved first-time request and send it to the Supplier.','เปิดคำขอครั้งแรกที่บันทึกไว้เพื่อส่งให้ Supplier'),rows.length,deskRequestTable(rows,'request-drafts'),'drafts'):'';
}
function deskRequestTabs(rows,key){const state=deskState(key);return `<div class="desk-queue-tabs" role="group" aria-label="${wfText('Request stage','ขั้นตอนคำขอ')}">${[['active','In progress','กำลังดำเนินการ'],['supplier','Waiting for Supplier','รอ Supplier'],['issue','WEBPARK Issue','รอ Issue'],['check','WEBPARK Check','รอ Check'],['approve','WEBPARK Approve','รอ Approve'],['history','History / completed','ประวัติ / เสร็จแล้ว'],['all','All cycles','ทุกรอบ']].filter(([id])=>portal==='roki'||id!=='unsent').map(([id,en,th])=>`<button data-desk-stage="${id}" data-desk-key="${key}" class="${state.stage===id?'active':''}" aria-pressed="${state.stage===id}">${wfText(en,th)}<span>${deskVisibleRows(rows,id).length}</span></button>`).join('')}</div>`}
function requestTrackingPanel(key,forcedStage){
 const state=deskState(key),all=deskFiltered(deskRows(),state),stage=forcedStage||state.stage,rows=deskVisibleRows(all,stage).slice().reverse();
 return `<section class="panel desk-panel">${deskFiltersBar(key)}${forcedStage?'':deskRequestTabs(all,key)}${deskRequestTable(rows,key)}</section>`;
}
function requestTrackingView(forcedStage){
 const key=portal==='supplier'?'requests':forcedStage?'supplier-waiting':'request-register';
 return heading(wfText('Requests and purchase prices','คำขอและราคาซื้อ'),forcedStage?wfText('Waiting for Supplier','คำขอที่รอ Supplier'):wfText('Request tracking','ติดตามคำขอ'),wfText('Requests that have already been sent to a Supplier, one row per part. A part that has never been quoted is on the Review schedule page.','เฉพาะคำขอที่ส่งให้ Supplier แล้ว หนึ่งแถวต่อชิ้นส่วน ชิ้นส่วนที่ยังไม่เคยเสนอราคาอยู่ที่หน้ากำหนดรอบทบทวน'),'')+requestTrackingPanel(key,forcedStage);
}
function rfqRegister(){const id=route().split('/')[1];if(id)return rfqDetail(id);if(portal==='roki'){setTimeout(()=>{if(route().split('/')[0]==='request-register'&&!route().split('/')[1])location.replace('#schedule')});return dueReviewView()}return requestTrackingView()}
function workflowRequests(waitingOnly=false){return requestTrackingView(waitingOnly?'supplier':null)}
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset.deskFilter)return;const s=deskState(el.dataset.deskKey);s[el.dataset.deskFilter]=el.value;s.page=1;deskState('schedule-ready').page=1;deskState('schedule-sent').page=1;render()});
document.addEventListener('input',e=>{const el=e.target,key=el.dataset.deskQuery;if(!key)return;const pos=el.selectionStart,s=deskState(key);s.query=el.value;s.page=1;deskState('schedule-ready').page=1;deskState('schedule-sent').page=1;render();const replacement=document.querySelector(`[data-desk-query="${key}"]`);replacement?.focus();try{replacement?.setSelectionRange(pos,pos)}catch{}});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.deskStage){const s=deskState(b.dataset.deskKey);s.stage=b.dataset.deskStage;s.page=1;render()}if(b.dataset.deskPage){deskState(b.dataset.deskKey).page=Number(b.dataset.deskPage);render()}if(b.hasAttribute('data-desk-clear')){selected.clear();render()}});
function rfqProgress(r){
 const pairs=deskSentPairs().filter(row=>row.r?.id===r.id),indices=r.items.map(id=>pairs.find(row=>row.i.id===id)?.phase.index??0),current=rfqDelivery(r)==='Sent'?Math.min(...indices):0;
 const steps=flowSteps();
 return `<div class="desk-flow-caption">${wfText('Workflow · the system sends the request on schedule: Supplier Issue → Supplier Approve → WEBPARK Issue → WEBPARK Check → WEBPARK Approve','โฟล · ระบบส่งคำขอเองตามกำหนดการ: Supplier Issue → Supplier Approve → WEBPARK Issue → WEBPARK Check → WEBPARK Approve')}${r.items.length>1?`<small>${wfText('The progress strip shows the earliest unfinished item. See each item below.','แสดงขั้นตอนแรกที่ยังไม่ครบของคำขอนี้ ตรวจสถานะรายชิ้นส่วนในตารางด้านล่าง')}</small>`:''}</div><ol class="desk-flow">${steps.map(([owner,label],i)=>`<li class="${current>i?'done':current===i?'current':''}" ${current===i?'aria-current="step"':''}><span>${current>i?icon('check'):i+1}</span><div><strong>${owner}</strong><small>${label}</small></div></li>`).join('')}</ol>`;
}
function quotationBeforeTimeline(q){
 /* The request is sent by the review schedule and is not a workflow step: only records from the older internal-approval flow are kept here, collapsed. */
 const n=detailSentRequest(q),r=n&&db.priceRequests.find(r=>r.id===n.priceRequestId),legacy=portal==='roki'&&r?.trail.filter(t=>['submit','advance'].includes(t.action));
 if(!legacy?.length)return '';
 return detailPanel(wfText('Earlier workflow records','ประวัติจากโฟลเดิม'),`<details class="desk-legacy-history"><summary>${wfText('Earlier workflow records','ประวัติจากโฟลเดิม')}</summary><p>${wfText('Retained for traceability; these are not required steps in the current workflow.','เก็บหลักฐานเดิมไว้เพื่ออ้างอิง ไม่ใช่ขั้นตอนที่ต้องทำในโฟลปัจจุบัน')}</p>${legacy.map(t=>`<div><strong>${esc(t.role)} · ${esc(t.user)}</strong><small>${esc(t.at)}</small></div>`).join('')}</details>`);
}
function quotationAfterTimeline(q){
 const stages=['S-Issue','S-Approve','R-Issue','R-Check','R-Approve'],steps=flowSteps().map(([owner,label],i)=>[stages[i],owner,label]);
 const n=detailSentRequest(q),r=n&&portal==='roki'&&db.priceRequests.find(r=>r.id===n.priceRequestId);
 const reset=q.trail.findLastIndex(t=>!t.stage&&/returned/i.test(t.action)),trail=reset>=0?q.trail.slice(reset+1):q.trail,sig=new Map(trail.filter(t=>t.stage).map(t=>[t.stage,t]));
 const current=({Draft:0,Reverted:0,'Supplier approval':1,'ROKI Issue':2,'ROKI Check':3,'ROKI Approve':4,Approved:5,Rejected:-1})[q.status];
 return detailPanel(wfText('Approval workflow','โฟลการอนุมัติ'),`<div class="desk-source-document"><a href="#quote/${q.id}">${esc(q.id)}</a>${statusBadge(q.status)}</div>${n?`<p class="muted-note">${wfText('Request','คำขอ')} ${esc(r?.id||n.id)} · ${wfText('sent on the review schedule','ส่งตามกำหนดการทบทวน')} ${esc(n.created)} · ${wfLink('request-detail/'+n.id+'/'+q.item,'View request & response','ดูคำขอและคำตอบ')}</p>`:`<p class="muted-note">${wfText('No originating request is linked to this quotation.','ใบเสนอราคานี้ไม่มีคำขอต้นทางเชื่อมโยง')}</p>`}${['Reverted','Rejected'].includes(q.status)?`<p class="desk-return-note">${q.status==='Reverted'?wfText('Supplier corrects and resubmits through its approver.','Supplier Issue แก้ไข แล้วผ่าน Supplier Approve ใหม่'):wfText('This quotation is closed. Supplier must submit a replacement.','ใบนี้ปิดแล้ว Supplier ต้องเสนอใบใหม่')}</p>`:''}<ol class="desk-timeline">${steps.map(([stage,owner,label],index)=>{const entry=sig.get(stage);return `<li class="${entry?'done':current===index?'current':''}" ${current===index?'aria-current="step"':''}><span>${entry?icon('check'):index+1}</span><div><strong>${owner}</strong><p>${label}</p><small>${entry?esc(entry.user)+' · '+esc(entry.at):current===index?wfText('Awaiting this role','รอบทบาทนี้ดำเนินการ'):wfText('No confirmation recorded in this round','ยังไม่มีบันทึกยืนยันในรอบนี้')}</small></div></li>`}).join('')}</ol>`);
}
function legacyDeskPartProcess(i){
 const reference=route().split('/')[2],q=reference&&visibleQuotes().find(q=>q.id===reference&&q.item===i.id),linked=q&&detailSentRequest(q),r=portal==='roki'&&(db.priceRequests.find(r=>r.id===reference&&r.items.includes(i.id))||db.priceRequests.find(r=>r.id===linked?.priceRequestId)),pair=linked?deskSentPairs().find(row=>row.n.id===linked.id&&row.i.id===i.id):r?deskSentPairs().find(row=>row.r?.id===r.id&&row.i.id===i.id):deskCurrentPair(i.id),offer=q||pair?.phase.offer;
 return `${r?rfqProgress(r):rfqNavigation()}${pair?deskPanel(wfText('Current responsibility','ผู้รับผิดชอบปัจจุบัน'),wfText('Follow the same request and item throughout the cycle.','อ้างอิงคำขอและชิ้นส่วนเดียวกันตลอดรอบ'),1,deskRequestTable([pair],'process-item',{pagination:false})):r?`<section class="panel body-pad"><p>${rfqNext(r)}</p>${rfqActions(r)}</section>`:''}${quotationAccessPanel(i.id,{request:r||null,notice:pair?.n||linked,quote:offer})}${offer?`<div class="desk-timeline-grid">${quotationBeforeTimeline(offer)}${quotationAfterTimeline(offer)}</div>`:pair?receivedFormPanel(pair.n,[i.id]):''}`;
}
function rokiWorkflowHome(){
 const rows=deskRows(),active=deskVisibleRows(rows,'active'),supplier=deskVisibleRows(rows,'supplier'),issue=deskVisibleRows(rows,'issue'),check=deskVisibleRows(rows,'check'),approve=deskVisibleRows(rows,'approve');
 return heading('WEBPARK',wfText('Review and request workspace','ภาพรวมการทบทวนและคำขอ'),wfText('Plan the next review, follow Supplier responses and verify purchase prices.','วางแผนรอบทบทวน ติดตามคำตอบ Supplier และตรวจสอบราคาซื้อ'),wfLink('approvals','My assigned work','งานที่ถึงคิวฉัน',true))+`<div class="desk-overview-links">${[['schedule',db.items.filter(i=>i.next&&i.next>TODAY).length,'Upcoming reviews (auto-sent)','รอบถัดไป (ระบบส่งเอง)'],['schedule',supplier.length,'Waiting for Supplier','รอ Supplier'],['request-register',issue.length,'Awaiting Issue','รอ Issue'],['request-register',check.length,'Awaiting Check','รอ Check'],['request-register',approve.length,'Awaiting Approve','รอ Approve']].map(([id,count,en,th],index)=>`<a class="panel body-pad" href="#${id}" ${index>0?`data-desk-jump="${['','supplier','issue','check','approve'][index]}"`:''}><span>${wfText(en,th)}</span><strong>${count}</strong><small>${wfText('View items','เปิดดูรายการ')} ${icon('arrow')}</small></a>`).join('')}</div>${deskPanel(wfText('Current open work','คำขอที่กำลังดำเนินการ'),wfText('Counts refer to requested part–Supplier pairs, including unsent requests.','นับเป็นรายการชิ้นส่วน–Supplier รวมรายการที่บันทึกไว้แต่ยังไม่ส่ง'),active.length,deskRequestTable(active.slice().reverse(),'overview'))}`;
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-desk-jump]');if(a){const s=deskState('request-register');s.stage=a.dataset.deskJump;s.page=1;if(['request-register','schedule'].includes(route().split('/')[0]))render()}});
function deskQuoteOwner(q){return ({Draft:'Supplier Issue',Reverted:'Supplier Issue','Supplier approval':'Supplier Approve','ROKI Issue':'WEBPARK Issue','ROKI Check':'WEBPARK Check','ROKI Approve':'WEBPARK Approve'})[q.status]||''}
function quoteTable(quotes,sortKey=''){
 if(!quotes.length)return deskEmpty(wfText('No quotations in this view.','ไม่มีใบเสนอราคาในมุมมองนี้'));
 return `<div class="table-wrap desk-table-wrap"><table class="data-table desk-table desk-quotes-table" ${sortKey?`data-sort-page="${sortKey}"`:""}><thead><tr><th>${wfText('Part / quotation','ชิ้นส่วน / ใบเสนอราคา')}</th>${portal==='roki'?'<th>Supplier</th>':''}<th class="num">${wfText('Approved reference','ราคาอ้างอิง')}</th><th class="num">${wfText('Calculated price','ราคาคำนวณ')}</th><th class="num">${wfText('Change','ส่วนต่าง')}</th><th>${wfText('Status / owner','สถานะ / ผู้รับผิดชอบ')}</th><th>${wfText('Action','ดำเนินการ')}</th></tr></thead><tbody>${quotes.map(q=>{const i=itemOf(q),identity=quotationIdentity(q)||i,incomplete=isIncompleteQuote(q),delta=q.previous?((q.total-q.previous)/q.previous*100):null;return `<tr data-open="${q.id}" ${detailRowAttrs('quote/'+q.id)}><td><a class="desk-record" href="#quote/${q.id}">${esc(identity.code||i.code)}</a><span class="desk-secondary desk-part-name">${esc(identity.name||i.name)}</span><span class="desk-source">${esc(q.id)} · Rev. ${q.revision}</span></td>${portal==='roki'?`<td><span class="desk-supplier">${esc(supplierName(q.supplier))}</span></td>`:''}<td class="num desk-price">${q.previous==null?'—':cash(q.previous)}</td><td class="num desk-price"><strong>${incomplete?wfText('Incomplete','ยังไม่ครบ'):cash(q.total)}</strong><small>${wfText('THB / pc','บาท/ชิ้น')}</small></td><td class="num"><span class="desk-change ${delta<0?'down':delta>0?'up':''}">${incomplete?'—':delta==null?wfText('First price','ราคาแรก'):(delta>0?'+':'')+delta.toFixed(2)+'%'}</span></td><td><div class="desk-stage">${q.status==='Approved'?validityBadge(q):statusBadge(q.status)}${deskQuoteOwner(q)?`<span class="desk-owner">${deskQuoteOwner(q)}</span>`:''}</div></td><td class="desk-actions"><a class="button ${workflowQueue(q)?'primary':''}" data-quote-access="${q.id}" href="#quote/${q.id}">${pendingForRole(q)?(user.role==='Check'?wfText('Check costs','ตรวจต้นทุน'):wfText('Review / approve','ตรวจ / อนุมัติ')):wfText('Open quotation','เปิดใบเสนอราคา')}</a></td></tr>`}).join('')}</tbody></table></div>`;
}
function supplierIssueTasks(){
 const mine=deskSentPairs().filter(r=>!r.phase.historical),due=mine.filter(r=>['waiting','entry'].includes(r.phase.key)).slice().reverse(),back=mine.filter(r=>r.phase.key==='correction').slice().reverse();
 return heading(wfText('Cost entry','กรอกต้นทุน'),wfText('Cost entry tasks','งานกรอก / แก้ไขต้นทุน'),wfText('Requests that are due and quotations returned for correction are listed separately.','แยกรายการที่ถึงรอบเสนอราคา ออกจากรายการที่ถูกส่งกลับมาแก้ไข'))+
  deskPanel(wfText('Due for quotation','ถึงรอบเสนอราคา · รอกรอกต้นทุน'),wfText('Requests sent to you for this review round. Enter costs, then send to Supplier Approve.','คำขอที่ส่งถึงคุณในรอบนี้ กรอกต้นทุนแล้วส่งให้ Supplier Approve'),due.length,due.length?deskRequestTable(due,'tasks-due'):deskEmpty(wfText('No requests are waiting for costs.','ไม่มีคำขอที่รอกรอกต้นทุน')),'tasks-due')+
  deskPanel(wfText('Returned for correction','ถูกส่งกลับมาแก้ไข'),wfText('WEBPARK or Supplier Approve returned these quotations. Correct and submit again.','WEBPARK หรือ Supplier Approve ส่งใบเหล่านี้กลับ แก้ไขแล้วส่งใหม่'),back.length,back.length?deskRequestTable(back,'tasks-back'):deskEmpty(wfText('Nothing returned for correction.','ไม่มีรายการที่ถูกส่งกลับ')),'tasks-back');
}
const activeQuoteDeskKey='quote-register';
const quoteFilterKeys=['format','movement','effectiveFrom','effectiveTo','minPrice','maxPrice'];
function activeQuoteFilterState(){
 const state=deskState(activeQuoteDeskKey);
 if(state.filterAccount!==user.id){
  state.filterAccount=user.id;state.advanced={};state.advancedOpen=false;state.page=1;
 }
 return state;
}
function quoteMovement(q){
 if(!(q.previous>0))return 'first';
 const change=Number(((q.total-q.previous)/q.previous*100).toFixed(2));
 return change>0?'up':change<0?'down':'same';
}
function matchesActiveQuoteFilters(q,f){
 return (!f.format||q.format===f.format)&&(!f.movement||quoteMovement(q)===f.movement)
  &&(!f.effectiveFrom||q.effective>=f.effectiveFrom)&&(!f.effectiveTo||q.effective<=f.effectiveTo)
  &&(!f.minPrice||q.total>=Number(f.minPrice))&&(!f.maxPrice||q.total<=Number(f.maxPrice));
}
function activeQuoteFilterButton(state){
 const count=quoteFilterKeys.filter(key=>state.advanced[key]).length;
 return `<button class="button" type="button" data-active-quote-toggle aria-expanded="${state.advancedOpen}" aria-controls="active-quote-advanced">${wfText('Advanced filters','ตัวกรองขั้นสูง')}${count?` <span class="desk-count">${count}</span>`:''}</button>`;
}
function activeQuoteFilterPanel(state){
 const f=state.advanced;
 const select=(key,label,options)=>`<label>${label}<select name="${key}"><option value="">${wfText('All','ทั้งหมด')}</option>${options.map(([value,caption])=>`<option value="${value}" ${f[key]===value?'selected':''}>${caption}</option>`).join('')}</select></label>`;
 const input=(key,label,type)=>`<label>${label}<input name="${key}" type="${type}" value="${esc(f[key]||'')}" ${type==='number'?'min="0" step="any" inputmode="decimal"':''}></label>`;
 return `<form id="active-quote-advanced" class="desk-advanced" ${state.advancedOpen?'':'hidden'}>
 <div class="desk-advanced-fields">
  ${select('format',wfText('Form type','ประเภทฟอร์ม'),[['Single Part',wfText('Single Part','ชิ้นส่วน')],['Assembly',wfText('Assembly','ชุดประกอบ')]])}
  ${select('movement',wfText('Price movement','การเปลี่ยนแปลงราคา'),[['up',wfText('Increased','เพิ่มขึ้น')],['down',wfText('Decreased','ลดลง')],['same',wfText('Unchanged','เท่าเดิม')],['first',wfText('No reference price','ไม่มีราคาอ้างอิง')]])}
  ${input('effectiveFrom',wfText('Effective date from','วันที่มีผลตั้งแต่'),'date')}
  ${input('effectiveTo',wfText('Effective date to','วันที่มีผลถึง'),'date')}
  ${input('minPrice',wfText('Minimum price (THB / pc)','ราคาต่ำสุด (บาท / ชิ้น)'),'number')}
  ${input('maxPrice',wfText('Maximum price (THB / pc)','ราคาสูงสุด (บาท / ชิ้น)'),'number')}
 </div><p class="desk-advanced-error" role="alert" hidden></p>
 <div class="desk-advanced-actions"><button class="button" type="button" data-active-quote-clear>${wfText('Clear filters','ล้างตัวกรอง')}</button><button class="button primary" type="submit">${wfText('Apply filters','ใช้ตัวกรอง')}</button></div></form>`;
}

document.addEventListener('submit',event=>{
 const form=event.target;if(form.id!=='active-quote-advanced')return;
 event.preventDefault();
 const f=Object.fromEntries(new FormData(form)),error=form.querySelector('[role="alert"]');
 const invalidDates=f.effectiveFrom&&f.effectiveTo&&f.effectiveFrom>f.effectiveTo;
 const invalidPrices=f.minPrice&&f.maxPrice&&Number(f.minPrice)>Number(f.maxPrice);
 if(invalidDates||invalidPrices){
  error.hidden=false;
  error.textContent=invalidDates?wfText('Start date must be on or before the end date.','วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'):wfText('Minimum price must not exceed the maximum price.','ราคาต่ำสุดต้องไม่เกินราคาสูงสุด');
  return;
 }
 const state=activeQuoteFilterState();state.advanced=f;state.page=1;render();
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-active-quote-toggle],[data-active-quote-clear]');if(!button)return;
 const state=activeQuoteFilterState();
 if(button.hasAttribute('data-active-quote-toggle')){
  state.advancedOpen=!state.advancedOpen;
  document.getElementById('active-quote-advanced').hidden=!state.advancedOpen;
  button.setAttribute('aria-expanded',String(state.advancedOpen));
 }else{
  state.advanced={};state.page=1;search='';filterSupplier='';render();
 }
});

function workflowQuotes(approval=false,sent=false){
 if(approval&&portal==='supplier'&&user.role==='Issue')return supplierIssueTasks();
 const active=!approval&&!sent;
 let pool=visibleQuotes();
 if(approval)pool=pool.filter(workflowQueue);
 if(sent)pool=pool.filter(q=>['ROKI Issue','ROKI Check','ROKI Approve'].includes(q.status));
 if(active)pool=pool.filter(q=>q.status==='Approved'&&priceValidity(q)==='active');
 const key=approval?'quote-approvals':sent?'quote-sent':activeQuoteDeskKey;
 const state=active?activeQuoteFilterState():deskState(key);
 if(active){
  const filterKey=JSON.stringify([search,filterSupplier]);
  if(state.basicFilterKey!==filterKey){state.basicFilterKey=filterKey;state.page=1}
 }
 let rows=pool.filter(q=>(!filterStatus||q.status===filterStatus)&&(!filterSupplier||q.supplier===filterSupplier)&&(!formatFilter||q.format===formatFilter)&&(!priceFilter||priceValidity(q)===priceFilter)&&(!search||[q.id,itemOf(q).code,itemOf(q).name,supplierName(q.supplier)].join(' ').toLowerCase().includes(search.toLowerCase()))&&(!active||matchesActiveQuoteFilters(q,state.advanced))).reverse();
 if(active){
  const columns=[q=>quotationIdentity(q)?.code||itemOf(q)?.code,...(portal==='roki'?[q=>supplierName(q.supplier)]:[]),q=>q.previous,q=>q.total,q=>q.previous>0?(q.total-q.previous)/q.previous:null,q=>q.status];
  rows=window.sortPaginatedRows?.(key,rows,columns)??rows;
 }
 const page=deskPage(rows,state);
 const statuses=Object.entries(stageLabels).filter(([status])=>approval?true:['ROKI Issue','ROKI Check','ROKI Approve'].includes(status));
 return heading(wfText('Purchase prices','ราคาซื้อและต้นทุน'),approval?(portal==='roki'?(user.role==='Issue'?wfText('My issue queue','งาน Issue ของฉัน'):user.role==='Check'?wfText('My cost checks','งานตรวจต้นทุนของฉัน'):wfText('My final price approvals','งานอนุมัติราคาของฉัน')):user.role==='Issue'?wfText('My cost entries / corrections','งานกรอก / แก้ไขต้นทุน'):wfText('My approvals','งานอนุมัติของฉัน')):sent?(portal==='roki'?wfText('Awaiting WEBPARK action','รอดำเนินการภายใน WEBPARK'):wfText('Sent to WEBPARK','ส่งแล้ว · รอ WEBPARK')):wfText('Quotations in use','ใบเสนอราคาที่กำลังใช้'),approval?wfText('Only work assigned to your current role is shown.','แสดงเฉพาะงานที่ถึงคิวบทบาทปัจจุบันของคุณ'):sent?wfText('Quotations the Supplier has approved and sent back. They wait for WEBPARK Issue, Check or Approve. Your own step is under My tasks.','ใบที่ Supplier อนุมัติและส่งกลับแล้ว รอ WEBPARK Issue / Check / Approve งานของคุณอยู่ที่เมนูงานของฉัน'):wfText('Approved quotations whose price is in effect now. Earlier and future prices are in Reports & history.','ใบที่อนุมัติแล้วและราคามีผลอยู่ตอนนี้ ราคาเก่าและราคาล่วงหน้าดูที่รายงานและประวัติ'))+
 `<section class="panel desk-panel"><div class="desk-filters"><label class="desk-search">${icon('search')}<input id="search" value="${esc(search)}" placeholder="${wfText('Search quotation or part','ค้นหาใบเสนอราคาหรือชิ้นส่วน')}"></label>${approval||sent?`<select id="status-filter"><option value="">${wfText('All statuses','ทุกสถานะ')}</option>${statuses.map(([status,labels])=>`<option value="${status}" ${filterStatus===status?'selected':''}>${wfQuoteLabel(status,labels[0])}</option>`).join('')}</select>`:''}${portal==='roki'?`<select id="supplier-filter">${deskSupplierOptions(filterSupplier)}</select>`:''}${approval||sent?`<select id="price-filter"><option value="">${wfText('All price validity','การมีผลของราคาทั้งหมด')}</option>${[['active','Current effective price','ราคาที่มีผลปัจจุบัน'],['scheduled','Future effective price','ราคาที่อนุมัติล่วงหน้า'],['historical','Historical price','ราคาย้อนหลัง']].map(([value,en,th])=>`<option value="${value}" ${priceFilter===value?'selected':''}>${wfText(en,th)}</option>`).join('')}</select>`:''}${active?activeQuoteFilterButton(state):''}</div>${active?activeQuoteFilterPanel(state):''}${quoteTable(page.items,active?key:'')}${deskPager(key,rows.length,page.pages)}</section>`;
}
