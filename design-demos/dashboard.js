'use strict';
/* Overview dashboards for WEBPARK and Supplier: what needs me now, where every request is, what is late,
   what is coming up, and how recent approvals moved prices. All numbers come from the same records as the lists. */
const dashDays=iso=>Math.round((Date.parse(iso+'T00:00:00Z')-Date.parse(TODAY+'T00:00:00Z'))/864e5);
const dashPct=(a,b)=>b?((a-b)/b)*100:null;
const dashSigned=v=>v===null?'—':(v>0?'+':'')+v.toFixed(2)+'%';
function dashKpi({label,value,sub,tone='blue',href='',ico='grid'}){
  const inner=`<span class="dash-kpi-ico">${icon(ico)}</span><div><small>${label}</small><strong>${value}</strong><em>${sub||''}</em></div>`;
  return href?`<a class="dash-kpi tone-${tone}" href="#${href}">${inner}</a>`:`<div class="dash-kpi tone-${tone}">${inner}</div>`;
}
function dashPanel(title,sub,body,extra=''){return `<section class="dash-panel"><header><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>${extra}</header>${body}</section>`}
function dashStageOf(row){
  const k=row.phase.key,g=row.phase.group;
  if(k==='waiting')return 0;if(['entry','correction','supplier-approve'].includes(k))return 1;
  return ({issue:2,check:3,approve:4})[g]??-1;
}
const DASH_STAGES=()=>[
  {label:wfText('Awaiting cost entry','รอกรอกต้นทุน'),owner:'Supplier Issue',jump:'supplier',tone:'amber'},
  {label:wfText('Supplier preparing / approving','Supplier จัดทำ / อนุมัติ'),owner:'Supplier',jump:'supplier',tone:'amber'},
  {label:wfText('WEBPARK Issue','WEBPARK Issue'),owner:'WEBPARK',jump:'issue',tone:'blue'},
  {label:wfText('WEBPARK Check','WEBPARK Check'),owner:'WEBPARK',jump:'check',tone:'blue'},
  {label:wfText('WEBPARK Approve','WEBPARK Approve'),owner:'WEBPARK',jump:'approve',tone:'blue'}
];
function dashPipeline(rows,linkRoute){
  const counts=DASH_STAGES().map(()=>0);for(const r of rows){const s=dashStageOf(r);if(s>=0)counts[s]++}
  const total=counts.reduce((a,b)=>a+b,0),max=Math.max(1,...counts);
  return `<div class="dash-pipeline">${DASH_STAGES().map((s,i)=>`<a class="dash-stage tone-${s.tone}" href="#${linkRoute}" data-desk-jump="${s.jump}"><span class="dash-step">${i+1}</span><strong>${counts[i]}</strong><small>${s.label}</small><i style="--w:${Math.round(counts[i]/max*100)}%"></i></a>`).join('')}</div><p class="dash-foot">${total} ${wfText('part–Supplier pairs in the current cycle','คู่ชิ้นส่วน–Supplier ในรอบปัจจุบัน')}</p>`;
}
function dashPriceMoves(quotes){
  const moves=quotes.filter(q=>q.status==='Approved'&&q.previous!=null&&q.total!=null&&Math.abs(q.total-q.previous)>=0.005).slice().sort((a,b)=>String(b.approvedAtISO||b.effective).localeCompare(String(a.approvedAtISO||a.effective))).slice(0,7).map(q=>({q,pct:dashPct(q.total,q.previous)}));
  if(!moves.length)return `<div class="dash-empty">${wfText('No approved price has changed yet.','ยังไม่มีราคาที่อนุมัติแล้วเปลี่ยนแปลง')}</div>`;
  const max=Math.max(1,...moves.map(m=>Math.abs(m.pct)));
  const avg=moves.reduce((a,m)=>a+m.pct,0)/moves.length;
  return `<div class="dash-moves">${moves.map(({q,pct})=>`<a href="#quote/${q.id}" class="dash-move"><span class="dash-move-name"><strong>${esc(itemOf(q)?.code||q.item)}</strong><small>${esc(supplierName(q.supplier))}</small></span><span class="dash-bar ${pct>0?'up':'down'}"><i style="--w:${Math.max(3,Math.abs(pct)/max*100)}%"></i></span><span class="dash-move-val ${pct>0?'up':'down'}">${dashSigned(pct)}<small>฿${cash(q.previous)} → ฿${cash(q.total)}</small></span></a>`).join('')}</div><p class="dash-foot">${wfText('Average change of these approvals','เฉลี่ยการเปลี่ยนแปลงของรายการเหล่านี้')}: <strong class="${avg>0?'up':'down'}">${dashSigned(avg)}</strong></p>`;
}
function dashUpcoming(items,limitDays=45){
  const list=items.filter(i=>i.next&&dashDays(i.next)>=0&&dashDays(i.next)<=limitDays&&!deskFirstTime(i)&&!deskPendingPair(i.id)).sort((a,b)=>a.next.localeCompare(b.next)).slice(0,7);
  if(!list.length)return `<div class="dash-empty">${wfText('No reviews due in the next '+limitDays+' days.','ไม่มีรอบทบทวนใน '+limitDays+' วันข้างหน้า')}</div>`;
  return `<ul class="dash-upcoming">${list.map(i=>{const d=dashDays(i.next);return `<li><a href="#part/${i.id}"><span class="dash-when ${d<=7?'soon':''}"><b>${d===0?wfText('Today','วันนี้'):d}</b><small>${d===0?'':wfText('days','วัน')}</small></span><span><strong>${esc(i.code)}</strong><small>${esc(i.name)} · ${esc(supplierName(i.supplier))}</small></span><em>${date(i.next)}</em></a></li>`}).join('')}</ul>`;
}
function dashAttention(rows){
  const late=rows.filter(r=>r.phase.late).sort((a,b)=>(a.n.due||'').localeCompare(b.n.due||'')).slice(0,6);
  if(!late.length)return `<div class="dash-empty good">${icon('check')}${wfText('Nothing is overdue.','ไม่มีรายการเกินกำหนด')}</div>`;
  return `<ul class="dash-late">${late.map(r=>`<li><a href="#request-detail/${r.n.id}/${r.i.id}"><span class="dash-late-days">${Math.abs(dashDays(r.n.due))}<small>${wfText('days late','วันเกิน')}</small></span><span><strong>${esc(r.i.code)}</strong><small>${esc(supplierName(r.n.supplier))} · ${esc(r.phase.label)}</small></span><em>${date(r.n.due)}</em></a></li>`).join('')}</ul>`;
}
function dashSuppliers(rows){
  const by=new Map();for(const r of rows){const s=r.n?.supplier||r.i.supplier;if(!by.has(s))by.set(s,{open:0,late:0,wait:0});const x=by.get(s);x.open++;if(r.phase.late)x.late++;if(dashStageOf(r)<=1)x.wait++}
  const list=[...by.entries()].sort((a,b)=>b[1].open-a[1].open).slice(0,6),max=Math.max(1,...list.map(([,x])=>x.open));
  if(!list.length)return `<div class="dash-empty">${wfText('No open requests.','ไม่มีคำขอค้าง')}</div>`;
  return `<div class="dash-suppliers">${list.map(([id,x])=>`<div class="dash-sup"><span>${esc(supplierName(id))}</span><span class="dash-stack"><i class="wait" style="--w:${x.wait/max*100}%"></i><i class="inhouse" style="--w:${(x.open-x.wait)/max*100}%"></i></span><b>${x.open}</b>${x.late?`<em>${x.late} ${wfText('late','เกิน')}</em>`:''}</div>`).join('')}</div><p class="dash-legend"><i class="wait"></i>${wfText('With Supplier','อยู่ที่ Supplier')} <i class="inhouse"></i>${wfText('With WEBPARK','อยู่ที่ WEBPARK')}</p>`;
}
function dashTasks(){
  const mine=visibleQuotes().filter(q=>pendingForRole(q)||canEdit(q)).slice(0,5);
  if(!mine.length)return `<div class="dash-empty good">${icon('check')}${wfText('You are all caught up.','ไม่มีงานค้างของคุณ')}</div>`;
  return `<ul class="dash-tasks">${mine.map(q=>`<li><a href="#quote/${q.id}"><span><strong>${esc(itemOf(q)?.code||q.item)}</strong><small>${esc(supplierName(q.supplier))} · ${esc(q.id)}</small></span>${statusBadge(q.status)}<b>฿${cash(q.total)}</b></a></li>`).join('')}</ul>`;
}
function dashHero(taskCount,route){
  const hour=new Date().getHours(),hi=hour<12?wfText('Good morning','สวัสดีตอนเช้า'):hour<17?wfText('Good afternoon','สวัสดีตอนบ่าย'):wfText('Good evening','สวัสดีตอนเย็น');
  return `<section class="dash-hero"><div><p>${hi}, ${esc(user.name.split(' ')[0])}</p><h1>${taskCount?`${taskCount} ${wfText(taskCount===1?'task is waiting for you':'tasks are waiting for you','งานรอคุณดำเนินการ')}`:wfText('Nothing is waiting for you','ไม่มีงานค้างของคุณ')}</h1><span>${esc(user.role)} · ${portal==='roki'?'WEBPARK':esc(supplierName(user.supplier))} · ${date(TODAY)}</span></div><a class="dash-hero-btn" href="#${route}">${taskCount?wfText('Open my tasks','เปิดงานของฉัน'):wfText('View all work','ดูงานทั้งหมด')}${icon('arrow')}</a></section>`;
}
function rokiDashboard(){
  const rows=deskRows().filter(r=>!r.phase.historical&&r.phase.group!=='completed'),quotes=visibleQuotes(),mine=quotes.filter(pendingForRole).length;
  const late=rows.filter(r=>r.phase.late).length,soon=db.items.filter(i=>i.next&&dashDays(i.next)>=0&&dashDays(i.next)<=14&&!deskFirstTime(i)&&!deskPendingPair(i.id)).length,inUse=quotes.filter(q=>q.status==='Approved'&&priceValidity(q)==='active').length;
  const awaiting=quotes.filter(q=>['ROKI Issue','ROKI Check','ROKI Approve'].includes(q.status)).length;
  return dashHero(mine,'approvals')+`<div class="dash-kpis">${[
    {label:wfText('Open requests','คำขอที่เปิดอยู่'),value:rows.length,sub:wfText('in the current cycle','ในรอบปัจจุบัน'),ico:'file',href:'schedule'},
    {label:wfText('Overdue at Supplier','เกินกำหนดที่ Supplier'),value:late,sub:late?wfText('needs a reminder','ควรติดตาม'):wfText('on schedule','เป็นไปตามกำหนด'),tone:late?'red':'green',ico:'clock',href:'schedule'},
    {label:wfText('Awaiting WEBPARK','รอ WEBPARK ดำเนินการ'),value:awaiting,sub:wfText('three internal steps','3 ขั้นภายใน'),tone:'blue',ico:'check',href:'sent'},
    {label:wfText('Reviews in 14 days','ครบรอบใน 14 วัน'),value:soon,sub:wfText('sent automatically','ระบบส่งเอง'),tone:'purple',ico:'clock',href:'schedule'},
    {label:wfText('Prices in use','ราคาที่ใช้อยู่'),value:inUse,sub:wfText('approved quotations','ใบเสนอราคาที่อนุมัติ'),tone:'green',ico:'chart',href:'quotes'}
  ].map(dashKpi).join('')}</div>`+
  `<div class="dash-grid">`+
   dashPanel(wfText('Where every request is','คำขอทั้งหมดอยู่ที่ขั้นไหน'),wfText('Five-step flow · click a step to see its items','โฟล 5 ขั้น · คลิกที่ขั้นเพื่อดูรายการ'),dashPipeline(rows,'schedule'))+
   dashPanel(wfText('My tasks','งานของฉัน'),wfText('Waiting for your role','ที่ถึงคิวบทบาทของคุณ'),dashTasks(),`<a class="dash-link" href="#approvals">${wfText('All','ทั้งหมด')} ${icon('arrow')}</a>`)+
   dashPanel(wfText('Needs attention','ต้องติดตาม'),wfText('Requests past the Supplier deadline','คำขอที่เกินกำหนดตอบของ Supplier'),dashAttention(rows))+
   dashPanel(wfText('Coming up','รอบทบทวนที่กำลังมา'),wfText('The system sends these requests on the due date','ระบบจะส่งคำขอให้เองเมื่อถึงวัน'),dashUpcoming(db.items),`<a class="dash-link" href="#schedule">${wfText('Schedule','กำหนดรอบ')} ${icon('arrow')}</a>`)+
   dashPanel(wfText('Price movement','ราคาที่เปลี่ยนล่าสุด'),wfText('Latest approvals compared with the previous price','การอนุมัติล่าสุดเทียบกับราคาก่อนหน้า'),dashPriceMoves(quotes))+
   dashPanel(wfText('Workload by Supplier','ภาระงานแยกตาม Supplier'),wfText('Open part–Supplier pairs','ชิ้นส่วนที่ยังเปิดอยู่'),dashSuppliers(rows))+
  `</div>`;
}
function supplierDashboard(){
  const rows=deskRows().filter(r=>!r.phase.historical&&r.phase.group!=='completed'),quotes=visibleQuotes(),mine=quotes.filter(q=>pendingForRole(q)||canEdit(q)).length+(user.role==='Issue'?rows.filter(r=>r.phase.key==='waiting').length:0);
  const own=db.items.filter(i=>i.supplier===user.supplier),late=rows.filter(r=>r.phase.late).length;
  const waiting=rows.filter(r=>r.phase.key==='waiting').length,sent=quotes.filter(q=>['ROKI Issue','ROKI Check','ROKI Approve'].includes(q.status)).length,inUse=quotes.filter(q=>q.status==='Approved'&&priceValidity(q)==='active').length;
  return dashHero(mine,'approvals')+`<div class="dash-kpis">${[
    {label:wfText('Awaiting your costs','รอกรอกต้นทุน'),value:waiting,sub:wfText('requests from WEBPARK','คำขอจาก WEBPARK'),tone:waiting?'amber':'green',ico:'bell',href:'approvals'},
    {label:wfText('Overdue','เกินกำหนด'),value:late,sub:late?wfText('answer as soon as possible','ควรตอบโดยเร็ว'):wfText('on schedule','เป็นไปตามกำหนด'),tone:late?'red':'green',ico:'clock',href:'approvals'},
    {label:wfText('With WEBPARK','อยู่ที่ WEBPARK'),value:sent,sub:wfText('approved by you, being reviewed','คุณอนุมัติแล้ว รอ WEBPARK'),tone:'blue',ico:'check',href:'sent'},
    {label:wfText('Prices in use','ราคาที่ใช้อยู่'),value:inUse,sub:wfText('approved quotations','ใบเสนอราคาที่อนุมัติ'),tone:'green',ico:'chart',href:'quotes'},
    {label:wfText('Your parts','ชิ้นส่วนของคุณ'),value:own.length,sub:wfText('assigned to your company','ที่ผูกกับบริษัทคุณ'),tone:'purple',ico:'box',href:'parts'}
  ].map(dashKpi).join('')}</div>`+
  `<div class="dash-grid">`+
   dashPanel(wfText('Where your requests are','คำขอของคุณอยู่ที่ขั้นไหน'),wfText('Five-step flow','โฟล 5 ขั้น'),dashPipeline(rows,'requests'))+
   dashPanel(wfText('My tasks','งานของฉัน'),wfText('Waiting for your role','ที่ถึงคิวบทบาทของคุณ'),dashTasks(),`<a class="dash-link" href="#approvals">${wfText('All','ทั้งหมด')} ${icon('arrow')}</a>`)+
   dashPanel(wfText('Needs attention','ต้องติดตาม'),wfText('Requests past their deadline','คำขอที่เกินกำหนดตอบ'),dashAttention(rows))+
   dashPanel(wfText('Coming up','รอบทบทวนที่กำลังมา'),wfText('WEBPARK will send these requests on the due date','WEBPARK จะส่งคำขอให้เมื่อถึงวัน'),dashUpcoming(own))+
   dashPanel(wfText('Price movement','ราคาที่เปลี่ยนล่าสุด'),wfText('Your latest approved quotations','ใบเสนอราคาของคุณที่อนุมัติล่าสุด'),dashPriceMoves(quotes))+
  `</div>`;
}
function workflowOverview(){return portal==='roki'?rokiDashboard():supplierDashboard()}
