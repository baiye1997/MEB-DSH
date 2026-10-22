import React,{useEffect,useRef,useState} from 'react';
import UISelect from './ui-select.jsx';
import {addDwgContours,adoptedDwgContours} from './dwg-model.js';
import {makeDwgReviewRequest,makeDwgReferenceRequest,sharedPlanCandidateNumbers} from './dwg-assistant.js';

function Footprint({points}){
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(1,Math.max(...xs)-minX),h=Math.max(1,Math.max(...ys)-minY);
 return <svg className="dwg-footprint" viewBox="0 0 180 100" role="img" aria-label="轮廓预览"><polygon points={points.map(([px,py])=>`${8+(px-minX)*164/w},${92-(py-minY)*84/h}`).join(' ')} /></svg>;
}

function PlanMap({shapes,label,focus}){
 const points=shapes.flatMap(shape=>shape.points||[]);
 if(!points.length)return null;
 const frame=focus?.length?focus:points;
 const xs=frame.map(p=>p[0]),ys=frame.map(p=>p[1]),frameMinX=Math.min(...xs),frameMinY=Math.min(...ys);
 const frameWidth=Math.max(1,Math.max(...xs)-frameMinX),frameHeight=Math.max(1,Math.max(...ys)-frameMinY);
 const width=focus?Math.max(110,frameWidth*1.7):frameWidth,height=focus?Math.max(80,frameHeight*1.7):frameHeight;
 const minX=frameMinX-(width-frameWidth)/2,minY=frameMinY-(height-frameHeight)/2;
 const scale=Math.min(364/width,154/height),left=(400-width*scale)/2,top=(190-height*scale)/2;
 const plot=polygon=>polygon.map(([x,y])=>`${(left+(x-minX)*scale).toFixed(1)},${(190-top-(y-minY)*scale).toFixed(1)}`).join(' ');
 const ordered=[...shapes.filter(s=>s.kind==='other'||s.kind==='existing'),...shapes.filter(s=>s.kind!=='other'&&s.kind!=='existing')];
 return <svg className="dwg-plan-map" viewBox="0 0 400 190" role="img" aria-label={label}>{ordered.map((shape,i)=><polygon key={`${shape.id}-${i}`} className={shape.kind} points={plot(shape.points)}><title>{shape.label}</title></polygon>)}</svg>;
}

const factor={mm:.001,cm:.01,m:1};
const buildingLayerHint=c=>/SITE-BLD|WALL|建筑|外墙|轮廓/i.test(c.layer||'');
async function pngFromReviewSvg(svg,name){
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  canvas.getContext('2d').drawImage(image,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('无法生成审图 PNG');
  return new File([blob],name,{type:'image/png'});
 }finally{URL.revokeObjectURL(url);}
}
function suggestedX(config,cad){
 const buildings=config.mode==='cad'?cad.buildings:config.buildings;
 const xs=buildings.flatMap(b=>b.polygon?.map(p=>p[0])||(Number.isFinite(b.x)&&Number.isFinite(b.width)?[b.x+b.width]:[]));
 return xs.length?Math.ceil(Math.max(...xs)+20):0;
}

export default function DwgReview({config,cad,hasModel,onImport,onRenderEvidence,onAdopt,onAskDsh,suggestion,disabled}){
 const input=useRef();
 const evidenceUrl=useRef(''),evidenceRequest=useRef(0);
 const [queue,setQueue]=useState([]),[batch,setBatch]=useState([]),[pending,setPending]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
 const [selected,setSelected]=useState([]),[units,setUnits]=useState('mm'),[layerQuery,setLayerQuery]=useState(''),[layerScope,setLayerScope]=useState('all'),[hovered,setHovered]=useState(null);
 const [evidence,setEvidence]=useState(null),[evidenceBusy,setEvidenceBusy]=useState(false),[evidenceZoom,setEvidenceZoom]=useState(false),[showCadSetup,setShowCadSetup]=useState(false);
 const [lot,setLot]=useState(''),[action,setAction]=useState(hasModel?'append':'replace'),[alignment,setAlignment]=useState('manual'),[offsetX,setOffsetX]=useState('0'),[offsetY,setOffsetY]=useState('0');
 const result=queue[0];
 useEffect(()=>()=>{evidenceRequest.current++;if(evidenceUrl.current)URL.revokeObjectURL(evidenceUrl.current);},[]);
 useEffect(()=>{if(!evidenceZoom)return;const close=event=>{if(event.key==='Escape')setEvidenceZoom(false);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[evidenceZoom]);
 function clearEvidence(){evidenceRequest.current++;if(evidenceUrl.current)URL.revokeObjectURL(evidenceUrl.current);evidenceUrl.current='';setEvidence(null);setEvidenceBusy(false);setEvidenceZoom(false);}
 function startReview(items,append=hasModel,currentConfig=config,all=items){
  clearEvidence();
  setQueue(items);setBatch(all);setSelected([]);setLayerQuery('');setLayerScope('all');setHovered(null);setUnits(items[0]?.units||'mm');setLot('');
  setAction(append?'append':'replace');setAlignment('manual');setOffsetX(String(append?suggestedX(currentConfig,cad):0));setOffsetY('0');
 }
 async function importFiles(files){
  if(!files.length)return;
  if(files.length>8){setError('一次最多选择 8 张 DWG；完成后仍可继续追加。');return;}
  setPending(true);setError('');const items=[],failures=[];
  for(let i=0;i<files.length;i++){
   setProgress(`正在识别 ${i+1} / ${files.length} 张：${files[i].name}`);
   try{const data=await onImport(files[i]);if(data.drawingUse==='reference'||data.candidates.length)items.push({...data,originalFile:files[i]});else failures.push(`${files[i].name}：未找到可审阅的建筑轮廓`);}
   catch(e){failures.push(`${files[i].name}：${e.message}`);}
  }
  startReview(items);setError(failures.join('；'));setPending(false);setProgress('');input.current.value='';
 }
 const ratio=result?factor[units]/factor[result.units]:1;
 const adopted=action==='append'?adoptedDwgContours(config,result):new Map();
 const hintedCount=result?result.candidates.filter(buildingLayerHint).length:0;
 const visible=result?result.candidates.map((c,i)=>({c,i})).filter(({c,i})=>(layerScope==='all'||buildingLayerHint(c))&&(!layerQuery.trim()||`${i+1} ${c.layer} ${c.width} ${c.depth}`.toLowerCase().includes(layerQuery.trim().toLowerCase()))):[];
 const hiddenSelected=selected.filter(i=>!visible.some(item=>item.i===i));
 const suggestedNumbers=result&&suggestion?.sourceSha256===result.source.sha256?suggestion.candidateNumbers.filter(n=>result.candidates[n-1]&&!adopted.has(result.candidates[n-1].index)):[];
 const suggestedSet=new Set(suggestedNumbers);
 const mapped=[...visible,...hiddenSelected.map(i=>({c:result.candidates[i],i}))];
 const focused=visible.find(({i})=>i===hovered)||mapped.find(({i})=>i===selected.at(-1))||visible[0];
 const shownEvidence=evidence?.sha===result?.source.sha256&&evidence?.number===focused?.i+1?evidence:null;
 async function showEvidence(){
  if(!focused||!onRenderEvidence||evidenceBusy)return;
  if(shownEvidence){clearEvidence();return;}
  const request=++evidenceRequest.current,number=focused.i+1,sha=result.source.sha256;
  setEvidenceBusy(true);setError('');
  try{
   const rendered=await onRenderEvidence(result.originalFile,[number],sha);
   if(rendered.sourceSha256!==sha||rendered.candidateNumbers.length!==1||rendered.candidateNumbers[0]!==number||rendered.pages.length!==1)throw Error('图像与当前候选不一致');
   const url=URL.createObjectURL(new Blob([rendered.pages[0]],{type:'image/svg+xml'}));
   if(request!==evidenceRequest.current){URL.revokeObjectURL(url);return;}
   if(evidenceUrl.current)URL.revokeObjectURL(evidenceUrl.current);
   evidenceUrl.current=url;setEvidence({sha,number,url});setEvidenceZoom(false);
  }catch(e){if(request===evidenceRequest.current)setError(`无法查看图纸局部：${e.message}`);}
  finally{if(request===evidenceRequest.current)setEvidenceBusy(false);}
 }
 const placement=()=>({units,lot,append:action==='append',alignment,x:Number(offsetX),y:Number(offsetY)});
 let placed=null,placementError='';
 if(result&&selected.length){
  try{
   if(!offsetX.trim()||!offsetY.trim())throw Error('请填写放置位置');
   placed=addDwgContours(config,cad,result,selected,placement());
  }catch(e){placementError=e.message;}
 }
 function advance(nextConfig=config,adopted=false){
  const rest=queue.slice(1);startReview(rest,adopted||action==='append',nextConfig,batch);setError('');
 }
 function adopt(){
  try{
   if(placementError)throw Error(placementError);
   const nextConfig=onAdopt(result,selected,placement());advance(nextConfig,true);
  }catch(e){setError(e.message);}
 }
 async function askDsh(){
  setPending(true);setProgress('正在生成带编号的 DWG 审图图像…');setError('');
  try{
   const evidence=await onRenderEvidence(result.originalFile,visible.map(({i})=>i+1),result.source.sha256);
   if(evidence.sourceSha256!==result.source.sha256||evidence.candidateNumbers.join(',')!==visible.map(({i})=>i+1).join(','))throw Error('审图图像与当前候选编号不一致');
   const images=await Promise.all(evidence.pages.map((svg,i)=>pngFromReviewSvg(svg,`DWG-候选审图-${i+1}.png`)));
   const related=batch.filter(item=>item.drawingUse==='plan'&&item.source.sha256!==result.source.sha256);
   for(const [drawingIndex,drawing] of related.entries()){
    if(drawing.drawingUse==='reference'||!drawing.candidates.length)continue;
    const shared=new Set(sharedPlanCandidateNumbers(drawing,related));
    const numbers=drawing.candidates.map((c,i)=>({c,n:i+1})).filter(({c,n})=>buildingLayerHint(c)&&!shared.has(n)).slice(0,6).map(({n})=>n);
    if(!numbers.length)continue;
    const rendered=await onRenderEvidence(drawing.originalFile,numbers,drawing.source.sha256);
    if(rendered.sourceSha256!==drawing.source.sha256||rendered.candidateNumbers.join(',')!==numbers.join(','))throw Error(`${drawing.source.name} 的审图图像与候选编号不一致`);
    images.push(...await Promise.all(rendered.pages.map((svg,i)=>pngFromReviewSvg(svg,`关联图${drawingIndex+1}-${drawing.source.name.replace(/\.dwg$/i,'')}-候选${i+1}.png`))));
   }
   onAskDsh({...makeDwgReviewRequest(result,visible,{units,lot,buildings:config.buildings,visualPages:evidence.pages.length,relatedVisualPages:images.length-evidence.pages.length,relatedDrawings:related}),file:result.originalFile,relatedFiles:related.map(item=>item.originalFile).filter(Boolean),visualFiles:images});
  }catch(e){setError(`审图图像未发送：${e.message}`);}finally{setPending(false);setProgress('');}
 }
 return <section className="dwg-review">
  <div className="dwg-review-bar"><input ref={input} hidden type="file" accept=".dwg" multiple aria-label="选择 DWG 图纸" onChange={e=>importFiles([...e.target.files])}/><button type="button" disabled={disabled||pending} onClick={()=>input.current.click()}>{pending?'正在识别 DWG…':'上传 DWG 图纸'}</button><span>{progress||'可一次选择多张，逐张核对并追加；原图只读。'}</span><button type="button" className="dwg-dependency-button" onClick={()=>setShowCadSetup(open=>!open)} aria-expanded={showCadSetup}>DWG 依赖说明</button></div>
  {showCadSetup&&<aside className="dwg-dependency-note" role="note"><strong>DWG 识别需要本机 CAD 依赖</strong><p>npm 包不携带 LibreDWG 或 Python 虚拟环境。macOS 按以下默认路径安装后，可重新上传图纸。</p><code>brew install libredwg<br/>python3 -m venv ~/.local/share/meb-cad<br/>~/.local/share/meb-cad/bin/python -m pip install ezdxf==1.4.4</code><p>自定义 Python 路径时，设置 <code>MEB_PYTHON</code> 后重启 DSH。Windows/Linux 请按发行版安装 LibreDWG，并使用能导入 <code>ezdxf</code> 的 Python。</p></aside>}
  {error&&<p role="alert" className="model-editor-error">{error}</p>}
  {result?.drawingUse==='reference'&&<div className="dwg-review-results"><header><strong>{result.source.name} · 高度参考图</strong><span>待审阅 {queue.length} 张</span></header><p>立面、剖面图可用于核对楼层与高度；楼栋轮廓和位置仍从总图、平面图选取。{result.skippedBlocks>0?`本图有 ${result.skippedBlocks} 处缺失块定义，解析不完整。`:''}本地找到 {result.referenceHints?.length||0} 条高度相关文字线索，均待原图核实。</p>{!!result.referenceHints?.length&&<details><summary>查看图中文字线索</summary><ul>{result.referenceHints.slice(0,12).map((hint,i)=><li key={i}>{hint.text}</li>)}</ul></details>}<footer><span>不会自动填写层高或修改模型</span><div><button type="button" disabled={pending||!onAskDsh} onClick={()=>{try{onAskDsh({...makeDwgReferenceRequest(result,{buildings:config.buildings}),file:result.originalFile,visualFiles:[]});}catch(e){setError(e.message);}}}>✦ 交给 DSH 核对层高</button><button type="button" onClick={()=>advance()}>{queue.length>1?'下一张':'结束审阅'}</button></div></footer></div>}
  {result&&result.drawingUse!=='reference'&&<div className="dwg-review-results">
   <header><strong>{result.source.name} · {result.candidates.length} 个候选轮廓</strong><span>待审阅 {queue.length} 张</span></header>
   <div className="dwg-review-options">
    <label>图纸单位<UISelect aria-label="DWG 图纸单位" value={units} onChange={e=>setUnits(e.target.value)}><option value="mm">毫米</option><option value="cm">厘米</option><option value="m">米</option></UISelect></label>
    <label>导入方式<UISelect aria-label="DWG 导入方式" value={action} onChange={e=>{setAction(e.target.value);setSelected([]);setAlignment('manual');setOffsetX(String(e.target.value==='append'?suggestedX(config,cad):0));}}><option value="replace">建立新模型</option>{(hasModel||config.mode==='imported')&&<option value="append">追加到当前模型</option>}</UISelect></label>
    <label>标段 / 分组 · 每张图确认<input aria-label="标段或楼栋分组" maxLength="80" value={lot} onChange={e=>setLot(e.target.value)} placeholder="例如：二标段；未划分可填未分标段"/></label>
    <label>坐标对齐<UISelect aria-label="图纸坐标对齐方式" value={alignment} onChange={e=>setAlignment(e.target.value)}><option value="manual">手动放置</option>{action==='append'&&config.coordinateOrigin&&result.origin&&<option value="shared">沿用同一 CAD 坐标</option>}</UISelect></label>
    {alignment==='manual'&&<><label>放置 X · 米<input aria-label="图纸放置 X" inputMode="decimal" value={offsetX} onChange={e=>setOffsetX(e.target.value)}/></label><label>放置 Y · 米<input aria-label="图纸放置 Y" inputMode="decimal" value={offsetY} onChange={e=>setOffsetY(e.target.value)}/></label></>}
   </div>
    <p>{result.unitsConfirmed?'图纸声明了单位，请核对。':'图纸未声明单位，已按坐标范围猜测；请对照已知建筑尺寸确认。'} {alignment==='manual'?'各图纸坐标可能不同；放置位置是参考值，生成前须核对楼栋相对位置。':'仅在图纸共用原 CAD 坐标时选择；距离异常会阻止采用。'} {result.skippedBlocks>0?`有 ${result.skippedBlocks} 处缺失块定义，提取不完整；请补齐外部参照或换完整图纸。`:''}{result.truncated?'图元过多，仅检查了前 50 万个，可能漏掉轮廓；请换更聚焦的建筑图纸。':''}{result.candidateLimitReached?'候选较多，仅列出排序前 200 个；请换更聚焦的建筑图纸。':''}采用轮廓后可自行填写楼层数和每层层高，无需等待立面标高解析。</p>
   <div className="dwg-review-body">
    <div className="dwg-review-list"><div className="dwg-candidates-heading"><div><strong>图纸轮廓</strong><span>按图层与闭合度排序；对照原图确认楼栋。</span></div><div className="dwg-candidate-scope" role="group" aria-label="候选轮廓范围"><button type="button" aria-pressed={layerScope==='all'} onClick={()=>setLayerScope('all')}>全部 {result.candidates.length}</button><button type="button" aria-pressed={layerScope==='hinted'} onClick={()=>setLayerScope('hinted')}>建筑图层线索 {hintedCount}</button></div><input type="search" aria-label="查找轮廓图层或尺寸" placeholder="找图层、编号或尺寸" value={layerQuery} onChange={e=>setLayerQuery(e.target.value)}/><div className="dwg-dsh-handoff"><button type="button" disabled={pending||!onAskDsh||!onRenderEvidence||!visible.length||visible.length>24} onClick={askDsh}>✦ 交给 DSH 初筛</button><small>{visible.length>24?'请先筛选到 24 个以内':'发送原始 DWG 与编号图像，保留人工核对'}</small></div>{suggestion?.sourceSha256===result.source.sha256&&<div className="dwg-dsh-suggestion"><strong>{suggestion.unverified?(suggestedNumbers.length?`DSH 根据${suggestion.evidenceBasis==='visual'?'编号图像':'解析标注'}提出 ${suggestedNumbers.length} 个待核轮廓`:'DSH 未完成原图核对'):`DSH 提出 ${suggestedNumbers.length} 个待核轮廓`}</strong><small>{suggestion.unverified?'候选轮廓尚未对应到可核实的原图实体；标记仅供人工对照，不会自动采用。':'已在列表标记；请逐个对照原图，再手动勾选。'}</small>{suggestion.drawingMatches?.length>0&&<ul>{suggestion.drawingMatches.map((m,i)=><li key={i}>#{m.candidateNumber} · {m.buildingName} ↔ {m.relatedDrawing} #{m.relatedCandidateNumber} · {m.evidence}</li>)}</ul>}{(suggestion.sourceEvidence||suggestion.reason)&&<details><summary>查看判断依据与图纸证据</summary>{suggestion.sourceEvidence&&<p>{suggestion.evidenceBasis==='parsed'?'本地解析标注':suggestion.evidenceBasis==='visual'?'编号审图图像':'原图核对'}：{suggestion.sourceEvidence}</p>}{suggestion.reason&&<p>{suggestion.reason}</p>}</details>}</div>}</div>
     <div className="dwg-candidates">{visible.map(({c,i})=>{const used=adopted.get(c.index);return <label key={i} className={'dwg-candidate '+(used?'adopted':selected.includes(i)?'selected':'')} onMouseEnter={()=>setHovered(i)}><input type="checkbox" disabled={!!used} checked={selected.includes(i)} onChange={e=>{const checked=e.target.checked;setHovered(i);setSelected(old=>checked?[...old,i]:old.filter(v=>v!==i));}}/><Footprint points={c.points}/><span><strong>#{i+1} · {(c.width*ratio).toFixed(1)} × {(c.depth*ratio).toFixed(1)} m {suggestedSet.has(i+1)&&<em className="dwg-dsh-mark">DSH 待核</em>}</strong><small title={c.layer}>{c.sheetHint||c.layer}</small><small>约 {(c.area*ratio*ratio).toFixed(0)} m²{c.gap*ratio>=.05?` · 开口 ${(c.gap*ratio).toFixed(1)} m，需核对`:''}</small>{c.localAnnotations?.length>0&&<small title={c.localAnnotations.map(a=>a.text).join(' · ')}>附近标注：{c.localAnnotations.slice(0,2).map(a=>a.text).join(' · ')}</small>}{used&&<small className="dwg-used">已采用 · {used.lot||'未分标段'} / {used.number} · {used.name}</small>}</span></label>})}</div>
     {!visible.length&&<p className="dwg-candidates-empty">当前条件下没有轮廓。可清空搜索或切回“全部 {result.candidates.length}”。</p>}
    </div>
    <div className="dwg-review-maps"><div><div className="dwg-map-head"><strong>图纸内位置 · #{focused?focused.i+1:'—'}</strong><button type="button" disabled={!focused||!onRenderEvidence||evidenceBusy} onClick={showEvidence}>{evidenceBusy?'读取局部线条…':shownEvidence?'返回简图':'查看 DWG 局部线条'}</button></div>{shownEvidence?<button type="button" className="dwg-evidence-thumb" onClick={()=>setEvidenceZoom(true)} aria-label={`放大候选 #${shownEvidence.number} 的 DWG 局部线条`}><img className="dwg-local-evidence" src={shownEvidence.url} alt={`DWG 候选 #${shownEvidence.number} 的局部线条及红色轮廓`}/><span>点击放大</span></button>:<PlanMap label="当前轮廓附近的图纸位置示意" focus={focused?.c.points} shapes={mapped.map(({c,i})=>({id:i,points:c.points,label:`轮廓 ${i+1} ${c.layer}`,kind:selected.includes(i)?'selected':hovered===i?'hovered':'other'}))}/>}<small>{shownEvidence?'红色为候选，背景为转换后的 DWG 局部线条；天正对象和绑定图可能缺失，仍需核对完整原图。':'停在候选上可切换位置；查看局部线条后再决定是否勾选。'}</small></div>{selected.length>0&&<div><strong>项目内放置</strong>{placed?<PlanMap label="现有楼栋与拟加入轮廓的位置预览" shapes={placed.buildings.map((b,i)=>({id:b.id,points:b.polygon,label:`${b.lot||'未分标段'} ${b.number} ${b.name}`,kind:i>=placed.buildings.length-selected.length?'proposed':'existing'}))}/>:<p role="alert">{placementError}</p>}<small>深色为现有楼栋，橙色为拟加入轮廓；采用前核对重叠和方位。</small></div>}</div>
   </div>
   {evidenceZoom&&shownEvidence&&<div className="dwg-evidence-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setEvidenceZoom(false);}}><section role="dialog" aria-modal="true" aria-label={`DWG 候选 #${shownEvidence.number} 局部线条`}><header><div><strong>候选 #{shownEvidence.number} · DWG 局部线条</strong><span>红色为候选轮廓；局部转换图不能代替完整原图。</span></div><button type="button" autoFocus onClick={()=>setEvidenceZoom(false)} aria-label="关闭放大图">关闭</button></header><img src={shownEvidence.url} alt={`放大的 DWG 候选 #${shownEvidence.number} 局部线条`}/></section></div>}
   <footer><span>已选 {selected.length} 个{hiddenSelected.length?` · ${hiddenSelected.length} 个不在当前筛选中`:''} · 项目上限 30 栋</span><div><button type="button" onClick={()=>advance()}>{queue.length>1?'跳过这张':'取消审阅'}</button><button type="button" className="primary" disabled={!selected.length||disabled||!!placementError} onClick={adopt}>采用到{lot||'当前分组'} ↗</button></div></footer>
  </div>}
 </section>;
}
