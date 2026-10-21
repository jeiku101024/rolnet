import type { ReactNode } from "react";

export function DataTable({ headers, children, empty }: { headers: string[]; children?: ReactNode; empty?: ReactNode }) {
  return <div className="data-region"><div className="data-scroll">{children ? <table className="data-table"><thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table> : empty}</div></div>;
}

export function DataTableRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}
