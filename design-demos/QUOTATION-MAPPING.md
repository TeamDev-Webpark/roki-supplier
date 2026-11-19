# Selected design and quotation formats

User selected Concept 1 (comparison workspace) on 18 November 2026. Current scope remains design images first. No production app or backend has been built or deployed.

## Supplier accounts and roles

Confirmed by user: suppliers have their own user accounts with Issue and Approve roles. Model individual user accounts linked to a supplier organization, with role-based access to that supplier's quotations.

- Supplier Issue: prepare, revise, and issue quotations for supplier approval.
- Supplier Approve: review and approve the supplier quotation before it is submitted to ROKI.
- Overall workflow: Supplier Issue -> Supplier Approve -> ROKI Issue -> ROKI Check -> ROKI Approve.
- Supplier approval is an authenticated confirmation; earlier brief specifies e-signatures only on the ROKI side.
- Whether one person may hold both supplier roles, and whether self-approval is permitted, has not been specified. Do not infer a separation-of-duties policy.
- Current static design images predate this clarification. Supplier action labels and the workflow must reflect the supplier approval stage in the next design revision.

## Price update schedule and manual supplier notifications

Confirmed by user: ROKI needs a page to recheck which items and suppliers should receive requests to update prices, then manually click to send supplier notifications.

- Add `Price update schedule` to the ROKI workspace navigation.
- Review and selection unit is an item-supplier pair, preserving multiple suppliers for one part.
- Show item code/name, supplier, last approved price/effective date, last update, next scheduled review, and last notification. Proposed design filters: review period, supplier, due/overdue status, and notification status.
- ROKI can select the item-supplier pairs to notify and review the selected requests before manually sending notifications.
- A scheduled review becoming due must not automatically send notifications. No recurring notification automation is authorized.
- Record who sent each notification, when, which item-supplier pairs were included, and send outcome. Distinguish pending, sent, and failed outcomes; do not mark a request sent merely because it was selected.
- Supplier notification should direct supplier users to the applicable quotation update requests within their own account/company scope. Supplier Issue -> Supplier Approve occurs before submission to ROKI.
- Prior brief mentions email notifications; exact recipient selection, review cadence exceptions, response due dates, and grouping multiple items per supplier are implementation details still to establish.
- This is a product requirement only; no actual supplier messages have been sent or authorized by this clarification.

## References reviewed

- `/Users/vikanda/Downloads/โรกิ (ประเทศไทย) จำกัด (2).pdf`: latest meeting notes take precedence over earlier notes. Supplier enters all quotation information; ROKI Issue / Check / Approve; ROKI e-sign only; required change remarks; Revert for corrections versus Reject/drop; version history; separate part images and PDF drawings; SAP upload using existing Excel format; on-premise SQL preference.
- `/Users/vikanda/Downloads/Format Quotation Part Assembly.xlsx`: one sheet, `QUOTATION Part .............`, three side-by-side blocks Original / Re.1 / Re.2. No populated part examples. Header: supplier, date, part number/name, revision, monthly quantity, RTP code, beginning/effective date.
- `/Users/vikanda/Downloads/PART STEEL.pdf`: 3 scanned historical Unit Part quotation pages: GUARD ELEMENT, PLATE, MASH (component named MESH on the parent sheet). Original 16 Sep 2023 and revision 28 Apr 2025. Historical values are transcribed for design only; status/signatory identities are not inferred from signatures.

## Assembly format

A Components: part number/name, import/local, unit cost, quantity; expense = unit cost × quantity. Management rate 0.5% in template.
B Material: import/local, drawing weight, input weight; revised block distinguishes part weight and runner weight, rate THB/kg. Original expense = input weight × rate; Re.1 expense = (part + runner weights) × rate. Loss rate 3% in template.
C Process: process, machine, cavity count, cost/CT, cycle time. Original expense = cycle time × rate; Re.1 divides shot cycle expense by cavity count.
D Investment: molds/dies/jigs; import/local/supply/common/new investment, investment amount and annual volume; expense uses investment / volume. Inspect merged cells and exact references before implementing: formula numerator references differ from visible starting header column.
E Packing and transport: type, cost, quantity, expense. Original and Re.1 generally divide cost by quantity; Re.2 has inconsistent special formulas.
Subtotal = A+B+C+D+E. Profit/admin = 15% of C. Total = subtotal + profit/admin.
Original input cells are mostly blank; several formulas divide blank denominators. Re.2 lacks many detail formulas. Do not clone these deficiencies as executable app rules.

## Unit Part / steel format

A Material; B Components; C Process; D Packing/transport; E Equipment. Keep these letter assignments distinct from Assembly.
GUARD ELEMENT: original B=8.53, C=2.50, D=1.00, E=0.00, subtotal=12.03, profit/admin=1.80, total=13.83. Revised B=8.13, C=1.55, D=0.02, E=0.00, subtotal=9.70, profit/admin=1.45, total=11.15. A is blank, not a typed zero. Quoted change = -2.68 (-19.38%).
Components: PLATE 4.33 -> 4.03; MESH 4.20 -> 4.10; quantity 1 each. Component total 8.53 -> 8.13.
The parent quotation applies 15% to subtotal; component sheets have no profit/admin amount. Avoid assuming a global 15% charge on all Unit Part quotations.

## Rules needing confirmation before calculation implementation

- Profit/admin applicability and basis by quotation format and item (Assembly C vs historical steel parent subtotal; steel components blank).
- Rounding: 9.70 × 15% = 1.455, while the historical quote displays 1.45. Preserve historical values; confirm truncation/rounding policy for new quotes.
- Weight units: steel form labels vary between kg and g across pages/columns; do not infer scale from labels alone. Normalize explicitly after confirmation.
- Original versus revised material and process formulas differ. Confirm intended canonical equations and migration behavior.
- Investment source columns and annual-volume amortization basis, and inconsistent Re.2 packing formulas.
- Quotation Excel is not an SAP import schema; actual SAP upload template remains needed for implementation.

## Design outputs

- `previews/roki-comparison-quotation.png`: selected Concept 1, detailed historical quote comparison.
- `previews/roki-assembly-quotation.png`: matching supplier Assembly entry form, illustrative values with correct example arithmetic.
- `quotation.html?view=comparison` and `quotation.html?view=assembly` are static design sources for screenshots. Controls are visual placeholders.

## Implemented local prototype update

Separate `roki.html` and `supplier.html` now provide the interactive demo. `index.html` and the old quotation URL redirect to the ROKI portal. Alternate concept navigation has been removed from the app. Original image design studies remain as reference assets.

Includes named individual demo accounts, supplier Issue / Approve, ROKI Issue / Check / Approve, role-specific actions, quotation calculations and attachments, return/reject reasons, revision snapshots, approved-only CSV export, manual price update schedule/notification preview/log and supplier request inbox. Status highlights include amber, blue, green, purple, red and gray with text labels.

This demo uses browser storage and simulated account/signature/notification behavior. It does not implement production authentication, authorization, database, email, real digital signatures or SAP integration. See README.md for run instructions and verification.
