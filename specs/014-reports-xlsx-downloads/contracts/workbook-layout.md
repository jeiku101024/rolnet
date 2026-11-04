# Contract: Workbook layout

The authoritative visual target is the six mocks in [../reference/](../reference/); this contract is
the checklist the generator and the mock-comparison test (research R14) enforce. Requirement ids refer
to [../spec.md](../spec.md).

## Workbook

| Item | All units | Single unit |
|------|-----------|-------------|
| Sheets | "All units", then one per unit in natural name order | the unit's sheet only |
| Defined names | `_xlnm.Print_Titles` per unit sheet (`localSheetId`), value `'Name'!$1:$4` | same |
| Calc | `<calcPr fullCalcOnLoad="1"/>`; every formula cell has `<v>` cached | same |
| Zip | deflate (method 8) parts; STORE fallback | same |

Part order inside a worksheet XML: `sheetPr` → `dimension` → `sheetViews` → `sheetFormatPr` → `cols` →
`sheetData` → `mergeCells` → `hyperlinks` → `printOptions` → `pageMargins` → `pageSetup`.

## Styles (exact)

| Id | Font (Arial) | Fill | Border | Alignment | Number format |
|----|--------------|------|--------|-----------|---------------|
| `title` | 16 bold, FFFFFF | 1F3864 | — | left, indent 1, v-center | General |
| `subtitle` | 11 bold, 1F3864 | D9E2F3 | — | left, indent 1, v-center | General |
| `headFirst` | 10 bold, FFFFFF | 2F5496 | — | left, indent 1, v-center | General |
| `headText` | 10 bold, FFFFFF | 2F5496 | — | left, v-center | General |
| `headAmount` | 10 bold, FFFFFF | 2F5496 | — | right, v-center | General |
| `date` | 10 | — | bottom thin BFBFBF | left, indent 1 | `ddd", "mmm d` |
| `month` | 10 | — | bottom thin BFBFBF | left, indent 1 | `mmmm` |
| `text` | 10 | — | bottom thin BFBFBF | left | General |
| `amount` | 10 | — | bottom thin BFBFBF | right | AMT |
| `subLabel` | 10 bold | D9E2F3 | — | left, indent 1 | General |
| `subAmount` / `subBlank` | 10 bold | D9E2F3 | — | right | AMT |
| `lineLabelItalic` | 10 italic | — | — | left, indent 2 | General |
| `lineAmountItalic` | 10 italic | — | — | right | AMT |
| `lineLabelBold` / `lineAmountBold` | 10 bold | — | — | left indent 2 / right | AMT for amount |
| `grandLabel` / `grandAmount` / `grandBlank` | 10 bold | — | top + bottom medium 000000 | left indent 1 / right | AMT |
| `grandLineLabel` / `grandLineAmount` | 10 bold (Expenses, Allowance also italic) | — | — | left indent 2 / right | AMT |
| `link` | 10 underline single, 0563C1 | — | bottom thin BFBFBF | left, indent 1 | General |
| `linkAmount` | 10, 007A33 | — | bottom thin BFBFBF | right | AMT |
| `totalLabel` / `totalAmount` | 10 bold | — | top + bottom medium 000000 | left indent 1 / right | AMT |
| `notesHead` | 10 bold | — | — | left | General |
| `note` | 10 italic, 595959 | — | — | left, top, wrap | General |

AMT = `#,##0;[Red]-#,##0;"-"`. Blank cells inside bordered/filled rows carry the row's style so the
border or fill spans the table width (FR-036, FR-037, FR-039). Expenses/Allowance/Net rows leave
non-value cells unstyled (FR-038), matching the mocks.

## Common header rows (every sheet)

| Row | Height | Content |
|-----|--------|---------|
| 1 | 30 | merged A1:{last col}1, `title`, period text |
| 2 | 20 | merged A2:{last}2, `subtitle`, "Unit {name}  ·  {Type} report" / "All units  ·  {Type} report" |
| 3 | 10 | empty |
| 4 | 20 | headers |

Frozen pane: `ySplit=4`, `topLeftCell=A5`. Tab colour: summary 1F3864, unit 2F5496.

## Period texts

| Kind | Title band | Block range label |
|------|-----------|-------------------|
| Monthly | `October 2026` | `Oct 1–4`, `Oct 5–11`, `Nov 1` (en dash, no spaces) |
| Weekly | `Week of Oct 19 – 25, 2026` · `Week of Oct 26 – Nov 1, 2026` · `Week of Dec 28, 2026 – Jan 3, 2027` | `Oct 19–25` · `Oct 26–Nov 1` · `Dec 28–Jan 3` |
| Yearly | `2026` | `Jan–Dec` |

## Monthly unit sheet (A–E; widths 36, 24, 17, 17, 17; rows ≥ 5 height 13)

Headers: Date | Driver | Rental | Deposit | Allowance. For each week block n (1…4–6):

| Row | A | B | C | D | E |
|-----|---|---|---|---|---|
| date rows F…L | date serial (`date`) | driver (`text`) | rental (`amount`) | `=C{r}-E{r}` | allowance |
| blank day | date serial | blank `text` | blank `amount` | blank | blank |
| S | `Week {n} Subtotal  ·  {range}` (`subLabel`) | `subBlank` | `=SUM(C{F}:C{L})` | `=SUM(D…)` | `=SUM(E…)` |
| S+1 | `Expenses:` (italic) | | number | | |
| S+2 | `Allowance:` (italic) | | `=E{S}` | | |
| S+3 | `Net:` (bold) | | `=C{S+2}-C{S+1}` | | |

GRAND TOTAL block after the last week: G `GRAND TOTAL` with `=C{S1}+…+C{Sn}` (C, D, E); G+1 Expenses
`=C{X1}+…+C{Xn}`; G+2 Allowance `=E{G}`; G+3 Net `=C{G+2}-C{G+1}`. Summary links: `C{G}`, `D{G}`,
`E{G}`, `C{G+1}`, `C{G+3}`.

Worked example (Oct 2026): blocks at rows 5–12, 13–23, 24–34, 35–45, 46–55; G = 56.

## Weekly unit sheet (A–E; same headers and widths; rows ≥ 5 height 16)

Rows 5–11 Monday…Sunday (extra rows only for legacy duplicates), then one block: S `Week Subtotal  ·
{range}`, S+1 Expenses (all 7 days), S+2 Allowance, S+3 Net. No GRAND TOTAL. Summary links: `C{S}`,
`D{S}`, `E{S}`, `C{S+1}`, `C{S+3}`. Worked example: S = 12.

## Yearly unit sheet (A–D; widths 30, 24, 24, 24; rows ≥ 5 height 16)

Headers: Month | Rental | Deposit | Allowance. Rows 5–16: A = serial of the 1st (`month`), B rental, C
`=B{r}-D{r}`, D allowance (0 shows "-"). Row 17 `Year Subtotal  ·  Jan–Dec` with `=SUM(B5:B16)` (B, C,
D); 18 Expenses B number; 19 Allowance `=D17`; 20 Net `=B19-B18`; 21 GRAND TOTAL `=B17`, `=C17`,
`=D17`; 22 `=B18`; 23 `=D21`; 24 `=B23-B22`. Summary links: `B21`, `C21`, `D21`, `B22`, `B24`.

## All units summary sheet (A–F; widths 26, 15×5)

Headers: Unit | Rental | Deposit | Allowance | Expenses | Net. Rows 5…: A `link` hyperlink to
`'Name'!A1`; B–F `linkAmount` formulas `='Name'!{ref}`. Total row: `ALL UNITS`, `=SUM(B5:B{last})` …
F. Two rows below: `Notes`, then the kind's lines (spec FR-043), each merged A:F, height 15 (≤ 112
characters) or 28. Summary data rows keep the default height (15).

## Print setup (every sheet)

`<printOptions horizontalCentered="1"/>`,
`<pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>`,
`<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>`,
`<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`. No header/footer text.

## Sheet names and references

See research R7. Formulas and hyperlink locations always use `'Name'` with `'` doubled. Examples:
`rolnet-1` → `'rolnet-1'!C56`; `Mang Ben's` → `'Mang Ben''s'!C56`; `All units` → sheet
`All units (unit)`; two units cleaning to the same 31-character name → second gets ` (2)` within 31.
