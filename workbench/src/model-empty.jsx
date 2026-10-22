import React from 'react';
import UIIcon from './ui-icon.jsx';
import HelpNote from './help-note.jsx';
export default function ModelEmpty({reason,onConfigure}){return <div className="model-empty-state"><UIIcon name="materials" size={32}/><h2>项目模型尚未就绪</h2><p>导入图纸或配置楼栋后，即可生成并预览体量模型。</p><div>{onConfigure&&<button onClick={onConfigure}>配置模型</button>}{reason&&<HelpNote label="模型暂不可用的原因">{reason}</HelpNote>}</div></div>;}
