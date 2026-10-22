// Presentation only: saved fields keep their identity, visibility and custom widths.
import {businessColumns} from './business.js';
const receiptOrder=['number','location','description','reported','unit','discipline'];
const receiptWidths={number:112,location:136,description:180,reported:104,unit:84,discipline:88};
export function ledgerDisplayColumns(columns,kind){
 const visible=columns.filter(c=>!c.hidden);
 if(kind!=='receipt')return visible;
 const defaults=businessColumns(kind);
 const ordered=[...receiptOrder.map(id=>visible.find(c=>c.id===id)).filter(Boolean),...visible.filter(c=>!receiptOrder.includes(c.id))];
 return ordered.map(c=>({...c,width:receiptWidths[c.id]&&c.width===defaults.find(d=>d.id===c.id)?.width?receiptWidths[c.id]:c.width}));
}
