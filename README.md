# WEBPARK Supplier Price

Interactive local prototype for ROKI supplier price comparison and quotation approval.

## Run locally

Requires Python 3. From the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory design-demos
```

- ROKI portal: http://localhost:4173/roki.html
- Supplier portal: http://localhost:4173/supplier.html

Select an individual demo account in each portal to explore its role. Use the same host and port for both portals so they share browser-local data.

## Features

- Internal ROKI price requests now require **Issue → Check → Approve** before Issue can separately send them to suppliers. Draft creation, internal approval and supplier dispatch are distinct actions. Role-specific menus and request queues separate RFQ approval from the later supplier quotation approval flow.

- Separate ROKI and Supplier workspaces using the selected ROKI blue-and-gray design.
- Supplier Issue and Approve roles, followed by ROKI Issue, Check, and Approve.
- Single Part and Assembly quotations with detailed cost calculations, revision reasons, images, and drawing PDFs.
- Item–supplier price review schedule with manual notification review and sending.
- Supplier update requests, returned/rejected quotations, revision history, and approved-price CSV export.
- Colored status highlights with text labels and responsive layouts.
- Quotation sheets follow ROKI's own Excel formats (`docs/sample -QT.xls`, `docs/QT-ASSY.pdf`): Single Part A Material / B Components / C Process / D Packing & transport / E Equipment (PM / interest, spare part cost), Assembly A–E with management and loss. New revisions start from the last approved values.
- Cost comparison on every quotation: Original vs Revised per category (A–F, total) and per line, with changed values highlighted.
- Printable quotation form in the paper layout (Original | Revise side by side) with supplier and ROKI signature boxes filled from the approval trail.
- Price history report: approved price over time per part and supplier, reasons for each change, history CSV.
- Email notifications page: the emails each workflow step would send (recorded, not delivered).
- Part master kept separate from stock: ROKI adds / edits / deletes parts and assemblies (with sub-part lists) per supplier, or imports them from a CSV file with a row-by-row preview (Excel: Save As › CSV UTF-8; template download included).
- Price update schedule is created from parts: choose part × supplier pairs, set the interval (1 or 3 months) and first review date, or let it be calculated from the last approved price. A pair’s next review moves on after its quotation is approved. Creating or importing never sends a notification.
- Parts with no approved price yet are supported: their first quotation has nothing to compare with and shows “New”.
- **Calculation formulas** (ROKI Approve): edit each format's row formulas, columns, % adjustments, profit/spare basis, rounding and total formula. Every save is a new version with a reason; issued quotations keep their version. Locks stop suppliers changing a percentage. A live check recalculates a real quotation under the draft. Formulas use a safe built-in expression engine (no eval): + - * / ^ ( ), min, max, round, abs, sqrt, if(c,a,b).
- Suppliers see every part ROKI assigned to them (My parts) but can start a quotation only from an open ROKI price update request, so ROKI controls the price cycle.
- English / Thai language switch (EN | ไทย) on every screen, remembered per browser.
- Browser checks: `cd design-demos && npm install && npm run verify`.
- Demo data transcribed from the sample quotations; seeded GUARD ELEMENT (13.83 → 11.15) and HOLDER (3.07 → 3.23) reproduce the paper totals.

## Prototype limitations

Section totals are rounded and profit/admin (F) truncated to 2 decimals to match the paper forms; this rounding policy still needs ROKI's confirmation.

Authentication, role restrictions, notifications, and e-signatures demonstrate the intended workflow in the browser. They are not production authentication, server authorization, email delivery, or legally valid signatures. Data and attachments are stored locally in the browser. No backend or SQL database is included. CSV export is not an SAP import template.

See [workspace documentation](design-demos/README.md) and [quotation mapping](design-demos/QUOTATION-MAPPING.md) for details. Initial design images and static studies are retained as reference assets; the active app does not link to alternate concepts.
