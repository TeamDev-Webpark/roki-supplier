'use strict';
/* Presentation helper: a "Fill sample data" button on every long form. It only fills fields that are still empty,
   keeps whatever WEBPARK has fixed (read-only), and never submits anything. */
(function(){
  const label=()=>wfText('Fill sample data','กรอกข้อมูลตัวอย่างอัตโนมัติ');
  const hint=()=>wfText('For presentations · fills empty fields only','สำหรับนำเสนอ · เติมเฉพาะช่องที่ยังว่าง');
  const bar=kind=>`<div class="demo-fill-bar" data-demo-fill-bar><button type="button" class="button" data-demo-fill="${kind}">✦ ${label()}</button><small>${hint()}</small></div>`;
  const pick=a=>a[Math.floor(Math.random()*a.length)],rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  const TEXT={purpose:['Periodic review of material, labour and logistics costs against the current approved price.','Annual cost alignment: confirm resin, process and packing rates after the latest supplier price notice.','First quotation for a newly introduced part: please confirm tooling, cycle time and logistics assumptions.','Review of cost drivers following the revised production plan and the updated drawing revision.'],message:['Please enter costs in the supplied form, attach supporting evidence and obtain your company approval before submitting.','Fill in every cost line and attach the material price notice; your approver must verify the figures before sending back.','Costs must follow the supplied form. Explain any change from the previous price in the revision reason.'],reason:['Reviewed against the drawing, production plan and supporting documents. Figures are consistent with the previous approved price.','Costs verified with the supplier statement and cycle-time study; no unexplained variance remains.','Returned for a clearer breakdown of material loss and packing cost; please resubmit with evidence.'],remark:['Quarterly review: material rate +3.5% per supplier price notice, cycle time improved 2% after line balancing; packing and tooling unchanged.','Material rate +2.1% after the latest resin notice; labour rate unchanged; yield improved by 0.5%.','Cycle time reduced 3% after tooling maintenance; freight cost +1.8% from the new logistics contract.'],title:['Periodic price review','Quarterly cost review','Annual price alignment','First quotation request'],name:['BRACKET, MOUNTING','COVER, SIDE PANEL','HOLDER, HOSE CLIP','TUBE, AIR INTAKE','CASE ASSY, FILTER','GUARD, HEAT SHIELD'],rtp:()=>'S0'+rnd(10000,99999)+'-101-0'+rnd(1,9),drawing:()=>'M'+rnd(100,299)+'-F-'+rnd(20,29),family:'',children:'',link:'https://example.com/spec/sample-'+rnd(100,999)+'.pdf',supplierref:()=>'SUP-QT-2026-'+String(rnd(1,999)).padStart(3,'0')};
  const text=h=>{const v=TEXT[h];return typeof v==='function'?v():Array.isArray(v)?pick(v):v};
  const hintFor=el=>{const k=(el.id+' '+(el.name||'')+' '+(el.dataset.requestDrawing!==undefined?'drawing':'')).toLowerCase();return Object.keys(TEXT).find(h=>k.includes(h))};
  function setValue(el,v){if(el.value===v)return;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
  function fillEmpty(root){
    let n=0;
    root.querySelectorAll('input,select,textarea').forEach(el=>{
      if(el.disabled||el.readOnly||el.closest('[data-demo-fill-bar]'))return;
      const type=(el.type||'').toLowerCase();if(['file','checkbox','radio','hidden','button','submit','search'].includes(type))return;
      if(el.tagName==='SELECT'){if(el.value)return;const o=[...el.options].find(o=>o.value);if(o){setValue(el,o.value);n++}return}
      if(String(el.value).trim()!=='')return;
      if(type==='date'){const d=new Date(TODAY+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+(/end/i.test(el.id+el.dataset.requestEnding)?365:30));d.setUTCDate(d.getUTCDate()+rnd(0,20));setValue(el,el.min&&d.toISOString().slice(0,10)<el.min?el.min:d.toISOString().slice(0,10));n++;return}
      if(type==='number'){setValue(el,String(Math.max(Number(el.min)||0,/qty|quantity/i.test(el.id+el.dataset.requestQty)?rnd(2,60)*1000:rnd(50,500))));n++;return}
      const h=hintFor(el);let v=h?text(h):'';
      if(el.id==='pf-code')v='WP-DEMO-'+String(Date.now()).slice(-5)+rnd(0,9);if(el.id==='pf-name')v=text('name')+' — '+rnd(100,999);if(el.id==='pf-qty')v=String(rnd(2,60)*1000);
      if(el.id==='pf-children'||el.id==='pf-family')return;
      if(!v&&(el.required||el.tagName==='TEXTAREA'||type==='text'))v=wfText('Sample entry for the presentation','ข้อมูลตัวอย่างสำหรับการนำเสนอ');
      if(v){setValue(el,v);n++}
    });
    return n;
  }
  /* Realistic, randomised supplier costs. Ranges follow the sample quotations (resin / compound / sheet prices, press tonnage,
     cycle times, rack and die costs). WEBPARK-fixed columns and the rows defined by the request are never touched. */
  const KIND=[[/rubber/,'rubber'],[/steel|guard/,'steel'],[/paper|unit-part/,'paper']];
  const POOL={
    injection:{mat:[['PP-GF30','Local',[0.04,0.35],[62,95]],['ABS HF380','Local',[0.05,0.4],[68,98]],['PA66-GF25','Import',[0.03,0.25],[105,150]],['POM M90-44','Import',[0.02,0.2],[88,125]]],proc:[['Injection',['80T','150T','250T','450T','650T'],[25,420],[0.12,0.26]],['Trimming','Manual',[6,30],[0.05,0.12]],['Inspection','Station',[4,20],[0.04,0.1]]]},
    rubber:{mat:[['EPDM 60 Shore A','Local',[0.02,0.3],[95,160]],['NBR/PVC HS70','Local',[0.03,0.28],[88,150]],['CR compound','Import',[0.02,0.25],[120,210]]],proc:[['Compression molding',['150T','250T','350T'],[90,380],[0.1,0.22]],['Trimming','Manual',[8,40],[0.05,0.11]],['Post-cure','Oven',[20,60],[0.03,0.08]]]},
    steel:{mat:[['SGCC 0.8 mm','Local',[0.12,1.1],[28,40]],['SPHC 1.6 mm','Local',[0.2,1.4],[26,38]],['SPCC 1.2 mm','Local',[0.15,1.2],[30,44]]],proc:[['Blanking',['60T','110T','160T'],[4,18],[0.12,0.3]],['Bending',['40T','80T'],[5,22],[0.1,0.24]],['Spot welding','Robot',[8,35],[0.09,0.2]]]},
    paper:{mat:[['Kraft paper 180 gsm','Local',[0.01,0.12],[32,50]],['Filter paper','Local',[0.01,0.1],[45,70]]],proc:[['Cutting','Die cut',[3,14],[0.06,0.14]],['Folding','Auto',[4,18],[0.05,0.12]],['Pasting','Manual',[6,24],[0.04,0.1]]]}
  };
  const PACK=['Rack','Carton box','Pallet','Plastic bag','Foam tray'],EQUIP=[['Die set',[350000,1800000]],['Jig / fixture',[40000,260000]],['Checking gauge',[15000,90000]]],INVEST=[['Tooling',[80000,900000]],['Fixture / jig',[30000,300000]]],COMP=['Bracket','Clip','Rubber seal','Bolt M6','Insert nut','Gasket'];
  const fl=(lo,hi,d=3)=>Number((lo+Math.random()*(hi-lo)).toFixed(d)),inRange=r=>fl(r[0],r[1],r[0]<1?3:2);
  function fillQuote(){
    const c=window.formCosts;if(!c||typeof sectionsOf!=='function')return;
    let kind='injection';try{const id=formulaSetOf(formulaVersion(c.fv)).id;kind=(KIND.find(([re])=>re.test(id))||[0,'injection'])[1]}catch{}
    const pool=POOL[kind],qty=Number(document.getElementById('quantity')?.value)||25000,mat=pick(pool.mat),cav=pick([1,2,2,4]);
    const rowsOf=(s,min)=>{c[s.key]=c[s.key]||[];if(!formCostRowCount(s.key))while(c[s.key].length<min)c[s.key].push(blankRow(s));return c[s.key]};
    const put=(s,row,vals)=>{for(const f of s.fields){const k=f[0];if(!(k in vals)||isFixedField(s,f))continue;row[k]=vals[k]}};
    for(const s of sectionsOf(c)){
      if(s.key==='material'){const rows=rowsOf(s,1);rows.forEach((row,i)=>{const m=i?pick(pool.mat):mat,w=inRange(m[2]);put(s,row,{code:'MAT-'+rnd(1000,9999),name:m[0],origin:m[1],weight:w,scrap:Number((w*fl(.05,.12)).toFixed(3)),rate:Math.round(inRange(m[3])*2)/2})})}
      else if(s.key==='components'){
        c.components=(c.components||[]).filter(r=>String(r.partNo||'').trim()||String(r.name||'').trim());   /* an empty placeholder row is not a WEBPARK-defined component */
        c.components.forEach(row=>put(s,row,{partNo:row.partNo||'CP-'+rnd(1000,9999),name:row.name||pick(COMP),origin:pick(['Local','Local','Import']),qty:rnd(1,4),rate:fl(2,60,2)}));
      }
      else if(s.key==='process'){const rows=rowsOf(s,2);const used=[];rows.forEach((row,i)=>{const p=i?pool.proc[Math.min(i,pool.proc.length-1)]:pool.proc[0];used.push(p);const m=Array.isArray(p[1])?pick(p[1]):p[1];put(s,row,{name:p[0],machine:m,cavity:i?1:cav,time:Math.round(inRange(p[2])),rate:Number(inRange(p[3]).toFixed(3))})})}
      else if(s.key==='packing'){const rows=rowsOf(s,1);rows.forEach((row,i)=>put(s,row,{name:i?pick(PACK):pick(PACK.slice(0,3)),amount:Math.round(rnd(5,150)*1000),qty:Math.round(rnd(20,300)*1000)}))}
      else if(s.key==='equipment'){const rows=rowsOf(s,1);rows.forEach((row,i)=>{const e=i?pick(EQUIP):EQUIP[0];put(s,row,{name:e[0],origin:pick(['Local','Local','Import']),cavity:cav,amount:Math.round(rnd(e[1][0]/1000,e[1][1]/1000)*1000),volume:Math.round(qty*fl(2,8,1)/1000)*1000||qty})})}
      else if(s.key==='investment'){const rows=rowsOf(s,1);rows.forEach((row,i)=>{const e=i?pick(INVEST):INVEST[0];put(s,row,{name:e[0],origin:'Local',amount:Math.round(rnd(e[1][0]/1000,e[1][1]/1000)*1000),volume:Math.round(qty*fl(2,6,1)/1000)*1000||qty})})}
    }
    render();
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&!el.readOnly&&!el.disabled)setValue(el,v)};
    set('remark',text('remark'));set('supplierRef',text('supplierref'));
    document.getElementById('remark')?.scrollIntoView?.({block:'center'});
  }
  function fillRequest(){
    const codes=[...document.querySelectorAll('[data-spec-item] h3')].map(h=>h.textContent.split(' · ')[0]).join(', ');
    const t=document.getElementById('rfq-title');if(t&&!t.readOnly)setValue(t,text('title')+' · '+codes+' · '+rnd(100,999));
    const pu=document.getElementById('rfq-purpose');if(pu&&!pu.value)setValue(pu,text('purpose'));
    document.querySelectorAll('[data-request-formula]').forEach(sel=>{if(!sel.value){const o=[...sel.options].find(o=>o.value);if(o)setValue(sel,o.value)}});
    fillEmpty(document.querySelector('.rfq-form-page')||document);
    const due=document.getElementById('response-due');if(due&&!due.value){setValue(due,(()=>{const d=new Date(TODAY+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+14);return d.toISOString().slice(0,10)})())}
  }
  function scan(){
    const inject=(anchor,kind,where='before')=>{if(!anchor||anchor.parentNode?.querySelector(`[data-demo-fill="${kind}"]`))return;anchor.insertAdjacentHTML(where==='before'?'beforebegin':'afterbegin',bar(kind))};
    const quote=document.getElementById('quote-form');if(quote)inject(quote,'quote');
    const rfq=document.querySelector('.rfq-form-page');if(rfq)inject(rfq,'request');
    document.querySelectorAll('#modal-root .dialog').forEach(d=>{if(d.querySelector('#pf-code,#action-reason,#rfq-reason,#fm-reason')&&!d.querySelector('[data-demo-fill]'))inject(d.querySelector('.dialog-body')||d.children[1]||d,'dialog','inside')});
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-demo-fill]');if(!b)return;e.preventDefault();
    const kind=b.dataset.demoFill;
    if(kind==='quote')fillQuote();else if(kind==='request')fillRequest();else fillEmpty(b.closest('.dialog')||document);
    if(typeof toast==='function')toast(wfText('Sample data filled. Review it before saving or sending.','กรอกข้อมูลตัวอย่างแล้ว ตรวจสอบก่อนบันทึกหรือส่ง'));
  });
  let queued=false;
  const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;observer.disconnect();try{scan()}finally{observer.observe(document.body,{childList:true,subtree:true})}})});
  function start(){scan();observer.observe(document.body,{childList:true,subtree:true})}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
