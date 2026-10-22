import {useState,useRef,useEffect} from 'react';
import {rangeBetween,changeRangeFormat} from './sheet-range.js';
export default function useSheetRange({rows,columns,format,onChange,onActiveRow,selectedRowIds=[],onRowSelectionChange}){
 const [selection,setSelection]=useState(null),[brush,setBrush]=useState(null),[dragging,setDragging]=useState(false),[error,setError]=useState('');
 const gesture=useRef(null),live=useRef(null),suppressClick=useRef(false);live.current={rows,columns,format,onChange,onActiveRow,selection,brush,onRowSelectionChange};
 function target(node){const cell=node?.closest?.('[data-format-column],[data-format-header],[data-format-row]');if(!cell)return null;const current=live.current;
  const kind=cell.hasAttribute('data-format-header')?'column':cell.hasAttribute('data-format-row')?'row':'cell';
  const rowId=cell.closest('[data-sheet-row]')?.dataset.sheetRow||current.rows[0]?.id,columnId=cell.dataset.formatColumn||cell.dataset.formatHeader||current.columns[0]?.id;
  return columnId&&(kind==='column'||rowId!==undefined)?{rowId:String(rowId??''),columnId,kind}:null;
 }
 function select(point,extend=false){if(!point)return;const {rows,columns,selection}=live.current,anchor=extend&&selection?.anchor?selection.anchor:point;const next=rangeBetween(rows,columns,anchor,point,point.kind);setSelection(next);return next;}
 const selectedKey=JSON.stringify(selectedRowIds);
 useEffect(()=>{const ids=JSON.parse(selectedKey).map(String).filter(id=>rows.some(r=>String(r.id)===id));if(!ids.length){setSelection(old=>old?.kind==='row'?null:old);return;}const point={rowId:ids[0],columnId:columns[0]?.id};if(point.columnId)setSelection({kind:'row',rowId:point.rowId,columnId:point.columnId,anchor:point,focus:point,rowIds:ids,columnIds:columns.map(c=>c.id)});},[selectedKey]);
 useEffect(()=>{
  const move=e=>{const g=gesture.current;if(!g)return;if(!g.moved&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<4)return;g.moved=true;setDragging(true);e.preventDefault();window.getSelection()?.removeAllRanges();
   const point=target(document.elementFromPoint(e.clientX,e.clientY));if(point){point.kind=g.kind;g.selection=rangeBetween(live.current.rows,live.current.columns,g.anchor,point,g.kind);setSelection(g.selection);}
   const grid=g.host.querySelector('[role=grid]');if(grid){const b=grid.getBoundingClientRect();grid.scrollBy({left:e.clientX>b.right-24?22:e.clientX<b.left+24?-22:0,top:e.clientY>b.bottom-24?22:e.clientY<b.top+24?-22:0});}
  };
  const up=()=>{const g=gesture.current;if(!g)return;gesture.current=null;setDragging(false);suppressClick.current=g.moved;const now=live.current;if(g.kind==='row')now.onRowSelectionChange?.((g.selection||now.selection).rowIds);if(now.brush){try{now.onChange(changeRangeFormat(now.format,g.selection||now.selection,'cell',now.brush));setError('');}catch(e){setError(e.message);}setBrush(null);suppressClick.current=true;}};
  const abort=()=>{const g=gesture.current;gesture.current=null;if(g)setSelection(g.previous);setDragging(false);setBrush(null);suppressClick.current=false;};
  const key=e=>{if(e.key==='Escape')abort();};
  document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',abort);document.addEventListener('keydown',key);window.addEventListener('blur',abort);
  return()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',abort);document.removeEventListener('keydown',key);window.removeEventListener('blur',abort);};
 },[]);
 function pointerDown(e){if(e.pointerType==='touch'||e.button!==0||e.target.closest('button,select,input[type=checkbox],.rdg-resize-handle'))return;const point=target(e.target);if(!point)return;const previous=live.current.selection,selected=select(point,e.shiftKey);gesture.current={x:e.clientX,y:e.clientY,kind:point.kind,host:e.currentTarget,anchor:selected.anchor,selection:selected,previous,moved:false};if(point.kind!=='cell'||brush)e.preventDefault();if(point.kind!=='column')onActiveRow?.(point.rowId);}
 function focus(e){if(gesture.current||suppressClick.current)return;const point=target(e.target);if(!point)return;const old=live.current.selection;if(old?.rowIds.includes(point.rowId)&&old?.columnIds.includes(point.columnId))return;select(point);}
 function click(e){if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}
 function keyDown(e){if(!e.shiftKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||!selection)return;const r=rows.findIndex(r=>String(r.id)===selection.focus.rowId),c=columns.findIndex(c=>c.id===selection.focus.columnId);const next={rowId:String(rows[Math.max(0,Math.min(rows.length-1,r+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)))]?.id),columnId:columns[Math.max(0,Math.min(columns.length-1,c+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)))]?.id,kind:selection.kind};if(next.columnId){e.preventDefault();e.stopPropagation();select(next,true);}}
 return {selection,brush,setBrush,dragging,error,handlers:{onPointerDownCapture:pointerDown,onFocusCapture:focus,onClickCapture:click,onKeyDownCapture:keyDown}};
}
