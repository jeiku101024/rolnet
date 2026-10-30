import { Children, type ReactNode } from "react";
import { ListFrame, type ListView } from "@/components/ui/paged-list";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow } from "@/components/ui/table";

/**
 * A paged record table in a card (feature 006). The page and search are read on the server; a
 * spaced toolbar (search + count) sits above the table and the pagination footer below it.
 */
export function DataTable({ headers, children, empty, id, list }: { headers: string[]; children?: ReactNode; empty?: ReactNode; id?: string; list: ListView }) {
  const hasRows = Children.count(children) > 0;
  return <Card className="min-w-0"><CardContent className="data-region border-0"><ListFrame list={list} hasRows={hasRows} empty={empty}><Table id={id} className="data-table"><TableHeader><TableRow>{headers.map((header) => <TableHead scope="col" key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></ListFrame></CardContent></Card>;
}

export function DataTableRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}
