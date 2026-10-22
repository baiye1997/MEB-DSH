import {extractChanges,hasChanges} from './assistant-changes.js';
import React,{useEffect,useState,useRef,useSyncExternalStore} from 'react';
import {sendReviewPage,sessionMessages,submitPrompt,uploadReviewFile,workbenchPrompt} from './dsh-bridge.js';
import {extractDwgReviewSuggestion} from './dwg-assistant.js';
import {presentDshResponse,assistantScope,responseForCopy,replyForClipboard,sentMessageScope} from './dsh-response.js';
import {ledgerNames} from './model.js';
import {workbenchRequest} from './workbench-request.js';
import AssistantReading from './assistant-reading.jsx';
import HelpNote from './help-note.jsx';
import UIIcon from './ui-icon.jsx';
import UISelect from './ui-select.jsx';
import assistantCSS from './assistant-ui.css';
export function MessageText({text='',role}){
 const contextEnd=text.indexOf('</project-data>'),guidanceEnd=text.indexOf('</workbench-guidance>'),scopeEnd=text.indexOf('</meb-scope>');
 const body=role==='user'?(contextEnd>=0?text.slice(contextEnd+15):guidanceEnd>=0?text.slice(guidanceEnd+21):scopeEnd>=0?text.slice(scopeEnd+12):text).trim():text;
 if(role==='user'&&body.includes('候选摘要：\n')&&body.includes('```meb-model-review'))return <><p>请核对所附图纸，说明可确认的楼栋和仍需核实的位置。</p><details className="proposal-code"><summary>查看本次识图资料说明</summary><pre>{body}</pre></details></>;
 const codes=[...body.matchAll(/```(?:meb-change|meb-model-review)[\s\S]*?```/g)];
 const readable=responseForCopy(body);
 const view=role==='assistant'?presentDshResponse(readable):null;
 const sharedScope=role==='user'?sentMessageScope(text):'';
 return <>{view?<><AssistantReading text={view.markdown||view.summary}/>{view.detail&&<p className="assistant-result-detail">{view.detail}</p>}{view.collapsed&&<details className="proposal-code"><summary>查看完整原文</summary><pre>{view.raw}</pre></details>}</>:readable&&<p>{readable}</p>}{sharedScope&&<small className="message-context-tag">{sharedScope}</small>}{codes.length>0&&<details className="proposal-code"><summary>技术详情</summary><pre>{codes.map(m=>m[0]).join('\n')}</pre></details>}</>;
}
const emptyList={ids:[],byId:{}},emptySession={},emptyEvents={entries:[]};
const noop=()=>()=>{};
function useFeed(feed,fallback){return useSyncExternalStore(feed?fn=>feed.subscribe(fn):noop,feed?()=>feed.getSnapshot():()=>fallback);}
function projectSessions(projectId){try{const saved=JSON.parse(localStorage.getItem('meb-dsh-sessions:'+projectId)||'[]');if(Array.isArray(saved)&&saved.length)return saved.filter(s=>typeof s.id==='string'&&typeof s.title==='string');const old=localStorage.getItem('meb-dsh-session:'+projectId);return old?[{id:old,title:'之前的项目会话'}]:[];}catch{return [];}}
function tasksFor(data){
 if(data.page==='table'&&data.visibleRows===0)return [['从哪里开始','这个台账第一次录入前要准备什么？'],['先看核对方法','这类台账平时怎么检查？']];
 if(data.page==='calculator'||data.ledger==='calculation')return [['核对计算依据','这笔计算的依据可靠吗？'],['解释这笔计算','用简单的话解释这笔计算。']];
 if(data.ledger==='receipt'&&data.page==='table')return [['查缺项与签认','这批收方还有哪些没补齐？'],['查重复收方','有没有可能重复的收方？']];
 if(data.ledger==='output'&&data.page==='table')return [['核对产值口径','这批产值的口径有没有混？'],['整理待核事项','还有哪些产值资料要补？']];
 return [['核对缺项','这批记录哪里还需要核实？'],['梳理下一步','下一步先补什么？']];
}
export default function DSHAssistant({ctx,project,context,reviewPage,onClose,onProposal,onModelProposal,modelReviewRequest,onReviewRequestSettled,assistantWidth=400,resizing=false,onResizeStart,onResizeMove,onResizeEnd,onResizeKeyDown,visible=true,expanded=false,onExpand,draftCache}){
 const storageKey='meb-dsh-session:'+project.id,sessionsKey='meb-dsh-sessions:'+project.id;
 const [projectChats,setProjectChats]=useState(()=>projectSessions(project.id));
 const [sessionId,setSessionId]=useState(()=>{try{return localStorage.getItem(storageKey)||projectChats[0]?.id||'';}catch{return projectChats[0]?.id||'';}});
 const initialDraft=useRef(draftCache?.get(project.id));
 const [draft,setDraft]=useState(()=>initialDraft.current?.draft||''),[scopeMode,setScopeMode]=useState(()=>initialDraft.current?.scopeMode||'auto'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState('');
 // Unsent text belongs to its project, including after returning home or switching projects.
 // Keep this in memory only; it is not part of project backups or model context until sent.
 useEffect(()=>{draftCache?.set(project.id,{draft,scopeMode,reviewRequestId:modelReviewRequest?.sent?null:modelReviewRequest?.id});},[draft,scopeMode,project.id,draftCache,modelReviewRequest?.id,modelReviewRequest?.sent]);
 const [reviewFile,setReviewFile]=useState(null),[relatedFiles,setRelatedFiles]=useState([]),[reviewImages,setReviewImages]=useState([]),[uploadProgress,setUploadProgress]=useState(null);
 const [batch,setBatch]=useState(null),[chatQuery,setChatQuery]=useState('');
 const transcript=useRef(null),follow=useRef(true),input=useRef(null),uploadedReceipts=useRef(new WeakMap()),reviewRequestId=useRef();
 reviewRequestId.current=modelReviewRequest?.id;
 const list=useFeed(ctx.sessions?.list,emptyList),binding=sessionId?ctx.sessions?.binding(sessionId):null;
 const session=useFeed(binding?.session,emptySession),events=useFeed(binding?.eventSource,emptyEvents);
 const messages=sessionMessages(events.entries),available=!!ctx.sessions,data=JSON.parse(context),scope=assistantScope(context,scopeMode);
 const subject=data.page==='calculator'?'当前计算表':data.page==='materials'?'材料价格库':data.page==='table'?ledgerNames[data.ledger]:'项目资料';
 const tasks=tasksFor(data);
 const emptyTable=data.page==='table'&&data.visibleRows===0;
 useEffect(()=>{if(modelReviewRequest?.id&&!modelReviewRequest.sent){uploadedReceipts.current=new WeakMap();setDraft(initialDraft.current?.reviewRequestId===modelReviewRequest.id?initialDraft.current.draft:modelReviewRequest.text);setReviewFile(modelReviewRequest.file||null);setRelatedFiles(modelReviewRequest.relatedFiles||[]);setReviewImages(modelReviewRequest.visualFiles||[]);setUploadProgress(null);setReceipt('图纸已准备好，发送后由 DSH 核对。识别建议需要你复核后采用。');}},[modelReviewRequest?.id]);
 useEffect(()=>{try{if(sessionId&&list.byId[sessionId])ctx.sessions.open(sessionId);}catch(e){setError(e.message);}},[sessionId,list.byId[sessionId]?.id]);
 useEffect(()=>{if(follow.current&&transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;},[events,session.pendingSubmissions,session.queue]);
 function selectChat(id){if(id===sessionId)return;setBatch(null);setSessionId(id);setReceipt('已切换会话；待发送的问题仍保留。');setError('');try{localStorage.setItem(storageKey,id);}catch{setError('已切换会话，但未能记住选择；刷新后请重新选择。');}}
 async function createChat(){
  const id=await ctx.sessions.create(),b=ctx.sessions.binding(id);if(!b)throw Error('项目会话尚未就绪，请稍后重试。');
  const title=subject+'核对 '+(projectChats.length+1)+' · '+new Date().toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}),chats=[{id,title},...projectChats];
  setProjectChats(chats);setSessionId(id);ctx.sessions.open(id);
  try{localStorage.setItem(storageKey,id);localStorage.setItem(sessionsKey,JSON.stringify(chats));}catch{setError('会话已建立，但未能记住会话列表；可在 DSH 完整会话中找回。');}
  const named=await b.session.rename('MEB · '+project.name+' · '+title);if(!named.ok)setError('会话已建立，名称未更新；仍可继续核对。');
  return {id,binding:b};
 }
 async function connect(){setBusy(true);setError('');try{await createChat();setBatch(null);setReceipt('已新建会话，待发送的问题和图纸已保留。');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function continueBatch(){
  if(!batch||busy||session.running||session.pendingSubmissions?.length||session.queue?.length||batch.sessionId!==sessionId)return;
  setBusy(true);setError('');follow.current=true;
  try{
   await workbenchRequest('bind-session',{sessionId,projectId:project.id});
   const result=await sendReviewPage(binding.session,batch.page,batch.next,batch.question);
   setBatch({...batch,next:result.next,sent:result.sent});setReceipt('下一批资料已发送给 DSH，请查看实际核对回复。');
  }catch(e){setError('这一批未能发送，保留原范围，可重试。'+e.message);}finally{setBusy(false);}
 }
 async function send(){
  if(!draft.trim()||!available||busy)return;
  const submitted=draft,file=reviewFile,related=relatedFiles,images=reviewImages,requestId=modelReviewRequest?.id;
  setBusy(true);setError('');setReceipt('');follow.current=true;
  try{
   if(file&&submitted.trim().startsWith('/'))throw Error('请先完成图纸核对，再单独发送 DSH 指令。');
   const target=binding?{id:sessionId,binding}:await createChat();ctx.sessions.open(target.id);await workbenchRequest('bind-session',{sessionId:target.id,projectId:project.id});
   if(submitted.trim().startsWith('/')){
    const r=await target.binding.session.command(submitted.trim());if(!r.ok)throw Error(r.error.message);if(!r.value.matched)throw Error('DSH 未识别此指令，请打开完整会话查看可用指令。');
   }else{
    const parts=[],files=[...(file?[file]:[]),...related,...images];
    if(files.length&&!ctx.fileUpload?.available)throw Error('图纸未能发送：附件服务暂不可用。请稍后重试。');
    for(let i=0;i<files.length;i++){
     setUploadProgress({label:`正在发送第 ${i+1}/${files.length} 份图纸资料`});
     const receiptId=await uploadReviewFile(ctx.fileUpload,target.id,files[i],uploadedReceipts.current);
     parts.push({type:'file',receiptId});
    }
    if(!files.length&&scopeMode!=='none'&&scope.snapshot&&reviewPage&&['table','materials'].includes(data.page)&&data.omittedAfter>0){
     const result=await sendReviewPage(target.binding.session,reviewPage,0,submitted);
     setBatch({page:reviewPage,question:submitted,sessionId:target.id,next:result.next,sent:result.sent,total:result.total,label:subject});
    }else{await submitPrompt(target.binding.session,workbenchPrompt(submitted,context,scopeMode!=='none'&&!file,scope.snapshot),parts);setBatch(null);}
   }
   if(draftCache?.get(project.id)?.draft===submitted)draftCache.set(project.id,{...draftCache.get(project.id),draft:''});
   onReviewRequestSettled?.(requestId,'sent');
   if(reviewRequestId.current===requestId){uploadedReceipts.current=new WeakMap();setDraft(current=>current===submitted?'':current);setReviewFile(null);setRelatedFiles([]);setReviewImages([]);setUploadProgress(null);}
   setReceipt(submitted.trim().startsWith('/')?'指令已交给 DSH，处理过程可在完整会话查看。':'已发送给 DSH。');
  }catch(e){setUploadProgress(null);setError('未发送，问题已保留。'+e.message);}finally{setBusy(false);}
 }
 function openFull(){if(!sessionId)return;ctx.sessions.open(sessionId);ctx.layout.selectPanel(null);}
 function readLatest(){const panel=transcript.current,replies=panel?.querySelectorAll('article.assistant'),last=replies?.[replies.length-1];if(last){follow.current=false;panel.scrollTo({top:panel.scrollTop+last.getBoundingClientRect().top-panel.getBoundingClientRect().top,behavior:'smooth'});}}
 function chooseTask(text){setDraft(text);setReceipt('问题已填入下方，可修改后发送。');input.current?.focus();}
 async function copyReply(text){try{await navigator.clipboard.writeText(replyForClipboard(text));setReceipt('已复制这条回复的正文。');setError('');}catch{setError('复制失败，请选中回复文字后手动复制。');}}
 const quickTasks=<div className="assistant-tasks">{tasks.map(([label,text])=><button key={label} type="button" disabled={busy||!!reviewFile} onClick={()=>chooseTask(text)}>{label} <span aria-hidden="true">↗</span></button>)}</div>;
 return <aside className={'dsh-assistant'+(expanded?' assistant-reading-layout':'')+(resizing?' is-resizing':'')} style={{'--dsh-assistant-width':`${assistantWidth}px`}} aria-label="DSH 项目助手" hidden={!visible}>
  <style>{assistantCSS}</style><div className="assistant-resize-handle" role="separator" aria-orientation="vertical" aria-label="调整 DSH 助手宽度" aria-valuemin="300" aria-valuemax="720" aria-valuenow={assistantWidth} tabIndex="0" onPointerDown={onResizeStart} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} onPointerCancel={onResizeEnd} onKeyDown={onResizeKeyDown}/>
  <div className="assistant-heading"><div><UIIcon name="sparkles" size={21}/><h2>项目助手</h2><small>{project.name} · {subject}</small></div><div className="assistant-window-actions"><HelpNote label="项目助手使用说明">结合当前项目核对已保存资料；发送当前记录前可调整范围。附件、原图和未保存记录不会自动发送。修改建议须经预览确认。</HelpNote><button onClick={onExpand} aria-label={expanded?'侧栏显示助手':'展开助手阅读区'} title={expanded?'侧栏显示':'展开阅读区'}><UIIcon name="columns"/></button><button aria-label="关闭项目助手" onClick={onClose}><UIIcon name="close"/></button></div></div>
  <div className="assistant-layout"><nav className="assistant-history" aria-label="项目会话历史"><button className="primary" disabled={!available||busy} onClick={connect}><UIIcon name="plus"/>新建会话</button><label><UIIcon name="search"/><input aria-label="搜索项目会话" placeholder="搜索会话…" value={chatQuery} onChange={e=>setChatQuery(e.target.value)}/></label><h3>本项目会话</h3><div>{projectChats.filter(c=>c.title.toLowerCase().includes(chatQuery.toLowerCase())).map(chat=><button key={chat.id} aria-current={chat.id===sessionId?'page':undefined} disabled={busy} onClick={()=>selectChat(chat.id)}><UIIcon name="sparkles"/><span>{chat.title}</span></button>)}{!projectChats.length&&<p>发送问题后自动创建会话</p>}</div><footer><UIIcon name="project"/><span>{project.name}</span></footer></nav><div className="assistant-conversation">
  <div className="assistant-connection"><div className="assistant-chat-picker"><span>{session.running?'正在处理…':binding?projectChats.find(chat=>chat.id===sessionId)?.title||'项目会话':'发送后开始项目会话'}</span>{projectChats.length>1&&<details><summary>历史会话</summary><div className="assistant-chat-list">{projectChats.map(chat=><button key={chat.id} type="button" disabled={busy||chat.id===sessionId} onClick={e=>{selectChat(chat.id);e.currentTarget.closest('details').open=false;}}>{chat.title}{chat.id===sessionId?' · 当前':''}</button>)}</div></details>}</div><div className="assistant-chat-actions">{messages.some(m=>m.role==='assistant')&&<button type="button" onClick={readLatest}>最新回复</button>}{available&&binding&&<button type="button" disabled={busy} onClick={connect}>新建会话</button>}{binding&&<button type="button" onClick={openFull}>完整会话 ↗</button>}</div></div>
  {!available?<div className="assistant-empty"><h3>在 DSH 中开始核对</h3><p>请从 DSH 打开 MEB 工作台，即可结合项目资料提问、核对和查看处理过程。</p></div>:<>
   <div className="assistant-transcript" ref={transcript} onScroll={e=>{const el=e.currentTarget;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}} aria-live="polite">
    {session.hasMore&&<button onClick={()=>binding.session.loadOlder().catch(e=>setError(e.message))}>查看更早的核对记录</button>}
    {!messages.length&&<div className="assistant-empty"><header><h3>{emptyTable?'先录入资料，或咨询方法':'开始项目核对'}</h3><HelpNote label="项目助手使用说明">{emptyTable?'具体记录需先在台账录入或调整筛选。':'选择常用问题或直接提问；发送前检查核对范围，回复会标明依据和待核事项。'}</HelpNote></header>{quickTasks}</div>}
    {messages.map(m=><article key={m.id} className={'assistant-message '+m.role}><strong>{m.role==='user'?'你':'DSH'}</strong><MessageText text={m.text} role={m.role}/>{m.role==='assistant'&&!m.id.startsWith('live')&&<div className="assistant-reply-actions">{responseForCopy(m.text)&&<button type="button" onClick={()=>copyReply(m.text)}>复制正文</button>}{hasChanges(m.text)&&<button type="button" onClick={()=>{try{onProposal(extractChanges(m.text));}catch(e){setError(e.message);}}}>核对修改建议</button>}{m.text.includes('```meb-model-review')&&<button type="button" onClick={()=>{try{onModelProposal(extractDwgReviewSuggestion(m.text,modelReviewRequest));}catch(e){setError(e.message);}}}>核对楼栋识别建议</button>}</div>}</article>)}
    {(session.pendingSubmissions||[]).map(p=><article key={p.requestId} className="assistant-message user"><strong>正在发送</strong><MessageText text={p.text} role="user"/></article>)}
    {(session.queue||[]).map(p=><article key={p.id} className="assistant-message user"><strong>已排队 · 等待处理</strong><MessageText text={p.text||p.preview} role="user"/></article>)}
    {session.openError&&<p role="alert">会话未能打开：{session.openError.message}</p>}{session.lastAgentError&&<p role="alert">本次处理未完成：{session.lastAgentError}</p>}
    {session.running&&<div className="assistant-running" role="status">DSH 正在核对资料。<button type="button" onClick={openFull}>查看处理过程 ↗</button><span>如需授权，可在完整会话中处理。</span></div>}
    {session.promptError&&<p role="alert">消息未能处理：{session.promptError.error?.message}</p>}
   </div>
   <div className="assistant-compose">
    {reviewFile?<div className="assistant-file-chip"><span><strong>本次核对图纸</strong>{reviewFile.name}{relatedFiles.length>0?`，另有 ${relatedFiles.length} 张关联图纸`:''}{reviewImages.length>0?`、${reviewImages.length} 张审图图片`:''}<small>{uploadProgress?.label||'发送后保存在本项目的 DSH 会话中。'}</small></span><button type="button" disabled={busy} onClick={()=>{setReviewFile(null);setRelatedFiles([]);setReviewImages([]);setDraft('');setReceipt('');onReviewRequestSettled?.(modelReviewRequest?.id,'cancelled');}}>取消识图</button></div>:<div className="assistant-scope-card"><div className="assistant-scope"><span>核对范围</span><UISelect aria-label="DSH 可以使用的资料" disabled={busy} value={scopeMode} onChange={e=>setScopeMode(e.target.value)}><option value="auto">{scopeMode==='auto'?scope.label:'自动选择合适范围'}</option><option value="view">发送当前记录</option><option value="none">只问方法，不带项目资料</option></UISelect></div><HelpNote label="核对范围说明" side="up">{scope.detail}</HelpNote></div>}
    {!batch&&!reviewFile&&scopeMode!=='none'&&scope.partial&&<p className="assistant-scope-warning" role="status">{reviewPage&&['table','materials'].includes(data.page)&&data.omittedAfter>0?`共 ${data.visibleRows} 条记录，将分批发送；每批回复后可继续下一批。`:`本次仅附带 ${scope.attached} 条记录，部分内容未包含。请缩小范围分批核对。`}{data.clippedFields>0?' 部分长文字已截短，需另行核实原记录。':''}</p>}
    {batch&&<section className="assistant-batch" aria-label="分批核对进度"><strong>{batch.label} · 已发送 {batch.sent} / {batch.total} 条</strong><HelpNote label="分批核对说明" side="up">沿用首次发送的资料和问题。发送进度不代表核对完成；跨批重复项需汇总核实。</HelpNote>{batch.next!==null?<button type="button" disabled={busy||session.running||!!session.pendingSubmissions?.length||!!session.queue?.length} onClick={continueBatch}>继续下一批</button>:<span>本次范围已全部发送，请查看 DSH 的核对结论。</span>}<button type="button" disabled={busy} onClick={()=>{setBatch(null);setReceipt('已结束分批发送，已有回复保留。');}}>结束本次分批</button></section>}
    {messages.length>0&&!reviewFile&&<details className="assistant-shortcuts"><summary>常用核对</summary>{quickTasks}</details>}
    {reviewFile?<p className="assistant-review-note">请 DSH 说明哪些楼栋能够确认、哪些仍需核实，并保留图纸依据。</p>:<><label className="assistant-input-label" htmlFor={'assistant-question-'+project.id}>要核对的问题</label><textarea id={'assistant-question-'+project.id} ref={input} aria-label="要核对的问题" placeholder="例如：这批收方还有哪些数量、单位或签认没补齐？" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send();}}}/></>}
    {error&&<p className="assistant-error" role="alert">{error}{error.startsWith('未发送')&&<span>重试时会按当前核对范围重新取资料。</span>}</p>}
    <div className="assistant-send-actions"><small>⌘ / Ctrl + Enter 发送</small>{session.running&&<button type="button" onClick={()=>binding.session.cancel().then(r=>{if(!r.ok)setError(r.error.message);else setReceipt('已请求停止，已有回复保留。');}).catch(e=>setError(e.message))}>停止处理</button>}<button className="primary" disabled={busy||!draft.trim()} onClick={send}>{busy?'正在发送…':reviewFile?'发送图纸核对':error.startsWith('未发送')?'重新发送':session.running?'排队发送':'发送给 DSH'}</button></div>
   </div>
  </>}
  {receipt&&<p className="assistant-receipt" role="status">{receipt}</p>}
  </div><section className="assistant-context-panel" aria-label="当前核对资料"><h3>核对资料</h3><dl><div><dt>项目</dt><dd>{project.name}</dd></div><div><dt>当前页面</dt><dd>{subject}</dd></div>{data.worksheetName&&<div><dt>工作表</dt><dd>{data.worksheetName}</dd></div>}<div><dt>数据状态</dt><dd>{data.dataState}</dd></div>{['table','materials'].includes(data.page)&&<div><dt>当前记录</dt><dd>{data.visibleRows} 条{data.selectedCount?' · 已勾选 '+data.selectedCount+' 条':''}</dd></div>}</dl><div className="assistant-context-footer"><UIIcon name="check"/><span>只读查询；修改建议须确认后保存</span></div></section></div>
 </aside>;
}
