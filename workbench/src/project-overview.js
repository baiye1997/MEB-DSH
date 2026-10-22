import {sumMoney,sumQuantity,cellValue} from './business.js';
export const costStages=['合同','清标','施工','一审','二审','三审','结算完成'];
export function auditAvailable(finance,id){const required={audit1:3,audit2:4,audit3:5}[id];return required===undefined||costStages.indexOf(finance.stage)>=required||finance[id]!==undefined&&finance[id]!=='';}
export function locateReceipt(row,config){
 const text=[row.cells.location,row.cells.building,row.cells.floor].filter(Boolean).join(' ');
 const floors=new Set([...text.matchAll(/(?:^|[^0-9])([1-9][0-9]?)\s*[Ff层楼]/g)].map(m=>Number(m[1])));
 for(const m of text.matchAll(/([一二三四五])\s*[层楼]/g))floors.add('一二三四五'.indexOf(m[1])+1);
 if(floors.size>1)return {building:null,floor:null};
 const floor=[...floors][0]||null;
 if(config){
  const mentionedLots=[...new Set(config.buildings.map(b=>b.lot?.trim()).filter(Boolean))].filter(lot=>text.includes(lot));
  const longestLot=Math.max(0,...mentionedLots.map(lot=>lot.length));
  const exactLots=mentionedLots.filter(lot=>lot.length===longestLot);
  if(exactLots.length>1)return {building:null,floor:null};
  const candidates=exactLots.length?config.buildings.filter(b=>b.lot?.trim()===exactLots[0]):config.buildings;
  const nameHits=config.buildings.flatMap(b=>{const hits=[];if(!b.name)return hits;for(let at=text.indexOf(b.name);at>=0;at=text.indexOf(b.name,at+1))hits.push({id:b.id,start:at,end:at+b.name.length});return hits;});
  const names=new Set(nameHits.filter(hit=>!nameHits.some(other=>other.id!==hit.id&&other.start<=hit.start&&other.end>=hit.end&&other.end-other.start>hit.end-hit.start)).map(hit=>hit.id));
  const named=candidates.filter(b=>names.has(b.id));
  const matches=named.length?named:candidates.filter(b=>new RegExp('(?:^|[^0-9A-Za-z])'+b.number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=栋|号楼)','u').test(text));
  if(matches.length===1){if(floor&&floor>matches[0].heights.length)return {building:null,floor:null};return {building:matches[0].id,floor};}
  if(matches.length>1||config.mode!=='cad')return {building:null,floor:null};
 }
 const ids=[];if(/原有教学楼|原教学楼|一期/.test(text))ids.push('E');if(/二期(?:新建)?\s*[AaＡ]|[AaＡ]栋/.test(text))ids.push('A');if(/二期(?:新建)?\s*[BbＢ]|[BbＢ]栋/.test(text))ids.push('B');
 if(ids.length!==1)return {building:null,floor:null};
 if(floor&&floor>(config?.buildings.find(b=>b.id===ids[0])?.heights.length??(ids[0]==='E'?4:5)))return {building:null,floor:null};
 return {building:ids[0],floor};
}
export function ledgerTotals(rows,columns,kind){
 if(!['change','contract','output'].includes(kind))return [];
 const ids=kind==='receipt'?['reported']:kind==='output'?['reported','verified','payable','received','outstanding']:['reported','verified'];
 const groups=new Map();
 for(const row of rows){const c=row.cells;if(!ids.some(id=>String(cellValue(row,{id},kind)||'').trim()!==''))continue;let label=kind==='receipt'?(c.unit?`数量 · ${c.unit}`:'未填单位（不汇总）'):kind==='change'?'本视图合计':kind==='contract'?(c.category||'待分类'): [c.category||'待分类',c.party||'未填往来单位',c.contractRef||'未填合同'].join(' · ');
 const noSum=kind==='receipt'&&!c.unit||kind==='contract'&&!c.category||kind==='output'&&(!c.category||!c.party||!c.contractRef||!['当期','累计'].includes(c.basis));
 if(noSum)continue;
 if(kind==='output'&&c.basis==='累计')label+=` · 累计快照 ${c.date||''} 第${c.period||'—'}期（不叠加）`;
 const key=noSum||kind==='output'&&c.basis==='累计'?label+row.id:label;
 if(!groups.has(key))groups.set(key,{label:noSum?label+' · 待补口径':label,rows:[],noSum});groups.get(key).rows.push(row);
 }
 return [...groups.values()].map(g=>({label:g.label,values:Object.fromEntries(ids.filter(id=>columns.some(c=>c.id===id)).map(id=>[id,g.noSum?'—':(kind==='receipt'?sumQuantity:sumMoney)(g.rows.map(r=>({cells:{[id]:cellValue(r,{id},kind)}})),id)||'—']))}));
}
