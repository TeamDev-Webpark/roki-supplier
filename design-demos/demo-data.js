'use strict';
/* Additive, versioned presentation fixtures. Never reset browser records or reinsert
 * examples after the user has completed/deleted them. IDs and links use the real model. */
/* Version 2: one first-quotation part for every formula set in the system, so each sheet can be tried from the
   “Create request for new items” list (Injection, Rubber, Steel, QT-ASSY, the standard set and the assembly model). */
const FIRST_QUOTATION_DEMO=[
  {set:'injection',supplier:'s1',format:'Single Part',code:'WP-NEW-INJ-001',name:'COVER, AIR/C — injection (first quotation)',rtp:'S001571-101-01',drawing:'M206-F-26',qty:25000,cadence:3,children:[]},
  {set:'rubber',supplier:'s2',format:'Single Part',code:'WP-NEW-RUB-001',name:'TUBE, AIR CONN — rubber (first quotation)',rtp:'PRC0006-101-E20',drawing:'M206-F-26',qty:25000,cadence:3,children:[]},
  {set:'steel',supplier:'s3',format:'Single Part',code:'WP-NEW-STL-001',name:'GUARD ASSY — steel with sub-parts (first quotation)',rtp:'LOU0002-101-J21',drawing:'M-19-F0461',qty:178474,cadence:3,children:[{code:'17211-KZL-9300-21',qty:1},{code:'17211-K16-9022',qty:1}]},
  {set:'assembly-qt',supplier:'s1',format:'Assembly',code:'WP-NEW-ASY-001',name:'CASE ASSY, AIR/C — QT-ASSY (first quotation)',rtp:'FG03811-101-00',drawing:'04',qty:2492,cadence:1,children:[{code:'LOU0045-034-J21',qty:1},{code:'THS0058-067-J21',qty:5},{code:'GCT0144-020-D20',qty:1}]},
  {set:'standard',supplier:'s2',format:'Single Part',code:'WP-NEW-STD-001',name:'HOLDER — standard paper form (first quotation)',rtp:'S005109-101-01',drawing:'—',qty:12000,cadence:3,children:[]},
  {set:'standard',supplier:'s3',format:'Assembly',code:'WP-NEW-STD-002',name:'MODULE ASSY — standard formula (first quotation)',rtp:'LOU0002-102-J21',drawing:'05',qty:3000,cadence:1,children:[{code:'17211-KZL-9300-21',qty:2}]},
  {set:'assembly',supplier:'s2',format:'Assembly',code:'WP-NEW-ASM-001',name:'DUCT ASSY — assembly pricing model (first quotation)',rtp:'PRC0006-102-E20',drawing:'02',qty:4000,cadence:1,children:[]}
];
function addFirstQuotationDemoParts(data){
  const templates=seed();
  for(const f of FIRST_QUOTATION_DEMO){
    if(data.items.some(i=>i.code===f.code))continue;
    const base=templates.items.find(i=>i.supplier===f.supplier)||templates.items[0],id='i'+(Math.max(0,...data.items.map(i=>Number(i.id.slice(1))||0))+1);
    const item={...structuredClone(base),id,formulaSet:f.set,code:f.code,name:f.name,supplier:f.supplier,format:f.format,rtp:f.rtp,drawing:f.drawing,qty:f.qty,cadence:f.cadence,next:TODAY,children:structuredClone(f.children),demoScenario:'first-'+f.set};
    delete item.price;delete item.last;delete item.family;
    data.items.push(item);
  }
  data.demoDataVersion=2;
  return data;
}
function populateDemoData(original){
  const base=original.demoDataVersion>=1?original:populateBaseDemoData(original);
  if(base.demoDataVersion>=2)return base;
  return addFirstQuotationDemoParts(base===original?structuredClone(original):base);
}
function populateBaseDemoData(original){
  if(original.demoDataVersion>=1)return original;
  const data=structuredClone(original),templates=seed();
  for(const key of ['priceRequests','notifications','quotes','items','history','emails','audit'])data[key]||=[];
  const clone=v=>structuredClone(v);
  const day=(iso,offset)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)};
  const stamp=(iso,h=9)=>`${date(iso)}, ${String(h).padStart(2,'0')}:15 ICT`;
  const actor=(role,supplier)=>users.find(u=>supplier?u.supplier===supplier&&u.role===role:u.portal==='roki'&&u.role===role);
  const next=(records,prefix)=>prefix+String(Math.max(199,...records.map(r=>r.id.startsWith(prefix)?Number(r.id.slice(prefix.length))||0:0))+1).padStart(4,'0');
  const event=(action,role,iso,reason='')=>({action,role,user:actor(role).name,at:stamp(iso),reason,revision:1});
  // A real, readable one-page PDF attachment, generated locally without external URLs.
  const pdf=lines=>{
    const safe=s=>String(s).replace(/[^\x20-\x7e]/g,' ').replace(/[\\()]/g,'\\$&');
    const stream='BT /F1 11 Tf 50 790 Td '+lines.map((s,i)=>(i?'0 -22 Td ':'')+'('+safe(s)+') Tj').join('\n')+' ET';
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let out='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});
    const xref=out.length;out+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return 'data:application/pdf;base64,'+btoa(out);
  };
  const attachment=(q,it)=>({name:`${it.code}-cost-review.pdf`,kind:'drawing',type:'application/pdf',data:pdf(['WEBPARK - SAMPLE SUPPORTING DOCUMENT',`Quotation: ${q.id}`,`Part: ${it.code} / ${it.name}`,`Supplier: ${suppliers.find(s=>s.id===it.supplier).name}`,`Drawing revision: ${it.drawing}`,`Annual volume: ${it.qty} pieces`,`Proposed price: THB ${cash(q.total)} per piece`,`Effective from: ${q.effective}`,q.remark,'Cost items are detailed in the linked quotation.','Illustrative document for the interactive demo.'])});
  const mail=(id,to,subject,body,at,by,quote=null)=>{if(!data.emails.some(m=>m.id===id))data.emails.push({id,to:to.map(u=>u.id),subject,body,at,by,quote})};
  function request(items,status,iso,title,scenario){
    const count={'Draft':0,'Pending Check':1,'Pending Approve':2,Approved:3,Returned:1,Rejected:2,Cancelled:0}[status];
    const trail=[event('save','Issue',iso)];
    if(count>=1)trail.push(event('submit','Issue',day(iso,1)));
    if(count>=2)trail.push(event('advance','Check',day(iso,2),'Part scope, supplier assignment and response deadline verified.'));
    if(count>=3)trail.push(event('advance','Approve',day(iso,3),'Approved to request updated cost breakdowns. Supplier prices require separate approval.'));
    if(status==='Returned')trail.push(event('return','Check',day(iso,2),'Please confirm the annual volume against the latest production plan before resubmitting.'));
    if(status==='Rejected')trail.push(event('reject','Approve',day(iso,3),'Duplicate sourcing review; continue under the current approved contract.'));
    if(status==='Cancelled')trail.push(event('cancel','Issue',day(iso,1),'Production planning withdrew this review scope. No supplier notification was sent.'));
    const r={id:next(data.priceRequests,'RFQ-2026-'),title,purpose:'Quarterly sourcing review: verify material rates, production volume and process improvements against the current approved price.',message:'Please submit your itemized quotation, material price notice and confirmed production volume. Explain all changes against the approved baseline.',items:[...items],status,approvalStatus:status,deliveryStatus:'NotSent',due:day(TODAY,21),createdBy:actor('Issue').id,createdAt:stamp(iso),updatedAt:trail.at(-1).at,revision:1,versions:[],trail,notifications:[],demoScenario:scenario};
    if(status==='Approved'){r.approvedAt=trail.at(-1).at;r.approvedBy=actor('Approve').id}
    data.priceRequests.push(r);
    if(['Pending Check','Pending Approve','Returned','Rejected'].includes(status)){
      const role=status==='Pending Check'?'Check':status==='Pending Approve'?'Approve':'Issue';
      mail('M-DEMO-'+r.id,[actor(role)],`${r.id} - ${status}`,`${title}. ${trail.at(-1).reason||'Please review the request assigned to your role.'}`,r.updatedAt,trail.at(-1).user);
    }
    return r;
  }
  function dispatch(r,supplier,items,iso,existing){
    const n=existing||{id:next(data.notifications,'N-2026-'),supplier,items:[...items],created:stamp(iso,14),by:actor('Issue').name,due:r.due,message:r.message,read:false};
    n.priceRequestId=r.id;
    if(!existing)data.notifications.push(n);
    r.status='Sent';r.approvalStatus='Approved';r.deliveryStatus='Sent';r.sentAt=n.created;r.sentBy=actor('Issue').id;r.updatedAt=n.created;r.notifications.push(n.id);
    r.trail.push({...event('send','Issue',iso),at:n.created,reason:'Sent to the assigned supplier after completing internal approval.'});
    mail('M-DEMO-'+n.id,users.filter(u=>u.supplier===supplier),`${r.id} - quotation requested`,`${r.message} Parts: ${items.map(id=>data.items.find(i=>i.id===id).code).join(', ')}. Response due ${n.due}.`,n.created,n.by);
    return n;
  }
  function linkQuote(q){
    const it=data.items.find(i=>i.id===q.item);if(!it)return;
    if(!q.requestedBy){
      const start=day(q.quoteDate||TODAY,-8),r=request([it.id],'Approved',start,`Price review - ${it.code}`,`origin-${q.id}`);
      r.due=day(q.quoteDate||TODAY,7);
      q.requestedBy=dispatch(r,it.supplier,[it.id],day(start,4)).id;
    }
    if(!q.attachments.length)q.attachments.push(attachment(q,it));
    const nextRole={'Supplier approval':'Approve','ROKI Issue':'Issue','ROKI Check':'Check','ROKI Approve':'Approve',Reverted:'Issue',Rejected:'Issue',Approved:'Issue'}[q.status];
    if(nextRole){
      const recipients=['Supplier approval','Reverted','Rejected','Approved'].includes(q.status)?users.filter(u=>u.supplier===q.supplier&&(q.status==='Approved'||u.role===nextRole)):[actor(nextRole)];
      mail('M-DEMO-'+q.id,recipients,`${q.id} - ${q.status}`,`${it.code} ${it.name}: THB ${cash(q.total)} per piece. ${q.remark}`,q.trail.at(-1)?.at||stamp(q.quoteDate),q.trail.at(-1)?.user||actor('Issue',q.supplier).name,q.id);
    }
  }
  // Complete the provenance of the supplied sample quotations, without changing their prices/statuses.
  for(const template of templates.quotes){const q=data.quotes.find(q=>q.id===template.id);if(q)linkQuote(q)}
  for(const n of [...data.notifications])if(n.id==='N-DEMO-001'&&!n.priceRequestId){
    const r=request(n.items,'Approved','2026-11-10','Quarterly HOLDER material review','holder-waiting');r.due=n.due;dispatch(r,n.supplier,n.items,'2026-11-17',n);
  }
  const source=supplier=>templates.quotes.find(q=>q.supplier===supplier&&q.status==='Approved');
  function newItem(supplier,index,scenario){
    const base=templates.items.find(i=>i.id===source(supplier).item),id='i'+(Math.max(0,...data.items.map(i=>Number(i.id.slice(1))||0))+1);
    const item={...clone(base),id,code:`${supplier==='s1'?'17230':supplier==='s2'?'17253':'17211'}-WP${String(index).padStart(2,'0')}-9000`,rtp:`WP-${supplier.toUpperCase()}-${String(index).padStart(3,'0')}`,drawing:'B02',qty:supplier==='s3'?180000:24000,next:day(TODAY,index%3===0?-4:14),cadence:3,children:[],demoScenario:scenario};
    delete item.price;delete item.last;data.items.push(item);return item;
  }
  function quoteFor(item,status,iso,baseline,costTemplate){
    const costs=clone(costTemplate||source(item.supplier).costs);
    if(baseline){for(const row of costs.material||[])if(row.rate)row.rate=r2(row.rate*1.035);for(const row of costs.process||[])if(row.time)row.time=r2(row.time*.98)}
    const q={id:next(data.quotes,'Q-2026-'),item:item.id,supplier:item.supplier,format:item.format,revision:baseline?1:0,status,previous:baseline?.total??totals(costs).total,costs,total:totals(costs).total,quantity:item.qty,drawing:item.drawing,effective:baseline?'2027-01-01':'2026-08-01',quoteDate:iso,remark:baseline?'Quarterly review: material rate increased 3.5%; cycle time improved 2% after line balancing. Packing and tooling rates are unchanged.':'Initial approved unit price following drawing B02 and the annual production plan.',attachments:[],versions:[],requestedBy:null,baseline:baseline?snapshotOf(baseline):null,trail:[],demoScenario:item.demoScenario};
    const completed={Draft:0,'Supplier approval':1,'ROKI Issue':2,'ROKI Check':3,'ROKI Approve':4,Approved:5,Reverted:3,Rejected:4}[status];
    for(let i=0;i<completed;i++){
      const [stage,action]=STAGES[i],role=stage.split('-')[1],who=actor(role,stage.startsWith('S-')?item.supplier:null);
      q.trail.push({stage,action,user:who.name,at:stamp(day(iso,i),9+i),reason:i>=2?'Cost breakdown, annual volume and supporting document reviewed.':''});
    }
    if(status==='Draft')q.trail.push({action:'Supplier saved draft',user:actor('Issue',item.supplier).name,at:stamp(iso)});
    if(status==='Reverted'||status==='Rejected')q.trail.push({action:status==='Reverted'?'Returned to supplier issuer for correction':'ROKI rejected quotation',user:actor(status==='Reverted'?'Check':'Approve').name,at:stamp(day(iso,4)),reason:status==='Reverted'?'Confirm the revised cycle time and attach the signed material price notice before resubmission.':'The proposed increase is outside the agreed review terms; prepare a new quotation using the contracted material basis.'});
    if(status==='Reverted')q.versions.push({revision:0,status:'Reverted',total:q.total,remark:'Previous proposal: production volume required correction.',costs:clone(costs),attachments:[],effective:q.effective,quantity:18000,drawing:'B01',previous:q.previous,at:stamp(day(iso,-1))});
    data.quotes.push(q);linkQuote(q);
    if(status==='Approved'){data.history.push({item:item.id,effective:q.effective,price:q.total,quote:q.id,reason:q.remark});item.price=q.total;item.last=day(iso,4)}
    return q;
  }
  // Each supplier has usable work at every quotation stage, plus a valid approved baseline.
  for(const supplier of suppliers){
    for(const [index,status] of ['Draft','Supplier approval','ROKI Issue','ROKI Check','ROKI Approve','Reverted','Rejected','Approved'].entries()){
      const item=newItem(supplier.id,index+1,`${supplier.id}-${status}`);
      const approved=quoteFor(item,'Approved','2026-07-20',null);
      if(status!=='Approved')quoteFor(item,status,'2026-11-10',approved);
    }
    // An unstarted request provides a working 'Prepare quotation' action for each supplier.
    const item=newItem(supplier.id,20,`${supplier.id}-waiting`);quoteFor(item,'Approved','2026-07-20',null);
    const r=request([item.id],'Approved','2026-11-01',`November review - ${item.code}`,`${supplier.id}-waiting-request`);
    r.due=supplier.id==='s2'?'2026-11-16':'2026-12-09';dispatch(r,supplier.id,[item.id],'2026-11-05');
  }
  // The previously blank second source for MESH now has an approved qualification quotation.
  const secondSource=data.items.find(i=>i.id==='i9'&&i.code==='17211-K16-9022');
  if(secondSource&&!data.quotes.some(q=>q.item===secondSource.id)){
    secondSource.demoScenario='mesh-second-source';secondSource.next='2026-12-15';
    const meshCosts=clone(templates.quotes.find(q=>q.item==='i8'&&q.status==='Approved').costs);
    meshCosts.material.forEach(row=>{row.rate=r2(row.rate*1.02)});
    quoteFor(secondSource,'Approved','2026-07-20',null,meshCosts);
  }
  for(const [index,status] of ['Draft','Returned','Pending Check','Pending Approve','Approved','Rejected','Cancelled'].entries()){
    const item=newItem(suppliers[index%3].id,30+index,`internal-${status}`);quoteFor(item,'Approved','2026-07-20',null);
    const r=request([item.id],status,'2026-11-10',`${status==='Returned'?'Production volume confirmation':'Quarterly sourcing review'} - ${item.code}`,`internal-${status}`);
    if(status==='Returned'){
      r.revision=2;r.versions=[{revision:1,title:r.title,purpose:r.purpose,due:r.due,message:r.message,items:[item.id],status:'Pending Check',at:stamp('2026-11-11')}];
    }
  }
  data.audit.push({action:'Sample sourcing cycles available',user:'Demo data',at:stamp(TODAY),reason:'Linked requests, supplier responses, approvals, price history and simulated notifications for presentation.'});
  data.demoDataVersion=1;
  return data;
}
