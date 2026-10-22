import polygonClipping from 'polygon-clipping';
import {existingBuildings} from './dwg-model.js';
import {validateModelConfig} from './model-generation.js';

const ringArea=ring=>Math.abs(ring.reduce((sum,[x,y],i)=>sum+x*ring[(i+1)%ring.length][1]-ring[(i+1)%ring.length][0]*y,0)/2);
const footprintArea=b=>ringArea(b.polygon)-(b.holes||[]).reduce((sum,ring)=>sum+ringArea(ring),0);
const roundRing=ring=>ring.slice(0,-1).map(([x,y])=>[Number(x.toFixed(4)),Number(y.toFixed(4))]);

// The cut is an infinite straight line: both clicks can be anywhere on the plan.
// Intersect the original footprint (including courtyards) with each half-plane.
export function splitModelBuilding(config,cad,buildingId,[start,end]){
 const buildings=existingBuildings(config,cad),index=buildings.findIndex(b=>b.id===buildingId);
 if(index<0)throw Error('请选择要拆分的楼栋');
 const source=buildings[index],points=source.polygon;
 if(!Array.isArray(points)||points.length<3)throw Error('当前楼栋没有可拆分的平面轮廓');
 if(![start,end].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))throw Error('请在平面图上确定两个划线点');
 const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy);
 if(length<.05)throw Error('划线太短，请选择相隔更远的两个点');
 const direction=[dx/length,dy/length],normal=[-direction[1],direction[0]];
 const all=[...points,...(source.holes||[]).flat()],span=Math.hypot(Math.max(...all.map(p=>p[0]))-Math.min(...all.map(p=>p[0])),Math.max(...all.map(p=>p[1]))-Math.min(...all.map(p=>p[1])));
 const reach=span*4+length*4+10;
 const from=[start[0]-direction[0]*reach,start[1]-direction[1]*reach];
 const to=[end[0]+direction[0]*reach,end[1]+direction[1]*reach];
 const half=sign=>[from,to,[to[0]+normal[0]*reach*sign,to[1]+normal[1]*reach*sign],[from[0]+normal[0]*reach*sign,from[1]+normal[1]*reach*sign]];
 const shape=[[points,...(source.holes||[])]];
 let pieces;
 try{pieces=[...polygonClipping.intersection(shape,[[half(1)]]),...polygonClipping.intersection(shape,[[half(-1)]])].map(rings=>({polygon:roundRing(rings[0]),holes:rings.slice(1).map(roundRing)}));}
 catch{throw Error('轮廓无法准确拆分，请核对原轮廓是否闭合或自交');}
 pieces=pieces.filter(piece=>footprintArea(piece)>.0001);
 if(pieces.length<2)throw Error('划线没有穿过楼栋，请让线横跨楼栋轮廓');
 const sourceArea=footprintArea(source),areas=pieces.map(footprintArea);
 if(sourceArea<=0||areas.some(a=>a<Math.max(.5,sourceArea*.001)))throw Error('拆出了过小的碎片，请调整划线位置');
 if(Math.abs(areas.reduce((a,b)=>a+b,0)-sourceArea)>Math.max(.02,sourceArea*.00005))throw Error('拆分面积与原轮廓不一致，请调整划线');
 if(buildings.length-1+pieces.length>30)throw Error('拆分后超过 30 栋的模型上限');
 const siblings=new Set(buildings.filter((_,j)=>j!==index&&((_.lot||'').trim()===(source.lot||'').trim())).map(b=>b.number));
 const children=pieces.map((piece,j)=>{
  let serial=j+1,number;
  do{number=`${source.number.slice(0,25)}-${serial++}`;}while(siblings.has(number));
  siblings.add(number);
  return {...structuredClone(source),...piece,id:crypto.randomUUID(),number,name:`${source.name.slice(0,74)} · ${j+1}`};
 });
 const next={...structuredClone(config),mode:'imported',buildings:[...buildings.slice(0,index),...children,...buildings.slice(index+1)]};
 if(!next.site&&config.mode==='cad')next.site=structuredClone(cad.site);
 // Incomplete imported drawings can be split before their storeys are confirmed.
 const geometryOnly={...next,buildings:next.buildings.map(b=>({...b,heights:[3]}))};
 validateModelConfig(geometryOnly);
 return {config:next,children,areas,sourceArea};
}
