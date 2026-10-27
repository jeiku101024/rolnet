import { Children, type ReactNode } from "react";
import { TableSearch } from "@/components/ui/table-search";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow } from "@/components/ui/table";

export function DataTable({ headers, children, empty, id, searchable = true }: { headers: string[]; children?: ReactNode; empty?: ReactNode; id?: string; searchable?: boolean }) {
  const hasRows = Children.count(children) > 0;
  return <Card className="min-w-0"><CardContent className="data-region border-0">{searchable && hasRows ? <div className="mb-4"><TableSearch tableId={id} placeholder="Search records" /></div> : null}{hasRows ? <Table id={id} className="data-table"><TableHeader><TableRow>{headers.map((header) => <TableHead scope="col" key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table> : empty}</CardContent></Card>;
}

export function DataTableRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}
