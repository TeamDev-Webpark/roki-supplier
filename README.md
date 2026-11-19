# ROKI Supplier Price

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

- Separate ROKI and Supplier workspaces using the selected ROKI blue-and-gray design.
- Supplier Issue and Approve roles, followed by ROKI Issue, Check, and Approve.
- Single Part and Assembly quotations with detailed cost calculations, revision reasons, images, and drawing PDFs.
- Item–supplier price review schedule with manual notification review and sending.
- Supplier update requests, returned/rejected quotations, revision history, and approved-price CSV export.
- Colored status highlights with text labels and responsive layouts.

## Prototype limitations

Authentication, role restrictions, notifications, and e-signatures demonstrate the intended workflow in the browser. They are not production authentication, server authorization, email delivery, or legally valid signatures. Data and attachments are stored locally in the browser. No backend or SQL database is included. CSV export is not an SAP import template.

See [workspace documentation](design-demos/README.md) and [quotation mapping](design-demos/QUOTATION-MAPPING.md) for details. Initial design images and static studies are retained as reference assets; the active app does not link to alternate concepts.
