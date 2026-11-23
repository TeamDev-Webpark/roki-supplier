'use strict';
const SUPPLIER_WAIT_STATES=['waiting','preparing','correction','retry'];
function internalPendingRequests(){return rfqRecords().filter(r=>rfqDelivery(r)==='NotSent'&&['Pending Check','Pending Approve'].includes(rfqApproval(r)))}
function isSupplierWaitingRow({n,i,st}){
 if(!i||!SUPPLIER_WAIT_STATES.includes(st[0]))return false;
 if(deskLatestNotice(i.id)?.id!==n.id)return false;
 const r=rfqRecords().find(r=>r.id===n.priceRequestId);
 return !r||rfqDelivery(r)==='Sent'&&(r.flowVersion===2||rfqApproval(r)==='Approved');
}
function supplierWaitingRows(){
 return db.notifications.filter(n=>portal==='roki'||n.supplier===user.supplier).flatMap(n=>n.items.map(id=>({n,i:db.items.find(i=>i.id===id),st:workflowRequestState(n,id),q:wfLatest(n,id)}))).filter(isSupplierWaitingRow);
}
function queueSplitOverview(){
 const internal=internalPendingRequests(),supplier=supplierWaitingRows();
 const panel=(key,title,count,unit,help,head,body,link)=>`<section class="panel queue-panel queue-${key}" data-home-queue="${key}"><div class="panel-title"><div><h2>${title}</h2><small>${count} ${unit}</small></div>${statusPill(key==='internal'?wfText('Owner: WEBPARK','ผู้รับผิดชอบ: WEBPARK'):wfText('Owner: Supplier','ผู้รับผิดชอบ: Supplier'),key==='internal'?'blue':'amber')}</div><p class="queue-explanation">${help}</p><div class="table-wrap"><table class="data-table"><thead>${head}</thead><tbody>${body}</tbody></table>${body?'':`<div class="empty">${wfText('No pending items in this queue.','ไม่มีรายการค้างในคิวนี้')}</div>`}</div><div class="queue-footer">${link}</div></section>`;
 const internalBody=internal.slice().reverse().slice(0,5).map(r=>`<tr data-home-rfq="${r.id}"><td>${detailRecordLink('request-register/'+r.id,r.id)}<small data-i18n-skip>${esc(r.title)}</small></td><td>${rfqBadge(r)}<small>${rfqNext(r)}</small></td></tr>`).join('');
 const supplierBody=supplier.slice().reverse().slice(0,5).map(({n,i,st})=>`<tr data-home-notice="${n.id}" data-home-item="${i.id}"><td>${detailRecordLink('request-detail/'+n.id+'/'+i.id,i.code)}<small>${esc(supplierName(n.supplier))}</small></td><td>${statusPill(st[1],st[2])}<small>${wfText('Response due','ตอบภายใน')}: ${date(n.due)}</small></td></tr>`).join('');
 return `<div class="queue-split">${panel('internal',wfText('Awaiting internal WEBPARK approval','รออนุมัติภายใน WEBPARK'),internal.length,wfText('requests','คำขอ'),wfText('Not sent to Supplier. Waiting for WEBPARK Check or Approve.','ยังไม่ส่ง Supplier • รอ WEBPARK Check หรือ Approve'),`<tr><th>${wfText('Internal request','คำขอภายใน')}</th><th>${wfText('Waiting for','รอผู้ดำเนินการ')}</th></tr>`,internalBody,wfLink('internal-pending','View internal approval queue','ดูคิวรออนุมัติภายใน',true))}${panel('supplier',wfText('Awaiting Supplier response','รอ Supplier ตอบกลับ'),supplier.length,wfText('part–supplier pairs','รายการชิ้นส่วน–Supplier'),wfText('Sent after internal approval. Supplier is preparing, approving or correcting its offer.','ส่งหลังอนุมัติภายในแล้ว • รอ Supplier จัดทำ อนุมัติ หรือแก้ไขใบเสนอราคา'),`<tr><th>${wfText('Part / Supplier','ชิ้นส่วน / Supplier')}</th><th>${wfText('Supplier progress','งานค้างฝั่ง Supplier')}</th></tr>`,supplierBody,wfLink('supplier-waiting','View Supplier waiting queue','ดูคิวรอ Supplier',true))}</div>`;
}
/* Work queues share the existing quotation records; no second approval workflow. */
const wfText=(en,th)=>I18N.lang()==='th'?th:en;
const workflowQueue=q=>pendingForRole(q)||canEdit(q);
function wfQuoteLabel(status,fallback){
 const th={Draft:'ฉบับร่าง','Supplier approval':'รอผู้อนุมัติ Supplier','ROKI Issue':'รอ ROKI Issue รับเรื่อง','ROKI Check':'รอ ROKI Check ตรวจสอบ','ROKI Approve':'รอ ROKI Approve อนุมัติ',Approved:'อนุมัติแล้ว',Reverted:'ส่งกลับ Supplier แก้ไข',Rejected:'ปฏิเสธใบเสนอราคา'};
 return wfText(fallback,th[status]||fallback);
}
const wfLink=(route,en,th,primary=false)=>`<a class="button ${primary?'primary':''}" href="#${route}">${wfText(en,th)}</a>`;
const wfLatest=(n,id)=>db.quotes.filter(q=>q.requestedBy===n.id&&q.item===id).at(-1);
const wfActive=id=>{const n=deskLatestNotice(id);return n&&(!wfLatest(n,id)||wfLatest(n,id).status!=='Approved')?n:null};
function workflowNav(){
 const n=(icon,id,en,th,group)=>[icon,id,wfText(en,th),group];
 return portal==='roki'?[
 n('grid','overview','Overview','ภาพรวม',''),
 ...(user.role==='Issue'?[n('clock','schedule','Review schedule / create request','รอบทบทวน / สร้างคำขอ','requests'),n('file','request-drafts','Draft requests','คำขอฉบับร่าง','requests')]:[]),
 n('file','request-register','All requests','ทะเบียนคำขอ','requests'),n('bell','supplier-waiting','Waiting for Supplier','รอ Supplier','requests'),
 ...(['Check','Approve'].includes(user.role)?[n('check','approvals','My purchase price approvals','งานอนุมัติราคาของฉัน','prices')]:[]),n('compare','quotes','Quotations / comparison','ใบเสนอราคา / เปรียบเทียบ','prices'),
 n('box','parts','Parts and assemblies','ชิ้นส่วนและชุดประกอบ','master'),n('settings','formulas','Formula library','คลังสูตรคำนวณ','master'),n('chart','records','Reports and history','รายงานและประวัติ','master')]:[
 n('grid','overview','Overview','ภาพรวม',''),n('bell','requests','Cost requests','คำขอให้กรอกต้นทุน','work'),n('check','approvals',user.role==='Issue'?'My cost entry queue':'My approval queue',user.role==='Issue'?'งานกรอก / แก้ไขต้นทุน':'งานอนุมัติของฉัน','work'),n('file','quotes','All quotations','ใบเสนอราคาทั้งหมด','work'),n('compare','sent','Submitted / tracking','ส่งแล้ว / ติดตามผล','work'),n('box','parts','Assigned parts','ชิ้นส่วนที่รับผิดชอบ','master'),n('chart','records','Reports and history','รายงานและประวัติ','master')];
}

function workflowGroup(key){return {requests:wfText('Requests to Supplier','คำขอไป Supplier'),prices:wfText('Purchase price approval','ตรวจและอนุมัติราคา'),internal:wfText('1. Inside WEBPARK','1. งานภายใน WEBPARK'),'supplier-wait':wfText('2. Waiting on Supplier','2. งานที่รอ Supplier'),rfq:wfText('A. Requests to Supplier','A. คำขอเสนอราคาไป Supplier'),quotations:wfText('3. WEBPARK price approval','3. WEBPARK ตรวจอนุมัติราคา'),work:wfText('Daily work','งานประจำวัน'),master:wfText('Master data & planning','ข้อมูลหลักและแผนงาน'),records:wfText('History & reports','ประวัติและรายงาน')}[key]||''}
function workflowNext(q){
 const labels={Draft:['Supplier Issue: complete and issue','Supplier Issue: จัดทำและส่งอนุมัติ'],'Supplier approval':['Supplier Approve: review and submit','Supplier Approve: ตรวจและส่งให้โรกิ'],'ROKI Issue':['ROKI Issue: receive and forward','ROKI Issue: รับเรื่องและส่งตรวจ'],'ROKI Check':['ROKI Check: verify costs','ROKI Check: ตรวจต้นทุนและเหตุผล'],'ROKI Approve':['ROKI Approve: final decision','ROKI Approve: อนุมัติขั้นสุดท้าย'],Approved:['Completed: approved price recorded','เสร็จสิ้น: บันทึกราคาที่อนุมัติแล้ว'],Reverted:['Supplier Issue: correct and resubmit','Supplier Issue: แก้ไขและส่งอนุมัติใหม่'],Rejected:['Closed: prepare a new quotation if needed','ใบนี้สิ้นสุด: จัดทำใบใหม่หากต้องการเสนออีก']};
 return wfText(...(labels[q.status]||['','']));
}
function workflowGuide(){
 if(portal==='roki')return rfqNavigation();
 const steps=portal==='roki'?[['request-register','1. Create & approve RFQ','1. สร้างและอนุมัติคำขอ'],['request-tracking','2. Send & track suppliers','2. ส่งและติดตาม Supplier'],['approvals','3. Review quotations','3. ตรวจใบเสนอราคา'],['reports','4. Approved prices','4. ราคาที่อนุมัติ']]:[['requests','1. Receive request','1. รับคำขอ'],['quotes','2. Prepare quotation','2. จัดทำใบเสนอราคา'],['approvals','3. Supplier approval','3. อนุมัติในบริษัท'],['sent','4. Track ROKI review','4. ติดตามโรกิตรวจ']];
 return `<div class="workflow-guide">${steps.map(([r,en,th])=>`<a href="#${r}">${wfText(en,th)}</a>`).join('')}</div>`;
}
function workflowOverview(){
 if(portal==='roki')return rokiWorkflowHome();
 return overview().replace(stats(),workflowGuide()+stats())+processHelp()+(portal==='roki'?rfqOverview():'')+`<section class="panel workflow-help"><h2>${wfText('Start with one price cycle','เริ่มใช้งานหนึ่งรอบราคา')}</h2><p>${portal==='roki'?wfText('Create an internal request. ROKI Check verifies it and ROKI Approve approves it. ROKI Approve can then send it directly to suppliers. Supplier quotation approval starts after the response.','สร้างคำขอภายใน ให้ ROKI Check ตรวจและ ROKI Approve อนุมัติ จากนั้น ROKI Approve กดส่งต่อให้ Supplier ได้เลย เมื่อได้รับคำตอบจึงเริ่มรอบตรวจและอนุมัติใบเสนอราคา'):wfText('Open a ROKI request to prepare a quotation. Your company approver submits it to ROKI. Use Submitted to WEBPARK to follow Check and Approve.','เปิดคำขอจากโรกิเพื่อจัดทำใบเสนอราคา ผู้อนุมัติของบริษัทจะส่งให้โรกิ ใช้หน้าใบเสนอราคาที่ส่งให้โรกิเพื่อติดตาม Check และ Approve')}</p>${portal==='roki'?wfLink('parts','Set up parts','จัดเตรียมชิ้นส่วน')+(rfqCanCreate()?wfLink('request-new','Create price request','สร้างคำขอเสนอราคา',true):wfLink('request-review','Review requests','ตรวจคำขอ',true)):wfLink('requests','Open requests','เปิดคำขอจากโรกิ',true)}</section>`;
}
function workflowRequestNew(){return rfqComposer()}
function workflowRequestState(n,id){
 const q=wfLatest(n,id);
 const latest=deskLatestNotice(id);
 if(latest?.id!==n.id&&(!q||q.status==='Rejected'))return ['superseded',wfText('Replaced by a newer request','แทนที่ด้วยคำขอใหม่แล้ว'),'gray'];
 if(q?.status==='Approved')return ['done',wfText('Completed','เสร็จสิ้น'),'green'];
 if(q?.status==='Rejected')return ['retry',wfText('Quotation rejected · new quote needed','ใบเสนอราคาถูกปฏิเสธ · รอเสนอใหม่'),'red'];
 if(q?.status==='Reverted')return ['correction',wfText('Supplier correcting quotation','Supplier กำลังแก้ไขใบเสนอราคา'),'purple'];
 if(q&&q.status.startsWith('ROKI '))return ['review',wfText('ROKI reviewing','โรกิกำลังตรวจ / อนุมัติ'),'blue'];
 if(q)return ['preparing',wfText('Supplier preparing / approving','Supplier กำลังจัดทำ / อนุมัติ'),'amber'];
 return ['waiting',wfText('Waiting for supplier','รอ Supplier ตอบกลับ'),'amber'];
}
function workflowRequests(waitingOnly=false){
 const roki=portal==='roki',notes=db.notifications.filter(n=>roki||n.supplier===user.supplier).slice().reverse();
 let rows=notes.flatMap(n=>n.items.map(id=>({n,i:db.items.find(i=>i.id===id),st:workflowRequestState(n,id),q:wfLatest(n,id)}))).filter(r=>r.i);
 if(waitingOnly)rows=rows.filter(isSupplierWaitingRow);
 rows=rows.filter(({n,i,st})=>(!filterSupplier||n.supplier===filterSupplier)&&(!filterStatus||st[0]===filterStatus)&&`${n.id} ${i.code} ${i.name} ${supplierName(n.supplier)}`.toLowerCase().includes(search.toLowerCase()));
 const statesAll=[['waiting','Waiting for supplier','รอ Supplier ตอบกลับ'],['preparing','Supplier preparing / approving','Supplier กำลังจัดทำ / อนุมัติ'],['review','ROKI reviewing','โรกิกำลังตรวจ / อนุมัติ'],['correction','Correction needed','รอแก้ไข'],['retry','New quotation needed','รอเสนอใหม่'],['done','Completed','เสร็จสิ้น'],['superseded','Superseded','แทนที่ด้วยคำขอใหม่']];
 const states=waitingOnly?statesAll.filter(([id])=>SUPPLIER_WAIT_STATES.includes(id)):statesAll;
 return heading(wfText('Price requests','คำขอเสนอราคา'),waitingOnly?wfText('Awaiting Supplier response','รอ Supplier ตอบกลับ'):roki?wfText('Sent price requests','ติดตามคำขอที่ส่งแล้ว'):wfText('Requests from ROKI','คำขอเสนอราคาจากโรกิ'),waitingOnly?wfText('Already sent to Supplier. Waiting for preparation, Supplier approval, corrections or a replacement offer. WEBPARK review and completed items are in separate queues.','เฉพาะรายการที่ส่งแล้วและยังรอ Supplier จัดทำ อนุมัติ แก้ไข หรือเสนอใหม่ งานที่ส่งกลับให้ WEBPARK ตรวจและงานที่เสร็จแล้วอยู่คนละคิว'):wfText('Track each requested part separately. Request progress and quotation approval are different statuses.','ติดตามแยกแต่ละชิ้นส่วน สถานะคำขอบอกความคืบหน้าของงาน ส่วนสถานะใบเสนอราคาบอกขั้นอนุมัติ'),roki&&waitingOnly?wfLink('request-tracking','All sent requests','ดูทะเบียนคำขอที่ส่งทั้งหมด'):roki?(rfqCanCreate()?wfLink('request-new','Create price request','สร้างคำขอเสนอราคา',true):wfLink('request-review','Review requests','ตรวจคำขอ',true)):'')+`<section class="panel"><div class="filters"><div class="search"><input id="search" value="${esc(search)}" placeholder="${wfText('Search request, part or supplier','ค้นหาคำขอ ชิ้นส่วน หรือ Supplier')}"></div><select id="status-filter"><option value="">${wfText('All request progress','ความคืบหน้าทั้งหมด')}</option>${states.map(([id,en,th])=>`<option value="${id}" ${filterStatus===id?'selected':''}>${wfText(en,th)}</option>`).join('')}</select>${roki?`<select id="supplier-filter"><option value="">${wfText('All suppliers','Supplier ทั้งหมด')}</option>${suppliers.map(s=>`<option value="${s.id}" ${filterSupplier===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`:''}</div><div class="table-wrap"><table class="data-table" data-queue="${waitingOnly?'supplier':'sent-register'}"><thead><tr>${[wfText('Request / part','คำขอ / ชิ้นส่วน'),wfText('Response deadline','กำหนดตอบกลับ'),wfText('Request progress','ความคืบหน้าคำขอ'),wfText('Quotation / next owner','ใบเสนอราคา / ผู้รับผิดชอบถัดไป'),wfText('Action','ดำเนินการ')].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${rows.map(({n,i,st,q})=>{
 const disclosed=q&&(!roki||!['Draft','Supplier approval'].includes(q.status));
 const late=n.due<TODAY&&['waiting','preparing','retry','correction'].includes(st[0]);
 const canStart=!roki&&user.role==='Issue'&&['waiting','retry'].includes(st[0]);
 return `<tr data-request-row="${esc(n.id)}" data-item-row="${i.id}" ${detailRowAttrs('request-detail/'+n.id+'/'+i.id)}><td><strong>${esc(i.code)}</strong><small>${esc(i.name)}</small><small>${esc(supplierName(n.supplier))}</small><details><summary>${esc(n.id)}</summary><p>${esc(n.message)}</p><small>${esc(n.by)} · ${esc(n.created)}</small></details></td><td>${date(n.due)}${late?`<small>${statusPill(wfText('Response overdue','เกินกำหนดตอบกลับ'),'red')}</small>`:''}</td><td>${statusPill(st[1],st[2])}</td><td>${quotationAccessLinks(i.id,{notice:n,compact:true})}${disclosed?`<a class="link-button" href="#quote/${q.id}">${esc(q.id)}</a><small>${statusBadge(q.status)}</small><small>${workflowNext(q)}</small>`:wfText('Supplier Issue / Approve','Supplier Issue / Approve')}</td><td>${wfLink('request-detail/'+n.id+'/'+i.id,'Request details','ดูรายละเอียดคำขอ')}${canStart?`<button class="button primary" data-request="${n.id}" data-item="${i.id}">${wfText('Prepare quotation','จัดทำใบเสนอราคา')}</button>`:disclosed?wfLink('quote/'+q.id,'View quotation','ดูใบเสนอราคา'):wfText('Waiting for supplier team','รอทีม Supplier')}</td></tr>`;
 }).join('')}</tbody></table>${!rows.length?`<div class="empty">${wfText('No requests match this view.','ไม่พบคำขอที่ตรงเงื่อนไข')}</div>`:''}</div><div class="table-footer">${wfText('Requested part–supplier pairs','รายการชิ้นส่วน–Supplier ที่ขอราคา')}: ${rows.length}</div></section>`;
}
function workflowQuotes(approval=false,sent=false){
 let quotes=visibleQuotes();
 if(approval)quotes=quotes.filter(workflowQueue);
 if(sent)quotes=quotes.filter(q=>q.trail.some(t=>t.stage==='S-Approve'));
 const tabs=[['','All','ทั้งหมด'],['Draft','Draft','ร่าง'],['Supplier approval','Supplier approval','รอ Supplier อนุมัติ'],['ROKI Issue','ROKI receiving','รอโรกิรับเรื่อง'],['ROKI Check','ROKI checking','รอโรกิตรวจสอบ'],['ROKI Approve','ROKI final approval','รอโรกิอนุมัติ'],['Reverted','Correction needed','ส่งกลับแก้ไข'],['Approved','Approved','อนุมัติแล้ว'],['Rejected','Rejected','ปฏิเสธ']].filter(([s])=>portal==='supplier'||!['Draft','Supplier approval'].includes(s));
 const pool=quotes;
 quotes=quotes.filter(q=>(!priceFilter||priceValidity(q)===priceFilter)&&(!filterStatus||q.status===filterStatus)&&(!filterSupplier||q.supplier===filterSupplier)&&(!formatFilter||q.format===formatFilter)&&`${q.id} ${itemOf(q).code} ${itemOf(q).name} ${supplierName(q.supplier)}`.toLowerCase().includes(search.toLowerCase()));
 let content;
 // Reuse the established comparison table and filter wiring, with one source of truth.
 const title=approval?wfText('My review & approval queue','งานที่รอฉันตรวจ / อนุมัติ'):sent?wfText('Submitted to ROKI','ใบเสนอราคาที่ส่งให้โรกิ'):portal==='roki'?wfText('Quotations & comparison','ใบเสนอราคาและเปรียบเทียบ'):wfText('Prepare & track quotations','จัดทำและติดตามใบเสนอราคา');
 content=heading(wfText('Quotation workflow','ขั้นตอนใบเสนอราคา'),title,approval?wfText('Only quotations assigned to your current role appear here.','แสดงเฉพาะใบเสนอราคาที่ถึงคิวบทบาทของคุณ'):sent?wfText('Quotations submitted by your company approver, including ROKI review, returns and final decisions.','ใบที่ผู้อนุมัติบริษัทส่งให้โรกิแล้ว รวมใบที่กำลังตรวจ ส่งกลับแก้ไข และตัดสินใจแล้ว'):wfText('Compare previous approved and proposed prices. Each quotation shows its next owner.','เปรียบเทียบราคาอนุมัติเดิมกับราคาเสนอใหม่ พร้อมผู้รับผิดชอบขั้นถัดไป'))
 +`<div class="workflow-tabs">${tabs.map(([s,en,th])=>`<button class="button ${filterStatus===s?'primary':''}" data-wf-status="${s}">${wfText(en,th)} <b>${pool.filter(q=>!s||q.status===s).length}</b></button>`).join('')}</div><section class="panel"><div class="filters"><div class="search"><input id="search" value="${esc(search)}" placeholder="${wfText('Search quotation, part or supplier','ค้นหาใบเสนอราคา ชิ้นส่วน หรือ Supplier')}"></div><select id="status-filter">${tabs.map(([s,en,th])=>`<option value="${s}" ${filterStatus===s?'selected':''}>${wfText(en,th)}</option>`).join('')}</select><select id="price-filter" aria-label="${wfText('Price validity','การมีผลของราคา')}"><option value="">${wfText('All price validity','การมีผลของราคาทั้งหมด')}</option>${[['active','Active price','ราคาปัจจุบัน'],['scheduled','Future approved price','อนุมัติแล้ว รอวันมีผล'],['historical','Historical price','ราคาเก่า / ประวัติ']].map(([value,en,th])=>`<option value="${value}" ${priceFilter===value?'selected':''}>${wfText(en,th)}</option>`).join('')}</select><select id="format-filter"><option value="">${wfText('All formats','ทุกประเภท')}</option>${FORMAT_NAMES.map(f=>`<option value="${f}" ${formatFilter===f?'selected':''}>${esc(f)}</option>`).join('')}</select>${portal==='roki'?`<select id="supplier-filter"><option value="">${wfText('All suppliers','Supplier ทั้งหมด')}</option>${suppliers.map(s=>`<option value="${s.id}" ${filterSupplier===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`:''}</div>${quoteTable(quotes)}</section>`;
 return content;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-wf-status]');if(b){filterStatus=b.dataset.wfStatus;render()}});
