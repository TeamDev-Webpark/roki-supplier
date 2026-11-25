'use strict';
/* Price requests for items whose review is due are created and sent to the Supplier by the system itself.
   WEBPARK Issue does not send them; the first WEBPARK step is Issue after the Supplier has approved the quotation. */
const AUTO_ACTOR={id:'system',name:'System · automatic review',role:'System'};
const AUTO_RESPONSE_DAYS=14;
function autoSpecFor(i){
  const formats=FORMULAS.sets,own=formulaSetCurrent(i),std=formats.find(s=>s.id==='standard'&&s.formats.includes(i.format))||formats.find(s=>s.formats.includes(i.format)&&!s.retired);
  const version=own||std?.current;if(!version)return null;
  const effective=addMonths(TODAY,1),period=i.qtyPeriod||defaultQtyPeriod(i);
  return {formulaVersion:version,quantity:Number(i.qty)>0?Math.round(i.qty):1,drawing:i.drawing||'-',effective,reviewDueDate:i.next||null,cadence:i.cadence||3,requestedOn:TODAY,
    qtyPeriod:period,ending:defaultEnding(effective,i.cadence),rtp:i.rtp||(i.format==='Single Part'?'N/A':''),material:'',supplied:[]};
}
function autoDueItems(){
  return db.items.filter(i=>i.next&&i.next<=TODAY&&i.supplier&&!deskFirstTime(i)&&!wfActive(i.id)&&autoSpecFor(i));
}
function autoSendDueRequests(){
  if(!db||!Array.isArray(db.priceRequests))return 0;
  const due=autoDueItems();if(!due.length)return 0;
  const bySupplier=new Map();for(const i of due){if(!bySupplier.has(i.supplier))bySupplier.set(i.supplier,[]);bySupplier.get(i.supplier).push(i)}
  const before=structuredClone(db);let sent=0;
  try{
    autoActor=AUTO_ACTOR;
    /* a saved, unsent request never holds back a due review: the system sends it, so the draft is dropped */
    for(const i of due)for(const r of db.priceRequests){
      if(rfqDelivery(r)==='Sent'||['Cancelled','Rejected'].includes(r.status)||!r.items.includes(i.id))continue;
      r.items=r.items.filter(x=>x!==i.id);if(r.specs)delete r.specs[i.id];if(r.priceLines)delete r.priceLines[i.id];
      r.trail.push({action:'cancel',user:AUTO_ACTOR.name,role:AUTO_ACTOR.role,at:timestamp(),reason:'Review due: '+i.code+' was sent automatically'});
      if(!r.items.length){r.status='Cancelled'}
    }
    for(const [supplier,parts] of bySupplier){
      const n=Math.max(0,...db.priceRequests.map(r=>Number(String(r.id).split('-').at(-1))||0))+1,id='RFQ-'+TODAY.slice(0,4)+'-'+String(n).padStart(4,'0');
      const items=parts.map(i=>i.id),specs=Object.fromEntries(parts.map(i=>[i.id,autoSpecFor(i)]));
      const r={id,title:'Scheduled price review · '+supplierName(supplier),purpose:'Review due on the configured schedule',due:addDays(TODAY,AUTO_RESPONSE_DAYS),
        message:'Automatic request: the price review for these parts is due. Please enter costs in the attached forms.',specLink:'',specAttachments:[],items,specs,
        terms:{vat:'excluded',payment:'Credit 60 days',notes:''},priceLines:Object.fromEntries(items.map(x=>[x,{...rfqPriceLine(x,null),targetPrice:null}])),
        status:'Draft',approvalStatus:'NotRequired',deliveryStatus:'NotSent',flowVersion:2,auto:true,createdBy:AUTO_ACTOR.id,createdAt:timestamp(),updatedAt:timestamp(),revision:1,versions:[],
        trail:[{action:'save',role:AUTO_ACTOR.role,user:AUTO_ACTOR.name,at:timestamp()}]};
      db.priceRequests.push(r);dispatchCostRequest(r);sent++;
    }
    autoActor=null;persist();
  }catch(e){autoActor=null;db=before;setFormulaStore(db.formulas);console.warn('Automatic request failed',e);return 0}
  return sent;
}
