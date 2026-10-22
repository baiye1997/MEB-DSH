import {inspectReference,openReference,listReferenceDirectory} from './file-reference.js';
import {inspectDwgUpload,renderDwgReviewEvidence} from './dwg-import.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {defineDomain} from '@deepseek-ai/dsh-storage-domain';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {queryProject,queryCalculation} from './dsh-bridge.js';
import {mebAssistantSystemPrompt} from './dsh-response.js';
import {schema,initial,validate} from './model.js';
import {WebDavSync,mergeReferencePaths} from './webdav-sync.js';
import {readBoundedText} from './bounded-text.js';
import {loadWebDavSettings,saveWebDavSettings,updateWebDavBase,removeWebDavSettings} from './webdav-config.js';
export const inject=['connection','storageDomain','webServer','tools','systemPrompt'];
const MAX_RPC_REQUEST_BYTES=60_000_000;
const exportDirectory=()=>join(process.env.DSH_HOME||join(homedir(),'.dsh'),'exports','meb-workbench');
const exportPath=async(name)=>{const dir=exportDirectory();await mkdir(dir,{recursive:true});return join(dir,`${Date.now()}-${name}`);};
// DSH authenticates and applies its Host/Origin fence; this streaming route caps bytes before JSON parsing.
export async function apply(ctx){
 if(ctx.systemPrompt)ctx.effect(()=>ctx.systemPrompt.section({name:'meb:assistant',order:ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),text:mebAssistantSystemPrompt}));
 const domain=await ctx.storageDomain.open(defineDomain({name:'meb_workbench',version:1,global:{schema,initial:initial()},tables:{}}));
 ctx.effect(()=>()=>domain.close());
 let settings=null,configError='';
 try{settings=await loadWebDavSettings();}catch(e){configError=e.message;}
 const sync=new WebDavSync({config:()=>settings,readLocal:()=>domain.global.get(),writeLocal:async(remote,expected)=>{const current=domain.global.get();if(current!==expected)throw Error('本机在同步期间已修改，远端数据未覆盖本机');await domain.global.set(validate({...mergeReferencePaths(remote,current),revision:Math.max(current.revision+1,remote.revision)}));},validate,saveBase:async hash=>updateWebDavBase(settings,hash)});
 if(configError)sync.state={kind:'error',message:configError};
 const syncStatus=()=>({configured:!!settings,url:settings?.url||'',username:settings?.username||'',...sync.state});
 const sessionProjects=new Map();
 const bindSession=(payload)=>{const sessionId=payload?.sessionId,projectId=payload?.projectId;if(typeof sessionId!=='string'||!sessionId||typeof projectId!=='string'||!projectId)throw Error('DSH 项目绑定参数无效');if(!domain.global.get().projects.some(project=>project.id===projectId))throw Error('项目不存在');const previous=sessionProjects.get(sessionId);if(previous&&previous!==projectId)throw Object.assign(Error('DSH 会话已经绑定其他项目'),{code:'meb-forbidden'});sessionProjects.set(sessionId,projectId);return {sessionId,projectId};};
 const scopedProject=(args,exec)=>{const sessionId=exec?.agent?.session?.id||exec?.agent?.id,projectId=sessionProjects.get(sessionId);if(!projectId)throw Object.assign(Error('DSH 会话尚未绑定项目，请从工作台重新发送问题'),{code:'meb-forbidden'});if(args?.projectId&&args.projectId!==projectId)throw Object.assign(Error('不能查询当前项目以外的数据'),{code:'meb-forbidden'});return projectId;};
 const backup=async(value,source)=>{const path=await exportPath(`MEB-WebDAV-${source}-恢复前.json`);await writeFile(path,JSON.stringify(value),{flag:'wx'});return path;};
 ctx.effect(()=>ctx.tools.register(defineTool({
  name:'meb_project_query',
  description:'Read saved records from the project bound to this DSH session. Read-only; omits attachment bytes and attachment reference paths. A true truncated flag means this response is partial: omittedBefore and omittedAfter count unreturned rows, while clippedFields counts shortened cell values. A null nextOffset only means there is no later page. Do not claim unreturned rows were checked.',
  parameters:{
   projectId:{type:'string',description:'Optional bound project ID; omitting it reads the current bound project'},
   worksheetId:{type:'string',description:'Business worksheet ID from worksheets; omit or empty string for the default sheet. Inspect each sheet when reviewing the whole ledger.'},
   ledger:{type:'string',enum:['receipt','change','output','contract','calculation','materials'],description:'Ledger to inspect; omit for the project overview'},
   query:{type:'string',description:'Optional text filter across ledger cells, maximum 100 characters'},
   offset:{type:'integer',description:'Zero-based row offset, starting at 0'},
   limit:{type:'integer',description:'Rows to return, from 1 to 20; default 20'},
   rowId:{type:'string',description:'Optional row ID for focused detail'},
   summaryOnly:{type:'boolean',description:'For count, existence or status questions only: return totals without row details'}
  },
  output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
  async execute(args,exec){return queryProject(validate(domain.global.get()),{...args,projectId:scopedProject(args,exec)});}
 })));
 ctx.effect(()=>ctx.tools.register(defineTool({
  name:'meb_calculation_query',
  description:'Read saved MEB project calculation sheets and source rows. List available tools, page rows, or inspect a row ID for effective inputs and calculation steps. Read-only; live sheet results are recomputed, while historical booked values must be checked through meb_project_query ledger=calculation. Never treat unsaved browser edits as saved data.',
  parameters:{
   projectId:{type:'string',description:'Required MEB project ID'},
   kind:{type:'string',enum:['cable','bus','support','price','insulation','duct','custom'],description:'Calculation tool; omit to list all tools'},
   worksheetId:{type:'string',description:'Optional worksheet ID for cable, bus or support; empty string selects the original worksheet, omit to search all worksheets of this tool'},
   rowId:{type:'string',description:'Optional row ID for full calculation detail; specify worksheetId if the ID occurs in multiple worksheets'},
   offset:{type:'integer',description:'Zero-based row offset'},
   limit:{type:'integer',description:'Rows to return, from 1 to 20; default 20'}
  },
  output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
  async execute(args,exec){return queryCalculation(validate(domain.global.get()),{...args,projectId:scopedProject(args,exec)});}
 })));
 // ponytail: a single serialized document keeps backup and multi-row edits atomic;
 // split into transactional records when real project volume requires it.
 let queue=Promise.resolve(),syncQueue=Promise.resolve();
 const scheduleSync=()=>{sync.state={kind:'pending'};const task=syncQueue.then(()=>{sync.state={kind:'pending'};return sync.run();});syncQueue=task.catch(e=>{sync.state={kind:'error',message:e.message};});return task;};
 const handle=async(endpoint,payload)=>{
  try{
   if(endpoint==='meb/export'){if(!payload||typeof payload.name!=='string'||typeof payload.base64!=='string'||payload.base64.length>50000000)throw Error('导出参数无效');const filename=payload.name.replace(/[^\p{L}\p{N}._ -]/gu,'_');if(!/\.(xlsx|json)$/.test(filename))throw Error('导出格式无效');const file=await exportPath(encodeURIComponent(filename));await writeFile(file,Buffer.from(payload.base64,'base64'),{flag:'wx'});return {ok:true,value:file};}
   if(endpoint==='meb/export-attachment'){if(!payload||typeof payload.name!=='string'||!payload.name.trim()||payload.name.length>255||typeof payload.base64!=='string'||payload.base64.length>14000000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.base64))throw Error('附件导出参数无效');const bytes=Buffer.from(payload.base64,'base64');if(bytes.length>10000000)throw Error('单个附件暂限 10 MB');const filename=payload.name.replace(/[^\p{L}\p{N}._ -]/gu,'_').replace(/^\.+/,'')||'附件';const file=await exportPath(encodeURIComponent(filename));await writeFile(file,bytes,{flag:'wx'});return {ok:true,value:file};}
   if(endpoint==='meb/reference-list')return {ok:true,value:await listReferenceDirectory(payload?.path)};
   if(endpoint==='meb/reference')return {ok:true,value:await inspectReference(payload?.path)};
   if(endpoint==='meb/open-reference')return {ok:true,value:await openReference(payload?.path)};
   if(endpoint==='meb/model-dwg')return {ok:true,value:await inspectDwgUpload(payload)};
   if(endpoint==='meb/model-dwg-evidence')return {ok:true,value:await renderDwgReviewEvidence(payload)};
   if(endpoint==='meb/bind-session')return {ok:true,value:bindSession(payload)};
   if(endpoint==='meb/sync-status')return {ok:true,value:syncStatus()};
   if(endpoint==='meb/sync-wait'){await syncQueue;return {ok:true,value:syncStatus()};}
   if(endpoint==='meb/sync-check'){if(configError)return {ok:true,value:syncStatus()};await queue;if(sync.state.kind==='pending')await syncQueue;else await scheduleSync();return {ok:true,value:syncStatus()};}
   if(endpoint==='meb/sync-configure'){
    const task=queue.then(async()=>{await syncQueue;settings=await saveWebDavSettings(payload,settings);configError='';await sync.run();return syncStatus();});queue=task.catch(()=>{});return {ok:true,value:await task};
   }
   if(endpoint==='meb/sync-disconnect'){const task=queue.then(async()=>{await syncQueue;await removeWebDavSettings(settings);settings=null;configError='';sync.state={kind:'disabled'};return syncStatus();});queue=task.catch(()=>{});return {ok:true,value:await task};}
   if(endpoint==='meb/sync-use-remote'){if(!settings)throw Error('尚未配置 WebDAV');const task=queue.then(async()=>{await syncQueue;return sync.useRemote(value=>backup(value,'本机'));});queue=task.catch(()=>{});return {ok:true,value:{status:await task,data:validate(domain.global.get())}};}
   if(endpoint==='meb/sync-use-local'){if(!settings)throw Error('尚未配置 WebDAV');const task=queue.then(async()=>{await syncQueue;return sync.useLocal(value=>backup(value,'远端'));});queue=task.catch(()=>{});return {ok:true,value:await task};}
   if(endpoint==='meb/read')return {ok:true,apiVersion:8,value:validate(domain.global.get())};
   if(endpoint!=='meb/save')throw Error('未知工作台操作');
   const next=validate(payload);
   const task=queue.then(async()=>{const current=domain.global.get();if(next.revision!==current.revision)throw Error('其他窗口已经修改数据。请先导出未保存数据，再重新加载。');for(const project of current.projects){const incoming=payload.projects.find(p=>p.id===project.id);if(project.customCalculations?.length&&incoming&&!Object.hasOwn(incoming,'customCalculations'))throw Error('当前页面版本过旧，缺少已保存的自定义计算规则。请先导出未保存数据，再重新加载工作台。');if(project.businessWorksheets?.length&&incoming&&!Object.hasOwn(incoming,'businessWorksheets'))throw Error('当前页面版本过旧，缺少已保存的台账工作表。请先导出未保存数据，再重新加载工作台。');if(project.calculationWorksheets?.length&&incoming&&!Object.hasOwn(incoming,'calculationWorksheets'))throw Error('当前页面版本过旧，缺少已保存的独立计算工作表。请先导出未保存数据，再重新加载工作台。');}const saved={...next,revision:current.revision+1};await domain.global.set(saved);return saved;});
   queue=task.catch(()=>{});const saved=await task;if(!configError&&settings)void scheduleSync();return {ok:true,value:saved};
  }catch(e){return {ok:false,error:{code:'meb-error',message:e.message,details:{}}};}
 };
 ctx.effect(()=>ctx.connection.fetch.register({path:'/api/meb-workbench',methods:['POST'],requestBody:'streaming',fetch:async request=>{try{const body=JSON.parse(await readBoundedText(request,MAX_RPC_REQUEST_BYTES,'请求数据超过 60 MB'));return Response.json(await handle(body.endpoint,body.payload));}catch(e){return Response.json({ok:false,error:{message:e.message}},{status:e.status||400});}}}));
}
