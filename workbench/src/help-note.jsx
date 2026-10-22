import React,{useState,useCallback} from 'react';
import * as Popover from '@radix-ui/react-popover';
import UIIcon from './ui-icon.jsx';
const css=`.meb-help-note-content{box-sizing:border-box;z-index:1000;width:280px;max-width:min(280px,var(--radix-popover-content-available-width));max-height:min(260px,var(--radix-popover-content-available-height));overflow:auto;padding:12px 14px;border:1px solid #e1e4df;border-radius:8px;background:#fff;color:#303537;box-shadow:0 8px 24px #2426271c;font:12px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:normal;text-align:left;overflow-wrap:anywhere}.meb-help-note-content p{font:inherit;margin:0}.meb-help-note-arrow{fill:#fff}`;
export default function HelpNote({label='使用说明',children,side='down',warning=false}){
 const [open,setOpen]=useState(false),[boundary,setBoundary]=useState(null),trigger=useCallback(el=>setBoundary(el?.closest('.workbench-layout')||null),[]);
 return <Popover.Root open={open} onOpenChange={setOpen}><span className="help-note"><Popover.Trigger asChild><button ref={trigger} type="button" aria-label={label} title={label}><UIIcon name={warning?'warning':'help'} size={15}/></button></Popover.Trigger></span><Popover.Portal><Popover.Content role="note" className="meb-help-note-content" side={side==='up'?'top':'bottom'} align="end" sideOffset={7} collisionPadding={12} collisionBoundary={boundary||undefined} onOpenAutoFocus={e=>e.preventDefault()}><style>{css}</style>{children}<Popover.Arrow className="meb-help-note-arrow" width={10} height={5}/></Popover.Content></Popover.Portal></Popover.Root>;
}
