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

function workflowNext(q){
 const labels={Draft:['Supplier Issue: complete and issue','Supplier Issue: จัดทำและส่งอนุมัติ'],'Supplier approval':['Supplier Approve: review and submit','Supplier Approve: ตรวจและส่งให้โรกิ'],'ROKI Issue':['ROKI Issue: receive and forward','ROKI Issue: รับเรื่องและส่งตรวจ'],'ROKI Check':['ROKI Check: verify costs','ROKI Check: ตรวจต้นทุนและเหตุผล'],'ROKI Approve':['ROKI Approve: final decision','ROKI Approve: อนุมัติขั้นสุดท้าย'],Approved:['Completed: approved price recorded','เสร็จสิ้น: บันทึกราคาที่อนุมัติแล้ว'],Reverted:['Supplier Issue: correct and resubmit','Supplier Issue: แก้ไขและส่งอนุมัติใหม่'],Rejected:['Closed: prepare a new quotation if needed','ใบนี้สิ้นสุด: จัดทำใบใหม่หากต้องการเสนออีก']};
 return wfText(...(labels[q.status]||['','']));
}
function workflowRequestNew(){return rfqComposer()}
function workflowRequestState(n,id){
 const q=wfLatest(n,id);
 const latest=deskLatestNotice(id);
 if(latest?.id!==n.id&&(!q||q.status==='Rejected'))return ['superseded',wfText('Replaced by a newer request','แทนที่ด้วยคำขอใหม่แล้ว'),'gray'];
 if(q?.status==='Approved')return ['done',wfText('Completed','เสร็จสิ้น'),'green'];
 if(q?.status==='Rejected')return ['retry',wfText('Awaiting cost entry','รอกรอกต้นทุน'),'red'];
 if(q?.status==='Reverted')return ['correction',wfText('Supplier correcting quotation','Supplier กำลังแก้ไขใบเสนอราคา'),'purple'];
 if(q&&q.status.startsWith('ROKI '))return ['review',wfText('ROKI reviewing','โรกิกำลังตรวจ / อนุมัติ'),'blue'];
 if(q)return ['preparing',wfText('Supplier preparing / approving','Supplier กำลังจัดทำ / อนุมัติ'),'amber'];
 return ['waiting',wfText('Waiting for supplier','รอ Supplier ตอบกลับ'),'amber'];
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-wf-status]');if(b){filterStatus=b.dataset.wfStatus;render()}});

/* The quotation workflow is exactly these five steps. Setting the review schedule is not a step: the system sends the request on schedule. */
function flowSteps(){return [['Supplier Issue',wfText('Enter costs','กรอกต้นทุน')],['Supplier Approve',wfText('Verify and send back','ตรวจและส่งกลับ')],['WEBPARK Issue',wfText('Check the data','ตรวจสอบข้อมูล')],['WEBPARK Check',wfText('Check costs and price','ตรวจต้นทุนและราคา')],['WEBPARK Approve',wfText('Approve purchase price','อนุมัติราคาซื้อ')]]}
