export const reportColumns=["month","unit_body_number","plate_number","remittance_due_centavos","remittance_paid_centavos","outstanding_centavos","total_expense_centavos","net_income_centavos"];
function escapeCsv(value:unknown){const s=String(value??"");return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
export function monthlyCsv(month:string,rows:Record<string,unknown>[]){const lines=[reportColumns.join(","),...rows.map(row=>reportColumns.map(c=>escapeCsv(c==='month'?month:row[c]??0)).join(","))];return `\ufeff${lines.join("\r\n")}\r\n`;}
