import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {claimDailyIntro} from './daily-intro-state.js';
import {introBeams} from './daily-intro-glyphs.js';
import css from './daily-intro.css';

// All four phrases start together; each Chinese character has its own beam.
const glyphLanes=[0,0,0,1,2,2,2,3,4,5,6];
const beamCount=7;
const drawDuration=2750; // All seven beams share this drawing window.
function traceProgress(t,duration){
 const ramp=Math.min(.12,50/duration);
 if(t<ramp)return t*t/(2*ramp*(1-ramp));
 if(t>1-ramp)return 1-(1-t)*(1-t)/(2*ramp*(1-ramp));
 return (t-ramp/2)/(1-ramp);
}

// Rotate each closed outline to its uppermost point so every trace begins at the top.
function startAtTop(path,scale){
 const originalLength=path.getTotalLength();
 const count=Math.max(32,Math.min(600,Math.ceil(originalLength*scale/2)));
 const points=Array.from({length:count},(_,i)=>path.getPointAtLength(originalLength*i/count));
 let top=0;
 for(let i=1;i<points.length;i++)if(points[i].y>points[top].y)top=i;
 const ordered=[...points.slice(top),...points.slice(0,top),points[top]];
 path.setAttribute('d',ordered.map((point,i)=>(i?'L':'M')+point.x.toFixed(1)+' '+point.y.toFixed(1)).join(''));
 return path.getTotalLength();
}

export default function DailyIntro({replay=0}){
 const [visible,setVisible]=useState(false),[ending,setEnding]=useState(false);
 const skipRef=useRef(null),previousFocus=useRef(null),svgRef=useRef(null);
 const close=()=>{setVisible(false);setEnding(false);requestAnimationFrame(()=>{if(previousFocus.current?.isConnected)previousFocus.current.focus?.();});};
 useEffect(()=>{
  let storage;
  try{storage=window.localStorage;}catch{}
  if(!claimDailyIntro(storage))return;
  previousFocus.current=document.activeElement;
  setVisible(true);
 },[]);
 useEffect(()=>{if(replay>0){previousFocus.current=document.activeElement;setEnding(false);setVisible(true);}},[replay]);
 useEffect(()=>{
  if(!visible)return;
  skipRef.current?.focus();
  const svg=svgRef.current;
  if(!svg)return;
  let beams;
  try{
   beams=Array.from({length:beamCount},(_,i)=>{
    const light=svg.querySelector('[data-light="'+i+'"]');
    return {segments:[],index:0,ray:light.querySelector('polygon'),core:light.querySelector('line'),tip:light.querySelector('circle')};
   });
   const glyphs=[];
   introBeams.forEach((contours,group)=>{
    const paths=[...svg.querySelectorAll('[data-beam="'+group+'"]')];
    contours.forEach((contour,i)=>{
     let glyph=glyphs[glyphs.length-1];
     if(!glyph||glyph.x!==contour.x||glyph.baseline!==contour.baseline){
      glyph={x:contour.x,baseline:contour.baseline,parts:[]};glyphs.push(glyph);
     }
     glyph.parts.push({path:paths[i],...contour});
    });
   });
   glyphs.forEach((glyph,glyphIndex)=>{
    const beam=beams[glyphLanes[glyphIndex]];
    const sourceX=glyph.x+(glyphIndex<7?45:56)+(glyphIndex%2?24:-24);
    glyph.parts.forEach(part=>{
     const length=startAtTop(part.path,part.scale);
     part.path.style.strokeDasharray=String(length);
     part.path.style.strokeDashoffset=String(length);
     beam.segments.push({...part,length,sourceX});
    });
   });
   beams.forEach(beam=>{
    const gaps=beam.segments.map((segment,i)=>i===0?0:segment.x===beam.segments[i-1].x?18:80);
    const totalLength=beam.segments.reduce((sum,segment)=>sum+segment.length*segment.scale,0);
    const drawingTime=drawDuration-gaps.reduce((sum,gap)=>sum+gap,0);
    let time=180;
    beam.segments.forEach((segment,i)=>{
     time+=gaps[i];
     segment.start=time;
     segment.duration=drawingTime*segment.length*segment.scale/totalLength;
     time+=segment.duration;
    });
   });
  }catch{close();return;}
  let raf,holdTimer,exitTimer;
  const started=performance.now();
  const tick=now=>{
   const elapsed=now-started;
   let active=false;
   for(const beam of beams){
    while(beam.index<beam.segments.length&&elapsed>=beam.segments[beam.index].start+beam.segments[beam.index].duration){
     beam.segments[beam.index].path.style.strokeDashoffset='0';
     beam.index++;
    }
    const segment=beam.segments[beam.index];
    if(!segment){beam.ray.style.opacity='0';beam.core.style.opacity='0';beam.tip.style.opacity='0';continue;}
    active=true;
    if(elapsed<segment.start){beam.ray.style.opacity='0';beam.core.style.opacity='0';beam.tip.style.opacity='0';continue;}
    const phase=Math.min(1,(elapsed-segment.start)/segment.duration);
    const progress=traceProgress(phase,segment.duration);
    const lightOpacity=Math.min(1,(elapsed-segment.start)/45,(segment.start+segment.duration-elapsed)/60);
    segment.path.style.strokeDashoffset=String(segment.length*(1-progress));
    const point=segment.path.getPointAtLength(segment.length*progress);
    const x=segment.x+segment.scale*point.x,y=segment.baseline-segment.scale*point.y;
    const dx=x-segment.sourceX,dy=y+80,distance=Math.hypot(dx,dy)||1,nx=-dy/distance,ny=dx/distance;
    beam.ray.setAttribute('points',(segment.sourceX+nx*18)+','+(-80+ny*18)+' '+(x+nx*8)+','+(y+ny*8)+' '+(x-nx*8)+','+(y-ny*8)+' '+(segment.sourceX-nx*18)+','+(-80-ny*18));
    beam.core.setAttribute('x1',segment.sourceX);beam.core.setAttribute('x2',x);beam.core.setAttribute('y2',y);
    beam.tip.setAttribute('cx',x);beam.tip.setAttribute('cy',y);
    beam.ray.style.opacity=String(lightOpacity);beam.core.style.opacity=String(lightOpacity);beam.tip.style.opacity=String(lightOpacity);
   }
   if(active)raf=requestAnimationFrame(tick);
   else holdTimer=setTimeout(()=>{setEnding(true);exitTimer=setTimeout(close,280);},550);
  };
  raf=requestAnimationFrame(tick);
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'){e.preventDefault();skipRef.current?.focus();}};
  window.addEventListener('keydown',onKey);
  return()=>{cancelAnimationFrame(raf);clearTimeout(holdTimer);clearTimeout(exitTimer);window.removeEventListener('keydown',onKey);};
 },[visible]);
 if(!visible)return null;
 return createPortal(<div className="meb-intro-portal"><div className={'meb-daily-intro'+(ending?' is-ending':'')} role="dialog" aria-modal="true" aria-label="MEB-DSH 造价助手开场">
  <style>{css}</style>
  <button ref={skipRef} className="meb-intro-skip" onClick={close}>跳过开场 <span aria-hidden="true">↗</span></button>
  <svg ref={svgRef} className="meb-intro-lettering" viewBox="240 0 720 360" role="img" aria-label="七束光逐笔描出 MEB-DSH 造价助手">
   <defs><linearGradient id="meb-intro-light" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dceaff" stopOpacity="0"/><stop offset=".72" stopColor="#dceaff" stopOpacity=".08"/><stop offset="1" stopColor="#f5f9ff" stopOpacity=".3"/></linearGradient><radialGradient id="meb-intro-tip"><stop stopColor="#fff" stopOpacity="1"/><stop offset=".18" stopColor="#eef5ff" stopOpacity=".62"/><stop offset="1" stopColor="#e9f3ff" stopOpacity="0"/></radialGradient></defs>
   {Array.from({length:beamCount},(_,i)=><g key={i} data-light={i} className="meb-intro-light"><polygon fill="url(#meb-intro-light)"/><line x1="0" y1="-80" x2="0" y2="0"/><circle r="18" fill="url(#meb-intro-tip)"/></g>)}
   {introBeams.flatMap((contours,beamIndex)=>contours.map((contour,i)=><path key={beamIndex+'-'+i} data-beam={beamIndex} className="meb-intro-stroke" d={contour.d} transform={'translate('+contour.x+' '+contour.baseline+') scale('+contour.scale+' -'+contour.scale+')'}/>))}
  </svg>
 </div></div>,document.body);
}
