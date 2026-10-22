import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const data=window.__MEB_MODEL__;
import { cleanRing } from './geometry.js';
import { displayFootprint } from './display-geometry.js';

const $ = id => document.getElementById(id);
const host = $('viewport');
try {
  if(!data?.buildings?.length)throw Error(window.__MEB_MODEL_ERROR__||'请先导入图纸或配置楼栋，再生成模型。');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  host.prepend(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '项目三维模型；拖动旋转，滚轮缩放，方向键旋转，加减键缩放，R复位');
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault(); $('error').hidden = false; $('error').textContent = '三维显示已中断，请刷新页面恢复。';
  });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-160,160,120,-120,.1,1500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minZoom = .55; controls.maxZoom = 4;
  controls.minPolarAngle = .02; controls.maxPolarAngle = Math.PI / 2.15;
  controls.rotateSpeed = .7;
  const center = data.center||[0,0];
  const material = (color, roughness=.55) => new THREE.MeshStandardMaterial({color, roughness, metalness:.16, emissive:color, emissiveIntensity:.10});
  function shape(points) {
    return new THREE.Shape(cleanRing(points).map(([x,y]) => new THREE.Vector2(x-center[0],y-center[1])));
  }
  function extrude(points, height, materials, base=0, holes=[]) {
    const footprint=shape(points);
    footprint.holes=holes.map(ring=>new THREE.Path(cleanRing(ring).map(([x,y])=>new THREE.Vector2(x-center[0],y-center[1]))));
    const geometry = new THREE.ExtrudeGeometry(footprint, {depth:height, bevelEnabled:false, steps:1, curveSegments:1});
    geometry.rotateX(-Math.PI/2); geometry.translate(0,base,0);
    const mesh = new THREE.Mesh(geometry,materials);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
  function outline(points, elevation, color, opacity=1) {
    const vertices = cleanRing(points).map(([x,y])=>new THREE.Vector3(x-center[0],elevation,center[1]-y));
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color,transparent:true,opacity,toneMapped:false,depthWrite:false}));
  }
  scene.add(new THREE.HemisphereLight(0xd8e7ff,0x385476,1.8));
  const sun = new THREE.DirectionalLight(0xd9eaff,2.0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096,4096);
  Object.assign(sun.shadow.camera,{left:-180,right:180,top:180,bottom:-180,near:1,far:600});
  sun.shadow.normalBias = .025; sun.shadow.bias=-.00001;
  sun.shadow.radius = 3;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6da3ff,1.3);
  rim.position.set(-150,100,-180);scene.add(rim);
  const fill = new THREE.DirectionalLight(0xb7d8ff,1.0);
  fill.position.set(110,80,-290);scene.add(fill);
  // Reference grid on the display plane, not surveyed campus geometry.
  const grid = new THREE.GridHelper(300,30,0x476b94,0x274361);
  grid.position.y=-2.1;grid.material.transparent=true;grid.material.opacity=.35;
  scene.add(grid);
  const site=extrude(data.site,2,[material(0x142b45,.72),material(0x0b192b,.6)],-2);
  const siteOutline=outline(data.site,.025,0x6faefb,.85);
  scene.add(site,siteOutline);
  const groups=[];
  for(const building of data.buildings) {
    const old=building.phase==='one';
    const group = new THREE.Group();
    const makeVisual=polygons=>{
      const visual=new THREE.Group(),levels=new THREE.Group();
      for(const [outer,...holes] of polygons){
        const materials=[material(old?0x33445c:0x174b7d),material(old?0x344b67:0x145ca2)];
        // Shared cut walls must not compete with the taller solid's exterior.
        if(old)materials.forEach(m=>{m.polygonOffset=true;m.polygonOffsetFactor=1;m.polygonOffsetUnits=1;});
        const mesh=extrude(outer,building.height,materials,0,holes);
        visual.add(mesh);
        const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,22),new THREE.LineBasicMaterial({color:old?0xa1bddf:0x8ecaff,transparent:true,opacity:.7,toneMapped:false,depthWrite:false}));
        visual.add(edges);
        for(const ring of [outer,...holes]){
          visual.add(outline(ring,building.height+.035,old?0xd0e2fa:0xa9d9ff,.95));
          for(let i=1;i<building.floors;i++)levels.add(outline(ring,building.height*i/building.floors,old?0xa5bbd9:0x6eb5ff,.46));
        }
      }
      visual.add(levels);return {visual,levels};
    };
    const combined=makeVisual(displayFootprint(building,data.buildings));
    const isolated=makeVisual([[building.polygon]]);
    isolated.visual.visible=false;
    group.add(combined.visual,isolated.visual);scene.add(group);
    const tag=document.createElement('span');tag.className='model-label '+(old?'existing':'new');
    const name=building.number&&!building.name.includes(building.number)?`${building.number} · ${building.name}`:building.name;
    tag.textContent=[building.lot,name].filter(Boolean).join(' · ');
    host.append(tag);
    const bounds=new THREE.Box3().setFromObject(isolated.visual);const anchor=bounds.getCenter(new THREE.Vector3());anchor.y=building.height+5;
    groups.push({group,combined,isolated,tag,anchor,id:building.id});
  }
  const modelBounds=new THREE.Box3().setFromObject(site);
  for(const item of groups)modelBounds.union(new THREE.Box3().setFromObject(item.combined.visual));
  let focusBounds=modelBounds;
  function generatedViewHalf(aspect){
    camera.updateMatrixWorld();
    const {min,max}=focusBounds,point=new THREE.Vector3();
    let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
    for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
      point.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      left=Math.min(left,point.x);right=Math.max(right,point.x);
      bottom=Math.min(bottom,point.y);top=Math.max(top,point.y);
    }
    return Math.max(38,(top-bottom)*.58,(right-left)*.58/aspect);
  }
  let phase='all', frame=0;
  function draw(){
    frame=0;renderer.render(scene,camera);
    const width=host.clientWidth,height=host.clientHeight;
    const visibleLabels=[];
    for(const item of groups){
      const p=item.anchor.clone().project(camera);
      const inView=item.group.visible && p.z<=1 && Math.abs(p.x)<=.92 && Math.abs(p.y)<=.9 && $('labels').checked;
      item.tag.hidden=!inView;
      if(!inView)continue;
      item.tag.style.left=(p.x+1)*width/2+'px';item.tag.style.top=(1-p.y)*height/2+'px';
      const rect=item.tag.getBoundingClientRect();
      if(visibleLabels.some(other=>rect.left<other.right+6 && rect.right+6>other.left && rect.top<other.bottom+6 && rect.bottom+6>other.top))item.tag.hidden=true;
      else visibleLabels.push(rect);
    }
    $('view-status').textContent=`${Math.round(controls.getAzimuthalAngle()*180/Math.PI)}° 方位 · ${Math.round(controls.getPolarAngle()*180/Math.PI)}° 倾角 · ${Math.round(camera.zoom*100)}%`;
    $('zoom-in').disabled=camera.zoom>=3.999; $('zoom-out').disabled=camera.zoom<=.551;
  }
  function invalidate(){if(!frame)frame=requestAnimationFrame(draw);}
  function resize(){
    const w=host.clientWidth,h=host.clientHeight,aspect=w/h;
    const half=data.generated?generatedViewHalf(aspect):Math.max(87,136/aspect);
    Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});
    camera.updateProjectionMatrix();renderer.setSize(w,h);invalidate();
  }
  new ResizeObserver(resize).observe(host);
  function preset(top=false){
    const focus=data.generated?focusBounds.getCenter(new THREE.Vector3()):new THREE.Vector3();
    const scale=data.generated?Math.max(1,(data.span||250)/250):1;
    controls.target.set(focus.x,3,focus.z);
    camera.position.set(focus.x+(top?0:110*scale),top?350*scale:250*scale,focus.z+(top?.1:-290*scale));
    camera.far=Math.max(1500,scale*1500);
    camera.zoom=1;camera.updateProjectionMatrix();controls.update();if(data.generated)resize();invalidate();
  }
  function zoom(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.55,4);camera.updateProjectionMatrix();controls.update();invalidate();}
  controls.addEventListener('change',invalidate);
  $('reset').onclick=()=>preset();$('top').onclick=()=>preset(true);
  $('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);
  document.querySelectorAll('[data-phase]').forEach(button=>button.onclick=()=>{
    phase=button.dataset.phase;
    document.querySelectorAll('[data-phase]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    for(const item of groups){item.group.visible=phase==='all'||(phase==='one'?item.id==='E':item.id!=='E');item.combined.visual.visible=phase==='all';item.isolated.visual.visible=phase!=='all';}
    $('phase-status').textContent=groups.filter(g=>g.group.visible).length+' 栋';invalidate();
  });
  $('levels').onchange=()=>{groups.forEach(x=>{x.combined.levels.visible=x.isolated.levels.visible=$('levels').checked;});invalidate();};
  $('labels').onchange=invalidate;
  $('grid').onchange=()=>{grid.visible=$('grid').checked;invalidate();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)invalidate();});
  function lighting(){const angle=Number($('light').value)*Math.PI/180;sun.position.set(Math.cos(angle)*160,180,Math.sin(angle)*160);$('light-value').textContent=$('light').value+'°';invalidate();}
  $('light').oninput=lighting;
  renderer.domElement.addEventListener('keydown',event=>{
    if(['+','=','-','r','R','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))event.preventDefault();
    if(event.key==='+'||event.key==='=')zoom(1.2);
    if(event.key==='-')zoom(1/1.2);
    if(event.key.toLowerCase()==='r')preset();
    if(event.key.startsWith('Arrow')){
      const offset=camera.position.clone().sub(controls.target);const spherical=new THREE.Spherical().setFromVector3(offset);
      if(event.key==='ArrowLeft')spherical.theta-=.12;if(event.key==='ArrowRight')spherical.theta+=.12;
      if(event.key==='ArrowUp')spherical.phi-=.1;if(event.key==='ArrowDown')spherical.phi+=.1;
      spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();invalidate();
    }
  });
  preset();lighting();resize();$('loading').hidden=true;
} catch(error) {
  document.documentElement.classList.add('model-empty');
  $('loading').hidden=true;$('error').hidden=false;
  $('error').textContent=!data?.buildings?.length?error.message:'三维画面未能启动，请检查浏览器图形加速或重新生成模型。';console.error(error);
}
