'use strict';
/* Quotation cost model.
   The formulas are DATA, not code: a versioned "formula set" (see defaultFormulaStore) says, per quotation format,
   which cost sections and columns exist, how each row is calculated, which % adjustments apply, how profit & admin
   and spare part cost are based, how amounts are rounded, and how the total is built. ROKI edits it on the
   "Calculation formulas" page; every save is a new version with a reason. A quotation keeps the version it was
   issued under (costs.fv), so approved prices never change when formulas change.
   Defaults mirror ROKI's own sheets: Single Part → docs/sample -QT.xls, Assembly → docs/QT-ASSY.pdf. */

const num=v=>Number(v)||0;
const LOCAL_IMPORT=['Local','Import'],ORIGIN3=['Local','Import','Supply'];

/* ---------- safe formula engine (no eval) ----------
   numbers, column names, + - * / ^ ( ), comparisons, min max round abs sqrt if(cond,a,b) */
function parseFormula(src){
  const text=String(src||'');
  if(!text.trim())throw new Error('Formula is empty.');
  const toks=[],re=/\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|==|!=|[-+*/^(),<>]))/y;
  let pos=0;
  while(pos<text.length){
    re.lastIndex=pos;const m=re.exec(text);
    if(!m){if(/^\s*$/.test(text.slice(pos)))break;throw new Error('Formula has an unexpected symbol.')}
    toks.push(m[1]!==undefined?{k:'n',n:Number(m[1])}:m[2]!==undefined?{k:'id',v:m[2]}:{k:'op',v:m[3]});pos=re.lastIndex;
  }
  let i=0;const vars=new Set(),isOp=(t,...ops)=>t&&t.k==='op'&&ops.includes(t.v),peek=()=>toks[i],take=()=>toks[i++];
  const expect=op=>{if(!isOp(peek(),op))throw new Error('Check the brackets in the formula.');take()};
  const bin=(op,a,b)=>({'+':e=>a(e)+b(e),'-':e=>a(e)-b(e),'*':e=>a(e)*b(e),'/':e=>a(e)/b(e),'<':e=>+(a(e)<b(e)),'>':e=>+(a(e)>b(e)),'<=':e=>+(a(e)<=b(e)),'>=':e=>+(a(e)>=b(e)),'==':e=>+(a(e)===b(e)),'!=':e=>+(a(e)!==b(e))}[op]);
  const FN={min:(...a)=>Math.min(...a),max:(...a)=>Math.max(...a),round:(x,n=0)=>{const f=10**n;return Math.round(x*f)/f},abs:Math.abs,sqrt:Math.sqrt};
  function cmp(){let l=add();while(isOp(peek(),'<','>','<=','>=','==','!=')){const op=take().v;l=bin(op,l,add())}return l}
  function add(){let l=mul();while(isOp(peek(),'+','-')){const op=take().v;l=bin(op,l,mul())}return l}
  function mul(){let l=unary();while(isOp(peek(),'*','/')){const op=take().v;l=bin(op,l,unary())}return l}
  function unary(){if(isOp(peek(),'-')){take();const e=unary();return env=>-e(env)}if(isOp(peek(),'+')){take();return unary()}return pow()}
  function pow(){const b=primary();if(isOp(peek(),'^')){take();const e=unary();return env=>Math.pow(b(env),e(env))}return b}
  function primary(){
    const t=take();if(!t)throw new Error('Formula is incomplete.');
    if(t.k==='n')return()=>t.n;
    if(t.k==='id'){
      if(isOp(peek(),'(')){
        take();const args=[];if(!isOp(peek(),')')){args.push(cmp());while(isOp(peek(),',')){take();args.push(cmp())}}expect(')');
        if(t.v==='if'){if(args.length!==3)throw new Error('Formula uses an unknown function.');return env=>args[0](env)?args[1](env):args[2](env)}
        const f=FN[t.v];if(!f||!args.length)throw new Error('Formula uses an unknown function.');
        return env=>f(...args.map(a=>a(env)));
      }
      vars.add(t.v);return env=>num(env[t.v]);
    }
    if(isOp(t,'(')){const e=cmp();expect(')');return e}
    throw new Error('Formula has an unexpected symbol.');
  }
  const fn=cmp();if(i<toks.length)throw new Error('Check the brackets in the formula.');
  return {fn,vars};
}
const EXPR_CACHE=new Map();
function compileExpr(src){
  const key=String(src||'');if(EXPR_CACHE.has(key))return EXPR_CACHE.get(key);
  let r;try{r={...parseFormula(key),error:null}}catch(e){r={fn:()=>NaN,vars:new Set(),error:e.message}}
  EXPR_CACHE.set(key,r);return r;
}

/* ---------- rounding ---------- */
function roundBy(v,mode,d){
  const f=10**d;
  if(mode==='truncate')return Math.floor(v*f+1e-7)/f;
  if(mode==='ceil')return Math.ceil(v*f-1e-7)/f;
  return Math.round(v*f)/f;
}
const r2=v=>Math.round(v*100)/100;

/* ---------- default formula set ----------
   field = [key, label, type('text'|'number'|'origin'), options, {positive, def, req}] */
const fld=(key,label,type,options,flags)=>[key,label,type,options||null,flags||{}];
function defaultFormats(){
  const fmt=(qtyLabel,sections)=>({qtyLabel,sections,profit:{percent:15,base:'process',bases:['process','subtotal'],lock:false},spare:{percent:0,base:'process',lock:false},rounding:{decimals:2,section:'round',profit:'truncate',spare:'truncate',total:'round'},total:'subtotal+profit+spare'});
  const adj=(key,label,percent,extra)=>({key,label,percent,of:'self',lock:false,...extra});
  return {
    'Single Part':fmt('Quantity / year',[
      {key:'material',letter:'A',label:'Material',expr:'(weight+scrap)*rate',
        fields:[fld('code','Material code / spec','text'),fld('name','Material name','text',null,{req:true}),fld('origin','Imp / Loc','origin',LOCAL_IMPORT),fld('weight','Part wt · kg','number'),fld('scrap','Scrap wt · kg','number'),fld('rate','Cost · THB/kg','number')],
        adj:[adj('materialLoss','Material loss',3)]},
      {key:'components',letter:'B',label:'Component parts',expr:'qty*rate',
        fields:[fld('partNo','Part no.','text',null,{req:true}),fld('name','Part name','text',null,{req:true}),fld('origin','Import / Local / Supply','origin',ORIGIN3),fld('qty','Qty','number',null,{def:1}),fld('rate','Price · THB','number')],
        adj:[adj('componentLoss','Component loss',0)]},
      {key:'process',letter:'C',label:'Process',expr:'rate*time/cavity',
        fields:[fld('name','Process','text',null,{req:true}),fld('machine','M/C','text'),fld('cavity','Cavity','number',null,{positive:true,def:1}),fld('time','Time · sec','number'),fld('rate','Charge · THB/sec','number')],adj:[]},
      {key:'packing',letter:'D',label:'Packing & transport',expr:'amount/qty',
        fields:[fld('name','Type','text',null,{req:true}),fld('amount','Cost · THB','number'),fld('qty','Qty · pcs','number',null,{positive:true,def:1})],adj:[]},
      {key:'equipment',letter:'E',label:'Equipment',expr:'amount/volume',
        fields:[fld('name','Dies & jig','text',null,{req:true}),fld('origin','Imp / Loc','origin',LOCAL_IMPORT),fld('cavity','Cavity','number',null,{positive:true,def:1}),fld('amount','Dies & jig cost · THB','number'),fld('volume','Volume · pcs','number',null,{positive:true,def:1})],
        adj:[adj('pm','PM / interest',5,{ofKey:'pmBasis',of:'process',choices:[{value:'process',label:'Process cost (C)',of:'process'},{value:'equipment',label:'Dies & jig total',of:'self'}]})]}
    ]),
    'Assembly':fmt('Monthly quantity',[
      {key:'components',letter:'A',label:'Component parts',expr:'rate*qty',
        fields:[fld('partNo','Part no.','text',null,{req:true}),fld('name','Part name','text',null,{req:true}),fld('origin','Imp / Loc','origin',LOCAL_IMPORT),fld('rate','Unit cost · THB','number'),fld('qty','Qty','number',null,{def:1})],
        adj:[adj('management','Management',0.5)]},
      {key:'material',letter:'B',label:'Material',expr:'(weight+runner)*rate',
        fields:[fld('name','Material','text',null,{req:true}),fld('origin','Imp / Loc','origin',LOCAL_IMPORT),fld('weight','Part wt · kg','number'),fld('runner','Runner wt · kg','number'),fld('rate','THB / kg','number')],
        adj:[adj('loss','Material loss',3)]},
      {key:'process',letter:'C',label:'Process',expr:'rate*time/cavity',
        fields:[fld('name','Process','text',null,{req:true}),fld('machine','M/C','text'),fld('cavity','Cavity','number',null,{positive:true,def:1}),fld('time','CT · sec','number'),fld('rate','Cost/CT · THB/sec','number')],adj:[]},
      {key:'investment',letter:'D',label:'Investment',expr:'amount/volume',
        fields:[fld('name','Mold / die / jig','text',null,{req:true}),fld('origin','Imp / Loc','origin',LOCAL_IMPORT),fld('amount','Total investment · THB','number'),fld('volume','Volume · pcs','number',null,{positive:true,def:1})],adj:[]},
      {key:'packing',letter:'E',label:'Packing & transport',expr:'amount/qty',
        fields:[fld('name','Type','text',null,{req:true}),fld('amount','Cost · THB','number'),fld('qty','Qty · pcs','number',null,{positive:true,def:1})],adj:[]}
    ])
  };
}
const FORMULA_FORMATS=['Single Part','Assembly'];
function defaultFormulaStore(){
  return {current:1,versions:[{version:1,effective:'2026-01-01',by:'System',at:'01 Jan 2026',reason:'Initial formulas taken from ROKI’s quotation sheets.',changes:[],formats:defaultFormats()}]};
}
let FORMULAS=defaultFormulaStore();
const setFormulaStore=s=>{FORMULAS=s&&s.versions&&s.versions.length?s:defaultFormulaStore()};
const currentFormulas=()=>FORMULAS.versions.find(v=>v.version===FORMULAS.current)||FORMULAS.versions.at(-1);
const formulaVersion=n=>FORMULAS.versions.find(v=>v.version===n)||FORMULAS.versions[0];
const fmtCfg=format=>currentFormulas().formats[format||'Single Part'];
const cfgOf=c=>formulaVersion(c.fv||1).formats[c.format||'Single Part'];
const sectionsOf=c=>cfgOf(c).sections;
const isPositive=f=>!!(f[4]&&f[4].positive),isRequired=f=>!!(f[4]&&f[4].req);

/* one row → amount, using the section's formula */
function expenseOf(s,r){
  const env={};for(const f of s.fields)if(f[2]==='number')env[f[0]]=num(r[f[0]]);
  return compileExpr(s.expr).fn(env);
}
const rowExpenseOf=(c,key,r)=>{const s=sectionsOf(c).find(s=>s.key===key);return s?expenseOf(s,r):0};
function blankRow(s){
  const row={};
  for(const f of s.fields)row[f[0]]=f[2]==='number'?((f[4]&&f[4].def)||0):f[2]==='origin'?f[3][0]:'';
  return row;
}
const sectionLabel=s=>`${s.label} (${s.letter})`;
const adjChoice=(c,a)=>a.choices?(a.choices.find(x=>x.value===c[a.ofKey])||a.choices[0]):null;
const lcFirst=s=>s.charAt(0).toLowerCase()+s.slice(1);
function profitBase(c,cfg=cfgOf(c)){const sec=cfg.sections.find(s=>s.key===c.basis);return c.basis==='subtotal'||!sec?{key:'subtotal',label:'Subtotal',short:'subtotal'}:{key:sec.key,label:sectionLabel(sec),short:sec.letter}}
function spareBase(c,cfg=cfgOf(c)){const sec=cfg.sections.find(s=>s.key===cfg.spare.base)||cfg.sections.find(s=>s.key==='process')||cfg.sections[0];return {key:sec.key,label:sectionLabel(sec),short:sec.letter}}
const priceBaseOptions=c=>{const cfg=cfgOf(c);return cfg.profit.bases.map(k=>k==='subtotal'?{value:'subtotal',label:'Subtotal'}:{value:k,label:sectionLabel(cfg.sections.find(s=>s.key===k)||{label:k,letter:'?'})})};

/* new empty costs for a format, bound to the current formula version */
function blankCosts(format){
  const cfg=fmtCfg(format),c={format,fv:currentFormulas().version,profit:cfg.profit.percent,basis:cfg.profit.base,spare:cfg.spare.percent};
  for(const s of cfg.sections){
    c[s.key]=(s.letter==='A'||s.key==='process')?[blankRow(s)]:[];
    for(const a of s.adj||[]){c[a.key]=a.percent;if(a.ofKey)c[a.ofKey]=a.of}
  }
  return c;
}
/* costs entered under an older formula version, carried over to the current one:
   rows keep the values of columns that still exist; locked percentages follow the formula set */
function adaptCosts(old,format){
  const out=blankCosts(format),cfg=fmtCfg(format);
  for(const s of cfg.sections){
    if(Array.isArray(old[s.key]))out[s.key]=old[s.key].map(r=>{const n=blankRow(s);for(const f of s.fields)if(r[f[0]]!==undefined&&r[f[0]]!==null)n[f[0]]=r[f[0]];return n});
    for(const a of s.adj||[]){
      if(!a.lock&&old[a.key]!==undefined)out[a.key]=old[a.key];
      if(a.ofKey&&old[a.ofKey]!==undefined&&a.choices.some(x=>x.value===old[a.ofKey]))out[a.ofKey]=old[a.ofKey];
    }
  }
  if(!cfg.profit.lock){if(old.profit!==undefined)out.profit=old.profit;if(cfg.profit.bases.includes(old.basis))out.basis=old.basis}
  if(!cfg.spare.lock&&old.spare!==undefined)out.spare=old.spare;
  return out;
}
/* kept for older callers */
const seedCosts=format=>blankCosts(format);

function totals(c,cfgOverride){
  const cfg=cfgOverride||cfgOf(c),secs=cfg.sections,rd=cfg.rounding,d=rd.decimals,base={},out={sections:{}};
  for(const s of secs)base[s.key]=(c[s.key]||[]).reduce((t,r)=>t+expenseOf(s,r),0);
  for(const s of secs){
    let extra=0;
    for(const a of s.adj||[]){
      const target=a.choices?adjChoice(c,a).of:a.of;
      const of=target==='self'?base[s.key]:(base[target]??0);
      extra+=of*num(c[a.key])/100;
    }
    const value=roundBy(base[s.key]+extra,rd.section,d);
    out.sections[s.key]={base:base[s.key],extra,value};out[s.letter]=value;
  }
  out.subtotal=roundBy(secs.reduce((t,s)=>t+out[s.letter],0),rd.section,d);
  const pb=profitBase(c,cfg),valueOf=key=>key==='subtotal'?out.subtotal:out.sections[key].value;
  out.profit=roundBy(valueOf(pb.key)*num(c.profit)/100,rd.profit,d);
  out.spare=roundBy(valueOf(spareBase(c,cfg).key)*num(c.spare)/100,rd.spare,d);
  const env={subtotal:out.subtotal,profit:out.profit,spare:out.spare};
  for(const s of secs){env[s.letter]=out[s.letter];env[s.key]=out[s.letter]}
  out.total=roundBy(compileExpr(cfg.total).fn(env),rd.total,d);
  return out;
}

const pctOk=v=>Number.isFinite(v)&&v>=0&&v<=100;
function validateCosts(c){
  for(const s of sectionsOf(c))for(const row of c[s.key]||[]){
    for(const f of s.fields){
      if(f[2]==='number'){const v=row[f[0]];if(typeof v!=='number'||!Number.isFinite(v)||v<0||(isPositive(f)&&v===0))return 'Enter valid costs and positive quantities, cavity counts and volumes ('+s.letter+' · '+s.label+').'}
      else if(isRequired(f)&&!String(row[f[0]]??'').trim())return 'Complete the name or part number in each '+s.label.toLowerCase()+' row.';
    }
    if(!Number.isFinite(expenseOf(s,row)))return 'A formula result is not a valid number. Check the values in '+s.label.toLowerCase()+'.';
  }
  const cfg=cfgOf(c);
  for(const s of cfg.sections)for(const a of s.adj||[])if(!pctOk(c[a.key]))return 'Percentage rates must be between 0 and 100.';
  for(const key of ['profit','spare'])if(!pctOk(c[key]))return 'Percentage rates must be between 0 and 100.';
  const t=totals(c);if(!Number.isFinite(t.total)||t.total<=0)return 'The calculated unit price must be greater than zero.';
  return '';
}

/* ---------- checking a formula set before it is saved ---------- */
function validateFormatConfig(cfg){
  const errors=[],keys=new Set(),adjKeys=new Set();
  const rd=cfg.rounding;
  if(!Number.isInteger(rd.decimals)||rd.decimals<0||rd.decimals>4)errors.push('Decimals must be between 0 and 4.');
  for(const k of ['section','profit','spare','total'])if(!['round','truncate','ceil'].includes(rd[k]))errors.push('Choose a rounding rule for every amount.');
  for(const s of cfg.sections){
    const label=s.letter+' · '+(s.label||'?');
    if(!String(s.label||'').trim())errors.push('Each section needs a label.');
    if(keys.has(s.key))errors.push(label+': section keys must be unique.');keys.add(s.key);
    const fkeys=new Set(),numeric=new Set();
    for(const f of s.fields){
      if(!/^[a-z][A-Za-z0-9]*$/.test(f[0]))errors.push(label+': column keys must start with a lowercase letter and use only letters and digits.');
      if(fkeys.has(f[0]))errors.push(label+': column keys must be unique.');fkeys.add(f[0]);
      if(!String(f[1]||'').trim())errors.push(label+': each column needs a label.');
      if(f[2]==='number')numeric.add(f[0]);
    }
    if(!numeric.size)errors.push(label+': add at least one number column.');
    const ex=compileExpr(s.expr);
    if(ex.error)errors.push(label+': '+ex.error);
    else{
      for(const v of ex.vars)if(!numeric.has(v))errors.push(label+': the formula uses “'+v+'”, which is not one of its number columns.');
      const env={};numeric.forEach(k=>{env[k]=1});
      if(!Number.isFinite(ex.fn(env)))errors.push(label+': the formula gives an invalid result with sample values.');
    }
    for(const a of s.adj||[]){
      if(!String(a.label||'').trim())errors.push(label+': each adjustment needs a label.');
      if(adjKeys.has(a.key)||fkeys.has(a.key))errors.push(label+': adjustment keys must be unique.');adjKeys.add(a.key);
      if(!pctOk(Number(a.percent)))errors.push('Percentages must be between 0 and 100.');
    }
  }
  const secKeys=cfg.sections.map(s=>s.key);
  if(!pctOk(Number(cfg.profit.percent))||!pctOk(Number(cfg.spare.percent)))errors.push('Percentages must be between 0 and 100.');
  if(!cfg.profit.bases.length||!cfg.profit.bases.includes(cfg.profit.base)||cfg.profit.bases.some(b=>b!=='subtotal'&&!secKeys.includes(b)))errors.push('Choose what profit & admin is based on.');
  if(!secKeys.includes(cfg.spare.base))errors.push('Choose what spare part cost is based on.');
  const tx=compileExpr(cfg.total);
  if(tx.error)errors.push('Total formula: '+tx.error);
  else{
    const allowed=new Set(['subtotal','profit','spare',...cfg.sections.map(s=>s.letter),...secKeys]);
    for(const v of tx.vars)if(!allowed.has(v))errors.push('Total formula: “'+v+'” is not available. Use subtotal, profit, spare or a section letter.');
    const env={};allowed.forEach(k=>{env[k]=1});if(!Number.isFinite(tx.fn(env)))errors.push('Total formula: the formula gives an invalid result with sample values.');
  }
  return [...new Set(errors)];
}
/* the same costs, calculated as a new quotation would be under another formula set (used for the live check) */
function costsUnder(c,cfg){
  const out={...c};
  for(const s of cfg.sections){
    if(!out[s.key])out[s.key]=[];
    for(const a of s.adj||[]){
      if(a.lock||out[a.key]===undefined)out[a.key]=a.percent;
      if(a.ofKey&&(a.lock||out[a.ofKey]===undefined||!a.choices.some(x=>x.value===out[a.ofKey])))out[a.ofKey]=a.of;
    }
  }
  if(cfg.profit.lock)out.profit=cfg.profit.percent;
  if(cfg.profit.lock||!cfg.profit.bases.includes(out.basis))out.basis=cfg.profit.base;
  if(cfg.spare.lock)out.spare=cfg.spare.percent;
  return out;
}
/* what changed between two versions of one format, for the history list */
function diffFormat(format,a,b){
  const out=[],j=JSON.stringify;
  for(const s of b.sections){
    const o=a.sections.find(x=>x.key===s.key),where=s.letter+' · '+s.label;
    if(!o){out.push([format,where,'Section added']);continue}
    if(o.label!==s.label)out.push([format,where,'Label changed']);
    if(o.expr!==s.expr)out.push([format,where,'Formula changed']);
    if(j(o.fields)!==j(s.fields))out.push([format,where,'Columns changed']);
    if(j(o.adj)!==j(s.adj))out.push([format,where,'Adjustments changed']);
  }
  if(j(a.profit)!==j(b.profit))out.push([format,'Profit & admin','Settings changed']);
  if(j(a.spare)!==j(b.spare))out.push([format,'Spare part cost','Settings changed']);
  if(j(a.rounding)!==j(b.rounding))out.push([format,'Rounding','Settings changed']);
  if(a.total!==b.total)out.push([format,'Total formula','Formula changed']);
  return out;
}

/* Workflow stages, used for the approval trail and the signature boxes of the printed form. */
const STAGES=[['S-Issue','Supplier issued for approval','Issued by'],['S-Approve','Supplier approved and submitted to ROKI','Approved by'],['R-Issue','ROKI Issue completed · e-sign','Issued by'],['R-Check','ROKI Check completed · e-sign','Checked by'],['R-Approve','ROKI Approve completed · e-sign','Approved by']];
function signatures(q){
  const trail=q.trail||[];let start=-1;
  trail.forEach((t,i)=>{if(t.stage==='S-Issue')start=i});
  const sig={};
  trail.slice(Math.max(start,0)).forEach(t=>{if(t.stage)sig[t.stage]=t;if(t.stage==='S-Issue')for(const k of Object.keys(sig))if(k!=='S-Issue')delete sig[k]});
  return sig;
}
const snapshotOf=q=>q?{quote:q.id,revision:q.revision,total:q.total,costs:structuredClone(q.costs),effective:q.effective,date:q.quoteDate||q.effective,remark:q.remark,quantity:q.quantity,drawing:q.drawing,itemSnapshot:q.itemSnapshot?structuredClone(q.itemSnapshot):null,attachments:structuredClone(q.attachments||[]),trail:structuredClone(q.trail||[])}:null;

/* ---------- Demo data, transcribed from the sample Excel / PDF quotations in docs/ ---------- */
function seed(){
  const SP=o=>Object.assign(blankCosts('Single Part'),{material:[],components:[],process:[],packing:[],equipment:[],materialLoss:0,componentLoss:0,pm:0,spare:0},o);
  const AS=o=>Object.assign(blankCosts('Assembly'),o);
  const items=[
    {id:'i1',code:'17230-KWN-9000',name:'IJ COVER, AIR/C',supplier:'s1',format:'Single Part',rtp:'S001571-004-01',drawing:'M206-F-26',qty:25000,next:'2026-11-01',cadence:3},
    {id:'i2',code:'17253-KWN-9000',name:'TUBE, AIR CONN',supplier:'s2',format:'Single Part',rtp:'PRC0006-046-E20',drawing:'M206-F-26',qty:25000,next:'2026-11-18',cadence:3},
    {id:'i3',code:'17211-K16-9000-H1',name:'GUARD ELEMENT',supplier:'s3',format:'Single Part',rtp:'LOU0002-034-J21',drawing:'M206-F-26',qty:178474,next:'2026-12-01',cadence:3},
    {id:'i4',code:'17253-KWN-9000',name:'TUBE, AIR CONN',supplier:'s1',format:'Single Part',rtp:'S001571-011-02',drawing:'M206-F-26',qty:25000,next:'2026-11-15',cadence:3},
    {id:'i5',code:'17221-K1Z-J100',name:'CASE ASSY, AIR/C',supplier:'s1',format:'Assembly',rtp:'S001571-020-01',drawing:'04',qty:2400,next:'2026-11-18',cadence:1},
    {id:'i6',code:'13280-0226',name:'HOLDER',supplier:'s1',format:'Single Part',rtp:'S005109-004-01',drawing:'—',qty:12000,next:'2027-01-01',cadence:3},
    {id:'i7',code:'17211-KZL-9300-21',name:'PLATE',supplier:'s3',format:'Single Part',rtp:'LOU0002-035-J21',drawing:'M206-F-26',qty:250000,next:'2026-11-10',cadence:3},
    {id:'i8',code:'17211-K16-9022',name:'MESH',supplier:'s3',format:'Single Part',rtp:'LOU0002-036-J21',drawing:'M206-F-26',qty:250000,next:'2027-02-01',cadence:3},
    /* a second source with no quotation yet and not on the schedule: shows how a new pair is added */
    {id:'i9',code:'17211-K16-9022',name:'MESH',supplier:'s1',format:'Single Part',rtp:'S001571-036-04',drawing:'M206-F-26',qty:250000,next:null,cadence:3}
  ];
  /* sub-parts: GUARD ELEMENT is made of PLATE and MESH, which are managed parts; CASE ASSY uses purchased components */
  items.find(i=>i.id==='i3').children=[{code:'17211-KZL-9300-21',qty:1},{code:'17211-K16-9022',qty:1}];
  items.find(i=>i.id==='i5').children=[{code:'17222-K1Z-J000',qty:1},{code:'17210-K1Z-J010',qty:1}];
  items.forEach(i=>{i.children=i.children||[]});
  const item=id=>items.find(i=>i.id===id);
  const injection=(rate,time=350)=>[{name:'Injection',machine:'450T',cavity:2,time,rate},{name:'Inspection',machine:'',cavity:1,time:10,rate:.01},{name:'Checking',machine:'',cavity:1,time:10,rate:.015},{name:'Finishing',machine:'',cavity:1,time:15,rate:.015}];
  const ijCover=rate=>SP({material:[{code:'EKC0006-016-D10',name:'TTR-50',origin:'Local',weight:.135,scrap:.013,rate}],materialLoss:3,
    components:[{partNo:'17213-KWN-9001',name:'SEAL, DUCT COVER',origin:'Local',qty:1,rate:2.1}],componentLoss:3,
    process:[...injection(.194),{name:'Assy',machine:'',cavity:1,time:10,rate:.01}],
    packing:[{name:'Rack',amount:100000,qty:250000},{name:'Foam sheet',amount:.5,qty:1}],
    equipment:[{name:'Injection mold',origin:'Local',cavity:4,amount:1000000,volume:250000}],pm:5,pmBasis:'process',spare:15});
  const tube=(rate,time,code='1725Z-GHA-6301')=>SP({material:[{code,name:'NBR/PVC HS70±8',origin:'Local',weight:.135,scrap:.013,rate}],materialLoss:3,
    process:injection(.194,time),
    packing:[{name:'Rack',amount:100000,qty:250000},{name:'Foam sheet',amount:.5,qty:1},{name:'Transport',amount:1.5,qty:1}],
    equipment:[{name:'Injection mold',origin:'Local',cavity:4,amount:1000000,volume:250000}],pm:5,pmBasis:'equipment',spare:15});
  const guard=(plate,mesh,time,pack)=>SP({components:[{partNo:'17211-KZL-9300-21',name:'PLATE',origin:'Local',qty:1,rate:plate},{partNo:'17211-K16-9022',name:'MESH',origin:'Local',qty:1,rate:mesh}],
    process:[{name:'Spot welding & assy',machine:'SPOT 35 KVA',cavity:1,time,rate:.1}],packing:[pack],basis:'subtotal'});
  const holder=rate=>SP({material:[{code:'TTR-50',name:'TTR-50',origin:'Local',weight:.01105,scrap:0,rate}],materialLoss:.5,
    process:[{name:'Injection',machine:'100 TON',cavity:1,time:22.5,rate:.081},{name:'Finish',machine:'',cavity:1,time:10,rate:.01},{name:'Check',machine:'',cavity:1,time:10,rate:.01}],
    packing:[{name:'Plastic box (ROKI)',amount:0,qty:1},{name:'Partition',amount:.12,qty:1},{name:'Transport',amount:.07,qty:1}],pm:5,pmBasis:'process'});
  const plate=rate=>SP({material:[{code:'SGCC',name:'SGCC 0.4 × 120 × 180',origin:'Local',weight:.068,scrap:0,rate}],
    process:[{name:'Progressive',machine:'110 TONS',cavity:1,time:5,rate:.12}],packing:[{name:'Box',amount:8000,qty:100000}],
    equipment:[{name:'Die progressive',origin:'Local',cavity:1,amount:32500,volume:250000}]});
  const mesh=()=>SP({material:[{code:'MESH-16',name:'16 MESH wire dia 0.35, 80 × 152',origin:'Import',weight:.0066,scrap:0,rate:320}],
    process:[{name:'Blank',machine:'60 TONS',cavity:1,time:8,rate:.15}],packing:[{name:'Box',amount:8000,qty:100000}],
    equipment:[{name:'Die blank',origin:'Local',cavity:1,amount:132500,volume:250000}]});
  const caseAssy=(housing,element,resin)=>AS({components:[{partNo:'17222-K1Z-J000',name:'CASE, AIR/C',origin:'Local',rate:housing,qty:1},{partNo:'17210-K1Z-J010',name:'ELEMENT COMP, AIR/C',origin:'Import',rate:element,qty:1}],
    material:[{name:'PP resin',origin:'Local',weight:.2,runner:.02,rate:resin}],process:[{name:'Assembly',machine:'Line 01',cavity:1,time:40,rate:.2}],
    investment:[{name:'Assembly jig',origin:'Local',amount:12000,volume:12000}],packing:[{name:'Returnable tray',amount:10,qty:20}]});

  const su=s=>users.filter(u=>u.supplier===s),ru=r=>users.find(u=>u.portal==='roki'&&u.role===r);
  const at=(day,i)=>`${date(day)}, ${String(9+i).padStart(2,'0')}:${['10','40','05','30','15'][i]} ICT`;
  const trail=(supplier,day,n)=>{const s=su(supplier),who=[s.find(u=>u.role==='Issue'),s.find(u=>u.role==='Approve'),ru('Issue'),ru('Check'),ru('Approve')];return STAGES.slice(0,n).map(([stage,action],i)=>({stage,action,user:who[i].name,at:at(day,i)}))};
  const quotes=[];
  const add=(id,itemId,costs,o)=>{const it=item(itemId),t=totals(costs),baseline=o.baseline?snapshotOf(quotes.find(q=>q.id===o.baseline)):null;
    const q={id,item:itemId,supplier:it.supplier,format:it.format,revision:o.revision||0,status:o.status||'Approved',previous:baseline?baseline.total:t.total,costs,total:t.total,quantity:it.qty,drawing:it.drawing,effective:o.effective,quoteDate:o.date,remark:o.remark,attachments:[],
      trail:o.trail||trail(it.supplier,o.date,5),versions:[],requestedBy:null,baseline};
    quotes.push(q);return q};

  add('Q-2026-0011','i1',ijCover(56),{date:'2026-01-15',effective:'2026-02-01',remark:'Original quotation for model M206-F-26.'});
  add('Q-2026-0101','i1',ijCover(60),{revision:1,status:'ROKI Check',baseline:'Q-2026-0011',date:'2026-11-10',effective:'2027-01-01',remark:'Material TTR-50 price increased from 56 to 60 THB/kg (resin supplier notice). All other costs unchanged.',trail:trail('s1','2026-11-10',3)});
  add('Q-2026-0012','i2',tube(56,350),{date:'2026-01-15',effective:'2026-02-01',remark:'Original quotation for model M206-F-26.'});
  add('Q-2026-0102','i2',tube(58,330),{revision:1,status:'Supplier approval',baseline:'Q-2026-0012',date:'2026-11-17',effective:'2027-01-01',remark:'Compound NBR/PVC up 56 → 58 THB/kg. Injection cycle improved from 350 to 330 sec, partly offsetting the material increase.',trail:trail('s2','2026-11-17',1)});
  add('Q-2023-0003','i3',guard(4.33,4.20,25,{name:'Box + transport',amount:1,qty:1}),{date:'2023-09-16',effective:'2023-10-01',remark:'Original quotation.'});
  add('Q-2025-0041','i3',guard(4.03,4.10,15.5,{name:'Returnable rack',amount:2000,qty:100000}),{revision:1,baseline:'Q-2023-0003',date:'2025-04-28',effective:'2025-05-01',remark:'PLATE and MESH component prices reduced; spot welding time improved from 25 to 15.5 sec; packing changed to returnable rack.'});
  add('Q-2026-0014','i4',tube(54,350,'1725Z-GHA-6302'),{date:'2026-02-10',effective:'2026-03-01',remark:'Second source for TUBE, AIR CONN.'});
  add('Q-2026-0104','i4',tube(57,350,'1725Z-GHA-6302'),{revision:1,status:'ROKI Approve',baseline:'Q-2026-0014',date:'2026-11-12',effective:'2027-01-01',remark:'Rubber compound price up 54 → 57 THB/kg (quarterly review).',trail:trail('s1','2026-11-12',4)});
  add('Q-2026-0015','i5',caseAssy(17.5,11.8,48),{date:'2026-08-01',effective:'2026-08-18',remark:'Original assembly quotation.'});
  const ret=add('Q-2026-0105','i5',caseAssy(18,12,50),{revision:1,status:'Reverted',baseline:'Q-2026-0015',date:'2026-11-14',effective:'2026-12-18',remark:'Case and element component costs increased; PP resin up to 50 THB/kg.',trail:trail('s1','2026-11-14',3)});
  ret.trail.push({action:'Returned to supplier issuer for correction',user:ru('Check').name,at:at('2026-11-18',0),reason:'Please attach the element supplier price notice and confirm the annual production volume before resubmitting.'});
  add('Q-2026-0016','i6',holder(41.54),{date:'2026-04-08',effective:'2026-04-01',remark:'Update material cost for period Apr–Jun 2026. Material scrap included.'});
  add('Q-2026-0046','i6',holder(55.93),{revision:1,baseline:'Q-2026-0016',date:'2026-05-15',effective:'2026-05-01',remark:'Material grade changed from AC440U to TTR-50; material cost updated for May 2026; RTC code changed.'});
  add('Q-2025-0017','i7',plate(46),{date:'2025-04-10',effective:'2025-05-01',remark:'Sub-part quotation for GUARD ELEMENT.'});
  add('Q-2026-0107','i7',plate(49),{revision:1,status:'ROKI Issue',baseline:'Q-2025-0017',date:'2026-11-16',effective:'2027-01-01',remark:'SGCC steel sheet price up 46 → 49 THB/kg.',trail:trail('s3','2026-11-16',2)});
  add('Q-2025-0018','i8',mesh(),{date:'2025-04-10',effective:'2025-05-01',remark:'Sub-part quotation for GUARD ELEMENT.'});

  /* price history: approved quotations, plus earlier records imported from the paper/Excel files */
  const history=[];
  for(const it of items){
    const approved=quotes.filter(q=>q.item===it.id&&q.status==='Approved').sort((a,b)=>a.effective.localeCompare(b.effective));
    const first=approved[0];
    if(!first)continue;
    const y=Number(first.effective.slice(0,4));
    history.push({item:it.id,effective:`${y-1}${first.effective.slice(4)}`,price:r2(first.total*.96),quote:null,reason:'Imported from Excel price record'});
    history.push({item:it.id,effective:`${y-1}-${first.effective.slice(5,7)>'06'?'12':'08'}-01`,price:r2(first.total*.98),quote:null,reason:'Imported from Excel price record'});
    for(const q of approved)history.push({item:it.id,effective:q.effective,price:q.total,quote:q.id,reason:q.remark});
    const last=approved.at(-1);it.price=last.total;it.last=last.quoteDate;
  }
  const emails=[];
  return {version:4,formulas:defaultFormulaStore(),items,quotes,history,emails,
    notifications:[{id:'N-DEMO-001',supplier:'s1',items:['i6'],created:'17 Nov 2026, 08:30 ICT',by:ru('Issue').name,due:'2026-12-01',message:'Please review your current price and submit an updated quotation with a reason for any change.',read:false}],
    audit:[{action:'Demo workspace initialized from ROKI sample quotations',user:'Demo data',at:'18 Nov 2026, 08:00 ICT'}]};
}
