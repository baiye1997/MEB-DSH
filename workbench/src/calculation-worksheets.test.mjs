import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,ledgerBook,restoreBackup} from './model.js';
import {initial} from '../test-fixtures/workspace.mjs';
import {apply as applyWorkbench} from './index.js';
import {workbenchRequest} from './workbench-request.js';
import {emptySheet,newCalculationRow,calculationWorksheets,findCalculationSheet,editCalculationSheet,createCalculationWorksheet,renameCalculationWorksheet,applyCalculationParameters,resolveCalculation,snapshotRecord,pasteCalculationRows} from './calculation-sheet.js';
import {setSheetAlignment} from './sheet-format.js';
import {projectContext,projectRouteContext,queryCalculation,queryProject} from './dsh-bridge.js';

const row=(id,overrides={})=>({...newCalculationRow(),id,name:'事项 '+id,specification:'YJV-3×400',length:'63.61',overrides});
function fixture(count=1){
 const data=validate(initial()),project=data.projects[0],sheet=emptySheet('cable');
 sheet.params.base='68740';sheet.params.current='105825';sheet.rows=Array.from({length:count},(_,i)=>row('original-'+i));
 project.calculationSheets={cable:sheet};return {data,project,sheet};
}
const read=(data,args)=>JSON.parse(queryCalculation(data,{projectId:data.projects[0].id,...args}));

test('legacy sheets survive unchanged and independent worksheets round-trip parameters, rows and alignment',()=>{
 const {data,project,sheet}=fixture(),legacy=structuredClone(sheet),loadedLegacy=validate(JSON.parse(JSON.stringify(data)));
 assert.equal(loadedLegacy.projects[0].calculationWorksheets,undefined);assert.deepEqual(loadedLegacy.projects[0].calculationSheets.cable,legacy);
 const cableId=createCalculationWorksheet(project,'cable','二号楼'),busId=createCalculationWorksheet(project,'bus','母线清单'),supportId=createCalculationWorksheet(project,'support','支架清单');
 for(const [kind,id,specification] of [['cable',cableId,'3×2.5'],['bus',busId,'50×3×1+50×1.5×1'],['support',supportId,'150×100']]){
  editCalculationSheet(project,kind,id,s=>{s.params.current='90000';s.rows.push({...row(kind),specification});s.format=setSheetAlignment(undefined,{scope:'cell',rowId:kind,columnId:'length'},'center');});
 }
 const loaded=validate(JSON.parse(JSON.stringify(data))),restored=loaded.projects[0];
 assert.deepEqual(restored.calculationSheets.cable,legacy);assert.deepEqual(restored.calculationWorksheets,project.calculationWorksheets);
 assert.equal(calculationWorksheets(restored,'cable').length,2);assert.equal(calculationWorksheets(restored,'cable')[0].id,'');
 const invalid=structuredClone(loaded);invalid.projects[0].calculationWorksheets[0].format.cells.cable.length='justify';assert.throws(()=>validate(invalid));
});

test('creating a worksheet inherits only parameters and rejects duplicate names and identifiers',()=>{
 const {data,project,sheet}=fixture();sheet.format={columns:{length:'center'}};
 const id=createCalculationWorksheet(project,'cable','  二号楼  '),extra=findCalculationSheet(project,'cable',id);
 assert.equal(extra.name,'二号楼');assert.deepEqual(extra.params,sheet.params);assert.notEqual(extra.params,sheet.params);assert.deepEqual(extra.rows,[]);
 extra.params.current='90000';assert.equal(sheet.params.current,'105825');
 const secondId=createCalculationWorksheet(project,'cable','三号楼',id);assert.deepEqual(findCalculationSheet(project,'cable',secondId).params,extra.params);
 for(const name of ['二号楼','工作表 1','  ','x'.repeat(61)])assert.throws(()=>createCalculationWorksheet(project,'cable',name),/同名|名称/);
 assert.throws(()=>renameCalculationWorksheet(project,'cable',id,'工作表 1'),/同名/);
 assert.throws(()=>renameCalculationWorksheet(project,'cable','missing','不存在'),/工作表不存在/);
 renameCalculationWorksheet(project,'cable',id,'二号楼电缆');assert.equal(extra.name,'二号楼电缆');
 const duplicate=structuredClone(data);duplicate.projects[0].calculationWorksheets[1].id=id;assert.throws(()=>validate(duplicate),/工作表 ID 重复/);
 const duplicateName=structuredClone(data);duplicateName.projects[0].calculationWorksheets[1].name=extra.name;assert.throws(()=>validate(duplicateName),/工作表名称重复/);
 const duplicateRow=structuredClone(data);duplicateRow.projects[0].calculationSheets.cable.rows.push(structuredClone(sheet.rows[0]));assert.throws(()=>validate(duplicateRow),/计算行 ID 重复/);
});

test('two nonadjacent selections change only their requested parameters and can restore inheritance',()=>{
 const {sheet}=fixture(6),before=structuredClone(sheet),firstIds=['original-0','original-3'],secondIds=['original-1','original-5'];
 const first=applyCalculationParameters(sheet,'cable',firstIds,{current:'98,000',threshold:'4'}),next=applyCalculationParameters(first,'cable',secondIds,{base:'70,000',length:'100'}),expected=structuredClone(sheet);
 for(const r of expected.rows){if(firstIds.includes(r.id))r.overrides={current:'98000',threshold:'4'};if(secondIds.includes(r.id)){r.overrides.base='70000';r.length='100';}}
 assert.deepEqual(next,expected);assert.deepEqual(sheet,before);assert.equal(first.rows[1].length,'63.61');
 const reset=applyCalculationParameters(next,'cable',firstIds,{current:null,threshold:null});
 for(const id of firstIds){const r=reset.rows.find(r=>r.id===id);assert.deepEqual(r.overrides,{});assert.equal(resolveCalculation('cable',reset,r).inputs.current,reset.params.current);}
 assert.deepEqual(reset.rows[1],next.rows[1]);assert.deepEqual(reset.params,before.params);
});

test('invalid batch parameters fail atomically and bus/support modes restore their defaults',()=>{
 const {sheet}=fixture(3),before=structuredClone(sheet);
 for(const patch of [{current:'bad'},{current:'98000',base:'0'},{base:'0'},{threshold:'101'},{n1:'1.5'},{density:'-1'},{length:null},{mode:'direct'},{unknown:'1'},{}]){
  assert.throws(()=>applyCalculationParameters(sheet,'cable',['original-0','original-2'],patch));assert.deepEqual(sheet,before);
 }
 assert.throws(()=>applyCalculationParameters(sheet,'cable',['missing'],{current:'90000'}),/选中行/);assert.deepEqual(sheet,before);
 const bus=emptySheet('bus');bus.rows=[{...row('bus'),specification:'50×3×1+50×1.5×1'}];
 const direct=applyCalculationParameters(bus,'bus',['bus'],{mode:'direct',unitWeight:'6.1'});assert.equal(resolveCalculation('bus',{...direct,params:{base:'68740',current:'105825'}},direct.rows[0]).mode,'direct');
 const busReset=applyCalculationParameters(direct,'bus',['bus'],{mode:null,unitWeight:null});assert.deepEqual(busReset,bus);
 const support=emptySheet('support');support.rows=[{...row('support'),specification:'150×100'}];
 const single=applyCalculationParameters(support,'support',['support'],{mode:'single',spacing:'3'});assert.equal(resolveCalculation('support',single,single.rows[0]).mode,'single');
 assert.deepEqual(applyCalculationParameters(single,'support',['support'],{mode:null,spacing:null}),support);assert.throws(()=>applyCalculationParameters(support,'support',['support'],{mode:'direct'}),/方式/);
});

test('booked snapshots freeze worksheet identity, parameters and results after later edits',()=>{
 const {data,project}=fixture(),id=createCalculationWorksheet(project,'cable','月度铜价'),sheet=findCalculationSheet(project,'cable',id);sheet.rows=[row('booked')];
 const record=snapshotRecord(project,'cable',sheet,sheet.rows[0],project,id),frozen=JSON.stringify(record);ledgerBook(project,'calculation').rows.push(record);
 renameCalculationWorksheet(project,'cable',id,'下月铜价');sheet.params.current='90000';sheet.rows[0].length='100';
 assert.equal(JSON.stringify(record),frozen);assert.equal(record.source.sheetId,'cable');assert.equal(record.source.worksheetId,id);assert.equal(record.source.worksheetName,'月度铜价');
 const saved=validate(JSON.parse(JSON.stringify(data))),history=JSON.parse(queryProject(saved,{projectId:project.id,ledger:'calculation',rowId:record.id})).focusedRow.calculationSource;
 assert.equal(history.worksheetId,id);assert.equal(history.worksheetName,'月度铜价');assert.equal(history.inputs.current,'105825');assert.equal(history.result,record.source.result);
 assert.notEqual(read(saved,{kind:'cable',worksheetId:id,rowId:'booked'}).rows[0].result,record.cells.reported);
});

test('five-column Excel paste writes price overrides and rejects invalid rectangles without mutation',()=>{
 for(const kind of ['cable','bus']){
  const sheet=emptySheet(kind);sheet.rows=[row('paste',{density:'0.0089'})];const before=structuredClone(sheet);
  const pasted=pasteCalculationRows(sheet,'paste','name','"教学楼\n一层"\t3×2.5\t1,200\t68,740\t105,825\r\n二层\t3×4\t100\t70,000\t98,000',kind);
  assert.equal(pasted.count,2);assert.equal(pasted.sheet.rows[0].name,'教学楼\n一层');assert.equal(pasted.sheet.rows[0].length,'1200');assert.deepEqual(pasted.sheet.rows[0].overrides,{density:'0.0089',base:'68740',current:'105825'});assert.deepEqual(pasted.sheet.rows[1].overrides,{base:'70000',current:'98000'});
  assert.deepEqual(sheet,before);
  const priceOnly=pasteCalculationRows(sheet,'paste','base','68,740\t105,825',kind);assert.equal(priceOnly.sheet.rows[0].overrides.current,'105825');assert.equal(priceOnly.sheet.rows[0].length,before.rows[0].length);
  assert.throws(()=>pasteCalculationRows(sheet,'paste','name','有效\t3×4\t10\t70000\t98000\n非法\t3×4\t10\t70000\t98000\t多余',kind),/最多可粘贴 5 列/);
  assert.throws(()=>pasteCalculationRows(sheet,'paste','name','"未闭合\t10',kind),/引号不完整/);assert.deepEqual(sheet,before);
 }
});

test('DSH paginates across worksheets, counts all rows and preserves exact row locations',()=>{
 const {data,project,sheet}=fixture(15),id=createCalculationWorksheet(project,'cable','二号楼'),extra=findCalculationSheet(project,'cable',id);extra.params.current='90000';extra.rows=Array.from({length:12},(_,i)=>row('extra-'+i));
 assert.equal(read(data,{}).tools.find(t=>t.kind==='cable').rows,27);
 const first=read(data,{kind:'cable'}),second=read(data,{kind:'cable',offset:first.nextOffset});
 assert.equal(first.totalRows,27);assert.equal(first.rows.length,20);assert.equal(first.nextOffset,20);assert.equal(second.rows.length,7);assert.equal(second.nextOffset,null);
 assert.deepEqual([...first.rows,...second.rows].map(r=>[r.id,r.worksheetId]),[...sheet.rows.map(r=>[r.id,'']),...extra.rows.map(r=>[r.id,id])]);
 assert.equal(first.worksheets[1].name,'二号楼');assert.equal(first.worksheets[1].params,undefined);
 const detail=read(data,{kind:'cable',rowId:'extra-0'});assert.equal(detail.params.current,'90000');assert.equal(detail.rows.length,1);assert.equal(detail.rows[0].worksheetId,id);assert.equal(detail.rows[0].inputs.current,'90000');assert.ok(detail.rows[0].steps.length);
 assert.equal(read(data,{kind:'cable',worksheetId:''}).totalRows,15);assert.equal(read(data,{kind:'cable',worksheetId:id}).totalRows,12);
 extra.rows[0].id=sheet.rows[0].id;assert.throws(()=>queryCalculation(data,{projectId:project.id,kind:'cable',rowId:sheet.rows[0].id}),/多个工作表/);
 assert.equal(read(data,{kind:'cable',worksheetId:id,rowId:sheet.rows[0].id}).rows[0].inputs.current,'90000');assert.equal(read(data,{kind:'cable',worksheetId:'',rowId:sheet.rows[0].id}).rows[0].inputs.current,'105825');
 assert.throws(()=>queryCalculation(data,{projectId:project.id,kind:'cable',worksheetId:id,rowId:'original-1'}),/计算行不存在/);
 for(const args of [{kind:'cable',worksheetId:'missing'},{kind:'bus',worksheetId:id},{kind:'cable',limit:21},{kind:'cable',worksheetId:42},{kind:'custom',worksheetId:id}])assert.throws(()=>queryCalculation(data,{projectId:project.id,...args}));
});

test('DSH calculator context includes only the active sheet and routing retains its worksheet ID',()=>{
 const {project}=fixture(),id=createCalculationWorksheet(project,'cable','独立工作表'),sheet=findCalculationSheet(project,'cable',id);sheet.params.current='90000';sheet.rows=[row('active')];
 project.calculationSheets.cable.rows[0].name='其他工作表的私密内容';
 const context=JSON.parse(projectContext(project,'calculator','receipt',{calcTool:'cable',worksheetId:id,unsaved:true}));
 assert.equal(context.worksheetId,id);assert.equal(context.worksheetName,'独立工作表');assert.equal(context.calculation.params.current,'90000');assert.equal(context.calculationTotalRows,1);assert.equal(context.calculation.rows[0].id,'active');assert.equal(context.worksheets.length,2);assert.doesNotMatch(JSON.stringify(context),/其他工作表的私密内容/);
 assert.deepEqual(Object.keys(context.worksheets[0]).sort(),['id','name','rows']);
 const route=JSON.parse(projectRouteContext(JSON.stringify(context)));assert.equal(route.worksheetId,id);assert.equal(route.worksheetName,'独立工作表');assert.equal(route.dataState,'当前未保存编辑');assert.equal(route.calculation,undefined);
 const legacy=JSON.parse(projectContext(project,'calculator','receipt',{calcTool:'cable'}));assert.equal(legacy.worksheetId,'');assert.equal(legacy.calculation.rows[0].id,'original-0');
});

test('DSH clips worksheet fields and never serializes attachments, file paths or hidden format payloads',()=>{
 const {data,project,sheet}=fixture(),path='/example/private/secret.pdf';
 data.files=[{id:'secret',projectId:project.id,name:'秘密附件',path,data:'data:application/pdf;base64,c2VjcmV0'}];
 sheet.path=path;sheet.params.attachmentPath=path;sheet.format={path};Object.assign(sheet.rows[0],{name:'长'.repeat(1200),files:['secret'],path,attachment:{path}});sheet.rows[0].overrides.attachmentPath=path;
 const before=structuredClone(data),query=queryCalculation(data,{projectId:project.id,kind:'cable',rowId:'original-0'}),result=JSON.parse(query),context=projectContext(project,'calculator','receipt',{calcTool:'cable'});
 assert.equal(result.rows[0].name.length,500);assert.equal(JSON.parse(context).calculation.rows[0].name.length,500);assert.equal(JSON.parse(context).clippedFields,1);assert.equal(JSON.parse(context).truncated,true);
 for(const text of [query,context]){assert.ok(!text.includes(path));assert.doesNotMatch(text,/秘密附件|c2VjcmV0|attachmentPath/);assert.equal(JSON.parse(text).files,undefined);}
 assert.deepEqual(data,before);
});


test('an older page cannot silently discard saved worksheets and an explicit empty list remains valid',async()=>{
 const {data,project}=fixture();createCalculationWorksheet(project,'cable','保留工作表');let stored=structuredClone(data),route;
 const ctx={storageDomain:{open:async()=>({close(){},global:{get:()=>structuredClone(stored),set:async value=>{stored=structuredClone(value);}}})},effect:fn=>fn(),tools:{register:()=>()=>{}},connection:{fetch:{register:value=>{route=value.fetch;return()=>{};}}}};
 await applyWorkbench(ctx);
 const response=await route(new Request('http://fixture/api/meb-workbench',{method:'POST',body:JSON.stringify({endpoint:'meb/read'})}));assert.equal((await response.json()).apiVersion,8);
 const save=async payload=>(await route(new Request('http://fixture/api/meb-workbench',{method:'POST',body:JSON.stringify({endpoint:'meb/save',payload})}))).json();
 const previous=structuredClone(stored),oldPage=structuredClone(stored);delete oldPage.projects[0].calculationWorksheets;
 const rejected=await save(oldPage);assert.equal(rejected.ok,false);assert.match(rejected.error.message,/页面版本过旧.*工作表/);assert.deepEqual(stored,previous);
 const backupBefore=structuredClone(oldPage),restored=restoreBackup(oldPage,stored.revision);assert.deepEqual(oldPage,backupBefore);assert.deepEqual(restored.projects[0].calculationWorksheets,[]);assert.equal((await save(restored)).ok,true);assert.deepEqual(stored.projects[0].calculationWorksheets,[]);
});


test('the worksheets client requires the updated host before loading editable data',async()=>{
 for(const apiVersion of [undefined,2,5,6,7])await assert.rejects(workbenchRequest('read',null,async()=>({ok:true,json:async()=>({ok:true,apiVersion,value:{}})})),/请重启 DSH/);
 assert.equal(await workbenchRequest('read',null,async()=>({ok:true,json:async()=>({ok:true,apiVersion:8,value:'updated'})})),'updated');
});

test('batch and paste length edits replace a legacy length override in the effective calculation',()=>{
 const {sheet}=fixture();sheet.rows[0].overrides.length='99';const before=structuredClone(sheet),id=sheet.rows[0].id;
 const batch=applyCalculationParameters(sheet,'cable',[id],{length:'100'}),pasted=pasteCalculationRows(sheet,id,'length','200','cable').sheet;
 for(const [changed,length] of [[batch,'100'],[pasted,'200']]){
  assert.equal(changed.rows[0].length,length);assert.equal(changed.rows[0].overrides.length,undefined);assert.equal(resolveCalculation('cable',changed,changed.rows[0]).inputs.length,length);
 }
 assert.deepEqual(sheet,before);
});
