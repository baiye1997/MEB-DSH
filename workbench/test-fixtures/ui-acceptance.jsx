import UIField from '../src/ui-field.jsx';
import UISelect from '../src/ui-select.jsx';
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import BusinessGrid from '../src/business-grid.jsx';
import Calculator from '../src/calculator.jsx';
import {blankProject,validate} from '../src/model.js';
import {initial} from './workspace.mjs';
import {businessColumns} from '../src/business.js';
import {emptySheet} from '../src/calculation-sheet.js';
import base from '../src/style.css';import polish from '../src/workspace-ui.css';import design from '../src/design-system.css';
const p=blankProject('ui-only','界面验收 · 不写入项目');p.calculationSheets={cable:emptySheet('cable')};p.calculationSheets.cable.params={base:'68740',current:'105825',threshold:'3',density:'0.0089'};
function App(){const [book,setBook]=useState({columns:businessColumns('receipt'),rows:[{id:'one',cells:{number:'SF-001',location:'原有教学楼 / 2F',description:'示例记录'},files:[],notes:''}],views:[]}),[project,setProject]=useState(p),[page,setPage]=useState('receipt'),[dark,setDark]=useState(false),[small,setSmall]=useState(false),[notice,setNotice]=useState(''),[date,setDate]=useState(''),[choice,setChoice]=useState('');return <><nav><button onClick={()=>setDark(!dark)}>切换深浅色</button><button onClick={()=>setSmall(!small)}>切换窄窗口</button><button onClick={()=>setPage('receipt')}>收方验收</button><button onClick={()=>setPage('calc')}>计算验收</button></nav><div className="meb" style={{height:'90vh',width:small?650:'100%',colorScheme:dark?'dark':'light'}}><style>{base+polish+design}</style><main className="work"><header>隔离验收 · 数据仅在内存中</header><div className="tools"><UIField type="date" aria-label="测试日期" value={date} onChange={e=>setDate(e.target.value)}/><UISelect aria-label="测试选择" value={choice} onChange={e=>setChoice(e.target.value)}><option value="">全部项目</option><option value="school">示例校园</option></UISelect></div>{page==='receipt'?<div className="ledger"><BusinessGrid kind="receipt" book={book} onChange={fn=>setBook(b=>{const n=structuredClone(b);fn(n);return n;})} onValidate={()=>{}} onDetail={()=>{}} onMessage={setNotice}/></div>:<div className="calculator-page"><Calculator project={project} onChange={(kind,fn)=>setProject(p=>{const n=structuredClone(p);n.calculationSheets[kind]??=emptySheet(kind);fn(n.calculationSheets[kind]);return n;})} onPublish={()=>setNotice('快照验证入口')} /></div>}<p role="status">{notice}</p></main></div></>;}
createRoot(document.getElementById('root')).render(<App/>);
