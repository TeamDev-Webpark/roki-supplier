'use strict';

const reportFilters=new Map();
const rt=(en,th)=>wfText(en,th);
const reportColumn=(key,en,th,kind)=>({key,label:rt(en,th),kind});
const reportIdentity=()=>[reportColumn('part','Part code','รหัสชิ้นส่วน'),reportColumn('name','Part name','ชื่อชิ้นส่วน'),reportColumn('company','Supplier','Supplier'),reportColumn('format','Form','ประเภทฟอร์ม')];
const reportStatus=()=>reportColumn('status','Status','สถานะ');
const reportDay=(at,iso)=>{
 const time=deskNoticeTime({created:at,createdISO:iso});
 return time?bangkokDay(new Date(time)):/^\d{4}-\d{2}-\d{2}$/.test(at||'')?at:'';
};
const reportElapsed=(start,end)=>start&&end>=start?Math.round((end-start)/8640000)/10:null;
const reportChange=(amount,previous)=>amount!=null&&previous>0?Math.round((amount/previous-1)*10000)/100:null;
const reportPart=(i,supplier=i?.supplier)=>({part:i?.code||'',name:i?.name||'',supplier,company:supplierName(supplier),format:i?.format||''});
const reportQuoteLabel=q=>wfQuoteLabel(q.status,stageLabels[q.status]?.[0]||q.status);
const reportFormat=value=>value==='Assembly'?rt('Assembly','ชุดประกอบ'):value==='Single Part'?rt('Single Part','ชิ้นส่วน'):value;

function reportRequestRows(){
 const responses=new Map();
 for(const q of visibleQuotes()){
  const key=q.requestedBy+':'+q.item;
  for(const entry of q.trail.filter(entry=>entry.stage==='S-Approve')){
   const time=deskNoticeTime({created:entry.at,createdISO:entry.atISO});
   if(time&&(!responses.has(key)||time<responses.get(key)))responses.set(key,time);
  }
 }
 const rows=deskSentPairs().map(({key,n,r,i,phase})=>{
  const sent=deskNoticeTime(n),response=responses.get(key);
  const responseDay=response?bangkokDay(new Date(response)):'';
  const overdue=phase.late&&!response;
  const onTime=responseDay&&n.due?responseDay<=n.due:null;
  const sla=onTime===true?'on-time':onTime===false?'late':overdue?'overdue':'';
  return {...reportPart(n.forms?.[i.id]?.itemSnapshot?{...i,...n.forms[i.id].itemSnapshot}:i,n.supplier),ref:r?.id||n.id,notice:n.id,link:'request-detail/'+n.id+'/'+i.id,
   day:sent?bangkokDay(new Date(sent)):'',due:n.due,response:responseDay,days:reportElapsed(sent,response),late:overdue,onTime,sla,
   status:phase.label,cycle:phase.historical?rt('Earlier cycle','รอบก่อน'):rt('Latest cycle','รอบล่าสุด'),owner:phase.historical?'':phase.owner,offer:phase.offer?.id||'',title:r?.title||n.message};
 });
 return rows.concat(deskUnsentRows().map(({r,i,phase})=>({...reportPart(i),ref:r.id,link:'request-register/'+r.id,day:reportDay(r.createdAt),due:r.due,status:phase.label,owner:phase.owner,title:r.title})));
}

function reportQuotationRows(){
 return visibleQuotes().map(q=>{
  const i=itemOf(q),amount=isIncompleteQuote(q)?null:q.total;
  return {...reportPart({...i,...q.itemSnapshot,format:q.format},q.supplier),ref:q.id,link:'quote/'+q.id,day:q.quoteDate,revision:q.revision,
   effective:q.effective,ending:q.ending,previous:q.previous,amount,change:reportChange(amount,q.previous),
   status:reportQuoteLabel(q),owner:deskQuoteOwner(q),formula:formulaLabel(q.costs.fv||1),reason:q.remark};
 });
}

function reportPriceRows(){
 const items=new Map(currentItems().map(i=>[i.id,i]));
 const quotes=new Map(visibleQuotes().filter(q=>q.status==='Approved').map(q=>[q.id,q]));
 const active=new Map([...items.keys()].map(id=>[id,activeQuote(id)?.id]));
 return db.history.flatMap((h,index)=>{
  const i=items.get(h.item);if(!i||h.quote&&!quotes.has(h.quote))return [];
  const q=quotes.get(h.quote),amount=h.price;
  const status=q?(active.get(h.item)===q.id?rt('Effective','มีผลปัจจุบัน'):priceValidity(q)==='scheduled'?rt('Future price','รอวันมีผล'):rt('Historical','ย้อนหลัง')):rt('Imported record','ข้อมูลนำเข้า');
  return [{...reportPart({...i,...q?.itemSnapshot},i.supplier),ref:h.quote||rt('Imported','นำเข้า'),link:'price-record/'+index,day:h.effective,ending:q?.ending,
   previous:q?.previous,amount,change:reportChange(amount,q?.previous),status,reason:h.reason||q?.remark}];
 });
}

function reportScheduleRows(){
 return currentItems().map(i=>{
  const state=i.next?deskScheduleState(i):{key:'unset',label:rt('Not scheduled','ยังไม่กำหนดรอบ')};
  return {...reportPart(i),link:'part/'+i.id,day:i.next,cadence:i.cadence,amount:i.price,status:state.label,dueNow:state.key==='due'};
 });
}

function reportActivityRows(){
 const quotations=visibleQuotes().flatMap(q=>q.trail.map(t=>({...reportPart(itemOf(q),q.supplier),ref:q.id,link:'quote/'+q.id,day:reportDay(t.at,t.atISO),time:t.at,actor:t.user,status:t.stage||rt('Other action','การดำเนินการอื่น'),action:t.action,reason:t.reason})));
 if(portal!=='roki')return quotations;
 return quotations.concat(db.priceRequests.flatMap(r=>r.items.flatMap(id=>{
  const item=db.items.find(i=>i.id===id);if(!item)return [];
  return r.trail.map(t=>({...reportPart(item),ref:r.id,link:'request-register/'+r.id,day:reportDay(t.at,t.atISO),time:t.at,actor:t.user,status:rt('Request','คำขอ'),action:rfqActionLabel(t.action,t.role),reason:t.reason}));
 })));
}

function reportNotificationRows(){
 const quotes=new Map(visibleQuotes().map(q=>[q.id,q]));
 return db.emails.flatMap(m=>{
  const recipients=m.to.map(id=>users.find(u=>u.id===id)).filter(Boolean);
  const q=quotes.get(m.quote),request=db.priceRequests.find(r=>m.subject.includes(r.id));
  const supplier=q?.supplier||recipients.find(u=>u.supplier)?.supplier||'';
  if(portal==='supplier'&&!recipients.some(u=>u.supplier===user.supplier))return [];
  return [{...reportPart(q?itemOf(q):null,supplier),ref:q?.id||(portal==='roki'?request?.id:''),link:q?'quote/'+q.id:portal==='roki'&&request?'request-register/'+request.id:'',day:reportDay(m.at,m.atISO),time:m.at,
   status:rt('Demo log','บันทึกจำลอง'),subject:m.subject,actor:m.by,recipients:recipients.filter(u=>portal==='roki'||u.supplier===user.supplier).map(u=>u.name).join(', ')}];
 });
}

function reportDefinitions(){
 const c=reportColumn,d=c('day','Date','วันที่','date'),ref=c('ref','Document','เอกสาร'),price=c('amount','THB / piece','บาท / ชิ้น','money');
 const identity=reportIdentity(),status=reportStatus(),owner=c('owner','Next owner','ผู้รับผิดชอบถัดไป');
 const priceColumns=[c('previous','Previous price','ราคาเดิม','money'),price,c('change','Change %','เปลี่ยนแปลง %','percent')];
 const requestDate=c('day','Request date','วันที่ออกคำขอ','date');
 const definitions={
  prices:{title:rt('Price history','ประวัติราคา'),description:rt('Approved price records, effective dates and changes per part and Supplier.','ดูราคาที่อนุมัติ วันที่มีผล และการเปลี่ยนแปลงแยกตามชิ้นส่วนและ Supplier'),columns:[ref,...identity,c('day','Effective date','วันที่มีผล','date'),c('ending','Ending date','วันสิ้นสุด','date'),...priceColumns,status,c('reason','Reason','เหตุผล')],rows:reportPriceRows},
  requests:{title:rt('Requests & SLA','คำขอและกำหนดตอบ'),description:rt('One row per part per request. Response time uses the first recorded Supplier approval and calendar days.','หนึ่งแถวต่อชิ้นส่วนในคำขอ เวลาตอบกลับนับถึงการอนุมัติครั้งแรกของ Supplier ที่มีบันทึก โดยใช้วันปฏิทิน'),columns:[ref,c('notice','Dispatch','เลขที่ส่ง'),...identity,requestDate,c('due','Reply due','กำหนดตอบ','date'),c('response','First response','ตอบครั้งแรก','date'),c('days','Response days','เวลาตอบ (วัน)'),c('sla','Response deadline status','ผลการตอบตามกำหนด'),status,c('cycle','Request cycle','รอบคำขอ'),owner,c('offer','Quotation','ใบเสนอราคา'),c('title','Request title','ชื่อคำขอ')],rows:reportRequestRows},
  quotes:{title:rt('Quotations & approvals','ใบเสนอราคาและอนุมัติ'),description:rt('Quotation values, formula version, price movement and current approval owner.','ติดตามราคาเสนอ เวอร์ชันสูตร ส่วนต่างราคา และผู้รับผิดชอบในคิวอนุมัติ'),columns:[ref,...identity,c('revision','Revision','ฉบับแก้ไข'),c('day','Quotation date','วันที่เสนอราคา','date'),c('effective','Effective date','วันที่มีผล','date'),c('ending','Ending date','วันสิ้นสุด','date'),...priceColumns,status,owner,c('formula','Formula','สูตรคำนวณ'),c('reason','Reason','เหตุผล')],rows:reportQuotationRows},
  schedules:{title:rt('Review schedule','กำหนดทบทวน'),description:rt('Review cycles, due parts, open cycles and parts without a schedule.','ดูรอบทบทวน รายการถึงรอบ รอบที่กำลังดำเนินการ และชิ้นส่วนที่ยังไม่กำหนดรอบ'),columns:[...identity,c('day','Next review','วันทบทวนถัดไป','date'),c('cadence','Cycle months','รอบ (เดือน)'),price,status],rows:reportScheduleRows},
  suppliers:{title:rt('Supplier performance','ผลการตอบของ Supplier'),description:rt('Measured per requested part. On-time rate uses recorded first responses with a deadline.','วัดต่อชิ้นส่วนที่ส่งคำขอ อัตราตรงเวลาคิดจากรายการที่มีทั้งบันทึกตอบครั้งแรกและกำหนดตอบ'),columns:[c('company','Supplier','Supplier'),c('count','Sent items','รายการที่ส่ง'),c('answered','Responses','มีบันทึกตอบ'),c('overdue','Overdue without response','เกินกำหนดและยังไม่ตอบ'),c('measured','Responses with deadline','รายการที่ใช้วัดตรงเวลา'),c('rate','On-time responses %','ตอบตรงเวลา %','percent'),c('avg','Average response days','เวลาตอบเฉลี่ย (วัน)')],rows:()=>reportRequestRows().filter(r=>r.notice)},
  activity:{title:rt('Audit history','ประวัติการดำเนินงาน'),description:rt('Trace quotation and request activity, including review notes and reasons.','ตรวจย้อนหลังว่าใครดำเนินการ เมื่อไหร่ และมีเหตุผลอะไรในคำขอหรือใบเสนอราคา'),columns:[ref,...identity,d,c('time','Recorded at','เวลาที่บันทึก'),c('actor','Actor','ผู้ดำเนินการ'),c('status','Workflow step','ขั้นตอน'),c('action','Action','รายการดำเนินการ'),c('reason','Reason','เหตุผล')],rows:reportActivityRows},
  notifications:{title:rt('Notifications','ประวัติการแจ้งเตือน'),description:rt('Review who received each recorded workflow notification.','ตรวจสอบผู้รับและหัวข้อการแจ้งเตือนที่บันทึกในระบบเดโม'),columns:[ref,c('company','Supplier','Supplier'),d,c('time','Recorded at','เวลาที่บันทึก'),c('subject','Subject','หัวข้อ'),c('recipients','Recipients','ผู้รับ'),c('actor','Actor','ผู้ดำเนินการ'),status],rows:reportNotificationRows}
 };
 return definitions;
}

function reportState(){
 const key=portal+':'+user.id;
 if(!reportFilters.has(key))reportFilters.set(key,{view:'prices',query:'',supplier:'',format:'',status:'',from:'',to:'',movement:'',cadence:'',sla:'',order:'desc',page:1});
 const state=reportFilters.get(key);
 if(state.language!==I18N.lang()){state.language=I18N.lang();state.status='';state.page=1}
 return state;
}

function reportScorecard(rows){
 const groups=new Map();
 for(const row of rows){if(!groups.has(row.supplier))groups.set(row.supplier,[]);groups.get(row.supplier).push(row)}
 return [...groups].map(([supplier,items])=>{
  const measured=items.filter(r=>r.onTime!=null),timed=items.filter(r=>r.days!=null);
  return {supplier,company:supplierName(supplier),link:'supplier/'+supplier,count:items.length,answered:items.filter(r=>r.response).length,overdue:items.filter(r=>r.late).length,measured:measured.length,
   rate:measured.length?measured.filter(r=>r.onTime).length/measured.length*100:null,avg:timed.length?Number((timed.reduce((sum,r)=>sum+r.days,0)/timed.length).toFixed(1)):null};
 }).sort((a,b)=>b.count-a.count||a.company.localeCompare(b.company));
}

function reportResult(){
 const state=reportState(),definitions=reportDefinitions(),view=definitions[state.view],source=view.rows();
 const invalid=!!(state.from&&state.to&&state.from>state.to),query=state.query.trim().toLowerCase();
 const filtered=invalid?[]:source.filter(row=>
  (!state.supplier||row.supplier===state.supplier)&&(!state.format||row.format===state.format)&&(!state.status||row.status===state.status)
  &&(!state.cadence||String(row.cadence)===state.cadence)&&(!state.sla||row.sla===state.sla)
  &&(!state.from||row.day&&row.day>=state.from)&&(!state.to||row.day&&row.day<=state.to)
  &&(!query||Object.entries(row).some(([key,value])=>key!=='link'&&String(value??'').toLowerCase().includes(query)))
  &&(!state.movement||(state.movement==='new'?row.previous==null:row.change!=null&&Math.sign(row.change)===Number(state.movement)))
 );
 const rows=state.view==='suppliers'?reportScorecard(filtered):filtered.sort((a,b)=>{
  if(!a.day||!b.day)return Number(!!b.day)-Number(!!a.day);
  return (state.order==='asc'?1:-1)*(a.day.localeCompare(b.day)||String(a.ref||a.part||'').localeCompare(String(b.ref||b.part||''),undefined,{numeric:true}));
 });
 return {state,definitions,view,source,filtered,rows,invalid};
}

function reportSelect(state,key,label,options){
 return `<label>${label}<select data-report-filter="${key}">${options.map(([value,text])=>`<option value="${esc(value)}" ${state[key]===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
}

function reportFilterForm(result){
 const {state,view,source}=result,any=rt('All','ทั้งหมด');
 const select=(key,label,options)=>reportSelect(state,key,label,[['',any],...options]);
 const dateLabel=view.columns.find(c=>c.key==='day')?.label||rt('Request date','วันที่ออกคำขอ');
 const statuses=[...new Set([...source.map(r=>r.status),state.status].filter(Boolean))].sort();
 const dateInput=(key,label)=>`<label>${label}<input type="date" data-report-filter="${key}" value="${esc(state[key])}"></label>`;
 return `<section class="report-filter-panel"><div class="report-filter-heading"><h2>${rt('Filters','ตัวกรองรายงาน')}</h2><button type="button" class="link-button" data-report-reset>${rt('Clear filters','ล้างตัวกรอง')}</button></div><div class="report-fields">
 <label class="report-search">${rt('Search report','ค้นหาในรายงาน')}<input type="search" data-report-filter="query" value="${esc(state.query)}" placeholder="${rt('Part, document, Supplier…','ชิ้นส่วน เลขเอกสาร Supplier…')}"></label>
 ${portal==='roki'?select('supplier','Supplier',suppliers.map(s=>[s.id,s.name])):''}
 ${state.view!=='notifications'?select('format',rt('Form type','ประเภทฟอร์ม'),['Single Part','Assembly'].map(f=>[f,reportFormat(f)])):''}
 ${statuses.length>1?select('status',rt('Status','สถานะ'),statuses.map(s=>[s,s])):''}
 ${dateInput('from',dateLabel+' · '+rt('From','ตั้งแต่'))}${dateInput('to',dateLabel+' · '+rt('To','ถึง'))}
 ${['prices','quotes'].includes(state.view)?select('movement',rt('Price movement','การเปลี่ยนแปลงราคา'),[['1',rt('Increase','เพิ่มขึ้น')],['-1',rt('Decrease','ลดลง')],['0',rt('Unchanged','เท่าเดิม')],['new',rt('No reference price','ไม่มีราคาอ้างอิง')]]):''}
 ${['requests','suppliers'].includes(state.view)?select('sla',rt('Response deadline','การตอบตามกำหนด'),reportSlaOptions()):''}
 ${state.view==='schedules'?select('cadence',rt('Review cycle','รอบทบทวน'),[['1',rt('1 month','1 เดือน')],['3',rt('3 months','3 เดือน')]]):''}
 ${state.view!=='suppliers'?reportSelect(state,'order',rt('Date order','เรียงตามวันที่'),[['desc',rt('Newest first','ล่าสุดก่อน')],['asc',rt('Oldest first','เก่าสุดก่อน')]]):''}
 </div>${result.invalid?`<p class="report-invalid" role="alert">${rt('The start date must be on or before the end date.','วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด')}</p>`:''}</section>`;
}

function reportSlaOptions(){return [['on-time',rt('Answered on time','ตอบตรงเวลา')],['late',rt('Answered late','ตอบล่าช้า')],['overdue',rt('Overdue without response','เกินกำหนดและยังไม่ตอบ')]]}

function reportMetrics({state,filtered,rows}){
 const statuses=new Map();
 for(const r of filtered)if(r.status)statuses.set(r.status,(statuses.get(r.status)||0)+1);
 const metrics=[[rows.length,rt('Matching rows','รายการตามตัวกรอง')],[new Set(filtered.map(r=>r.supplier).filter(Boolean)).size,rt('Suppliers in results','Supplier ในผลลัพธ์')]];
 if(['prices','quotes'].includes(state.view))metrics.push([filtered.filter(r=>r.change>0).length,rt('Prices increased','รายการราคาขึ้น')],[filtered.filter(r=>r.change<0).length,rt('Prices decreased','รายการราคาลง')]);
 if(['requests','suppliers'].includes(state.view))metrics.push([filtered.filter(r=>r.response).length,rt('Recorded responses','มีบันทึกตอบกลับ')],[filtered.filter(r=>r.late).length,rt('Overdue without response','เกินกำหนดและยังไม่ตอบ')]);
 if(state.view==='schedules')metrics.push([filtered.filter(r=>r.dueNow).length,rt('Due for review','ถึงรอบทบทวน')],[filtered.filter(r=>!r.day).length,rt('Without a review date','ยังไม่มีวันทบทวน')]);
 const distribution=[...statuses.entries()].sort((a,b)=>b[1]-a[1]);
 return `<div class="report-metrics">${metrics.map(([value,label])=>`<div><span>${label}</span><strong>${value.toLocaleString()}</strong></div>`).join('')}</div>${distribution.length>1?`<div class="report-distribution" aria-label="${rt('Status distribution','สัดส่วนสถานะ')}">${distribution.map(([label,count])=>`<div><span>${esc(label)}</span><meter min="0" max="${filtered.length}" value="${count}" aria-label="${esc(label)}"></meter><b>${count}</b></div>`).join('')}</div>`:''}`;
}

function reportValue(row,column,forCsv=false){
 const value=row[column.key];if(value==null||value==='')return forCsv?'':'—';
 if(column.key==='format')return reportFormat(value);
 if(column.key==='sla')return reportSlaOptions().find(([id])=>id===value)?.[1]||value;
 if(column.kind==='yes')return value?rt('Yes','ใช่'):rt('No','ไม่');
 if(column.kind==='date'&&!forCsv)return date(value);
 if(column.kind==='money'||column.kind==='percent'){
  const rounded=Number(Number(value).toFixed(2));
  if(forCsv)return rounded;
  return column.kind==='money'?cash(rounded):`${rounded>0&&column.key==='change'?'+':''}${rounded.toFixed(2)}%`;
 }
 return value;
}

function reportTable(result){
 const {state,view,rows}=result,size=12,totalPages=Math.max(1,Math.ceil(rows.length/size));
 state.page=Math.max(1,Math.min(totalPages,state.page));
 const start=(state.page-1)*size,visible=rows.slice(start,start+size);
 const cell=(row,column,index)=>{
  const value=esc(reportValue(row,column)),numeric=typeof row[column.key]==='number';
  const text=column.key==='status'?`<span class="report-status">${value}</span>`:index===0&&row.link?`<a href="#${esc(row.link)}">${value}</a>`:value;
  return `<td class="${numeric?'report-number':''}">${text}</td>`;
 };
 return `<section class="report-table-panel"><div class="report-table-heading"><div><h2>${view.title}</h2><p>${view.description}</p></div><span>${rows.length.toLocaleString()} ${rt('rows','รายการ')}</span></div>
 ${visible.length?`<div class="table-wrap" tabindex="0" aria-label="${view.title}"><table class="data-table report-data" data-no-sort><thead><tr>${view.columns.map(c=>`<th scope="col">${c.label}</th>`).join('')}</tr></thead><tbody>${visible.map(row=>`<tr ${row.link?detailRowAttrs(row.link):''}>${view.columns.map((c,i)=>cell(row,c,i)).join('')}</tr>`).join('')}</tbody></table></div>`:
 `<div class="report-empty"><strong>${rt('No matching results','ไม่พบรายการที่ตรงกับตัวกรอง')}</strong><p>${rt('Adjust the filters to see more results.','ลองปรับตัวกรองหรือช่วงวันที่')}</p></div>`}
 ${visible.length?`<div class="report-pagination"><span>${start+1}–${start+visible.length} / ${rows.length.toLocaleString()}</span><div><button type="button" class="button" data-report-page="${state.page-1}" ${state.page===1?'disabled':''}>${rt('Previous','ก่อนหน้า')}</button><span>${state.page} / ${totalPages}</span><button type="button" class="button" data-report-page="${state.page+1}" ${state.page===totalPages?'disabled':''}>${rt('Next','ถัดไป')}</button></div></div>`:''}</section>`;
}

function reportCenterView(){
 const result=reportResult(),{state,definitions,rows}=result;
 const links=portal==='roki'?'<a class="link-button" href="#suppliers">'+rt('Supplier directory','ข้อมูล Supplier')+'</a>':'';
 return `<div class="report-center">${heading(rt('Data & insights','ข้อมูลและการวิเคราะห์'),rt('Reports and history','รายงานและประวัติ'),rt('Track prices, review cycles and approvals from the same records used in the workflow.','ติดตามราคา รอบทบทวน และการอนุมัติจากข้อมูลที่ใช้ในโฟลจริง'),`<button class="button primary" type="button" data-report-export ${rows.length?'':'disabled'}>${icon('download')} ${rt('Export CSV','ส่งออก CSV')}</button>`)}
 <nav class="report-tabs" aria-label="${rt('Report type','ประเภทรายงาน')}">${Object.entries(definitions).map(([key,v])=>`<button type="button" data-report-view="${key}" aria-pressed="${state.view===key}">${v.title}</button>`).join('')}</nav>
 <div class="report-tools"><span>${rt('CSV includes all matching rows across pages.','CSV รวมทุกรายการตามตัวกรองจากทุกหน้า')}</span><a class="link-button" href="#reports">${rt('Price trend chart','กราฟแนวโน้มราคา')}</a>${links}${portal==='roki'?`<a class="link-button" href="#exports">${rt('Effective price export','ส่งออกราคาที่มีผล')}</a>`:''}</div>
 ${reportFilterForm(result)}<div class="report-results" aria-live="polite">${reportMetrics(result)}${reportTable(result)}</div></div>`;
}

function exportReportCsv(){
 const {state,view,rows}=reportResult();if(!rows.length)return;
 const encode=value=>typeof value==='number'?String(value):csvCell(String(value).replace(/^(?=\s*[=+@\-]|[\r\n\t])/u,"'"));
 const content='\uFEFF'+[view.columns.map(c=>encode(c.label)).join(','),...rows.map(row=>view.columns.map(c=>encode(reportValue(row,c,true))).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=`webpark-report-${state.view}-${TODAY}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

document.addEventListener('click',event=>{
 const button=event.target.closest('.report-center button');if(!button)return;
 const state=reportState();
 if(button.hasAttribute('data-report-export'))return exportReportCsv();
 if(button.dataset.reportView){Object.assign(state,{view:button.dataset.reportView,status:'',movement:'',cadence:'',sla:'',page:1});if(state.view==='notifications')state.format='';render();document.querySelector(`[data-report-view="${state.view}"]`)?.focus({preventScroll:true})}
 else if(button.dataset.reportPage){state.page=Number(button.dataset.reportPage);render()}
 else if(button.hasAttribute('data-report-reset')){Object.assign(state,{query:'',supplier:'',format:'',status:'',from:'',to:'',movement:'',cadence:'',sla:'',order:'desc',page:1});render()}
});

document.addEventListener('change',event=>{
 const key=event.target.dataset.reportFilter;
 if(!key||key==='query'||!event.target.closest('.report-center'))return;
 const state=reportState();state[key]=event.target.value;state.page=1;render();document.querySelector(`[data-report-filter="${key}"]`)?.focus({preventScroll:true});
});

document.addEventListener('input',event=>{
 if(!event.target.matches('[data-report-filter="query"]'))return;
 const state=reportState();state.query=event.target.value;state.page=1;
 const result=reportResult();document.querySelector('.report-results').innerHTML=reportMetrics(result)+reportTable(result);
 document.querySelector('[data-report-export]').disabled=!result.rows.length;installRecordRows();
});
