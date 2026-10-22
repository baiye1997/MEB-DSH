import React from 'react';
import UIIcon from './ui-icon.jsx';
import HelpNote from './help-note.jsx';
import css from './worksheet-tabs.css';
export default function WorksheetTabs({sheets,value,onSelect,onNew,onRename,disabled,label='工作表',className='',editor,onNavigate}){
 function navigate(e){if(onNavigate){onNavigate(e);return;}if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const at=sheets.findIndex(s=>s.id===value),index=e.key==='Home'?0:e.key==='End'?sheets.length-1:(at+(e.key==='ArrowRight'?1:-1)+sheets.length)%sheets.length;e.preventDefault();const host=e.currentTarget;onSelect(sheets[index].id);requestAnimationFrame(()=>host.querySelectorAll('[role=tab]')[index]?.focus());}
 return <div className={'worksheet-strip '+className}><style>{css}</style><div role="tablist" aria-label={label} onKeyDown={navigate}>{sheets.map(s=><button type="button" key={s.id} role="tab" tabIndex={value===s.id?0:-1} aria-selected={value===s.id} title={s.name} onClick={()=>onSelect(s.id)} onDoubleClick={()=>{if(value===s.id)onRename?.();}}>{s.name}</button>)}</div><div className="worksheet-controls"><button type="button" disabled={disabled} aria-label="新建工作表" onClick={onNew}><UIIcon name="plus"/>新建工作表</button>{onRename&&<button type="button" disabled={disabled} aria-label="重命名工作表" onClick={onRename}>重命名</button>}<HelpNote label="工作表说明" side="up">工作表分别保存记录、参数、字段与格式。新建表不会复制已有记录；修改后需要保存。</HelpNote></div>{editor&&<div className="worksheet-editor">{editor}</div>}</div>;
}
