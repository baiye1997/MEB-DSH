// Synthetic, in-memory preview acceptance. Never connects to DSH storage.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import ChangePreview from '../src/change-preview.jsx';
import {validate} from '../src/model.js';
import {initial} from './workspace.mjs';
import {prepareChanges} from '../src/assistant-changes.js';
import css from '../src/workspace-system.css';
const original=validate(initial());original.projects[0].rows=[{id:'r',cells:{description:'原收方内容'},notes:'',files:[]}];
const proposal={version:1,id:'ui-test',projectId:original.projects[0].id,ledger:'receipt',summary:'测试修改收方内容',operations:[{type:'update',rowId:'r',before:{description:'原收方内容'},cells:{description:'管道安装，已核对范围'}}]};
function Demo(){const[data,setData]=useState(original);return <main style={{maxWidth:800,margin:'40px auto',fontFamily:'sans-serif'}}><style>{css}</style><h1>隔离建议验收</h1><ChangePreview data={data} proposal={proposal} projectId={proposal.projectId} onApply={()=>setData(prepareChanges(data,proposal,proposal.projectId).next)}/><p role="status">当前记录：{data.projects[0].rows[0].cells.description}</p><button onClick={()=>setData(original)}>撤销测试修改</button></main>}
createRoot(document.getElementById('root')).render(<Demo/>);
