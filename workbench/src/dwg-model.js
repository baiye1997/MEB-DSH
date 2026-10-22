// Keep drawing coordinates and provenance explicit when several plans feed one model.
const unitFactor={mm:.001,cm:.01,m:1};
const bounds=points=>[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
const area=points=>Math.abs(points.reduce((sum,[x,y],i)=>sum+x*points[(i+1)%points.length][1]-points[(i+1)%points.length][0]*y,0)/2);
const inside=(inner,outer)=>inner[0]>=outer[0]-.25&&inner[1]>=outer[1]-.25&&inner[2]<=outer[2]+.25&&inner[3]<=outer[3]+.25;

export function existingBuildings(config,cad){
 if(config.mode==='imported')return structuredClone(config.buildings);
 if(config.mode==='cad')return config.buildings.map(b=>{const source=cad.buildings.find(x=>x.id===b.id);if(!source)throw Error(`CAD 中缺少 ${b.id} 的轮廓`);return {...structuredClone(b),polygon:structuredClone(source.polygon),holes:structuredClone(source.holes||[]),phase:source.phase||(b.id==='E'?'one':'two'),lot:b.lot||(b.id==='E'?'一期':'二期'),cadLayer:'原 CAD'};});
 return config.buildings.map(b=>({...structuredClone(b),polygon:[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.depth],[b.x,b.y+b.depth]],lot:b.lot||'未分标段',cadLayer:'参数体块'}));
}

export function adoptedDwgContours(config,result){
 const adopted=new Map();
 if(!result?.source?.sha256)return adopted;
 for(const building of config.buildings||[])
  if(building.dwgSource?.sha256===result.source.sha256&&Number.isInteger(building.cadEntityIndex))adopted.set(building.cadEntityIndex,building);
 return adopted;
}

export function addDwgContours(config,cad,result,indexes,{units,lot,alignment='manual',x=0,y=0,append=false}={}){
 if(result?.drawingUse==='reference')throw Error('立面、剖面或详图不能作为楼栋平面轮廓；请使用总图或平面图');
 if(!result?.source||!Array.isArray(result.candidates)||!Array.isArray(indexes)||!indexes.length)throw Error('请先选择图纸轮廓');
 if(!unitFactor[units]||!unitFactor[result.units])throw Error('请核对 DWG 图纸单位');
 if(typeof lot!=='string'||!lot.trim()||lot.trim().length>80)throw Error('请填写标段或楼栋分组');
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>100000||Math.abs(y)>100000)throw Error('放置位置须在 ±100000 米内');
 const chosen=indexes.map(i=>result.candidates[i]);
 if(chosen.some(c=>!c||!Array.isArray(c.points)||c.points.length<3))throw Error('候选轮廓已失效，请重新识别');
 const adopted=append?adoptedDwgContours(config,result):null;
 if(chosen.some(c=>adopted?.has(c.index)))throw Error('这张图纸的所选轮廓已采用，请选择其他图元');
 const base=append?existingBuildings(config,cad):[];
 if(base.length+chosen.length>30)throw Error('一个项目模型最多 30 栋；请拆分项目或移除无关轮廓');
 const ratio=unitFactor[units]/unitFactor[result.units];
 const sourceOrigin=(result.origin||[0,0]).map(v=>v*ratio);
 if(alignment==='shared'&&(!Array.isArray(config.coordinateOrigin)||!Array.isArray(result.origin)))throw Error('图纸缺少可复用的坐标基准，请改为手动定位');
 const world=chosen.map(c=>c.points.map(([px,py])=>[px*ratio+sourceOrigin[0],py*ratio+sourceOrigin[1]]));
 const all=world.flat(),anchor=[Math.min(...all.map(p=>p[0])),Math.min(...all.map(p=>p[1]))];
 const coordinateOrigin=alignment==='shared'?config.coordinateOrigin:(append&&config.coordinateOrigin?config.coordinateOrigin:[anchor[0]-x,anchor[1]-y]);
 const existingBounds=base.filter(b=>b.polygon).map(b=>({box:bounds(b.polygon),area:area(b.polygon)}));
 const numbers=new Set(base.filter(b=>(b.lot||'未分标段').trim()===lot.trim()).map(b=>b.number));
 const next=world.map((points,j)=>{
  const polygon=points.map(([px,py])=>[Number((alignment==='shared'?px-coordinateOrigin[0]:px-anchor[0]+x).toFixed(4)),Number((alignment==='shared'?py-coordinateOrigin[1]:py-anchor[1]+y).toFixed(4))]);
  if(polygon.some(p=>p.some(v=>!Number.isFinite(v)||Math.abs(v)>100000)))throw Error('轮廓离当前模型过远；请改用手动定位并核对图纸基准');
  const box=bounds(polygon),size=area(polygon);
  if(existingBounds.some(other=>(box.every((v,i)=>Math.abs(v-other.box[i])<1)&&Math.abs(size-other.area)<Math.max(1,size*.03))||
      (Math.min(size,other.area)/Math.max(size,other.area)>.55&&(inside(box,other.box)||inside(other.box,box)))))throw Error('选中的轮廓与已有楼栋重合或套叠；请核对是否为同栋内外轮廓');
  existingBounds.push({box,area:size});
  let n=1;while(numbers.has(String(n)))n++;numbers.add(String(n));
  const c=chosen[j];
  return {id:crypto.randomUUID(),number:String(n),name:`楼栋 ${n}`,lot:lot.trim(),polygon,cadLayer:String(c.layer||'').slice(0,300),cadEntityIndex:c.index,closureGap:Number((c.gap*ratio).toFixed(2)),dwgSource:{name:result.source.name,sha256:result.source.sha256,units},heights:[]};
 });
 const site=append?(config.site||(config.mode==='cad'?structuredClone(cad.site):undefined)):undefined;
 return {mode:'imported',source:append&&config.source?config.source:{...result.source,units},coordinateOrigin,...(site?{site}:{}),buildings:[...base,...next]};
}
