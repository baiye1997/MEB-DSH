import React from 'react';
import {cellValue} from './business.js';
const definitions={
 receipt:{subject:'description',measure:['reported','unit'],meta:['number','location','discipline'],body:['boqCode','itemName','remarks']},
 change:{subject:'description',measure:['reported'],meta:['number','location'],body:['remarks']},
 output:{subject:'party',measure:['reported','verified','paymentRate','payable'],meta:['category','contractRef','date','period','cycle','basis'],body:['remarks']},
 contract:{subject:'title',measure:['reported'],meta:['category','number','party','date'],body:['description','remarks']},
 materials:{subject:'title',measure:['price','unit'],meta:['specification','brand','date','supplier','taxBasis','taxRate'],body:['source','remarks']}
};
export default function LedgerDocument({book,row,kind}){
 const config=definitions[kind]||definitions.receipt,field=id=>book.columns.find(c=>c.id===id),value=id=>field(id)?cellValue(row,field(id),kind):'';
 const used=new Set([config.subject,...config.measure,...config.meta,...config.body]);
 const other=book.columns.filter(c=>!used.has(c.id)&&c.type!=='approval'&&!c.hidden&&value(c.id));
 const approvals=book.columns.filter(c=>c.type==='approval');
 return <article className="ledger-document"><h3>{value(config.subject)||'尚未填写内容'}</h3><dl className="document-facts">{config.meta.filter(id=>field(id)).map(id=><div key={id}><dt>{field(id).name}</dt><dd>{value(id)||'—'}</dd></div>)}</dl><dl className="document-amounts">{config.measure.filter(id=>field(id)).map(id=><div key={id}><dt>{field(id).name}</dt><dd>{value(id)||'—'}</dd></div>)}</dl>{[...config.body.filter(id=>field(id)&&value(id)).map(field),...other].map(c=><section key={c.id}><h4>{c.name}</h4><p>{value(c.id)}</p></section>)}{row.notes&&row.notes!==value('remarks')&&<section><h4>来源与补充说明</h4><p>{row.notes}</p></section>}{approvals.length>0&&<section><h4>签认状态</h4><div className="document-approvals">{approvals.map(c=><div key={c.id}><span>{c.name}</span>{['签字','盖章'].map(flag=><span key={flag} className={value(c.id).includes(flag)?'is-signed':''}>{value(c.id).includes(flag)?'✓':'—'} {flag}</span>)}</div>)}</div></section>}{!row.notes&&!config.body.some(id=>value(id))&&<p className="document-empty-note">尚未添加补充内容</p>}</article>;
}
