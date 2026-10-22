import {removeExtraColumn} from './sheet-format.js';

export function removeUserField(book,id,protectedIds){
 if(protectedIds.has(id))throw Error('内置字段参与业务关联，请隐藏而不删除');
 if(!book.columns.some(c=>c.id===id))throw Error('字段不存在');
 if(book.columns.length===1)throw Error('至少保留一个字段');
 return {...book,columns:book.columns.filter(c=>c.id!==id),rows:book.rows.map(r=>{const cells={...r.cells};delete cells[id];return {...r,cells};}),format:removeExtraColumn(book.format,id)};
}
