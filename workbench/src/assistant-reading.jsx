import React from 'react';

// Render the small Markdown vocabulary used in business replies as React text.
// HTML is never evaluated; unfamiliar syntax remains visible rather than lost.
function Inline({text}){
 return String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part,i)=>{
  const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
  if(link)return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
  return part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('`')?<span key={i}>{part.slice(1,-1)}</span>:part;
 });
}
const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(v=>v.trim().replace(/\\\|/g,'|'));
const divider=line=>/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
export default function AssistantReading({text}){
 const lines=String(text||'').split(/\r?\n/),blocks=[];
 for(let i=0;i<lines.length;){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  const key=i;
  if(/^\s*```/.test(line)){
   const content=[];i++;while(i<lines.length&&!/^\s*```/.test(lines[i]))content.push(lines[i++]);if(i<lines.length)i++;
   blocks.push(<details className="proposal-code" key={key}><summary>查看处理记录</summary><pre>{content.join('\n')}</pre></details>);continue;
  }
  if(i+1<lines.length&&line.includes('|')&&divider(lines[i+1])){
   const headers=cells(line),rows=[];i+=2;while(i<lines.length&&lines[i].trim()&&lines[i].includes('|'))rows.push(cells(lines[i++]));
   blocks.push(<div className="assistant-table" key={key} role="region" aria-label="核对结果表" tabIndex={0}><table><thead><tr>{headers.map((v,j)=><th scope="col" key={j}><Inline text={v}/></th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{Array.from({length:Math.max(headers.length,row.length)},(_,k)=><td key={k}><Inline text={row[k]||''}/></td>)}</tr>)}</tbody></table></div>);continue;
  }
  if(/^#{1,6}\s+/.test(line)){blocks.push(<h3 key={key}><Inline text={line.replace(/^#{1,6}\s+/,'')}/></h3>);i++;continue;}
  if(/^\s*(?:[-*•]|\d+[.)、])\s+/.test(line)){
   const ordered=/^\s*\d/.test(line),pattern=ordered?/^\s*\d+[.)、]\s+/:/^\s*[-*•]\s+/,items=[];
   while(i<lines.length&&pattern.test(lines[i]))items.push(lines[i++].replace(pattern,''));
   const List=ordered?'ol':'ul';blocks.push(<List key={key}>{items.map((v,j)=><li key={j}><Inline text={v}/></li>)}</List>);continue;
  }
  const paragraph=[line];i++;
  while(i<lines.length&&lines[i].trim()&&!/^\s*(?:#{1,6}\s|```|[-*•]\s|\d+[.)、]\s)/.test(lines[i])&&!(lines[i].includes('|')&&divider(lines[i+1]||'')))paragraph.push(lines[i++]);
  blocks.push(<p key={key}><Inline text={paragraph.join('\n')}/></p>);
 }
 return <div className="assistant-reading">{blocks}</div>;
}
