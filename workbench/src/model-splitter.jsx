import React,{useState} from 'react';
import {splitModelBuilding} from './model-split.js';

const fmt=value=>Number(value.toFixed(1));
const pathOf=shape=>[shape.polygon,...(shape.holes||[])].map(ring=>`${ring.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')} Z`).join(' ');

export default function ModelSplitter({config,cad,building,disabled,onApply,onClose}){
 const [start,setStart]=useState(null),[hover,setHover]=useState(null),[proposal,setProposal]=useState(null),[error,setError]=useState('');
 const [manual,setManual]=useState(['','','','']);
 const xs=building.polygon.map(p=>p[0]),ys=building.polygon.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const span=Math.max(maxX-minX,maxY-minY,1),margin=span*.16;
 const viewBox=[minX-margin,minY-margin,maxX-minX+margin*2,maxY-minY+margin*2];
 const visibleLine=proposal?proposal.line:start&&hover?[start,hover]:null;
 function point(event){const svg=event.currentTarget,p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const result=p.matrixTransform(svg.getScreenCTM().inverse());return [fmt(result.x),fmt(result.y)];}
 function previewLine(a,b){try{const result=splitModelBuilding(config,cad,building.id,[a,b]);setProposal({...result,line:[a,b]});setError('');}catch(e){setProposal(null);setError(e.message);}}
 function draw(event){if(disabled||proposal)return;const next=point(event);if(start){previewLine(start,next);setHover(null);}else{setStart(next);setError('');}}
 function reset(){setStart(null);setHover(null);setProposal(null);setError('');}
 function precise(event){event.preventDefault();const values=manual.map(Number);if(manual.some(v=>v.trim()==='')||values.some(v=>!Number.isFinite(v))){setError('请填写两点的 X、Y 坐标');return;}setStart([values[0],values[1]]);previewLine([values[0],values[1]],[values[2],values[3]]);}
 const line=visibleLine&&(()=>{const [[ax,ay],[bx,by]]=visibleLine,dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy)||1,scale=span*3/length;return [ax-dx*scale,ay-dy*scale,bx+dx*scale,by+dy*scale];})();
 return <section className="model-splitter" aria-label={`拆分 ${building.name}`}>
  <div className="model-splitter-heading"><div><strong>划线拆分</strong><span>在轮廓上点两下，直线将延伸穿过整栋楼。</span></div><button type="button" onClick={onClose} aria-label="关闭划线拆分">×</button></div>
  <svg className="model-splitter-plan" viewBox={viewBox.join(' ')} role="img" aria-label="当前楼栋平面轮廓，点击两点预览拆分" onClick={draw} onPointerMove={event=>{if(start&&!proposal)setHover(point(event));}} onPointerLeave={()=>setHover(null)}>
   <path className="source" d={pathOf(building)} fillRule="evenodd"/>
   {proposal?.children.map((child,i)=><path key={child.id} className={`piece piece-${i%4}`} d={pathOf(child)} fillRule="evenodd"/>)}
   {line&&<line className="cut" x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]}/>}
   {start&&!proposal&&<circle className="point" cx={start[0]} cy={start[1]} r={Math.max(span*.012,.08)}/>}
  </svg>
  <div className="model-splitter-status" aria-live="polite">{proposal?<><strong>可拆成 {proposal.children.length} 栋</strong><span>原面积 {fmt(proposal.sourceArea)} m² → {proposal.areas.map(a=>`${fmt(a)} m²`).join(' + ')}</span></>:<span>{start?'再点一下确定直线方向':'保留原轮廓，仅生成拆分后的楼栋体块'}</span>}</div>
  {proposal&&<p className="model-splitter-warning">子楼栋会使用新编号；原楼栋关联的收方记录需重新核对定位。</p>}
  {error&&<p className="model-splitter-error" role="alert">{error}</p>}
  <div className="model-splitter-actions"><button type="button" onClick={reset} disabled={disabled||(!start&&!proposal)}>重画</button><button type="button" className="primary" disabled={disabled||!proposal} onClick={()=>onApply(proposal)}>确认拆分</button></div>
  <details className="model-splitter-precise"><summary>精确输入划线坐标</summary><form onSubmit={precise}><div>{['起点 X','起点 Y','终点 X','终点 Y'].map((label,i)=><label key={label}>{label}<input type="number" step="any" value={manual[i]} onChange={event=>setManual(prev=>prev.map((v,j)=>j===i?event.target.value:v))} disabled={disabled}/></label>)}</div><button type="submit" disabled={disabled}>预览划线</button></form></details>
 </section>;
}
