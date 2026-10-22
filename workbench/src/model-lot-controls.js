if(data.mode==='imported'){
  const lots=[...new Set(data.buildings.map(b=>b.lot||'未分标段'))];
  const bar=document.querySelector('.segmented');
  bar.replaceChildren();
  bar.setAttribute('aria-label','标段筛选');
  const byId=new Map(data.buildings.map(b=>[b.id,b.lot||'未分标段']));
  const disclaimer=document.querySelector('.disclaimer'),allDisclaimer=disclaimer.textContent;
  const buttons=[];
  for(const key of ['all',...lots]){
    const button=document.createElement('button');
    button.type='button';button.textContent=key==='all'?'全部':key;
    button.setAttribute('aria-pressed',String(key==='all'));
    button.onclick=()=>{
      for(const b of buttons)b.setAttribute('aria-pressed',String(b===button));
      for(const item of groups){item.group.visible=key==='all'||byId.get(item.id)===key;item.combined.visual.visible=key==='all';item.isolated.visual.visible=key!=='all';}
      site.visible=siteOutline.visible=key==='all';
      disclaimer.textContent=key==='all'?allDisclaimer:'仅展示当前标段楼栋；标段边界未从图纸确认，楼层与位置仍需核对。';
      $('phase-status').textContent=(key==='all'?'全部':key)+' · '+groups.filter(item=>item.group.visible).length+' 栋';
      focusBounds=key==='all'?modelBounds:new THREE.Box3();
      if(key!=='all')for(const item of groups.filter(item=>item.group.visible))focusBounds.expandByObject(item.isolated.visual);
      preset();selectModelRecord(groups.some(item=>item.id===activeRecord?.building&&item.group.visible)?activeRecord.id:null);
    };
    buttons.push(button);bar.append(button);
  }
  $('phase-status').textContent='全部 · '+groups.length+' 栋';
}
