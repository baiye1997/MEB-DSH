import {businessWorksheets,businessRows} from './business-worksheets.js';
import {resolveCustom} from './custom-calculation.js';
// Public DSH session contracts only. No private routes or provider credentials.
import {ledgerBook,ledgerNames} from './model.js';
import {calculationEquations,calculationWorksheets,findCalculationSheet,resolveCalculation} from './calculation-sheet.js';
import {quickResult,quickSpecs} from './quick-tools.js';
import {specs} from './calculations.js';

const calculationKinds=['cable','bus','support'];
const clippedText=(value,max=500)=>String(value??'').slice(0,max);
const clippedMap=(value,max=500)=>Object.fromEntries(Object.entries(value||{}).map(([key,item])=>[key,clippedText(item,max)]));
const calculationParameters=(kind,value)=>clippedMap(Object.fromEntries(Object.entries(value||{}).filter(([key])=>key==='mode'||specs[kind].fields.some(([id])=>id===key))),200);
const calculationRow=(kind,row)=>({id:row.id,name:clippedText(row.name),specification:clippedText(row.specification),length:clippedText(row.length,200),overrides:calculationParameters(kind,row.overrides)});
const calculationMode=(kind,mode)=>kind==='cable'?'按规格拆分芯线':kind==='bus'?(mode==='direct'?'厂家确认单位铜重':'铜排截面积估算'):(mode==='single'?'单杆支架':'门架支架');
const calculationSource=source=>source&&({projectId:source.projectId,projectName:clippedText(source.projectName),sheetId:source.sheetId,worksheetId:source.worksheetId,worksheetName:clippedText(source.worksheetName,60),rowId:source.rowId,specification:clippedText(source.specification),formulaVersion:source.formulaVersion,capturedAt:source.capturedAt,inputs:clippedMap(source.inputs,200),mode:source.mode,result:source.result,unit:source.unit,formula:clippedText(source.formula),workbook:clippedText(source.workbook),...(source.sheetId==='custom'?{ruleId:source.ruleId,customRule:source.customRule,expression:source.expression}:{})});

export function projectContext(project,page,ledgerKey,{materials,calcTool,worksheetId='',businessWorksheetId='',viewRows,selectedRowId,offset=0,limit=50,unsaved=false,filterQuery='',selectedCount=0}={}){
 const books={receipt:{columns:project.columns||[],rows:project.rows||[]},...(project.ledgers||{})};
 const active=(page==='materials'?materials:businessWorksheetId?ledgerBook(project,ledgerKey,businessWorksheetId):books[ledgerKey])||books.receipt;
 const rows=['table','materials'].includes(page)?active.rows||[]:[];
 const visible=Array.isArray(viewRows)?viewRows:rows;
 const rowSnapshot=(r,detail=false)=>({id:r.id,cells:Object.fromEntries((active.columns||[]).map(c=>[c.id,String(r.cells[c.id]??'').slice(0,500)])),notes:r.notes?.slice(0,500),...(detail&&ledgerKey==='calculation'&&r.source?{calculationSource:calculationSource(r.source)}:{})});
 const focused=rows.find(r=>r.id===selectedRowId&&(!selectedCount||visible.some(v=>v.id===r.id)));
 const payload={...(page==='table'?{worksheetId:businessWorksheetId,worksheetName:businessWorksheets(project,ledgerKey).find(s=>s.id===businessWorksheetId)?.name,worksheets:businessWorksheets(project,ledgerKey).map(s=>({...s,rows:businessRowsForSheet(project,ledgerKey,s.id).length}))}:{}),selectedCount,project:{id:project.id,name:project.name,finance:project.finance},dataState:unsaved?'当前未保存编辑':'已保存数据',page,ledger:page==='materials'?'个人材料价格库':ledgerKey,filterQuery,columns:(active.columns||[]).map(({id,name,type})=>({id,name,type})),totalRows:rows.length,visibleRows:visible.length,rowOffset:offset,rows:visible.slice(offset,offset+limit).map(r=>rowSnapshot(r,!!selectedRowId&&r.id===selectedRowId)),...(focused?{focusedRow:rowSnapshot(focused,true)}:{}),scope:'当前项目视图快照；不含附件或路径。truncated 时看 omittedBefore、omittedAfter、clippedFields。'};
 if(project.modelConfig){const c=project.modelConfig;payload.model={mode:c.mode,buildingCount:c.buildings.length,buildings:c.buildings.map(b=>({id:b.id,number:b.number,name:b.name,lot:b.lot||'',floors:b.heights.length,totalHeight:b.heights.length&&b.heights.every(h=>Number.isFinite(h)&&h>0)?Number(b.heights.reduce((a,h)=>a+h,0).toFixed(3)):null,sourceDrawing:b.dwgSource?.name?.slice(0,120)||null,sourceLayer:b.cadLayer?.slice(0,100)||null,sourceEntity:b.cadEntityIndex??null}))};}
 let calculationClippedFields=0;
 if(page==='calculator'){
  payload.tool=calcTool;
  const sheet=calculationKinds.includes(calcTool)?findCalculationSheet(project,calcTool,worksheetId):undefined;
  if(calculationKinds.includes(calcTool)){payload.worksheetId=worksheetId;payload.worksheetName=sheet?.name||'工作表 1';payload.worksheets=calculationWorksheets(project,calcTool).map(({id,name,sheet})=>({id,name,rows:sheet.rows.length}));}
  const calculationRows=calcTool==='custom'?(project.customCalculations||[]).flatMap(rule=>rule.rows.map(row=>({...row,ruleId:rule.id}))):sheet?.rows||(project.quickTools||[]).filter(r=>r.cells.kind===calcTool);
  payload.calculationTotalRows=calculationRows.length;
  if(calcTool==='custom')payload.customRules=(project.customCalculations||[]).map(({rows,...rule})=>rule);
  payload.calculation=sheet?{params:calculationParameters(calcTool,sheet.params),rows:calculationRows.slice(0,50).map(row=>calculationRow(calcTool,row))}:calculationRows.slice(0,50);
  if(sheet)calculationClippedFields=Object.keys(payload.calculation.params).filter(key=>String(sheet.params[key]).length>200).length+calculationRows.slice(0,50).reduce((n,row)=>n+['name','specification'].filter(key=>String(row[key]).length>500).length+(String(row.length).length>200?1:0)+Object.keys(calculationParameters(calcTool,row.overrides)).filter(key=>String(row.overrides[key]).length>200).length,0);
 }
 let text=JSON.stringify(payload);
 if(text.length>18000){while(payload.rows.length&&JSON.stringify(payload).length>17000)payload.rows.pop();if(payload.calculation&&JSON.stringify(payload).length>17000){delete payload.customRules;payload.calculation={notice:'计算表过长，请缩小范围后再发送'};}if(payload.focusedRow&&JSON.stringify(payload).length>17000){payload.focusedRow={id:payload.focusedRow.id,notice:'选中行内容过长，请缩小字段范围后再发送'};}text=JSON.stringify(payload);}
 payload.returnedRows=payload.rows.length;
 payload.nextOffset=limit>0&&payload.rows.length&&offset+payload.rows.length<visible.length?offset+payload.rows.length:null;
 payload.omittedBefore=Math.min(offset,visible.length);
 payload.omittedAfter=Math.max(0,visible.length-offset-payload.returnedRows);
 const included=new Set(payload.rows.map(r=>r.id));if(payload.focusedRow?.cells)included.add(payload.focusedRow.id);
 payload.clippedFields=calculationClippedFields+rows.filter(r=>included.has(r.id)).reduce((count,row)=>count+(active.columns||[]).filter(c=>String(row.cells[c.id]??'').length>500).length+(String(row.notes??'').length>500?1:0),0);
 if(page==='calculator')payload.calculationReturnedRows=payload.calculation?.notice?0:(payload.calculation?.rows||payload.calculation||[]).length;
 payload.truncated=payload.omittedBefore>0||payload.omittedAfter>0||payload.clippedFields>0||!!payload.calculation?.notice||!!payload.focusedRow?.notice||(payload.calculationReturnedRows??0)<(payload.calculationTotalRows??0);
 text=JSON.stringify(payload);
 return text;
}
const businessRowsForSheet=(project,kind,id)=>id?ledgerBook(project,kind,id).rows:kind==='receipt'?project.rows:project.ledgers?.[kind]?.rows||[];
export function queryProject(data,{projectId,ledger,worksheetId='',query='',offset=0,limit=20,rowId,summaryOnly=false}={}){
 if(!projectId)return JSON.stringify({projects:data.projects.map(p=>({id:p.id,name:p.name,stage:p.finance?.stage||'',ledgers:Object.fromEntries(Object.keys(ledgerNames).map(key=>[key,businessRows(p,key).length]))}))});
 const project=data.projects.find(p=>p.id===projectId);if(!project)throw Error('项目不存在');
 if(!ledger)return JSON.stringify({project:{id:project.id,name:project.name,finance:project.finance},ledgers:Object.fromEntries(Object.keys(ledgerNames).map(key=>[key,businessRows(project,key).length])),model:project.modelConfig?{buildingCount:project.modelConfig.buildings.length,buildings:project.modelConfig.buildings.map(b=>({number:b.number,name:b.name,lot:b.lot||'',floors:b.heights.length}))}:null});
 if(!['materials',...Object.keys(ledgerNames)].includes(ledger))throw Error('台账类型无效');
 if(typeof worksheetId!=='string'||worksheetId.length>100||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>50||typeof query!=='string'||query.length>100||rowId!==undefined&&(typeof rowId!=='string'||rowId.length>100)||typeof summaryOnly!=='boolean')throw Error('查询范围无效');
 const book=ledger==='materials'?data.materials:ledgerBook(project,ledger,worksheetId);if(!book)throw Error('材料价格库未建立');
 if(rowId&&!book.rows.some(r=>r.id===rowId))throw Error('记录不存在');
 const matches=book.rows.filter(r=>!query||Object.values(r.cells).some(v=>String(v).toLocaleLowerCase().includes(query.toLocaleLowerCase())));
 if(summaryOnly&&!rowId)return JSON.stringify({project:{id:project.id,name:project.name},dataState:'已保存数据',ledger,...(worksheetId||project.businessWorksheets?.some(s=>s.kind===ledger)?{worksheetId,worksheets:businessWorksheets(project,ledger)}:{}),query:query||undefined,totalRows:book.rows.length,matchedRows:matches.length,scope:'仅汇总，不含记录明细'});
 return projectContext(project,ledger==='materials'?'materials':'table',ledger,{materials:data.materials,businessWorksheetId:worksheetId,viewRows:matches,selectedRowId:rowId,offset,limit:rowId?0:Math.min(limit,20),filterQuery:query});
}
export function queryCalculation(data,{projectId,kind,worksheetId,rowId,offset=0,limit=20}={}){
 if(typeof projectId!=='string'||!projectId||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>20||rowId!==undefined&&(typeof rowId!=='string'||rowId.length>100)||worksheetId!==undefined&&(typeof worksheetId!=='string'||worksheetId.length>100))throw Error('计算查询范围无效');
 const project=data.projects.find(p=>p.id===projectId);if(!project)throw Error('项目不存在');
 const allKinds=[...calculationKinds,...Object.keys(quickSpecs),'custom'];
 if(worksheetId!==undefined&&!calculationKinds.includes(kind))throw Error('工作表查询须指定电缆、母线槽或支吊架工具');
 if(!kind)return JSON.stringify({project:{id:project.id,name:project.name},dataState:'已保存数据',tools:allKinds.map(id=>({kind:id,name:id==='custom'?'自定义计算规则':quickSpecs[id]?.name||({cable:'电缆铜价调差',bus:'母线槽铜价调差',support:'桥架支吊架重量'})[id],rows:id==='custom'?(project.customCalculations||[]).reduce((n,r)=>n+r.rows.length,0):calculationKinds.includes(id)?calculationWorksheets(project,id).reduce((n,{sheet})=>n+sheet.rows.length,0):(project.quickTools||[]).filter(r=>r.cells.kind===id).length}))});
 if(kind==='custom'){
  const rules=project.customCalculations||[],all=rules.flatMap(rule=>rule.rows.map(row=>({rule,row})));
  if(rowId&&!all.some(x=>x.row.id===rowId))throw Error('计算行不存在');
  const selection=rowId?all.filter(x=>x.row.id===rowId):all.slice(offset,offset+limit),entries=selection.map(({rule,row})=>{try{const r=resolveCustom(rule,row);return {id:row.id,name:clippedText(row.name),ruleId:rule.id,ruleName:rule.name,formula:rule.formula,parameters:rule.variables,inputs:r.values,expression:r.expression,result:r.display,unit:r.unit,ruleNote:clippedText(rule.note)};}catch(e){return {id:row.id,name:clippedText(row.name),ruleId:rule.id,error:e.message};}});
  return JSON.stringify({project:{id:project.id,name:project.name},dataState:'已保存数据',kind,rules:rules.map(({id,name,rows})=>({id,name,rows:rows.length})),rows:entries,totalRows:all.length,returnedRows:entries.length,nextOffset:rowId||offset+entries.length>=all.length?null:offset+entries.length,scope:'已保存自定义计算；单位按用户约定，历史结果看 calculation 台账。'});
 }
 if(!allKinds.includes(kind))throw Error('计算工具类型无效');
 const quick=!calculationKinds.includes(kind),worksheets=quick?[]:calculationWorksheets(project,kind).filter(s=>worksheetId===undefined||s.id===worksheetId);
 if(!quick&&!worksheets.length)throw Error('工作表不存在');
 const rows=quick?(project.quickTools||[]).filter(r=>r.cells.kind===kind).map(row=>({row})):worksheets.flatMap(worksheet=>worksheet.sheet.rows.map(row=>({row,worksheet})));
 const matches=rowId?rows.filter(({row})=>row.id===rowId):[];
 if(rowId&&!matches.length)throw Error('计算行不存在');
 if(rowId&&matches.length>1)throw Error('计算行编号存在于多个工作表，请指定 worksheetId');
 const selection=rowId?matches:rows.slice(offset,offset+limit),sheet=rowId?matches[0].worksheet?.sheet:worksheets.length===1?worksheets[0].sheet:undefined;
 const entries=selection.map(({row:r,worksheet})=>{
  if(quick){let result='',error='';try{result=quickResult(kind,r.cells);}catch(e){error=e.message;}const {materialSnapshot,source,...cells}=r.cells;return {id:r.id,cells:clippedMap(cells),result,unit:quickSpecs[kind].unit,error,source:clippedText(source)};}
  const row={...calculationRow(kind,r),worksheetId:worksheet.id,worksheetName:clippedText(worksheet.name,60)};
  try{const resolved=resolveCalculation(kind,worksheet.sheet,r);return {...row,hasOverrides:Object.keys(r.overrides).length>0,result:resolved.result.value.toFixed(resolved.result.unit==='元'?2:3),unit:resolved.result.unit,...(rowId?{inputs:calculationParameters(kind,resolved.inputs),mode:calculationMode(kind,resolved.mode),steps:calculationEquations(kind,resolved.inputs,resolved.mode).map(([label,expression,value,unit])=>[label,expression,Number(value.toFixed(9)),unit])}:{})};}
  catch(e){return {...row,error:clippedText(e.message)};}
 });
 return JSON.stringify({project:{id:project.id,name:project.name},dataState:'已保存数据',kind,...(!quick?{worksheets:worksheets.map(({id,name,sheet})=>({id,name:clippedText(name,60),rows:sheet.rows.length})),...(worksheetId!==undefined?{worksheetId}:{})}:{}),params:quick?undefined:sheet?calculationParameters(kind,sheet.params):null,formula:quick?quickSpecs[kind].formula:specs[kind].formula,formulaSource:quick?'工作台内置几何/金额公式':specs[kind].source,totalRows:rows.length,rows:entries,returnedRows:entries.length,nextOffset:rowId||offset+entries.length>=rows.length?null:offset+entries.length,scope:'已保存计算表；金额 2 位、重量 3 位正常展示舍入；steps 是未入账中间值。附件和本机路径不返回。'});
}
export function projectRouteContext(context){
 const {project,dataState,page,ledger,tool,worksheetId,worksheetName,filterQuery,totalRows,visibleRows,focusedRow}=JSON.parse(context);
 return JSON.stringify({project:{id:project.id,name:project.name},dataState,page,ledger,tool,worksheetId,worksheetName,filterQuery,totalRows,visibleRows,focusedRowId:focusedRow?.id,scope:'项目定位，不含台账行、金额、附件或文件路径。按需查询已保存资料；当前筛选和未保存编辑可能无法重现。'});
}
export function workbenchPrompt(draft,context,includeContext=true,sendSnapshot=false){
 const question=draft.trim();
 if(!includeContext)return '<meb-scope mode="method-only">只回答方法，不使用项目资料。</meb-scope>\n\n'+question;
 const data=sendSnapshot?context:projectRouteContext(context);
 const scope=sendSnapshot?'当前资料仅限本次发送的行；truncated 时看 omittedBefore、omittedAfter、clippedFields。':'当前只发送项目定位；需要证据再查只读资料，不要假装看过台账。';
 return '<meb-scope>'+scope+'</meb-scope>\n<project-data>\n'+data+'\n</project-data>\n\n'+question;
}
export function sessionMessages(entries){
 const result=[],live=new Map();
 for(const {event:e} of entries||[]){if(!e)continue;
  if(e.type==='user/message'&&e.data?.source?.kind==='user')result.push({id:'u'+e.seq,role:'user',text:(e.data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')});
  if(e.type==='assistant/message'){const text=(e.data?.message?.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');if(text)result.push({id:'a'+e.seq,role:'assistant',text});}
  if(e.type==='assistant/live-chunk'&&e.data?.chunk?.type==='text-delta'){const id=e.data.attemptId;live.set(id,(live.get(id)||'')+e.data.chunk.text);}
 }
 for(const [id,text] of live)result.push({id:'live'+id,role:'assistant',text});return result;
}

export async function submitPrompt(session,text,extraParts=[]){
 const echo=session.beginSubmission({mode:'queue',text,attachments:[],onRetire:()=>{}});
 try{const result=await session.prompt([{type:'text',text},...extraParts],'queue',undefined,echo.requestId);if(!result.ok)throw Error(result.error.message);}
 catch(error){echo.abandon();throw error;}
}

export async function uploadReviewFile(service,sessionId,file,cache){
 const cached=cache.get(file);if(cached?.sessionId===sessionId)return cached.receiptId;
 const uploaded=await service.upload(sessionId,file,file.name);if(!uploaded.ok)throw Error(uploaded.error.message);
 const receiptId=uploaded.value.receiptId;cache.set(file,{sessionId,receiptId});return receiptId;
}

// The caller retains the original render's page provider so later edits cannot mix batches.
export async function sendReviewPage(session,page,offset,question){
 const context=page(offset),data=JSON.parse(context),count=data.returnedRows;
 if(!Number.isInteger(count)||count<=0||data.rowOffset!==offset)throw Error('当前资料过长，无法附带记录，请缩小范围后重新核对。');
 const sent=offset+count;
 if(sent>data.visibleRows||data.nextOffset!==null&&data.nextOffset!==sent)throw Error('核对范围发生异常，请重新发起。');
 const prompt=`${question}\n\n本次为同一批资料中的第 ${offset+1}—${sent} 条，共 ${data.visibleRows} 条。只说明实际读取的记录；${sent<data.visibleRows?'其余记录尚未发送，不得声称全量核对完成。':'本批为最后一批，结合本会话已有依据说明覆盖范围和仍待核实的事项。'}跨批次重复项不能仅凭本批排除，无法比对时明确列为待核。`;
 await submitPrompt(session,workbenchPrompt(prompt,context,true,true),[]);
 return {sent,total:data.visibleRows,next:data.nextOffset};
}
