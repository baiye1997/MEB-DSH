import {businessRows} from './business-worksheets.js';
// Count records; quantities with different units and unrelated contract amounts are not added.
export function receiptNeedsReview(row) {
  return !['number','location','description','unit','reported'].every(key=>String(row.cells[key]??'').trim()) ||
    ![0,1,2,3].every(i=>Boolean(row.cells['approval'+i]));
}
export function projectSummary(project) {
  const receipts=businessRows(project,'receipt').filter(row=>['number','location','description','reported'].some(key=>String(row.cells[key]??'').trim()));
  return {receipts:receipts.length,pending:receipts.filter(receiptNeedsReview).length,calculations:businessRows(project,'calculation').length};
}
export function dashboardSummary(projects) {
  const summaries=projects.map(project=>({project,...projectSummary(project)}));
  return {summaries,projects:projects.length,pending:summaries.reduce((n,p)=>n+p.pending,0),receipts:summaries.reduce((n,p)=>n+p.receipts,0),calculations:summaries.reduce((n,p)=>n+p.calculations,0),withModel:projects.filter(p=>p.model).length};
}
