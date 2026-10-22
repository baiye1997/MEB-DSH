import {parseTSV} from './business.js';
import {defaults,calculate,specs} from './calculations.js';
import {customSummary} from './custom-calculation.js';
export const formulaVersion='2026-09-21.1';
export function emptySheet(kind){return {params:kind==='support'?{beam:'600',gap:'100',spacing:'2',rodWeight:'0.617'}:{base:'',current:'',threshold:'3',density:'0.0089'},rows:[]};}
export function newCalculationRow(){return {id:crypto.randomUUID(),name:'',specification:'',length:'',overrides:{}};}
// Validate the full rectangle before changing any existing row.
export function pasteCalculationRows(sheet,rowId,key,text,kind){
 const keys=['name','specification','length',...(['cable','bus'].includes(kind)?['base','current']:[])],start=keys.indexOf(key),index=sheet.rows.findIndex(row=>row.id===rowId),matrix=parseTSV(text);
 if(start<0||index<0)throw Error('粘贴位置已变化，请重新选择单元格');
 if(!matrix.length)throw Error('剪贴板没有可写入的内容');
 if(matrix.some(row=>row.length>keys.length-start))throw Error(`从当前列最多可粘贴 ${keys.length-start} 列，请只复制当前表格可编辑的数据列`);
 const next=structuredClone(sheet);
 for(const [i,cells] of matrix.entries()){
  const row=next.rows[index+i]||(next.rows[index+i]=newCalculationRow());
  for(const [j,value] of cells.entries()){const field=keys[start+j],clean=['length','base','current'].includes(field)?value.trim().replace(/[，,]/g,''):value.trim();if(['base','current'].includes(field))row.overrides[field]=clean;else{row[field]=clean;if(field==='length')delete row.overrides.length;}}
 }
 return {sheet:next,count:matrix.length};
}
// Parse geometry independently so recognition also works before prices/length are entered.
export function parseCableSpecification(raw){
 const text=raw.normalize('NFKC').replace(/[×＊*]/g,'x').replace(/\s/g,'');
 const match=text.match(/(\d+x\d+(?:\.\d+)?(?:\+\d+x\d+(?:\.\d+)?)*)(?:mm2)?(?:[-,，]?(?:\d+(?:\.\d+)?\/)?\d+(?:\.\d+)?kV)?$/i);
 if(!match)throw Error('未识别芯数与截面积，请填写如 WDZ-BYJ-3*2.5，或自定义');
 const prefix=text.slice(0,match.index);
 if(/[+0-9x.]/i.test(prefix.slice(-1))||/\d+x\d/i.test(prefix))throw Error('规格无法完整解析，请核对或自定义');
 const groups=match[1].split('+').map(part=>{const [count,area]=part.split(/x/i).map(Number);return {count,area};});
 if(groups.length>3)throw Error('规格无法完整解析：最多支持三组芯线，请核对或自定义');
 if(groups.some(g=>!Number.isSafeInteger(g.count)||g.count<=0||!Number.isFinite(g.area)||g.area<=0))throw Error('芯数须为正整数，截面积须大于零');
 return {groups,cores:groups.reduce((n,g)=>n+g.count,0),area:groups.reduce((n,g)=>n+g.count*g.area,0)};
}
export function calculationInputs(kind,sheet,row){
 const input={...defaults(kind),...sheet.params,length:row.length};let mode=kind==='support'?'frame':kind==='bus'?'section':'',parseError='';
 const spec=row.specification.trim().replace(/[×＊*]/g,'x').replace(/\s/g,'');
 if(kind==='cable'){
  let parsed;
  try{parsed=parseCableSpecification(row.specification);}catch(error){if(!row.overrides.n1)parseError=error.message;}
  for(let i=1;i<=3;i++){input['n'+i]='0';input['a'+i]='0';}
  parsed?.groups.forEach(({count,area},i)=>{input['n'+(i+1)]=String(count);input['a'+(i+1)]=String(area);});
 }else if(kind==='bus'){
  mode=row.overrides.mode||'section';
  if(mode==='direct'){input.unitWeight='';}else{
   const m=spec.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+)\+(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+)$/i);
   if(!m&&!row.overrides.width)parseError='填写 ABCN宽×厚×每极根数 + PE宽×厚×根数，或填写尺寸字段';
   for(const key of ['width','thickness','count','peWidth','peThickness','peCount'])input[key]='';
   if(m)['width','thickness','count','peWidth','peThickness','peCount'].forEach((key,i)=>input[key]=m[i+1]);
  }
 }else{
  const m=spec.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i);
  if(!m&&!row.overrides.width)parseError='填写桥架宽×高，如 150×100，或填写宽高字段';
  input.width=m?m[1]:'';input.height=m?m[2]:'';
  const width=Number(row.overrides.width||input.width);
  mode=row.overrides.mode||(width<=100?'single':'frame');input.rods=mode==='single'?'1':'2';
  input.steelWeight=({100:'1.373',150:'2.422',200:'2.422',300:'3.77'})[width]||'';
 }
 Object.assign(input,Object.fromEntries(Object.entries(row.overrides).filter(([key])=>key!=='mode')));
 return {inputs:input,mode,parseError};
}
export function resolveCalculation(kind,sheet,row){
 const {inputs:input,mode,parseError}=calculationInputs(kind,sheet,row);
 if(parseError)throw Error(parseError);
 const result=calculate(kind,input,mode);
 return {inputs:input,mode,result,signature:JSON.stringify({kind,version:formulaVersion,input,mode,name:row.name,specification:row.specification})};
}
export function calculationFingerprint(kind,sheet,row){return JSON.stringify([kind,sheet.params,row.name,row.specification,row.length,row.overrides]);}
export function snapshotRecord(project,kind,sheet,row,target=project,worksheetId=''){
 const resolved=resolveCalculation(kind,sheet,row),time=new Date().toISOString();
 const source={projectId:project.id,projectName:project.name,targetProjectId:target.id,targetProjectName:target.name,sheetId:kind,...(worksheetId?{worksheetId}:{}),worksheetName:sheet.name||'工作表 1',rowId:row.id,specification:row.specification,formulaVersion,capturedAt:time,inputs:resolved.inputs,mode:resolved.mode,signature:resolved.signature,result:resolved.result.value,unit:resolved.result.unit,formula:specs[kind].formula,workbook:specs[kind].source};
 return {id:crypto.randomUUID(),cells:{title:row.name||row.specification,date:time.slice(0,10),number:row.id.slice(0,8),description:specs[kind].name,reported:resolved.result.value.toFixed(resolved.result.unit==='元'?2:3),specification:row.specification,quantity:kind==='support'?resolved.result.value.toFixed(3):resolved.inputs.length,amount:kind==='support'?'':resolved.result.value.toFixed(2),unit:kind==='support'?'kg':'m',remarks:'',status:'草稿',reason:resolved.result.value<0?'调减计算':''},files:[],notes:`${project.name} / ${specs[kind].name} / 行 ${row.id}\n${specs[kind].source}`,source};
}
export const formatResult=(value,unit)=>value.toLocaleString('zh-CN',{minimumFractionDigits:unit==='元'?2:0,maximumFractionDigits:unit==='元'?2:3});
// Currency totals add displayed cents; calculation inputs and frozen results retain full precision.
export function calculationSummary(rows,unit,resolve){
 if(unit==='元'){
  const summary=customSummary(rows,2,row=>{const value=resolve(row);return value.error?value:{display:formatResult(value.result.value,unit).replaceAll(',','')};});
  const [whole,fraction]=summary.display.split('.');
  return {...summary,display:whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+fraction};
 }
 let sum=0,errors=0;for(const row of rows){const value=resolve(row);if(value.error)errors++;else sum+=value.result.value;}
 return {count:rows.length-errors,errors,display:formatResult(sum,unit)};
}


export function participatingFields(kind,mode){return specs[kind].fields.filter(([id])=>kind!=='bus'||(mode==='direct'?!['width','thickness','count','peWidth','peThickness','peCount','density'].includes(id):id!=='unitWeight'));}
export function parameterSource(kind,sheet,row,id){
 if(Object.hasOwn(row.overrides,id))return '本行填写';
 if(id==='length')return '本行长度';
 if(Object.hasOwn(sheet.params,id))return '本表共用参数';
 if(kind==='support'&&id==='steelWeight')return '原表宽度对应型钢重量';
 if(kind==='support'&&id==='rods')return '支架形式：单杆1根 / 门架2根';
 if(kind==='bus'&&id==='unitWeight')return '待填写厂家确认值';
 return '由本行规格拆分';
}
export function calculationEquations(kind,input,mode){
 const v=Object.fromEntries(Object.entries(input).map(([k,n])=>[k,Number(n)]));
 const r=calculate(kind,input,mode),s=r.steps.map(x=>x[1]);
 const f=n=>Number(n.toFixed(9)).toString();
 if(kind==='support')return [
 ['单吊长度',mode==='single'?`${v.beam} + ${v.gap} − 20`:`${v.beam} + ${v.gap} + ${v.height}`,s[0],'mm'],
 ['横梁 / 吊框长度',mode==='single'?`(${v.width} + ${v.height} + 40) × 2`:`${v.width} + 100`,s[1],'mm'],
 ['普通支架单重',`(${f(s[0])} × ${v.rods} × ${v.rodWeight} + ${f(s[1])} × ${v.steelWeight}) ÷ 1000`,s[2],'kg'],
 ['防晃支架单重',`((${v.beam} ÷ 2 + ${v.gap} + ${v.height}) × 2 + ${v.width} + 100) ÷ 1000 × ${v.steelWeight}`,s[3],'kg'],
 ['普通支架折算数量',`${v.length} ÷ ${v.spacing}`,s[4],'个'],
 ['防晃支架折算数量',`${v.length} ÷ 20`,s[5],'个'],
 ['支吊架总重量',`${f(s[2])} × ${f(s[4])} + ${f(s[3])} × ${f(s[5])}`,r.value,'kg']];
 const direct=kind==='bus'&&mode==='direct',area=direct?null:s[0],weight=s[direct?0:1],tonnes=s[direct?1:2],delta=s[direct?2:3];
 const upper=v.base*(1+v.threshold/100),lower=v.base*(1-v.threshold/100);
 return [
 ...(!direct?[
 ['总铜截面积',kind==='cable'?[1,2,3].map(i=>`${v['n'+i]} × ${v['a'+i]}`).join(' + '):`${v.width} × ${v.thickness} × ${v.count} × 4 + ${v.peWidth} × ${v.peThickness} × ${v.peCount}`,area,'mm²'],
 ['单位铜重',`${f(area)} × ${v.density}`,weight,'kg/m']]:[['单位铜重','采用本行填写的确认铜重',weight,'kg/m']]),
 ['铜消耗量',`${v.length} × ${f(weight)} ÷ 1000`,tonnes,'t'],
 ['不可调上限',`${v.base} × (1 + ${v.threshold}%)`,upper,'元/t'],
 ['不可调下限',`${v.base} × (1 − ${v.threshold}%)`,lower,'元/t'],
 ['可调铜价差',v.current>upper?`${v.current} − ${f(upper)}`:v.current<lower?`${v.current} − ${f(lower)}`:'施工月均铜价位于不可调区间，取 0',delta,'元/t'],
 ['调差金额',`${f(tonnes)} × ${f(delta)}`,r.value,'元']];
}

// Operand names follow the source workbook, including its fixed allowances.
export function equationMeaning(kind,mode,label){
 const meanings={
 '单吊长度':mode==='single'?'结构梁高 + 距梁高度 − 原表修正值 20 mm':'结构梁高 + 距梁高度 + 桥架高',
 '横梁 / 吊框长度':mode==='single'?'(桥架宽 + 桥架高 + 原表余量 40 mm) × 两边':'桥架宽 + 原表横担余量 100 mm',
 '普通支架单重':'(单吊长度 × 吊杆根数 × 吊杆每米重 + 横梁长度 × 型钢每米重) ÷ 1000（毫米换米）',
 '防晃支架单重':'((结构梁高 ÷ 2 + 距梁高度 + 桥架高) × 两边 + 桥架宽 + 原表余量 100 mm) ÷ 1000（毫米换米）× 型钢每米重',
 '普通支架折算数量':'桥架长度 ÷ 普通支架间距',
 '防晃支架折算数量':'桥架长度 ÷ 原表防晃间距 20 m',
 '支吊架总重量':'普通支架单重 × 普通支架数量 + 防晃支架单重 × 防晃支架数量',
 '总铜截面积':kind==='cable'?'第1组芯数 × 第1组单芯面积 + 第2组芯数 × 第2组单芯面积 + 第3组芯数 × 第3组单芯面积':'ABCN排宽 × 排厚 × 每极根数 × 4极 + PE排宽 × 排厚 × 根数',
 '单位铜重':mode==='direct'?'厂家确认的单位铜重（kg/m）':'总铜截面积 × 铜密度系数',
 '铜消耗量':'长度 × 单位铜重 ÷ 1000（千克换吨）',
 '不可调上限':'基准铜价 × (1 + 不可调幅度)',
 '不可调下限':'基准铜价 × (1 − 不可调幅度)',
 '可调铜价差':'施工月均铜价 − 超出的上限或下限；区间内为 0',
 '调差金额':'铜消耗量 × 可调铜价差'
 };return meanings[label]||label;
}
export function equationOperandLabels(kind,mode,label){
 return {
 '单吊长度':['结构梁高','距梁高度',mode==='single'?'原表修正':'桥架高'],
 '横梁 / 吊框长度':mode==='single'?['桥架宽','桥架高','原表余量','两边']:['桥架宽','横担余量'],
 '普通支架单重':['单吊长度','吊杆根数','吊杆每米重','横梁长度','型钢每米重','毫米换米'],
 '防晃支架单重':['结构梁高','取一半','距梁高度','桥架高','两边','桥架宽','原表余量','毫米换米','型钢每米重'],
 '普通支架折算数量':['桥架长度','支架间距'],
 '防晃支架折算数量':['桥架长度','防晃间距'],
 '支吊架总重量':['普通支架单重','普通支架数量','防晃支架单重','防晃支架数量'],
 '总铜截面积':kind==='cable'?['第1组芯数','第1组截面积','第2组芯数','第2组截面积','第3组芯数','第3组截面积']:['ABCN排宽','ABCN排厚','每极根数','ABCN极数','PE排宽','PE排厚','PE根数'],
 '单位铜重':['总铜截面积','铜密度系数'],
 '铜消耗量':['长度','单位铜重','千克换吨'],
 '不可调上限':['基准铜价','基数','不可调幅度'],
 '不可调下限':['基准铜价','基数','不可调幅度'],
 '可调铜价差':['施工月均铜价','不可调边界'],
 '调差金额':['铜消耗量','可调铜价差']
 }[label]||[];
}

// Old sheets remain in place; extra worksheets keep independent defaults, rows and formatting.
export function calculationWorksheets(project,kind){return [{id:'',name:project.calculationSheets?.[kind]?.name||'工作表 1',sheet:project.calculationSheets?.[kind]||emptySheet(kind)},...(project.calculationWorksheets||[]).filter(s=>s.kind===kind).map(sheet=>({id:sheet.id,name:sheet.name,sheet}))];}
export function findCalculationSheet(project,kind,worksheetId=''){return worksheetId?(project.calculationWorksheets||[]).find(s=>s.id===worksheetId&&s.kind===kind):project.calculationSheets?.[kind];}
export function editCalculationSheet(project,kind,worksheetId,fn){
 if(!specs[kind])throw Error('计算工具类型无效');
 let sheet=findCalculationSheet(project,kind,worksheetId);
 if(!sheet){if(worksheetId)throw Error('工作表不存在，请重新选择');project.calculationSheets??={};sheet=project.calculationSheets[kind]=emptySheet(kind);}
 fn(sheet);
}
function worksheetName(project,kind,name,except){
 const clean=name.trim();if(!clean||clean.length>60)throw Error('工作表名称须为 1–60 个字符');
 if(calculationWorksheets(project,kind).some(s=>s.id!==except&&s.name===clean))throw Error('当前工具已有同名工作表');
 return clean;
}
export function createCalculationWorksheet(project,kind,name,sourceId=''){
 if(!specs[kind])throw Error('计算工具类型无效');
 if((project.calculationWorksheets||[]).length>=100)throw Error('每个项目最多新增 100 张工作表');
 const clean=worksheetName(project,kind,name),source=findCalculationSheet(project,kind,sourceId)||emptySheet(kind);
 const sheet={id:crypto.randomUUID(),kind,name:clean,params:{...source.params},rows:[]};
 project.calculationWorksheets??=[];project.calculationWorksheets.push(sheet);return sheet.id;
}
export function renameCalculationWorksheet(project,kind,id,name){const clean=worksheetName(project,kind,name,id);editCalculationSheet(project,kind,id,s=>{s.name=clean;});}
export function applyCalculationParameters(sheet,kind,rowIds,patch){
 const ids=new Set(rowIds),fields=new Map(specs[kind]?.fields.map(([id,label])=>[id,label]));
 if(!ids.size||sheet.rows.filter(r=>ids.has(r.id)).length!==ids.size)throw Error('选中行已变化，请重新选择');
 if(!Object.keys(patch).length)throw Error('请勾选要修改的参数');
 const clean={};
 for(const [id,raw] of Object.entries(patch)){
  if(id==='mode'){if(![...(kind==='bus'?['section','direct']:kind==='support'?['single','frame']:[]),null].includes(raw))throw Error('计算方式无效');clean[id]=raw;continue;}
  if(!fields.has(id)||id==='length'&&raw===null)throw Error('参数无效');
  if(raw===null){clean[id]=null;continue;}
  const value=String(raw).trim().replace(/[，,]/g,''),n=Number(value);
  if(!value||!Number.isFinite(n)||n<0)throw Error('请填写有效的'+fields.get(id));
  if(['n1','n2','n3','count','peCount','rods'].includes(id)&&!Number.isInteger(n))throw Error('芯数 / 根数必须为整数');
  if(['base','spacing','rods','rodWeight','steelWeight'].includes(id)&&n<=0||id==='threshold'&&n>100)throw Error(fields.get(id)+'超出有效范围');
  clean[id]=value;
 }
 const next=structuredClone(sheet);
 for(const row of next.rows){if(!ids.has(row.id))continue;for(const [id,value] of Object.entries(clean)){if(id==='length'){row.length=value;delete row.overrides.length;}else if(value===null)delete row.overrides[id];else row.overrides[id]=value;}}
 return next;
}
