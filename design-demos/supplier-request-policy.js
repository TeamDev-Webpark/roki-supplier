'use strict';
function requestSupplierId(ids=[...selected]){
 const items=ids.map(id=>db.items.find(i=>i.id===id));
 return items.length&&items.every(i=>i?.supplier&&i.supplier===items[0]?.supplier)&&new Set(ids).size===ids.length?items[0].supplier:null;
}
function selectedRequestSupplier(){return db.items.find(i=>selected.has(i.id))?.supplier||null}
function requestSupplierWarning(){return wfText('One request can contain several parts, but all parts must belong to the same Supplier company.','หนึ่งคำขอรวมหลายชิ้นส่วนได้ แต่ต้องเป็น Supplier บริษัทเดียวกันเท่านั้น')}
function toggleRequestSelection(id,checked){
 const i=db.items.find(i=>i.id===id),supplier=selectedRequestSupplier();
 if(!checked){selected.delete(id);return render()}
 if(!rfqCanCreate()||!i)return;
 if(supplier&&supplier!==i.supplier){toast(requestSupplierWarning());return render()}
 selected.add(id);render();
}
function selectRequestPage(checked){
 const inputs=[...document.querySelectorAll('[data-select]:not(:disabled)')];
 if(!checked){for(const c of inputs)selected.delete(c.dataset.select);return render()}
 const supplier=selectedRequestSupplier(),companies=new Set(inputs.map(c=>db.items.find(i=>i.id===c.dataset.select)?.supplier));
 if(!supplier&&companies.size>1){toast(wfText('Select a first part or filter to one Supplier before selecting all.','เลือกชิ้นส่วนแรก หรือกรอง Supplier บริษัทเดียวก่อนเลือกทั้งหมด'));return render()}
 const target=supplier||[...companies][0];for(const c of inputs)if(db.items.find(i=>i.id===c.dataset.select)?.supplier===target)selected.add(c.dataset.select);
 render();
}
function requestSingleItem(id){
 if(!rfqCanCreate())return;const i=currentItems().find(i=>i.id===id);
 if(!i||wfActive(id)||rfqReserved(id))return toast(wfText('This item already has an open request.','รายการนี้มีคำขอที่กำลังดำเนินการอยู่'));
 if(!deskFirstTime(i)&&(!i.next||i.next>TODAY))return toast(wfText('This part is not due for review.','รายการนี้ยังไม่ถึงกำหนดทบทวน'));
 selected=new Set([id]);render();rfqDraftDialog();
}
function requestItemAction(i,{schedules=false,request=null}={}){
 if(request)return `<a class="button" href="#part/${i.id}/${request.id}">${wfText('View details','ดูรายละเอียด')}</a>`;
 const draft=deskDraftFor(i.id),pending=deskPendingPair(i.id),first=deskFirstTime(i),ready=first&&rfqCanCreate()&&!pending&&(!draft||draft.id===request?.id),dueNow=false;   /* a due review is sent by the system; only first-time requests are sent by hand */
 if(draft&&!request&&first&&rfqEditable(draft))return `<a class="button primary" href="#request-new/${draft.id}">${wfText('Review and send request','ตรวจและส่งคำขอ')}</a>`;
 if(ready&&(dueNow||!schedules))return `<button class="button primary" data-single-request="${i.id}">${dueNow?wfText('Send review request','ส่งคำขอทบทวนราคา'):wfText('Set schedule','ตั้งกำหนดการ')}</button>`;
 if(schedules&&rfqCanCreate())return `<button class="button" data-schedule="${i.id}">${wfText('Edit schedule','แก้ไขกำหนดการ')}</button>`;
 return approvedReferenceButton(i.id)||`<a class="button" href="#part/${i.id}">${wfText('View details','ดูรายละเอียด')}</a>`;
}
function requestSelectionContext(){
 const supplier=selectedRequestSupplier();return `<div class="request-selection-context"><strong>${wfText('Send one item using its row button, or select multiple parts for one request.','ส่งรายการเดียวด้วยปุ่มท้ายแถว หรือเลือกหลายชิ้นส่วนเพื่อรวมเป็นคำขอเดียว')}</strong><p>${requestSupplierWarning()} ${supplier?wfText('Selected Supplier: ','Supplier ที่เลือก: ')+esc(supplierName(supplier)):wfText('Select the first part to choose its Supplier.','เลือกชิ้นส่วนแรกเพื่อกำหนดบริษัท Supplier')}</p></div>`;
}
function requestRecipientSummary(items){
 const supplier=requestSupplierId(items.map(i=>i.id));return `<div class="request-recipient-summary"><span>${wfText('Recipient Supplier','Supplier ผู้รับคำขอ')}</span><strong>${esc(supplierName(supplier))}</strong><p>${items.length} ${wfText('parts in one request. Each part keeps its own cost form and formula.','ชิ้นส่วนในคำขอเดียว แยกแบบฟอร์มต้นทุนและสูตรตามแต่ละรายการ')}</p></div>`;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-single-request]');if(b){e.preventDefault();requestSingleItem(b.dataset.singleRequest)}});
