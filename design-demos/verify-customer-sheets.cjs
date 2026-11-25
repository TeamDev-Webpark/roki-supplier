'use strict';
/* The customer formula sets (Injection, Rubber, Steel, QT-ASSY) reproduce ROKI's own worked examples exactly.
   - Injection / Rubber / Steel: every block (original + revised) of the five sheets in docs/sample -QT.xls,
     checked against the values Excel calculated (sections A–E, subtotal, profit & admin, spare part cost, total).
     Excel never rounds between steps, so section values must match to 1e-9; the unit price is that total rounded to 2 decimals.
   - Assembly: QT-ASSY.pdf Rev.10 and Rev.11 (lines rounded to 2 decimals, as on the paper form).
   - Paper forms: GUARD ELEMENT and HOLDER quotations kept in the demo data (PART STEEL.pdf, QT-COMPONENT.pdf).
   This test needs no browser: it runs the model file itself. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const users=['s1','s2','s3'].flatMap(id=>['Issue','Approve'].map(role=>({id:id+'-'+role,name:id+' '+role,role,portal:'supplier',supplier:id}))).concat(['Issue','Check','Approve'].map(role=>({id:'r-'+role,name:'ROKI '+role,role,portal:'roki'})));
const ctx=vm.createContext({console,Math,structuredClone,crypto:{randomUUID:()=>'00000000-0000'},date:s=>s,timestamp:()=>'now',users});
const M=vm.runInContext(fs.readFileSync(path.join(__dirname,'quote-model.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'formula-examples.js'),'utf8')+'\n;({ensureFormulaExamples,runFormulaExamples,customerExamples,CUSTOMER_SETS,EX_KEYS,totals,blankCosts,adaptCosts,sectionsOf,cfgOf,cfgIn,expenseOf,rowAmount,defaultFormulaStore,setFormulaStore,validateFormatConfig,validateCosts,currentFormulas,fmtCfg,compileExpr,seed,FORMULAS:()=>FORMULAS})',ctx);
const {totals}=M;
const V=setId=>M.FORMULAS().versions.find(v=>v.setId===setId);
const blankCosts=kind=>kind==='Assembly'?M.blankCosts('Assembly',V('assembly-qt')):M.blankCosts('Single Part',V(kind.toLowerCase()));
const near=(a,b,msg,eps=1e-9)=>assert(Math.abs(a-b)<=eps,`${msg}: got ${a}, expected ${b}`);

/* ---------- helpers to enter the sheets ---------- */
const mat=(code,name,weight,scrap,rate,loss)=>({code,name,origin:'Local',weight,scrap,rate,loss});
const comp=(partNo,name,qty,rate,loss=0)=>({partNo,name,origin:'Local',qty,rate,loss});
const proc=(name,machine,cavity,time,rate)=>({name,machine,cavity,time,rate});
const pack=(name,amount,perPiece,qty)=>({name,amount,perPiece,qty,pm:0});
const die=(name,amount,volume,extra={})=>({name,origin:'Local',invType:'New investment',cavity:1,amount,volume,repaid:'Not repaid',pm:5,...extra});
function sheet(profile,o){
  const c=blankCosts(profile);
  Object.assign(c,{material:[],components:[],process:[],packing:[],equipment:[]},o);
  return c;
}
const racks=[pack('Rack',100000,1,250000),pack('Foam sheet',0.5,1,1)],transport=pack('Transport',1.5,1,1);
const inj=(rate)=>sheet('Injection',{material:[mat('EKC0006-016-D10','TTR-50',.135,.013,rate,3)],components:[comp('17213-KWN-9001','SEAL,DUCTCOVER',1,2.1,3)],
  process:[proc('Injection','450T',2,350,.194),proc('Inspection','',1,10,.01),proc('Checking','',1,10,.015),proc('Finishing','',1,15,.015),proc('Assy','',1,10,.01)],
  packing:racks,equipment:[die('Injection mold',1000000,250000,{cavity:4,pm:0})],pm:5});
const rub=(rate)=>sheet('Rubber',{material:[mat('1725Z-GHA-6301','NBR/PVC HS70+/-8',.135,.013,rate,3)],
  process:[proc('Injection','450T',2,350,.194),proc('Inspection','',1,10,.01),proc('Checking','',1,10,.015),proc('Finishing','',1,15,.015)],
  packing:[...racks,transport],equipment:[die('Injection mold',1000000,250000,{cavity:4})]});
const sub1=(repaid)=>sheet('Steel',{material:[mat('','SGCC 0.4 x 120 x 180',.068,0,46,0)],
  process:[proc('PROGRESSIVE','110 TONS',1,350,.018),proc('FORM','60 TONS',1,10,.01),proc('INSPECTION','',1,10,.015),proc('Finishing','',1,15,.015)],
  packing:[pack('BOX',100000,1,250000),racks[1],transport],
  equipment:[die('DIE PROGRESSIVE',1000000,250000,{repaid}),die('DIE FORM',25000,250000,{repaid}),die('JIG CHECK',25000,250000,{repaid})]});
const sub2=(repaid)=>sheet('Steel',{material:[mat('','16 MESH WIRE DIA 0.35',.0066,0,320,0)],
  process:[proc('BLANK','',1,350,.018),proc('INSPECTION','',1,10,.01)],packing:[pack('BOX',100000,1,250000),racks[1],transport],equipment:[die('DIE BLANK',1000000,250000,{repaid})]});
const steelCom=(c1,c2)=>sheet('Steel',{components:[comp('17211-KZL-93-21','PLATE',1,c1),comp('17211-K16-9022','MESH',1,c2)],
  process:[proc('ASSY MASH','',1,350,.194),proc('STAMP 1','60 TONS',1,10,.01),proc('STAMP 2','60 TONS',1,10,.015),proc('PIERCE','60 TONS',1,15,.015)],
  packing:[...racks,transport],equipment:[die('Injection mold',1000000,250000,{cavity:4})]});

/* values calculated by Excel (cached results of docs/sample -QT.xls): [A,B,C,D,E,subtotal,profit,spare,total] */
const EXCEL={
 injOrig:[8.53664,2.163,34.525,.9,5.72625,51.85089,5.17875,5.17875,62.20839],
 injRev:[9.1464,2.163,34.525,.9,5.72625,52.46065,5.17875,5.17875,62.81815],
 rubOrig:[8.53664,0,34.425,2.4,4.2,49.56164,5.16375,5.16375,59.88914],
 rubRev:[9.1464,0,34.425,2.4,4.2,50.1714,5.16375,5.16375,60.4989],
 p1Orig:[3.128,0,6.775,2.4,4.41,16.713,1.01625,1.01625,18.7455],
 p1Rev:[3.128,0,6.775,2.4,.21,12.513,1.01625,1.01625,14.5455],
 p2Orig:[2.112,0,6.4,2.4,4.2,15.112,.96,.96,17.032],
 p2Rev:[2.112,0,6.4,2.4,.2,11.112,.96,.96,13.032],
 comOrig:[0,35.7775,68.375,2.4,4.2,110.7525,10.25625,10.25625,131.265],
 comRev:[0,27.5775,68.375,2.4,4.2,102.5525,10.25625,10.25625,123.065]
};
function check(name,c,exp){
  const t=totals(c),got=[t.A,t.B,t.C,t.D,t.E,t.subtotal,t.profit,t.spare,t.totalRaw];
  got.forEach((v,i)=>near(v,exp[i],`${name} ${['A','B','C','D','E','subtotal','profit','spare','total'][i]}`));
  near(t.total,exp[8],`${name} unit price is the Excel total rounded to 2 decimals`,0.005+1e-9);
  assert.equal(t.total,Math.round(t.total*100)/100,`${name} unit price has 2 decimals`);
  return t;
}
check('Injection original',inj(56),EXCEL.injOrig);check('Injection revised',inj(60),EXCEL.injRev);
check('Rubber original',rub(56),EXCEL.rubOrig);check('Rubber revised',rub(60),EXCEL.rubRev);
const p1o=check('Steel sub part 1 (PLATE) original',sub1('Not repaid'),EXCEL.p1Orig),p1r=check('Steel sub part 1 revised, tool repaid',sub1('Repaid'),EXCEL.p1Rev);
const p2o=check('Steel sub part 2 (MESH) original',sub2('Not repaid'),EXCEL.p2Orig),p2r=check('Steel sub part 2 revised, tool repaid',sub2('Repaid'),EXCEL.p2Rev);
/* the parent takes each sub-part's total (unrounded, as the Excel link does) as its component price */
check('Steel parent original (linked sub-part prices)',steelCom(p1o.totalRaw,p2o.totalRaw),EXCEL.comOrig);
check('Steel parent revised (linked sub-part prices)',steelCom(p1r.totalRaw,p2r.totalRaw),EXCEL.comRev);

/* the differences the customer pointed out are real formula settings, not accidents */
const injPM=inj(56),rubPM=rub(56);
const cfgOfSet=(id,format='Single Part')=>M.cfgIn(V(id),format);
assert.equal(cfgOfSet('injection').sections[4].adj[0].of,'process','Injection: PM is a % of the process cost (C)');
assert(cfgOfSet('rubber').sections[4].fields.some(f=>f[0]==='pm'),'Rubber: interest % sits on each die line');
assert.equal(cfgOfSet('steel').rounding.section,'none');assert.equal(cfgOfSet('assembly-qt','Assembly').rounding.row,'round');
/* a repaid tool costs nothing but still carries its maintenance / interest */
{const c=sub1('Repaid');near(totals(c).sections.equipment.value,.21,'repaid tools keep 5% maintenance');c.equipment[0].pm=0;c.equipment[1].pm=0;c.equipment[2].pm=0;near(totals(c).E,0,'repaid and no maintenance = 0')}
/* loss is per line */
{const c=rub(56);c.material[0].loss=0;near(totals(c).A,(.135+.013)*56,'no loss');c.material.push(mat('X','crush',.0155,0,21.5,0));near(totals(c).A,.148*56+.0155*21.5,'second line without loss')}

/* ---------- Assembly: QT-ASSY.pdf, rows rounded to 2 decimals ---------- */
const A=(partNo,name,rate,qty=1)=>({partNo,name,origin:'Local',rate,qty});
const B=(name,weight,rate,included=true)=>({name,origin:'Local',weight,runner:0,rate,lossApplies:included?'Included':'Not included'});
const P=(name,machine,time,rate)=>proc(name,machine,1,time,rate);
function assy(rev){
  const r10=rev===10;
  const c=blankCosts('Assembly');
  c.components=[A('LOU0045-034-J21','BAND56,AIR/C CONNECTING TUBE',7.64),A('THS0058-067-J21','SCREW,TAPPING 5X20',.44,5),A('GCT0144-020-D20','RESONATOR',18.98),A('LOU0001-034-J21','BAND,28 RESONATOR',8.49),A('FRC0045-017-E20','DUCT,AIR/C',43.95),A('TPR0033-065-E20','V.TUBE,8X12X80',4.28),A('CTS0021-012-J21','CLAMP D12.0 TUBE',1.32,2),A('GCT0007-020-E20','PLUG BREATHER TUBE',1.29),A('KEI0010-032-J23','CLIP,BREATHER TUBE',1.29),A('PRC0010-046-E20','TUBE,AIR/C DRAIN',1.94),A('AMP0107-003-J21','GUARD ELEMENT',14.5),A('TFC0092-059-Z04','SEAL',11.04),A('FRC0046-017-E20','TUBE,AIR/C CONNECTING',56.36),
    A('S004604-004-01','IJ LID COMP (SBP)',r10?15.44:16.64),A('S003384-004-01','IJ CASE,A/C (SBP)',r10?35.69:43.62),A('S003385-004-01','IJ PLATE,A/C BREATHE (SBP)',r10?11.41:11.43),A('S003386-004-01','IJ COVER,AIR DUCT (POL)',r10?41.43:44.77),
    A('Set-up loss','Set-up loss (0.18% of part vibration), quality guarantee',r10?.16:.18)];
  c.material=[B('DAPHNE MECHANIC OIL 32',.022,r10?75.99:91.36),B('3M K500 PRIMER',.000005,3068.18),B('PAPER AR122T',.214,26.99),B('HAMATITE WELBOND SUPPER',.0012,600),B('TRC-30K NUV BLACK (85%)',r10?.0876:.0876,r10?35.41:49.8),B('TRC-30K BLACK CRUSH 15%',.0155,21.5,false)];
  c.process=[P('ASSEMBLY','ASSEMBLY',150,.0926),P('PRE-ASSY','PRE-ASSY',10,.0911),P('PRE-ASSY','PRE-ASSY',8,.0911),P('OIL SPRAY','OIL SPRAY',18,.0556),P('ULTRASONIC','ULTRASONIC',25,.0996),P('PRE-ASSY','PRE-ASSY',40,.0911),P('3SOT','3SOT',54,.1673),P('PLEATING','PLEATING',6,.0705),P('VIBRATION','VIBRATION',42,.1106),P('ULTRASONIC','ULTRASONIC',60,.0996)];
  c.investment=[{name:'Oil Spray Jig (repayment start 01 Nov 2025)',origin:'Local',common:0,newInv:24000,volume:161760,repaid:'Repaid',pm:0,pmBase:0},{name:'PM Mold 5% (injection after 3 months or 20,000 shots)',origin:'Local',common:0,newInv:0,volume:1,repaid:'Not repaid',pm:5,pmBase:9.03},{name:'MN cost oil spray jig 5% (0.15 x 5%)',origin:'Local',common:0,newInv:0,volume:1,repaid:'Not repaid',pm:5,pmBase:.15}];
  c.packing=[{name:'TRANSPORT (30pcs/rack)',amount:1800,perPiece:1,qty:648,pm:0},{name:'RACK (new rack) + MN cost 5%',amount:2345360,perPiece:1,qty:1867834,pm:5},{name:'EPE FOAM SHEET 9 SHEET/RACK',amount:2.52,perPiece:.3,qty:1,pm:0},{name:'Partition (158 THB/pc: 4 pcs/rack, return 10 times)',amount:2.11,perPiece:1,qty:1,pm:0}];
  return c;
}
{const t=totals(assy(10));
 near(t.A,280.12,'QT-ASSY Rev.10 A',1e-9);near(t.B,11.96,'QT-ASSY Rev.10 B',1e-9);near(t.C,42.74,'QT-ASSY Rev.10 C',1e-9);near(t.D,.46,'QT-ASSY Rev.10 D',1e-9);near(t.E,6.97,'QT-ASSY Rev.10 E',1e-9);
 near(t.subtotal,342.25,'QT-ASSY Rev.10 sub total',1e-9);near(t.profit,6.41,'QT-ASSY Rev.10 profit & admin',1e-9);near(t.total,348.66,'QT-ASSY Rev.10 total',1e-9)}
{const t=totals(assy(11));
 near(t.A,292.7,'QT-ASSY Rev.11 A',1e-9);near(t.B,13.61,'QT-ASSY Rev.11 B',1e-9);near(t.C,42.74,'QT-ASSY Rev.11 C',1e-9);near(t.D,.46,'QT-ASSY Rev.11 D',1e-9);near(t.E,6.97,'QT-ASSY Rev.11 E',1e-9);
 near(t.subtotal,356.48,'QT-ASSY Rev.11 sub total',1e-9);near(t.total,362.89,'QT-ASSY Rev.11 total',1e-9)}

/* ---------- paper forms kept in the demo data ---------- */
const seed=M.seed(),q=id=>seed.quotes.find(x=>x.id===id);
for(const [id,total] of [['Q-2023-0003',13.83],['Q-2025-0041',11.15],['Q-2026-0016',3.07],['Q-2026-0046',3.23]])near(q(id).total,total,`paper form ${id}`,1e-9);

/* ---------- every default formula set is valid ---------- */
for(const v of M.defaultFormulaStore().versions)for(const [key,cfg] of Object.entries(v.formats)){const errors=M.validateFormatConfig(cfg);assert.equal(errors.length,0,`v${v.version} ${key}: `+errors.join(' | '))}
/* old quotations carry over to a new profile without losing their numbers */
{const old=seed.quotes.find(x=>x.id==='Q-2026-0011').costs;const moved=M.adaptCosts(old,'Single Part',V('injection'));assert.equal(moved.material[0].loss,3,'section-level loss becomes the line loss');assert.equal(moved.fv,V('injection').version);assert(Number.isFinite(totals(moved).total))}
{const old=seed.quotes.find(x=>x.id==='Q-2026-0015').costs;const moved=M.adaptCosts(old,'Assembly',V('assembly-qt'));assert.equal(moved.investment[0].newInv,12000,'amount becomes New investment');near(totals(moved).total,totals(old).total,'Assembly quotation re-entered under the new columns',1e-9)}
/* the examples stored with each formula set (what the formula library shows and re-runs on every save) */
{
  const store=M.ensureFormulaExamples(M.defaultFormulaStore());let n=0;
  for(const set of store.sets){
    const ver=store.versions.find(v=>v.version===set.current);
    for(const r of M.runFormulaExamples(M.cfgIn(ver,set.formats[0]),set.examples)){n++;assert(r.pass,`${set.id} · ${r.ex.name}: `+JSON.stringify(r.diffs))}
  }
  assert(n>=16,'Customer examples are stored: '+n);
  assert.equal(store.sets.find(s=>s.id==='steel').examples.length,6);assert.equal(store.sets.find(s=>s.id==='assembly-qt').examples.length,2);assert.equal(store.sets.find(s=>s.id==='unit-part-paper').examples.length,4);
  /* a formula that no longer reproduces the customer form is caught */
  const ver=store.versions.find(v=>v.setId==='injection'),cfg=JSON.parse(JSON.stringify(M.cfgIn(ver,'Single Part')));cfg.sections[2].expr='rate*time/cavity*1.1';
  assert(M.runFormulaExamples(cfg,store.sets.find(s=>s.id==='injection').examples).some(r=>!r.pass),'A changed formula fails the examples');
}
console.log('PASS verify-customer-sheets');
