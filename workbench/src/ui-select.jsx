import UIIcon from './ui-icon.jsx';
import React,{useState,useCallback} from 'react';
import * as Select from '@radix-ui/react-select';
const EMPTY='__meb_empty_selection__';
const optionsOf=children=>React.Children.toArray(children).flatMap(child=>child?.type==='option'?[child]:child?.props?.children?optionsOf(child.props.children):[]);
// Preserve existing controlled value/onChange contracts while replacing the OS menu.
export default function UISelect({children,value,defaultValue,onChange,className='',disabled,...props}){
 const [container,setContainer]=useState(null),trigger=useCallback(el=>setContainer(el?.closest('.meb')||null),[]),options=optionsOf(children);
 return <Select.Root value={value===undefined?undefined:String(value)||EMPTY} defaultValue={defaultValue===undefined?undefined:String(defaultValue)||EMPTY} disabled={disabled} onValueChange={v=>onChange?.({target:{value:v===EMPTY?'':v}})}><Select.Trigger ref={trigger} {...props} className={'ui-select '+className}><Select.Value/><Select.Icon className="select-chevron"><UIIcon name="chevron" size={12}/></Select.Icon></Select.Trigger><Select.Portal container={container}><Select.Content position="popper" sideOffset={5} collisionPadding={12} className="ui-select-popup"><Select.ScrollUpButton className="select-scroll"><span style={{display:'flex',transform:'rotate(180deg)'}}><UIIcon name="chevron" size={12}/></span></Select.ScrollUpButton><Select.Viewport>{options.map((o,i)=>{const v=String(o.props.value??o.props.children);return <Select.Item key={v||i} value={v||EMPTY} disabled={o.props.disabled} className="ui-select-option"><Select.ItemText>{o.props.children}</Select.ItemText><Select.ItemIndicator><UIIcon name="check" size={13}/></Select.ItemIndicator></Select.Item>;})}</Select.Viewport><Select.ScrollDownButton className="select-scroll"><UIIcon name="chevron" size={12}/></Select.ScrollDownButton></Select.Content></Select.Portal></Select.Root>;
}
