// Column order from specs/001-fleet-management/contracts/http.md. Values come straight from
// monthly_report(), including its final FLEET TOTAL row; no totals are recalculated here.
export const reportColumns=["month","unit_body_number","plate_number","remittance_due_centavos","remittance_paid_centavos","outstanding_centavos","credit_centavos","fuel_expense_centavos","repair_expense_centavos","registration_expense_centavos","insurance_expense_centavos","other_expense_centavos","total_expense_centavos","net_income_centavos"];
const textColumns:Record<string,string>={unit_body_number:"body_number",plate_number:"plate_number"};
function escapeCsv(value:unknown){const s=String(value??"");return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function cell(month:string,row:Record<string,unknown>,column:string){if(column==="month")return month;if(column in textColumns)return row[textColumns[column]]??"";return row[column]??0;}
export function monthlyCsv(month:string,rows:Record<string,unknown>[]){const lines=[reportColumns.join(","),...rows.map(row=>reportColumns.map(c=>escapeCsv(cell(month,row,c))).join(","))];return `﻿${lines.join("\r\n")}\r\n`;}
