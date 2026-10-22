// Table definitions and calculations. Money uses fixed-point arithmetic; no inferred contract terms.
const field=(id,name,type='text',width=150,options=[],hidden=false)=>({id,name,type,width,options,hidden});
const approvalFields=()=>['施工单位','监理单位','过控单位','建设单位'].map((name,i)=>field('approval'+i,name,'approval',150));
export const contractKinds=['项下合同（与总包）','对下合同（分包）','对下合同（班组）'];
export const outputKinds=['报业主产值','报总包额度产值','报总包项下合同产值','班组报我方产值'];
export function businessColumns(key){
 const notes=field('remarks','备注','text',240),date=field('date','时间','date',140);
 if(key==='receipt')return [field('number','收方单编号'),field('location','收方部位', 'text',180),field('discipline','专业','select',110,['给排水','电气','暖通','消防']),field('description','收方内容','text',260),field('boqCode','清单编码'),field('itemName','项目名称','text',220),field('reported','收方数量','number',120),field('unit','单位','text',85),...approvalFields(),notes,{...date,hidden:true},field('status','状态','select',110,['草稿','待签认','已签认'],true)];
 if(key==='change')return [field('number','变更编号'),field('location','变更部位','text',180),field('description','变更内容','text',260),field('reported','签证金额','number'),...approvalFields(),notes,field('verified','审定金额','number',150,[],true),{...date,hidden:true},field('status','状态','select',120,['草稿','已报送','已审定'],true)];
 if(key==='contract')return [field('category','合同类别','select',210,contractKinds),field('number','合同编号'),field('title','合同名称','text',220),field('party','合同对方','text',200),field('description','承包范围','text',260),field('reported','合同金额','number'),date,field('verified','已付款','number'),notes];
 if(key==='output')return [field('category','产值口径','select',210,outputKinds),field('party','往来单位 / 班组','text',180),field('contractRef','合同编号'),date,field('period','第几期','text',100),field('cycle','申报类型','select',110,['月度','节点']),field('basis','金额口径','select',110,['当期','累计']),field('reported','报送金额','number'),field('verified','审定金额','number'),field('paymentRate','付款比例 %','number',130),field('payable','应收 / 应付金额','computed',160),field('received','已收 / 已付金额','number',160,[],true),field('outstanding','未收 / 未付金额','computed',160,[],true),notes];
 if(key==='materials')return [field('title','材料名称','text',200),field('specification','规格型号','text',220),field('brand','品牌'),field('unit','单位','text',85),field('price','单价','number',120),field('taxBasis','含税口径','select',120,['含税','不含税','待确认']),field('taxRate','税率 %','number',100),field('supplier','供应商','text',180),{...date,name:'价格日期'},field('location','地区 / 项目','text',180),field('source','价格来源 / 链接','text',260),notes];
 return [];
}
export function migrateBusiness(data){
 for(const p of data.projects){p.finance??={};p.ledgers??={};if(p.businessVersion>=2){if(p.businessVersion===2){for(const c of p.ledgers.output?.columns||[])if(['received','outstanding'].includes(c.id))c.hidden=true;p.businessVersion=3;}continue;}
  for(const key of ['receipt','change','output','contract']){
   const b=key==='receipt'?p:(p.ledgers[key]??={columns:[],rows:[],views:[]});
   const defaults=businessColumns(key),ids=new Set(defaults.map(c=>c.id));
   b.columns=[...defaults.map(c=>({...c,width:b.columns.find(x=>x.id===c.id)?.width||c.width})),...b.columns.filter(c=>!ids.has(c.id)).map(c=>({...c,hidden:['title','date','building','floor','verified','reason','status','unit','kind'].includes(c.id)?true:(c.hidden??false)}))];
   for(const r of b.rows){if(['receipt','change'].includes(key)&&!r.cells.description&&r.cells.title)r.cells.description=r.cells.title;if(!r.cells.location&&(r.cells.building||r.cells.floor))r.cells.location=[r.cells.building,r.cells.floor].filter(Boolean).join(' / ');if(!r.cells.remarks&&r.notes)r.cells.remarks=r.notes;}
  }p.businessVersion=3;
 }
 data.materials??={columns:businessColumns('materials'),rows:[],views:[]};return data;
}
const SCALE=100000000n;
const number=s=>typeof s==='string'&&/^-?\d+(\.\d{1,8})?$/.test(s)?BigInt(s.replace('-','').split('.')[0])*SCALE*(s.startsWith('-')?-1n:1n)+BigInt((s.replace('-','').split('.')[1]||'').padEnd(8,'0'))*(s.startsWith('-')?-1n:1n):null;
const fixed=(n,scale=SCALE)=>{const cents=(n<0n?-((-n*100n+scale/2n)/scale):((n*100n+scale/2n)/scale));return `${cents<0n?'-':''}${(cents<0n?-cents:cents)/100n}.${((cents<0n?-cents:cents)%100n).toString().padStart(2,'0')}`;};
export function rateAmount(amount,rate){const a=number(amount),r=number(rate);return a===null||r===null||r<0n||r>100n*SCALE?'':fixed(a*r,SCALE*SCALE*100n);}
export function subtractMoney(a,b){const x=number(a),y=number(b);return x===null||y===null?'':fixed(x-y);}
export function outputAmounts(c){const payable=rateAmount(c.verified,c.paymentRate);return {payable,outstanding:c.received===''||c.received===undefined?'':subtractMoney(payable,c.received)};}
export function cellValue(row,col,key){if(key==='output'&&['payable','outstanding'].includes(col.id))return outputAmounts(row.cells)[col.id];return col.id==='remarks'?(row.cells.remarks??row.notes??''):row.cells[col.id]||'';}
export function setLedgerCell(row,id,value){const previous=row.cells[id]||'';row.cells[id]=value;if(id==='remarks'&&(!row.notes||row.notes===previous))row.notes=value;}
export function sumMoney(rows,id){let total=0n,has=false;for(const row of rows){const n=number(row.cells[id]||'');if(n!==null){total+=n;has=true;}}return has?fixed(total):'';}
export function projectAmounts(p){const f=p.finance||{},changes=[...(p.ledgers?.change?.rows||[]),...(p.businessWorksheets||[]).filter(s=>s.kind==='change').flatMap(s=>s.rows)],contractTotal=sumMoney([...(p.ledgers?.contract?.rows||[]),...(p.businessWorksheets||[]).filter(s=>s.kind==='contract').flatMap(s=>s.rows)].filter(r=>r.cells.category===contractKinds[0]),'reported'),basis=f.base==='final'?(f.audit3||f.audit2||f.audit1||''):f.base==='contract'?(f.contract||''):f[f.base||'cleared']||'';
 const changeTotal=sumMoney(changes,f.changeBasis==='verified'?'verified':'reported');
 const effective=f.includeChanges==='yes'?(number(basis)!==null?fixed(number(basis)+(number(changeTotal)||0n)):''):basis;
 const owner=number(f.ownerDiscount),ours=number(f.ourDiscount);
 const gc=owner===null?'':discountAmount(effective,f.ownerDiscount),our=ours===null?'':discountAmount(gc,f.ourDiscount);
 return {basis,effective,changeTotal,contractTotal,gc,our};
}
// Excel clipboard dialect: quoted cells may contain tabs, newlines or doubled quotes.
export function parseTSV(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'&&(quoted||cell==='')){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(ch==='\t'||ch==='\n'||ch==='\r')){row.push(cell);cell='';if(ch!=='\t'){rows.push(row);row=[];if(ch==='\r'&&text[i+1]==='\n')i++;}}else cell+=ch;}if(quoted)throw Error('粘贴内容引号不完整');if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
export const toTSV=matrix=>matrix.map(row=>row.map(v=>/[\t\n\r"]/.test(String(v))?'"'+String(v).replaceAll('"','""')+'"':String(v)).join('\t')).join('\r\n');
export function approvalValue(text){const v=String(text).trim();if(!v||['无','未签未章','未签字未盖章'].includes(v))return '';if(v==='签字'||v==='已签字')return '签字';if(v==='盖章'||v==='已盖章')return '盖章';if(['签字+盖章','签字,盖章','签字、盖章','已签字已盖章'].includes(v))return '签字+盖章';throw Error('签章填写：签字、盖章、签字+盖章，或留空');}
export function pasteCells(book,visibleRows,visibleCols,rowId,columnId,matrix,kind,defaults={}){
 if(!matrix.length)return;const start=visibleRows.findIndex(r=>r.id===rowId),colStart=visibleCols.findIndex(c=>c.id===columnId);if(start<0||colStart<0)throw Error('请先选择粘贴起点');
 if(matrix.some(row=>row.length>visibleCols.length-colStart))throw Error('粘贴列数超出当前可见字段，请展开字段后重试');
 if(book.rows.length+matrix.length>20000)throw Error('单表最多 20000 行');
 matrix.forEach((cells,i)=>{let target=visibleRows[start+i]?book.rows.find(r=>r.id===visibleRows[start+i].id):null;if(!target){target={id:crypto.randomUUID(),cells:{...defaults},files:[],notes:''};book.rows.push(target);}cells.forEach((value,j)=>{const c=visibleCols[colStart+j];if(c.type==='computed')return;let v=String(value);if(c.type==='number')v=v.trim().replaceAll(',','').replaceAll('，','');if(c.type==='date'){const m=v.trim().match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);if(m)v=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;}if(c.type==='approval')v=approvalValue(v);setLedgerCell(target,c.id,v);});});
}

export function discountAmount(amount,rate){const a=number(amount),r=number(rate);return a===null||r===null||r<0n||r>100n*SCALE?'':fixed(a*(100n*SCALE-r),SCALE*SCALE*100n);}

export function multiplyMoney(a,b){const x=number(a),y=number(b);return x===null||y===null?'':fixed(x*y,SCALE*SCALE);}

export function sumQuantity(rows,id){let total=0n,has=false;for(const row of rows){const n=number(row.cells[id]||'');if(n!==null){total+=n;has=true;}}if(!has)return '';const s=(total<0n?-total:total).toString().padStart(9,'0'),fraction=s.slice(-8).replace(/0+$/,'');return (total<0n?'-':'')+s.slice(0,-8)+(fraction?'.'+fraction:'');}

// Only identical content and units are additive; unclassified rows remain visible.
export const receiptGroupKey=(row,mode='content')=>JSON.stringify([String(row.cells.description||'').trim(),String(row.cells.unit||'').trim(),...(mode==='location'?[String(row.cells.location||'').trim()]:[])]);
export const filterReceiptRows=(rows,filters)=>rows.filter(r=>Object.entries(filters).every(([key,value])=>value===null||value===undefined||String(r.cells[key]||'').trim()===value));
export function receiptQuantityGroups(rows,mode='content'){
 const groups=new Map();
 for(const row of rows){if(!Object.values(row.cells).some(v=>String(v??'').trim()))continue;const key=receiptGroupKey(row,mode);if(!groups.has(key)){const [content,unit,location]=JSON.parse(key);groups.set(key,{key,content,unit,location,rows:[]});}groups.get(key).rows.push(row);}
 return [...groups.values()].map(g=>{const valid=g.rows.filter(r=>number(String(r.cells.reported??''))!==null);return {...g,total:g.content&&g.unit?sumQuantity(valid,'reported'):'',missing:g.rows.length-valid.length};});
}
