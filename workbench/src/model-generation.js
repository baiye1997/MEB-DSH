// Project-owned parameters; CAD polygons remain immutable source geometry.
export function validateModelConfig(config){
 if(!config||!['cad','blocks','imported'].includes(config.mode)||!Array.isArray(config.buildings)||!config.buildings.length||config.buildings.length>30)throw Error('请配置 1–30 栋建筑');
 if(config.coordinateOrigin&&(!Array.isArray(config.coordinateOrigin)||config.coordinateOrigin.length!==2||config.coordinateOrigin.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9)))throw Error('图纸坐标基准无效');
 if(config.site&&(!Array.isArray(config.site)||config.site.length<3||config.site.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||Math.abs(n)>100000))))throw Error('场地轮廓无效');
 const ids=new Set(),numbers=new Set();
 for(const b of config.buildings){
  if(typeof b.id!=='string'||!b.id||ids.has(b.id))throw Error('楼栋标识重复');ids.add(b.id);
  if(config.mode==='cad'&&!b.polygon&&!['E','A','B'].includes(b.id))throw Error('CAD 模式需要保留源轮廓');
  if(b.lot!==undefined&&(typeof b.lot!=='string'||b.lot.length>80))throw Error('标段名称过长');
  const numberKey=`${b.lot?.trim()||'未分标段'}\0${typeof b.number==='string'?b.number.trim():''}`;
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80||typeof b.number!=='string'||!b.number.trim()||b.number.length>30||numbers.has(numberKey))throw Error('同一标段内请填写不重复的楼栋号和楼栋名称');numbers.add(numberKey);
  if(!Array.isArray(b.heights)||!b.heights.length||b.heights.length>60||b.heights.some(h=>!Number.isFinite(h)||h<1||h>20))throw Error('每栋需有 1–60 层，每层层高为 1–20 米');
  if(config.mode==='imported'&&(!Array.isArray(b.polygon)||b.polygon.length<3||b.polygon.length>180||b.polygon.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||Math.abs(n)>100000))))throw Error('DWG 建筑轮廓无效');
  if(b.holes&&(!Array.isArray(b.holes)||b.holes.some(ring=>!Array.isArray(ring)||ring.length<3||ring.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||Math.abs(n)>100000)))))throw Error('建筑中庭轮廓无效');
  if(config.mode==='blocks'&&(!Number.isFinite(b.width)||b.width<2||b.width>200||!Number.isFinite(b.depth)||b.depth<2||b.depth>200||![b.x,b.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=1000)))throw Error('楼栋长宽需为 2–200 米，位置需在 ±1000 米内');
 }
 return config;
}
export function initialModelConfig(cad){return {mode:'cad',buildings:cad.buildings.map(b=>({id:b.id,number:b.id,name:b.name,heights:Array.from({length:b.floors},(_,i)=>i===b.floors-1?b.height-Number((b.height/b.floors).toFixed(3))*(b.floors-1):Number((b.height/b.floors).toFixed(3)))}))};}
export function generateModel(config,cad={buildings:[]}){
 validateModelConfig(config);
 const buildings=config.buildings.map(b=>{const source=(cad.buildings||[]).find(x=>x.id===b.id)||(b.polygon?b:null);if(config.mode==='cad'&&!source)throw Error('旧版示意模型未保留轮廓，请重新导入图纸或配置楼栋；原有项目记录仍保留。');return {...(config.mode==='cad'?source:{}),id:b.id,name:b.name,number:b.number,lot:b.lot||'',phase:b.phase||(config.mode==='cad'&&b.id==='E'?'one':'two'),polygon:config.mode==='cad'?structuredClone(source.polygon):config.mode==='imported'?structuredClone(b.polygon):[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.depth],[b.x,b.y+b.depth]],holes:config.mode==='imported'?structuredClone(b.holes||[]):config.mode==='cad'?structuredClone(source.holes||[]):[],floors:b.heights.length,height:b.heights.reduce((a,h)=>a+h,0),floorHeights:[...b.heights],...(b.dwgSource?{dwgSource:structuredClone(b.dwgSource)}:{}),...(b.cadLayer?{cadLayer:b.cadLayer}:{}),...(Number.isInteger(b.cadEntityIndex)?{cadEntityIndex:b.cadEntityIndex}:{}),...(Number.isFinite(b.closureGap)?{closureGap:b.closureGap}:{})};});
 const points=buildings.flatMap(b=>b.polygon),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs)-10,maxX=Math.max(...xs)+10,minY=Math.min(...ys)-10,maxY=Math.max(...ys)+10;
 return {site:config.mode==='cad'&&cad.site?structuredClone(cad.site):config.site?structuredClone(config.site):[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]],buildings,center:[(minX+maxX)/2,(minY+maxY)/2],span:Math.max(maxX-minX,maxY-minY,...buildings.map(b=>b.height))*1.25,generated:true,mode:config.mode};
}
export function modelDocument(html,config,cad){if(!config)return html;try{const data=JSON.stringify(generateModel(config,cad)).replace(/</g,'\\u003c');return html.replace('<head>','<head><script>window.__MEB_MODEL__='+data+';</script>');}catch(error){const message=JSON.stringify(error.message).replace(/</g,'\\u003c');return html.replace('<head>','<head><script>window.__MEB_MODEL_ERROR__='+message+';</script>');}}
