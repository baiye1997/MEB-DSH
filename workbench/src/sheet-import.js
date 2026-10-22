import {decimal,display,normalizeDate,pasteRows,validDate} from './model.js';
import {outputKinds} from './business.js';
const normalize=v=>String(v??'').replace(/[\s（）()·%％]/g,'').replace(/元\/t|元\/吨|元|人民币/g,'').trim();
const aliases={number:['编号'],location:['部位','位置'],description:['签证内容','项目描述','施工内容'],unit:['计量单位'],reported:['工程量','数量'],verified:['审核金额'],title:['名称'],specification:['规格尺寸','规格','规格标准','规格、型号'],price:['材料单价'],date:['日期']};
const coreFields=new Set(['number','title','description','itemName','specification','category','reported','verified','price']);
export const usefulMapping=(mapping,columns)=>mapping.some((index,i)=>index>=0&&coreFields.has(columns[i]?.id));
export function matchColumns(header,columns){return columns.map(c=>{if(c.type==='computed')return -1;const exact=header.map((v,i)=>normalize(v)===normalize(c.name)?i:-1).filter(i=>i>=0);if(exact.length===1)return exact[0];if(exact.length>1)return -1;const alternatives=header.map((v,i)=>((c.id==='reported'&&!/数量|工程量|报送量/.test(c.name))||(c.id==='verified'&&!/金额/.test(c.name))?[]:aliases[c.id]||[]).some(a=>normalize(v)===normalize(a))?i:-1).filter(i=>i>=0);return alternatives.length===1?alternatives[0]:-1;});}
export function importGuess(matrix,columns){let headerRow=0,score=0;matrix.slice(0,30).forEach((row,i)=>{const n=matchColumns(row,columns).filter(x=>x>=0).length;if(n>score){score=n;headerRow=i;}});return {headerRow:score?headerRow:-1,startRow:score?headerRow+1:0,mapping:score?matchColumns(matrix[headerRow],columns):columns.map(()=>-1),skipTotals:true,keepExtra:true};}
export function materialPriceCandidates(matrix,headerRow,startRow){
 if(headerRow<0)return [];
 return (matrix[headerRow]||[]).flatMap((value,column)=>{
  const label=String(value??'').trim();
  if(!/(单价|报价|调价|价格|金额|合价)/.test(label)||/(日期|时间|来源|链接|编号|编码|税率)/.test(label))return [];
  const filled=matrix.slice(startRow,startRow+30).filter(row=>{const value=row[column];return value!==null&&value!==undefined&&String(value).trim()!==''&&decimal(String(value).replace(/[,，]/g,''))!==null;}).length;
  return filled?[{column,label,filled}]:[];
 });
}
const floorHeader=value=>/^(?:[一二三四五六七八九十百\d]+层|首层|屋面层?|地下[一二三四五六七八九十\d]+层|B\d+|\d+F)$/i.test(String(value??'').replace(/\s/g,''));
export function detectFloorMatrix(matrix){
 let best=null;
 matrix.slice(0,30).forEach((row,headerRow)=>{
  const nameColumn=row.findIndex(value=>['清单项','项目名称','工程量名称'].includes(normalize(value)));
  if(nameColumn<0)return;
  const floors=row.map((value,column)=>floorHeader(value)?{column,label:String(value).replace(/\s/g,'').trim()}:null).filter(Boolean);
  if(floors.length<2)return;
  if(!best||floors.length>best.floors.length)best={headerRow,nameColumn,floors,
   referenceColumns:Object.fromEntries(['清单总量','合计','差值'].map(name=>[name,row.findIndex(value=>normalize(value)===name)]))};
 });
 return best;
}
export function floorMatrixImport(matrix,{plan=detectFloorMatrix(matrix),building='',discipline='',source='Excel'}={}){
 if(!plan)throw Error('没有找到“清单项 + 多个楼层”表头；请改用普通逐行导入。');
 if(!building.trim())throw Error('请选择这张工作表对应的楼栋或区域，再展开楼层工程量。');
 const rows=[];let skipped=0,items=0;
 for(let i=plan.headerRow+1;i<matrix.length;i++){
  const sourceRow=matrix[i]||[],name=String(sourceRow[plan.nameColumn]??'').trim();
  if(!name||/^(合计|小计|总计)$/.test(name)){skipped++;continue;}
  let itemHasQuantity=false;
  for(const {column,label} of plan.floors){
   const raw=sourceRow[column];if(raw===null||raw===undefined||String(raw).trim()==='')continue;
   const quantity=String(raw).replace(/[,，]/g,'').trim();
   if(!/^\d+(?:\.\d{1,8})?$/.test(quantity)||!Number.isFinite(Number(quantity)))throw Error(`第 ${i+1} 行「${name}」的 ${label} 数量不是有效的非负数，请核对原表。`);
   if(Number(quantity)===0)continue;
   itemHasQuantity=true;
   const references=Object.entries(plan.referenceColumns).filter(([,index])=>index>=0&&String(sourceRow[index]??'').trim()).map(([key,index])=>`${key}：${sourceRow[index]}`);
   rows.push({id:crypto.randomUUID(),cells:{description:name,location:`${building.trim()} / ${label}`,reported:quantity,status:'草稿',...(discipline?{discipline}:{})},files:[],notes:[`来源：${source} · 第 ${i+1} 行 · ${label}列`,'原表为工程量台账，签认状态未核对；单位待补',...references].join('\n')});
  }
  if(itemHasQuantity)items++;else skipped++;
  if(rows.length>20000)throw Error('展开后超过单表 20000 行，请拆分工作表导入。');
 }
 if(!rows.length)throw Error('楼层列没有可导入的工程量；请核对工作表与表头。');
 return {rows,skipped,items};
}
export function detectReceiptForm(matrix){
 if(!matrix.slice(0,5).some(row=>row.some(value=>normalize(value)==='现场收方单')))return null;
 const field=label=>{
  for(let i=0;i<Math.min(30,matrix.length);i++)for(let j=0;j<(matrix[i]||[]).length;j++){
   if(!normalize(matrix[i][j]).startsWith(label))continue;
   const value=(matrix[i]||[]).slice(j+1).find(value=>String(value??'').trim());
   if(value!==undefined)return {value:String(value).trim(),row:i};
  }
  return null;
 };
 const content=field('工程内容');
 if(!content?.value)return null;
 const project=field('工程名称'),location=field('工程部位'),date=field('日期'),contractor=field('分包单位');
 if(!project&&!location)return null;
 return {content,project,location,date,contractor};
}
export function receiptFormImport(matrix,{plan=detectReceiptForm(matrix),source='Excel'}={}){
 if(!plan)throw Error('没有找到“现场收方单”的工程内容和基本信息；请改用普通逐行映射。');
 const date=normalizeDate(plan.date?.value||'');
 if(date&&!validDate(date))throw Error('收方单日期无效，请先核对原表。');
 if(plan.content.value.length>20000)throw Error('收方单正文超过单条记录上限，请拆分后导入。');
 const notes=[`来源：${source} · 第 ${plan.content.row+1} 行`,'原表签字、盖章及工程量未核验；原文件未自动关联，请在附件库引用原件',plan.project?.value&&`工程名称：${plan.project.value}`,plan.contractor?.value&&`分包单位：${plan.contractor.value}`].filter(Boolean).join('\n');
 return {rows:[{id:crypto.randomUUID(),cells:{description:plan.content.value,location:plan.location?.value||'',date,status:'草稿'},files:[],notes}]};
}
export function detectOutputValuation(matrix){
 const amountHeader=matrix.slice(0,4).flatMap((row,i)=>row.map((value,j)=>normalize(value)==='本期分部分项合价'?{row:i,column:j}:null)).find(Boolean);
 const headerRow=matrix.slice(0,5).findIndex(row=>row.some(value=>normalize(value)==='项目编码')&&row.some(value=>normalize(value)==='项目名称'));
 if(!amountHeader||headerRow<0)return null;
 const header=matrix[headerRow],codeColumn=header.findIndex(value=>normalize(value)==='项目编码');
 const nameColumn=header.findIndex(value=>normalize(value)==='项目名称');
 let count=0,nonzero=0,total=0n,invalid=0;
 const sample=[];
 matrix.slice(headerRow+1).forEach((row,index)=>{
  if(!String(row[codeColumn]??'').trim()||!String(row[nameColumn]??'').trim())return;
  count++;
  const raw=row[amountHeader.column];if(raw===null||raw===undefined||String(raw).trim()==='')return;
  const value=decimal(String(raw));if(value===null){invalid++;return;}
  total+=value;if(value!==0n){nonzero++;if(sample.length<4)sample.push({row:headerRow+index+2,name:String(row[nameColumn]),amount:display(value)});}
 });
 const summaryColumn=amountHeader.column+1;
 const summaries=matrix.slice(headerRow+1).flatMap((row,index)=>{
  const raw=row[summaryColumn];if(raw===null||raw===undefined||String(raw).trim()==='')return [];
  const value=decimal(String(raw));return value===null?[]:[{row:headerRow+index+2,amount:display(value),matches:value===total}];
 });
 const periods=matrix.slice(0,4).flatMap(row=>row.map(v=>String(v??'').trim()).filter(v=>/第[一二三四五六七八九十\d]+期|\d+月/.test(v)));
 return {amountHeader,headerRow,count,nonzero,invalid,amount:display(total),summaries,periods:[...new Set(periods)],sample};
}
export function outputValuationDraft(plan,{source='Excel',category='',period=''}={}){
 if(!plan||!plan.count||plan.invalid||plan.summaries.length!==1||!plan.summaries[0].matches)throw Error('原表分部分项合价未能唯一核对，不能建立来源记录。');
 if(!outputKinds.includes(category))throw Error('请选择这笔记录的产值口径。');
 if(!period.trim()||period.length>100)throw Error('请确认期次，避免与其他期产值混淆。');
 const note=`来源：${source}\n本期分部分项清单行合价（原表缓存值）：${plan.amount} 元；${plan.nonzero} 条非零清单行，与原表单列总额一致。${plan.periods?.length?`原表期次提示：${plan.periods.join('、')}；日期须对照原件核对。`:''}此数不是完整当期报送产值，金额须核对其他费用后填写。原文件未自动关联，请在附件库引用原件。`;
 return {id:crypto.randomUUID(),cells:{category,period:period.trim(),basis:'当期',remarks:'完整产值金额、合同、往来方及日期待核对'},files:[],notes:note};
}
export function mappedImport(matrix,columns,config){
 const {headerRow,startRow,mapping,skipTotals,keepExtra,allowUnpriced=false,source='Excel',kind=''}=config;
 if(kind==='output'&&detectOutputValuation(matrix))throw Error('这是多级产值清单，含清单行和分类小计；不能逐行导入产值台账，以免重复累计。请先核对完整期次金额、合同与往来方。');
 if(!Number.isInteger(startRow)||startRow<0||startRow>matrix.length)throw Error('数据起始行超出范围');
 if(!usefulMapping(mapping,columns))throw Error('尚未匹配业务名称、编号、数量或金额；只有备注等辅助字段不能导入。请核对表头和金额口径。');
 const width=matrix.reduce((n,r)=>Math.max(n,r.length),0);
 if(mapping.some(i=>!Number.isInteger(i)||i< -1||i>=width))throw Error('映射列超出工作表范围');
 if(kind==='materials'&&mapping[columns.findIndex(c=>c.id==='price')]<0&&materialPriceCandidates(matrix,headerRow,startRow).length){
  if(!allowUnpriced)throw Error('原表含金额列但尚未匹配单价。请核对价格口径后手动映射，或明确选择无价导入。');
  if(!keepExtra)throw Error('无价导入须保留未匹配内容，以便追溯原表金额。');
 }
 const used=new Set(mapping.filter(i=>i>=0));const header=matrix[headerRow]||[];let skipped=0;
 const rows=[];
 matrix.slice(startRow).forEach((a,index)=>{
  if(!a.some(v=>String(v??'').trim()))return;
  const first=a.find(v=>String(v??'').trim());
  if(skipTotals&&/^(合计|小计|总计)([（(].*[）)])?$/.test(String(first).trim())){skipped++;return;}
  const values=mapping.map((j,i)=>{let v=j<0?'':a[j]??'';if(v instanceof Date)return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;if(columns[i].type==='number'&&typeof v==='number')return Number.isFinite(v)?String(Number(v.toFixed(8))):String(v);if(columns[i].type==='number')return String(v).replace(/[,，]/g,'').trim();return v;});
  if(!values.some(v=>String(v).trim())){skipped++;return;}
  const [row]=pasteRows([values],columns);
  if(columns.some(c=>c.id==='reported'&&c.name==='收方数量')&&!row.cells.reported&&!row.cells.unit&&!row.cells.location&&!row.cells.number){skipped++;return;}
  if(kind==='receipt')row.cells.status='草稿';
  const extras=keepExtra?a.map((v,i)=>!used.has(i)&&String(v??'').trim()?`${header[i]||'第'+(i+1)+'列'}：${v}`:'').filter(Boolean):[];
  row.notes=[`来源：${source} · 第 ${startRow+index+1} 行`,...(kind==='receipt'?['导入为草稿；原表签认状态未核对']:[]),...extras].join('\n');
  rows.push(row);
 });
 return {rows,skipped};
}
