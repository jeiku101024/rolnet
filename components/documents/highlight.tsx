import { highlightParts } from "@/lib/documents/search";

/** Marks every match of the search in a piece of text (feature 013, FR-020). */
export function Highlight({ text, query }: { text: string; query: string }) {
  const parts = highlightParts(text, query);
  if (parts.length === 1 && !parts[0].match) return <>{text}</>;
  return <>{parts.map((part, index) => (part.match ? <mark key={index} className="rounded-sm bg-warn-soft px-0.5 text-ink">{part.text}</mark> : <span key={index}>{part.text}</span>))}</>;
}
