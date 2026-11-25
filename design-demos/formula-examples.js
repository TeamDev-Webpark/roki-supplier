'use strict';
/* Worked examples: the customer's own filled forms, stored with each formula set together with the results the customer's
   documents show. Every example is calculated again with a draft formula, so a change that no longer reproduces a customer
   form is visible before it is saved.
   Sources: docs/sample -QT.xls (values calculated by Excel itself), docs/QT-ASSY.pdf (Rev.10, Rev.11),
   docs/PART STEEL.pdf (GUARD ELEMENT, PLATE). Expected values are exactly what those documents show. */

const EX_KEYS=['A','B','C','D','E','subtotal','profit','spare','total'];
const EX_TOL={sheet:{section:1e-9,total:0.005+1e-9},rounded:{section:1e-9,total:1e-9}};

function customerExamples(setId,store){
  const set=store.sets.find(s=>s.id===setId),version=set&&store.versions.find(v=>v.version===set.current);
  if(!version)return [];
  const fmt=set.formats[0],bc=()=>blankCosts(fmt,version),T=c=>totals(c,cfgIn(version,c.format));
  const mk=(o)=>Object.assign(bc(),{material:[],components:[],process:[],packing:[],equipment:[]},o);
  const ex=(id,name,source,costs,expected,tol)=>({id,name,source,format:costs.format,costs,expected:Object.fromEntries(EX_KEYS.map((k,i)=>[k,expected[i]])),tol:tol||EX_TOL.sheet,builtin:true});
  const mat=(code,name,weight,scrap,rate,loss)=>({code,name,origin:'Local',weight,scrap,rate,loss});
  const comp=(partNo,name,qty,rate,loss=0)=>({partNo,name,origin:'Local',qty,rate,loss});
  const proc=(name,machine,cavity,time,rate)=>({name,machine,cavity,time,rate});
  const pack=(name,amount,perPiece,qty)=>({name,amount,perPiece,qty,pm:0});
  const die=(name,amount,volume,extra={})=>({name,origin:'Local',invType:'New investment',cavity:1,amount,volume,repaid:'Not repaid',pm:5,...extra});
  const racks=[pack('Rack',100000,1,250000),pack('Foam sheet',0.5,1,1)],transport=pack('Transport',1.5,1,1);
  const inj=rate=>mk({material:[mat('EKC0006-016-D10','TTR-50',.135,.013,rate,3)],components:[comp('17213-KWN-9001','SEAL,DUCTCOVER',1,2.1,3)],
    process:[proc('Injection','450T',2,350,.194),proc('Inspection','',1,10,.01),proc('Checking','',1,10,.015),proc('Finishing','',1,15,.015),proc('Assy','',1,10,.01)],
    packing:racks,equipment:[die('Injection mold',1000000,250000,{cavity:4,pm:0})],pm:5});
  const rub=rate=>mk({material:[mat('1725Z-GHA-6301','NBR/PVC HS70+/-8',.135,.013,rate,3)],
    process:[proc('Injection','450T',2,350,.194),proc('Inspection','',1,10,.01),proc('Checking','',1,10,.015),proc('Finishing','',1,15,.015)],
    packing:[...racks,transport],equipment:[die('Injection mold',1000000,250000,{cavity:4})]});
  const sub1=repaid=>mk({material:[mat('','SGCC 0.4 x 120 x 180',.068,0,46,0)],process:[proc('PROGRESSIVE','110 TONS',1,350,.018),proc('FORM','60 TONS',1,10,.01),proc('INSPECTION','',1,10,.015),proc('Finishing','',1,15,.015)],
    packing:[pack('BOX',100000,1,250000),racks[1],transport],equipment:[die('DIE PROGRESSIVE',1000000,250000,{repaid}),die('DIE FORM',25000,250000,{repaid}),die('JIG CHECK',25000,250000,{repaid})]});
  const sub2=repaid=>mk({material:[mat('','16 MESH WIRE DIA 0.35',.0066,0,320,0)],process:[proc('BLANK','',1,350,.018),proc('INSPECTION','',1,10,.01)],
    packing:[pack('BOX',100000,1,250000),racks[1],transport],equipment:[die('DIE BLANK',1000000,250000,{repaid})]});
  const parent=(a,b)=>mk({components:[comp('17211-KZL-93-21','PLATE',1,a),comp('17211-K16-9022','MESH',1,b)],process:[proc('ASSY MASH','',1,350,.194),proc('STAMP 1','60 TONS',1,10,.01),proc('STAMP 2','60 TONS',1,10,.015),proc('PIERCE','60 TONS',1,15,.015)],
    packing:[...racks,transport],equipment:[die('Injection mold',1000000,250000,{cavity:4})]});
  const X='docs/sample -QT.xls · ';
  if(setId==='injection')return [
    ex('inj-orig','single part -Inj · Cost Original (15.01.2026)',X+'cells I19…I67',inj(56),[8.53664,2.163,34.525,.9,5.72625,51.85089,5.17875,5.17875,62.20839]),
    ex('inj-rev','single part -Inj · Cost Original (15.03.2026, material 60)',X+'cells T19…T67',inj(60),[9.1464,2.163,34.525,.9,5.72625,52.46065,5.17875,5.17875,62.81815])];
  if(setId==='rubber')return [
    ex('rub-orig','single part -rubber · original',X+'cells I19…I67',rub(56),[8.53664,0,34.425,2.4,4.2,49.56164,5.16375,5.16375,59.88914]),
    ex('rub-rev','single part -rubber · revised (material 60)',X+'cells T19…T67',rub(60),[9.1464,0,34.425,2.4,4.2,50.1714,5.16375,5.16375,60.4989])];
  if(setId==='steel'){
    const p1o=sub1('Not repaid'),p1r=sub1('Repaid'),p2o=sub2('Not repaid'),p2r=sub2('Repaid');
    return [
      ex('steel-p1-orig','steel-sub part 1 (PLATE) · original',X+'K67',p1o,[3.128,0,6.775,2.4,4.41,16.713,1.01625,1.01625,18.7455]),
      ex('steel-p1-rev','steel-sub part 1 (PLATE) · revised, tooling repaid',X+'V67 (U59 interest on repaid tools)',p1r,[3.128,0,6.775,2.4,.21,12.513,1.01625,1.01625,14.5455]),
      ex('steel-p2-orig','steel-sub part 2 (MESH) · original',X+'K67',p2o,[2.112,0,6.4,2.4,4.2,15.112,.96,.96,17.032]),
      ex('steel-p2-rev','steel-sub part 2 (MESH) · revised, tooling repaid',X+'V67',p2r,[2.112,0,6.4,2.4,.2,11.112,.96,.96,13.032]),
      ex('steel-com-orig','steel-com (parent) · original, sub-part prices linked',X+'I67 (J23, J24 = sub-part totals)',parent(T(p1o).totalRaw,T(p2o).totalRaw),[0,35.7775,68.375,2.4,4.2,110.7525,10.25625,10.25625,131.265]),
      ex('steel-com-rev','steel-com (parent) · revised, sub-part prices linked',X+'T67',parent(T(p1r).totalRaw,T(p2r).totalRaw),[0,27.5775,68.375,2.4,4.2,102.5525,10.25625,10.25625,123.065])];
  }
  if(setId==='assembly-qt'){
    const A=(partNo,name,rate,qty=1)=>({partNo,name,origin:'Local',rate,qty});
    const B=(name,weight,rate,on=true)=>({name,origin:'Local',weight,runner:0,rate,lossApplies:on?'Included':'Not included'});
    const P=(name,machine,time,rate)=>proc(name,machine,1,time,rate);
    const assy=rev=>{
      const r10=rev===10,c=bc();
      c.components=[A('LOU0045-034-J21','BAND56,AIR/C CONNECTING TUBE',7.64),A('THS0058-067-J21','SCREW,TAPPING 5X20',.44,5),A('GCT0144-020-D20','RESONATOR',18.98),A('LOU0001-034-J21','BAND,28 RESONATOR',8.49),A('FRC0045-017-E20','DUCT,AIR/C',43.95),A('TPR0033-065-E20','V.TUBE,8X12X80',4.28),A('CTS0021-012-J21','CLAMP D12.0 TUBE',1.32,2),A('GCT0007-020-E20','PLUG BREATHER TUBE',1.29),A('KEI0010-032-J23','CLIP,BREATHER TUBE',1.29),A('PRC0010-046-E20','TUBE,AIR/C DRAIN',1.94),A('AMP0107-003-J21','GUARD ELEMENT',14.5),A('TFC0092-059-Z04','SEAL',11.04),A('FRC0046-017-E20','TUBE,AIR/C CONNECTING',56.36),
        A('S004604-004-01','IJ LID COMP (SBP)',r10?15.44:16.64),A('S003384-004-01','IJ CASE,A/C (SBP)',r10?35.69:43.62),A('S003385-004-01','IJ PLATE,A/C BREATHE (SBP)',r10?11.41:11.43),A('S003386-004-01','IJ COVER,AIR DUCT (POL)',r10?41.43:44.77),
        A('Set-up loss','Set-up loss (0.18% of part vibration), quality guarantee',r10?.16:.18)];
      c.material=[B('DAPHNE MECHANIC OIL 32',.022,r10?75.99:91.36),B('3M K500 PRIMER',.000005,3068.18),B('PAPER AR122T',.214,26.99),B('HAMATITE WELBOND SUPPER',.0012,600),B('TRC-30K NUV BLACK (85%)',.0876,r10?35.41:49.8),B('TRC-30K BLACK CRUSH 15%',.0155,21.5,false)];
      c.process=[P('ASSEMBLY','ASSEMBLY',150,.0926),P('PRE-ASSY','PRE-ASSY',10,.0911),P('PRE-ASSY','PRE-ASSY',8,.0911),P('OIL SPRAY','OIL SPRAY',18,.0556),P('ULTRASONIC','ULTRASONIC',25,.0996),P('PRE-ASSY','PRE-ASSY',40,.0911),P('3SOT','3SOT',54,.1673),P('PLEATING','PLEATING',6,.0705),P('VIBRATION','VIBRATION',42,.1106),P('ULTRASONIC','ULTRASONIC',60,.0996)];
      c.investment=[{name:'Oil Spray Jig (repayment start 01 Nov 2025)',origin:'Local',common:0,newInv:24000,volume:161760,repaid:'Repaid',pm:0,pmBase:0},{name:'PM Mold 5% (injection after 3 months or 20,000 shots)',origin:'Local',common:0,newInv:0,volume:1,repaid:'Not repaid',pm:5,pmBase:9.03},{name:'MN cost oil spray jig 5% (0.15 x 5%)',origin:'Local',common:0,newInv:0,volume:1,repaid:'Not repaid',pm:5,pmBase:.15}];
      c.packing=[{name:'TRANSPORT (30pcs/rack)',amount:1800,perPiece:1,qty:648,pm:0},{name:'RACK (new rack) + MN cost 5%',amount:2345360,perPiece:1,qty:1867834,pm:5},{name:'EPE FOAM SHEET 9 SHEET/RACK',amount:2.52,perPiece:.3,qty:1,pm:0},{name:'Partition (158 THB/pc: 4 pcs/rack, return 10 times)',amount:2.11,perPiece:1,qty:1,pm:0}];
      return c;
    };
    const Q='docs/QT-ASSY.pdf · ';
    return [
      ex('assy-r10','QT-ASSY · Cost Rev.10 (27/04/2026)',Q+'No. QTFGY2402-002',assy(10),[280.12,11.96,42.74,.46,6.97,342.25,6.41,0,348.66],EX_TOL.rounded),
      ex('assy-r11','QT-ASSY · Cost Rev.11 (26/05/2026)',Q+'No. QTFGY2402-002',assy(11),[292.7,13.61,42.74,.46,6.97,356.48,6.41,0,362.89],EX_TOL.rounded)];
  }
  if(setId==='unit-part-paper'){
    const P='docs/PART STEEL.pdf · ';
    const pr=(name,cost,machine='')=>({name,machine,cavity:1,time:0,rate:0,fixed:cost});
    const kg=(name,w,rate)=>({code:'',name,origin:'Local',weight:w,wunit:'kg',scrap:0,rate});
    const guard=(rev,profit)=>{
      const c=bc();c.material=[];c.profit=15;c.basis='subtotal';c.spare=0;c.materialLoss=0;c.pm=0;
      c.components=[comp('17211-KZL-9300-21','PLATE',1,rev?4.03:4.33),comp('17211-K0J-N000-21','MESH',1,rev?4.1:4.2)];
      c.process=rev?[pr('ASSY MASH',.5),pr('STAMP 1',.5),pr('STAMP 2',.3),pr('PIERCE',.25),pr('INSPECTION 100 %',0)]:[pr('ASSY MASH',.5),pr('STAMP 1',.5),pr('STAMP 2',.5),pr('PIERCE',.5),pr('INSPECTION 100 %',.5)];
      c.packing=rev?[{name:'Packing',amount:.01,qty:1},{name:'Transport',amount:.01,qty:1}]:[{name:'Packing',amount:.5,qty:1},{name:'Transport',amount:.5,qty:1}];
      c.equipment=['DIE STAMP 1','DIE STAMP 2','DIE PIERCE','JIG CHECK ASSY'].map(n=>({name:n,origin:'Local',cavity:1,amount:0,volume:356948}));
      return c;
    };
    const plate=rev=>{
      const c=bc();c.components=[];c.profit=0;c.basis='subtotal';c.spare=0;c.materialLoss=0;c.pm=0;
      c.material=[kg('SGCC 0.4 x 120 x 180',.068,46)];
      c.process=rev?[pr('PROGRESSIVE',.6,'110 TONS'),pr('FORM',.3,'60 TONS'),pr('INSPECTION',0)]:[pr('PROGRESSIVE',.6,'110 TONS'),pr('FORM',.5,'60 TONS'),pr('INSPECTION',.1)];
      c.packing=[];c.equipment=['DIE PROGRESSIVE','DIE FORM','JIG CHECK'].map(n=>({name:n,origin:'Local',cavity:1,amount:0,volume:535422}));
      return c;
    };
    return [
      ex('paper-guard-orig','GUARD ELEMENT · Cost Original (16.09.23)',P+'page 1 left',guard(false),[0,8.53,2.5,1,0,12.03,1.8,0,13.83],EX_TOL.rounded),
      ex('paper-guard-rev','GUARD ELEMENT · Cost Revise 1st (28.04.25)',P+'page 1 right',guard(true),[0,8.13,1.55,.02,0,9.7,1.45,0,11.15],EX_TOL.rounded),
      ex('paper-plate-orig','PLATE · Cost Original (16.09.23), weight entered in kg',P+'page 2 left',plate(false),[3.13,0,1.2,0,0,4.33,0,0,4.33],EX_TOL.rounded),
      ex('paper-plate-rev','PLATE · Cost Revise 1st (28.04.25)',P+'page 2 right',plate(true),[3.13,0,.9,0,0,4.03,0,0,4.03],EX_TOL.rounded)];
  }
  return [];
}
/* attach the customer examples to sets that have none yet (new libraries and libraries saved before examples existed) */
function ensureFormulaExamples(store){
  for(const set of store.sets){
    if(Array.isArray(set.examples))continue;
    set.examples=CUSTOMER_SETS.some(c=>c.id===set.id)?customerExamples(set.id,store):[];
  }
  return store;
}
/* calculate every example with a formula (draft or saved) and compare with what the customer's document shows */
function runFormulaExamples(cfg,examples){
  return (examples||[]).map(ex=>{
    const t=totals(ex.costs,cfg),diffs=[];
    for(const k of EX_KEYS){
      if(ex.expected[k]===undefined||ex.expected[k]===null)continue;
      const tol=k==='total'?(ex.tol&&ex.tol.total!==undefined?ex.tol.total:0.005+1e-9):(ex.tol&&ex.tol.section!==undefined?ex.tol.section:1e-9),got=t[k];
      if(!(Math.abs(got-ex.expected[k])<=tol))diffs.push({key:k,expected:ex.expected[k],got});
    }
    return {ex,t,diffs,pass:!diffs.length};
  });
}
/* a quotation becomes an example: its costs, and the results the system gave it under the formula it was issued with */
function exampleFromQuote(q,label){
  const t=totals(q.costs);
  return {id:'q-'+q.id+'-'+Date.now().toString(36),name:label||q.id,source:'Quotation '+q.id,format:q.format,costs:structuredClone(q.costs),
    expected:Object.fromEntries(EX_KEYS.map(k=>[k,t[k]])),tol:EX_TOL.rounded,builtin:false};
}

/* a version saved with a later effective date becomes the set's current version once that date has come */
function promoteDueFormulaVersions(store){
  for(const set of store.sets){
    const due=store.versions.filter(v=>v.setId===set.id&&v.effective<=TODAY).sort((a,b)=>b.version-a.version)[0];
    const cur=store.versions.find(v=>v.version===set.current);
    if(due&&cur&&due.version>cur.version){set.current=due.version;if(set.id==='standard')store.current=due.version}
  }
  return store;
}
