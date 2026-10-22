import React,{useRef,useEffect,useState} from 'react';
import DataGrid,{Row} from 'react-data-grid';
import gridCSS from 'react-data-grid/lib/styles.css';
import SheetFormatToolbar from './sheet-format-toolbar.jsx';
import {defaultSheetAlignment,sheetAlignment,sheetPaint} from './sheet-format.js';
import useSheetRange from './use-sheet-range.js';
import formatCSS from './sheet-format.css';
// Keep existing field editors and clipboard rules while the grid owns scrolling,
// frozen columns and selection. Small sheets retain native Tab navigation;
// large sheets render only visible rows and move focus across their boundary.
const list=node=>React.Children.toArray(node).flatMap(n=>n?.type===React.Fragment?list(n.props.children):[n]).filter(React.isValidElement);
function editorValue(node){
 for(const item of React.Children.toArray(node)){
  if(typeof item==='string'||typeof item==='number')return item;
  if(!React.isValidElement(item))continue;
  if(item.props.type==='checkbox')continue;
  if(item.props.value!==undefined)return item.props.value;
  const value=editorValue(item.props.children);if(value!==undefined)return value;
 }
}
// Focus the existing editor before native paste, preserving each page's clipboard rules.
export function sheetCellKeyDown(_,event){
 if(event.target.matches('input,select,textarea,button')){event.preventGridDefault();return;}
 if(event.key.toLowerCase()!=='v'||!(event.metaKey||event.ctrlKey)||!event.target.matches('[role=gridcell]'))return;
 const editor=event.target.querySelector('input:not([type=checkbox]):not(:disabled):not([readonly]),textarea:not(:disabled):not([readonly])');
 if(!editor)return;
 event.preventGridDefault();editor.focus();editor.select();
}
export default function SheetTable({children,dataRows,renderDataRow,focusRequest,className='',onActiveRow,onRowContext,contextActions=[],compactFirst=true,rowHeight=32,format,onFormatChange,onManageFields,disabled=false,toolbarExtra,selectedRowIds=[],onRowSelectionChange}){
 const [menu,setMenu]=useState(null),[overflow,setOverflow]=useState({left:false,right:false});
 useEffect(()=>{if(!menu)return;const close=e=>{if(e.type!=='keydown'||e.key==='Escape')setMenu(null);};document.addEventListener('click',close);document.addEventListener('keydown',close);window.addEventListener('resize',close);return()=>{document.removeEventListener('click',close);document.removeEventListener('keydown',close);window.removeEventListener('resize',close);};},[menu]);
 const gridRef=useRef(),previousRows=useRef([]);
 const sections=list(children),head=sections.find(s=>s.type==='thead'),body=sections.find(s=>s.type==='tbody'),foot=sections.find(s=>s.type==='tfoot');
 const allHeaders=[...list(list(head?.props.children)[0]?.props.children),...(format?.extraColumns||[]).map(c=><th key={c.id} data-column-key={c.id} data-column-label={c.name} data-column-type={c.type} data-extra-column={true}>{c.name}</th>)];
 const hidden=new Set(format?.hiddenColumns||[]),headers=allHeaders.filter(h=>!hidden.has(h.props['data-column-key']));
 // Build editors only when DataGrid actually asks for a visible row.
 const rows=dataRows?dataRows.map((data,index)=>({id:data.id,data,index})):list(body?.props.children).map((r,i)=>({id:r.props['data-sheet-row']??r.props['data-business-row']??r.key??i,element:r,cells:list(r.props.children)}));
 const selectableColumns=headers.filter(h=>h.props['data-column-key']).map(h=>({id:h.props['data-column-key']}));
 const range=useSheetRange({rows,columns:selectableColumns,format,onChange:onFormatChange,onActiveRow,selectedRowIds,onRowSelectionChange});
 const selection=range.selection,rangeRows=new Set(selection?.rowIds),rangeColumns=new Set(selection?.columnIds);
 const rendered=new Map();
 function visibleRow(row){if(!dataRows)return row;if(!rendered.has(row.id)){const element=renderDataRow(row.data,row.index);rendered.set(row.id,{element,cells:list(element.props.children)});}return rendered.get(row.id);}

 useEffect(()=>{const old=previousRows.current;if(old.length&&rows.length>old.length&&rows[old.length-1]?.id===old.at(-1)?.id){gridRef.current?.scrollToCell({rowIdx:rows.length-1});}previousRows.current=rows;},[rows]);
 useEffect(()=>{if(!focusRequest)return;const rowIdx=rows.findIndex(r=>String(r.id)===focusRequest.id);if(rowIdx<0)return;gridRef.current?.scrollToCell({rowIdx});const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>{const row=[...gridRef.current?.element?.querySelectorAll('[data-business-row]')||[]].find(el=>el.dataset.businessRow===focusRequest.id);const cell=[...row?.querySelectorAll('[data-column]')||[]].find(el=>el.dataset.column===focusRequest.column);cell?.querySelector('input:not([type=checkbox])')?.focus();}));return()=>cancelAnimationFrame(frame);},[focusRequest]);

 const totals=list(foot?.props.children).map((r,i)=>({id:'sum'+i,cells:list(r.props.children)}));
 const freezeThrough=Math.max(0,headers.findIndex(h=>h.props.className?.includes('action-col')),headers.findIndex(h=>h.props['data-frozen']));
 function checkOverflow(){const el=gridRef.current?.element;if(!el)return;const next={left:el.scrollLeft>1,right:el.scrollWidth-el.clientWidth-el.scrollLeft>1};setOverflow(old=>old.left===next.left&&old.right===next.right?old:next);}
 const columnLayout=headers.map(h=>`${h.props.style?.width}:${h.props.style?.minWidth}`).join('|');
 useEffect(()=>{const el=gridRef.current?.element;if(!el)return;checkOverflow();const observer=new ResizeObserver(checkOverflow);observer.observe(el);return()=>observer.disconnect();},[columnLayout,rows.length]);
 const columns=headers.map((h,visibleIndex)=>{
  const i=allHeaders.indexOf(h);
  const columnId=h.props['data-column-key'],fallback=h.props['data-default-align']||defaultSheetAlignment(h.props['data-column-type'],columnId);
  return {key:columnId||'_utility:'+i,headerCellClass:columnId?undefined:'sheet-utility-heading',name:h.props.children,width:i===0&&compactFirst?(h.props.className?.includes('check-col')?34:58):h.props.children==='#'?38:h.props.className?.includes('action-col')?110:h.props.style?.width,minWidth:i===0&&compactFirst?(h.props.className?.includes('check-col')?34:58):h.props.children==='#'?38:h.props.className?.includes('action-col')?110:h.props.style?.minWidth||140,resizable:true,frozen:i<=freezeThrough,renderHeaderCell:()=>columnId?<div className="sheet-range-heading" data-format-header={columnId} data-range-selected={selection?.kind==='column'&&rangeColumns.has(columnId)||undefined}>{h.props.children}</div>:h.props.children,renderCell:({row})=>{
   const cell=h.props['data-extra-column']?<td><input aria-label={`${row.index+1}行${h.props['data-column-label']}`} inputMode={h.props['data-column-type']==='number'?'decimal':undefined} value={format?.extraValues?.[row.id]?.[columnId]||''} disabled={disabled} onChange={e=>onFormatChange?.({...format,extraValues:{...format?.extraValues,[row.id]:{...format?.extraValues?.[row.id],[columnId]:e.target.value}}})}/></td>:visibleRow(row).cells[i];if(!cell)return null;
   const alignment=columnId?sheetAlignment(format,String(row.id),columnId,fallback):'center';
   const paint=columnId?sheetPaint(format,String(row.id),columnId,editorValue(cell.props.children)):{};
   return <div {...cell.props} data-format-column={columnId} data-format-row={!columnId&&!h.props.className?.includes('check-col')?String(row.id):undefined} data-range-selected={columnId&&rangeRows.has(String(row.id))&&rangeColumns.has(columnId)||undefined} data-align={alignment} data-painted={paint.fill||paint.color?true:undefined} style={{...cell.props.style,...(paint.fill?{backgroundColor:paint.fill}:{}),...(paint.color?{color:paint.color,'--sheet-cell-color':paint.color}:{}),...(alignment?{'--sheet-cell-align':alignment,'--sheet-cell-justify':{left:'flex-start',center:'center',right:'flex-end'}[alignment]}:{})}} className={'sheet-cell '+(cell.props.className||'')}>{cell.props.children}</div>;
  },renderSummaryCell:({row})=><div style={{textAlign:columnId?sheetAlignment(format,'',columnId,fallback):undefined}}>{row.cells[i]?.props.children}</div>};
 });
 const selectedHeader=selection&&headers.find(h=>h.props['data-column-key']===selection.columnId),selectedIndex=rows.findIndex(row=>String(row.id)===selection?.rowId);
 const activeSelection=selectedHeader?{...selection,allRowIds:rows.map(r=>String(r.id)),allColumnIds:allHeaders.map(h=>h.props['data-column-key']).filter(Boolean),defaults:Object.fromEntries(allHeaders.filter(h=>h.props['data-column-key']).map(h=>[h.props['data-column-key'],h.props['data-default-align']||defaultSheetAlignment(h.props['data-column-type'],h.props['data-column-key'])])),defaultAlignment:selectedHeader.props['data-default-align']||defaultSheetAlignment(selectedHeader.props['data-column-type'],selection.columnId),value:selectedIndex<0?undefined:editorValue(visibleRow(rows[selectedIndex]).cells[allHeaders.indexOf(selectedHeader)]?.props.children),label:selection.rowIds.length+' 行 × '+selection.columnIds.length+' 列'}:null;
 function tabEditors(e){
  if(e.key!=='Tab'||!e.target.matches('input,select,textarea,button'))return;
  const editors=[...e.currentTarget.querySelectorAll('[role="gridcell"] input:not(:disabled),[role="gridcell"] select:not(:disabled),[role="gridcell"] textarea:not(:disabled),[role="gridcell"] button:not(:disabled)')];
  const current=editors.indexOf(e.target),next=editors[current+(e.shiftKey?-1:1)];
  if(current>=0&&next){e.preventDefault();e.stopPropagation();next.focus();return;}
  if(current<0||rows.length<=20)return;
  const rowId=e.target.closest('[data-sheet-row]')?.dataset.sheetRow;
  const rowIndex=rows.findIndex(r=>String(r.id)===rowId);
  const targetIndex=rowIndex+(e.shiftKey?-1:1);
  if(rowIndex<0||targetIndex<0||targetIndex>=rows.length)return;
  e.preventDefault();e.stopPropagation();
  const host=e.currentTarget;
  gridRef.current?.scrollToCell({rowIdx:targetIndex});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const target=[...host.querySelectorAll('[data-sheet-row]')].find(el=>el.dataset.sheetRow===String(rows[targetIndex].id));
   const fields=[...target?.querySelectorAll('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')||[]];
   fields[e.shiftKey?fields.length-1:0]?.focus();
  }));
 }
 return <div className={"sheet-host"+(range.dragging?" is-range-dragging":"")+(range.brush?" is-format-brushing":"")} {...range.handlers} onContextMenu={e=>{const id=e.target.closest('[data-sheet-row]')?.dataset.sheetRow;if(!id||!contextActions.length)return;e.preventDefault();onActiveRow?.(id);onRowContext?.(id);setMenu({x:Math.max(8,Math.min(e.clientX,window.innerWidth-240)),y:Math.max(8,Math.min(e.clientY,window.innerHeight-300))});}} onKeyDownCapture={e=>{range.handlers.onKeyDownCapture(e);if(!e.defaultPrevented)tabEditors(e);}}><style>{gridCSS+formatCSS}</style>{onFormatChange&&<SheetFormatToolbar columns={allHeaders.filter(h=>h.props['data-column-key']).map(h=>({id:h.props['data-column-key'],name:h.props['data-column-label']||h.props['data-column-key']}))} onManageFields={onManageFields} extra={toolbarExtra} format={format} selection={activeSelection} brush={range.brush} onBrush={range.setBrush} onChange={onFormatChange} disabled={disabled}/>}{range.error&&<span role="alert">{range.error}</span>}<DataGrid ref={gridRef} onScroll={checkOverflow} onColumnResize={()=>requestAnimationFrame(checkOverflow)} enableVirtualization={rows.length>20} className={'meb-sheet '+className} columns={columns} rows={rows} rowKeyGetter={r=>r.id} rowHeight={rowHeight} headerRowHeight={38} bottomSummaryRows={totals} summaryRowHeight={40} style={{height:Math.min(600,Math.max(190,rows.length*rowHeight+totals.length*40+42))}} rowClass={r=>visibleRow(r).element.props.className||''} renderers={{renderRow:(key,props)=><Row key={key} {...props} data-sheet-row={String(props.row.id)} data-business-row={visibleRow(props.row).element.props['data-business-row']}/>}} onCellKeyDown={sheetCellKeyDown} />{(overflow.left||overflow.right)&&<div className="sheet-scroll-controls"><span>左右查看其余字段</span><button type="button" aria-label="向左查看列" disabled={!overflow.left} onClick={()=>gridRef.current?.element?.scrollBy({left:-Math.max(180,gridRef.current.element.clientWidth*.65)})}>← 向左</button><button type="button" aria-label="向右查看列" disabled={!overflow.right} onClick={()=>gridRef.current?.element?.scrollBy({left:Math.max(180,gridRef.current.element.clientWidth*.65)})}>向右 →</button></div>}{menu&&<div role="menu" aria-label="行操作" className="sheet-context-menu" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setMenu(null);}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...e.currentTarget.querySelectorAll('button:not(:disabled)')],i=items.indexOf(e.target);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}}} style={{position:'fixed',left:menu.x,top:menu.y}}><button role="menuitem" type="button" onClick={()=>{window.dispatchEvent(new Event('meb-undo'));setMenu(null);}}>撤销 · Ctrl/⌘ Z</button>{contextActions.map((a,i)=><button autoFocus={i===0} role="menuitem" type="button" key={a.label} disabled={a.disabled} onClick={()=>{a.run();setMenu(null);}}>{a.label}</button>)}</div>}</div>;
}
