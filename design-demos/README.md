# ROKI Supplier Price workspace

Selected Concept 1, implemented as an interactive, browser-local demo.

## Open

Run from this repository:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory design-demos
```

- ROKI portal: http://localhost:4173/roki.html
- Supplier portal: http://localhost:4173/supplier.html

Use the same host and port for both portals so browser storage is shared. Select an individual demo account to enter. Switch account to exercise each role. Separate session keys preserve independent ROKI and Supplier sessions; using two browser tabs makes the flow easiest to follow.

## Implemented demo behavior

- Selected visual design only. Index redirects to ROKI; old quotation URL redirects to ROKI. No links to alternate designs.
- Separate supplier and ROKI portals, account selection, role-specific actions and company-specific supplier views.
- Supplier Issue -> Supplier Approve -> ROKI Issue -> ROKI Check -> ROKI Approve.
- Single Part and Assembly quotation entry, five cost categories, live calculations, required revision reason, draft saving, image and PDF attachments, revision snapshots, return for correction and rejection.
- ROKI item-supplier review schedule: due dates, monthly/quarterly cadence, filters, selected pairs, notification preview, manual send, request log. No scheduled automatic sending.
- Supplier price update request inbox, linked quotation preparation and submission status.
- Parts, supplier account directory, history, and approved-only CSV export.
- Status text plus colors: amber waiting/due, blue review/requested, green approved, purple returned, red overdue/rejected, gray draft/upcoming.
- Browser storage persists data across refreshes. Storage updates propagate between portals opened on the same origin.

## Limits

This is a local frontend prototype, not a production system. There is no password authentication, server authorization, SQL database, actual email delivery, or real digital signature. Account selection and role/supplier filtering demonstrate intended behavior, not a security boundary. Notifications create browser-local supplier requests. E-sign confirmations are simulated. Data is illustrative.

CSV is a review export, not an SAP upload file. Actual SAP format and calculation/rounding decisions in QUOTATION-MAPPING.md remain inputs to production implementation. Existing source documents are unchanged. Files are stored in browser storage with demo limits (2 MB/file and 10 images); clearing site data removes them.

## Verification

Browser checks in verify-workspace.cjs and verify-revisions.cjs cover manual notification delivery to the correct supplier, no send on selection/schedule edits, supplier visibility, role-specific actions, five approval stages, confirmation requirements, live cost calculation, denominator validation, preserved remarks, revision snapshots, mandatory return reason, persistence, approved-only export, removal of design navigation, mobile overflow and browser errors.

These checks use the bundled Playwright library and installed Chrome; they are development support files.
