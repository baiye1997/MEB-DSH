// Appended inside the CAD viewer's scope by build.mjs.
function applyWorkbenchTheme(palette){
 const bg=new THREE.Color(palette.background),ink=new THREE.Color(palette.ink),accent=new THREE.Color(palette.accent);
 document.documentElement.style.colorScheme=palette.dark?'dark':'light';
 for(const [key,value] of Object.entries(palette))if(typeof value==='string')document.documentElement.style.setProperty('--'+key,value);
 const mix=t=>bg.clone().lerp(ink,t);
 scene.traverse(object=>{
  if(object.isMesh&&object.material){for(const m of Array.isArray(object.material)?object.material:[object.material]){
   if(m.isMeshStandardMaterial){m.userData.original??=m.color.getHex();const siteMaterial=[0x142b45,0x0b192b].includes(m.userData.original);m.color.copy(mix(siteMaterial?(palette.dark?.18:.12):palette.dark?.42:[0x33445c,0x174b7d].includes(m.userData.original)?.30:.46));m.emissive.copy(m.color);m.emissiveIntensity=.04;m.metalness=.04;m.roughness=.75;}
   if(m.isShadowMaterial)m.opacity=palette.dark?.2:.22;
  }}
  if(object.isLine&&!object.isGridHelper){object.material.color.copy(mix(palette.dark?.65:.68));object.material.opacity=.72;}
  if(object.isHemisphereLight){object.color.set(0xffffff);object.groundColor.copy(mix(.25));object.intensity=palette.dark?1.5:1.5;}
 });
 grid.visible=$('grid').checked;grid.material.color.copy(mix(.3));grid.material.opacity=.15;
 sun.color.set(0xffffff);rim.color.copy(accent.clone().lerp(new THREE.Color(0xffffff),.8));rim.intensity=.5;fill.color.set(0xffffff);
 renderer.toneMappingExposure=palette.dark?1.1:1.0;invalidate();
}
addEventListener('message',event=>{if(event.source===parent&&event.data?.type==='meb-theme')applyWorkbenchTheme(event.data.palette);});
parent.postMessage({type:'meb-model-ready'},'*');

// OrbitControls natively reverses PAN to ROTATE while Ctrl/Meta is held.
controls.mouseButtons.LEFT=THREE.MOUSE.PAN;
controls.touches.ONE=THREE.TOUCH.PAN;
renderer.domElement.style.cursor='move';
renderer.domElement.setAttribute('aria-label','校园三维沙盘；拖动平移，按住 Ctrl 或 Command 拖动旋转，滚轮缩放，R复位');
$('expand').onclick=()=>{const expanded=$('expand').getAttribute('aria-pressed')!=='true';$('expand').setAttribute('aria-pressed',String(expanded));$('expand').textContent=expanded?'收起模型':'展开模型';parent.postMessage({type:'meb-model-expand',expanded},'*');};
renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
$('reset').textContent='完整视图';
document.querySelector('.hint').textContent='拖动平移 · Ctrl / ⌘ + 拖动旋转 · 滚轮缩放 · 完整视图复原';

// The sandbox cannot access storage; the host owns per-project view preferences.
let viewReady=false;
addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='meb-model-restore')return;
 const view=validViewState(event.data.view);
 if(view){camera.position.fromArray(view.position);controls.target.fromArray(view.target);camera.zoom=view.zoom;camera.updateProjectionMatrix();controls.update();invalidate();}
 viewReady=true;
});
function persistView(){
 if(viewReady)parent.postMessage({type:'meb-model-view',view:{version:1,position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom}},'*');
}
controls.addEventListener('change',persistView);
for(const id of ['zoom-in','zoom-out','reset','top'])$(id).addEventListener('click',persistView);
renderer.domElement.addEventListener('keydown',persistView);

// Only records with an unambiguous building/floor may select model geometry.
const recordPanel=document.createElement('div');recordPanel.className='receipt-panel';host.append(recordPanel);
const recordHighlight=new THREE.Group();scene.add(recordHighlight);renderer.localClippingEnabled=true;
let modelRecords=[],activeRecord=null;
function selectModelRecord(id){
 activeRecord=modelRecords.find(r=>r.id===id)||null;
 for(const mesh of [...recordHighlight.children]){recordHighlight.remove(mesh);mesh.material.dispose();}
 if(activeRecord?.building){const item=groups.find(g=>g.id===activeRecord.building),building=data.buildings.find(b=>b.id===activeRecord.building);
 if(item&&building&&item.group.visible){const low=activeRecord.floor?(building.floorHeights?building.floorHeights.slice(0,activeRecord.floor-1).reduce((a,h)=>a+h,0):(activeRecord.floor-1)*building.height/building.floors):0,high=activeRecord.floor?(building.floorHeights?building.floorHeights.slice(0,activeRecord.floor).reduce((a,h)=>a+h,0):activeRecord.floor*building.height/building.floors):building.height;
 item.combined.visual.traverse(o=>{if(!o.isMesh)return;const m=new THREE.MeshBasicMaterial({color:activeRecord.kind==='change'?0xf1ad72:0x8dbfe3,transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,clippingPlanes:[new THREE.Plane(new THREE.Vector3(0,1,0),-low),new THREE.Plane(new THREE.Vector3(0,-1,0),high)]});recordHighlight.add(new THREE.Mesh(o.geometry,m));});}
 }
 renderModelRecords();invalidate();
}
function renderModelRecords(){
 recordPanel.replaceChildren();
 const located=modelRecords.filter(r=>r.building),linked=located.filter(r=>groups.some(g=>g.id===r.building&&g.group.visible));
 const receipts=linked.filter(r=>r.kind==='receipt').length,changes=linked.length-receipts;
 const heading=document.createElement('strong');heading.textContent=`收方 ${receipts} · 签证 ${changes} 条已定位${linked.length!==located.length?' · 当前标段':''}`;recordPanel.append(heading);
 if(modelRecords.length>located.length){const note=document.createElement('small');note.textContent=`${modelRecords.length-located.length} 条待核对楼栋或楼层`;recordPanel.append(note);}
 if(located.length>linked.length){const note=document.createElement('small');note.textContent=`另有 ${located.length-linked.length} 条在其他标段`;recordPanel.append(note);}
 for(const r of linked){const button=document.createElement('button');button.textContent=`${r.kind==='change'?'签证':'收方'} · ${r.label} · ${r.floor?r.floor+'F':'整栋'}`;button.setAttribute('aria-pressed',String(r.id===activeRecord?.id));button.onclick=()=>selectModelRecord(r.id);recordPanel.append(button);}
 if(activeRecord){const open=document.createElement('button');open.textContent=`打开此条${activeRecord.kind==='change'?'签证':'收方'} ↗`;open.onclick=()=>parent.postMessage({type:'meb-model-record-open',kind:activeRecord.kind,id:activeRecord.rowId,worksheetId:activeRecord.worksheetId||''},'*');recordPanel.append(open);}
 recordPanel.hidden=!modelRecords.length;
}
addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='meb-model-records'||!Array.isArray(event.data.records))return;
 modelRecords=event.data.records.filter(r=>['receipt','change'].includes(r.kind)&&typeof r.id==='string'&&typeof r.rowId==='string'&&typeof r.label==='string'&&(r.building===null||data.buildings.some(b=>b.id===r.building)));
 const selected=modelRecords.find(r=>r.id===event.data.selected),building=data.buildings.find(b=>b.id===selected?.building);
 if(building&&data.mode==='imported'&&selected.id!==activeRecord?.id){
  const lotButton=[...document.querySelectorAll('.segmented button')].find(button=>button.textContent===(building.lot||'未分标段'));
  if(lotButton?.getAttribute('aria-pressed')!=='true')lotButton?.click();
 }
 selectModelRecord(event.data.selected);
});
document.querySelectorAll('[data-phase]').forEach(button=>button.addEventListener('click',()=>selectModelRecord(activeRecord?.id)));
