# WEBPARK sourcing workspace

Page rendering starts after all modules have loaded (`DOMContentLoaded`). Each global view has one owner: `dashboard.js` for both overview dashboards, `schedule-register.js` for all review schedules, `quotation-sheet.js` for printed quotation forms, `document-details.js` for part/request details, and `operations-desk.js` for operational queues. Do not add fallback definitions in earlier scripts: saved sessions and direct links must show the same page as later navigation. `node verify-view-consistency.cjs` checks duplicate definitions and initial load/reload consistency across all nine accounts.

Quotation forms are classified on the part master as **Single Part — QT-COMPONENT / PART STEEL** or **Assembly — QT-ASSY**. The formula library starts with these two categories and filters compatible sets. New sets inherit the selected category; existing shared sets and issued versions remain intact. Requests show the master category and offer compatible formula versions. `npm run verify:formula-categories` covers category selection, editing, creation, master validation and request compatibility.

Use **Reset demo data** in the top-right header of either portal to restore the initial fixtures, including due-review items. Confirmation is required because it discards trial changes across both portals in this browser. The selected account, language and unrelated browser data are retained. Other open portal tabs reload the restored dataset. Run `npm run verify:demo-reset` to check restoration after dispatch, cancellation, confirmation, shared-tab updates and mobile layout.

The current operational UI separates **Due for review**, **Active schedules**, and **First-time request**. Due items and sent cycles have separate tables. **Request tracking** groups current work by Supplier, WEBPARK Check, and WEBPARK Approve, with one owner/status/action per row. Unsent saved records remain available in the tracking filter; there is no separate draft-request menu.

`operations-desk.js` and `operations-desk.css` provide these views for both portals. Request counts use the same records as the tables; current cycles use actual dispatch dates. Supplier-overdue alerts stop once the response moves to WEBPARK. Earlier approval evidence is retained separately from the current four-stage quotation timeline.

Run `npm run verify:operations-desk` for planning-list separation, request-stage counts, source-date ordering, Supplier privacy, role actions, sidebar continuity, timeline stages, and mobile overflow checks.

`document-details.js` connects schedule rows to the part's quotation workflow and request rows to the exact sent cycle. Request, part/assembly and quotation details include the visible quotation history for the same part/Supplier, with links to each quotation, source request and fixed formula version. Read-only cost rows without a separate business record open a row-detail dialog. Interactive controls keep their own actions. Run `npm run verify:document-details` for row clicks, keyboard navigation, history isolation, source links, mobile layout and Supplier privacy.

`supplier-request-policy.js` adds per-row review dispatch and enforces one Supplier company per new request. Selecting a first part locks bulk selection to that company; clearing unlocks it. The request dialog names the recipient and item count. Save and dispatch independently validate company consistency before side effects. A multi-part request produces one delivery with a separate fixed cost form per part. Previously sent historical requests are retained. Run `npm run verify:supplier-request-policy` for these checks.

Current workflow: **the system sends the price request to the Supplier automatically when an item's review is due** (`auto-requests.js`; WEBPARK Issue does not send it; a first-time part is still requested by hand from **First-time request**). Then **1. Supplier Issue → 2. Supplier Approve → 3. WEBPARK Issue → 4. WEBPARK Check → 5. WEBPARK Approve**. The first sidebar entry of every account is its own task queue (Pending issues / checks / approvals, or Cost entry tasks for Supplier Issue). Each list shows one kind of work: *Waiting for Supplier*, *Submitted · awaiting WEBPARK*, *Completed quotations*, *All requests* (with stage tabs).  
The quotation workflow has exactly five steps: **1 Supplier Issue (enter costs) → 2 Supplier Approve (verify and send back) → 3 WEBPARK Issue (check the data) → 4 WEBPARK Check (costs and price) → 5 WEBPARK Approve (purchase price)**. Setting the review schedule is not a step. A part's **formula set is chosen once when the part is added** and is read-only on the schedule form; the review interval is chosen on that form. Every form has a **Fill sample data** button for presentations.

See [WORKFLOW.md](WORKFLOW.md) for the current Thai user guide. The following implementation history includes earlier workflows and is superseded by the direct sourcing flow.

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

For a live approval demo, keep both portals in the **same browser profile** and use the same URL origin. Open the Supplier approval queue after Supplier Issue submits, then the WEBPARK Check and Approve queues. At each step, open the quotation, tick the confirmation and confirm. Open queues update as the action is saved. Sharing the LAN URL lets other devices open the demo, but their browser-local records do not synchronize with yours. `node verify-approval-handoff.cjs` checks the role handoffs, duplicate confirmation, and save-error recovery.

## Implemented demo behavior

- Workflow navigation is grouped into daily work, master data/planning, and history/reports.
- The ROKI workspace now has two explicitly separate work areas: **A. Requests to Supplier** and **B. Quotations from Supplier**. The home screen shows request preparation, internal approval, dispatch and supplier response tracking separately from the later quotation review cycle.
- Issue uses **Prepare & correct requests** (only own drafts/returns) and **Send to Supplier** (only approved, unsent requests). Check/Approve use **Review internal requests** (only their assigned stage). The register is for all-document lookup. A role-aware four-step navigation and a five-stage document progress indicator identify the current owner; the detail action panel exposes only the current role's valid actions.
- Quotation details show two distinct timelines: **before Supplier** uses the linked internal RFQ's Issue/Check/Approve records; **after Supplier** uses request dispatch followed by Supplier Issue/Approve and ROKI quotation Issue/Check/Approve. Legacy quotations without a linked RFQ show that history is unavailable instead of inventing approvals. Returned quotations display the current resubmission round separately from their full audit history.
- Business-record rows open dedicated details by click or Enter/Space: RFQs, sent requests (even without a Supplier response), quotations, parts, review schedules, supplier accounts, price-history records and formula versions. Selection checkboxes, edit buttons and expandable summaries keep their own behavior. Supplier detail routes remain restricted to their own company.
- Internal-review open buttons use the blue primary style for the current reviewer. Sidebar labels have no step numbers; workflow guides retain numbering to explain event order.
- ROKI **Create price request** selects existing part–supplier pairs, including unscheduled pairs, and saves an internal RFQ with its title, purpose, supplier message and response deadline. Save a draft or submit to Check. No supplier notification is created at this step.
- Internal RFQ workflow: **Issue creates → Check verifies → Approve approves and confirms sending → Supplier receives**. An approved request is locked; sending is a separate confirmed action. Check and Approve can return with a reason or reject. Issue can correct returned requests and submit through both review stages again, or cancel an unsent request. Revision content and action history are retained.
- **Price request register** contains all internal RFQs. Check and Approve have their own **Review internal requests** queue; Issue has Create, draft editing and approved-request dispatch actions. Supplier portals have no access to internal request pages. Existing requests already sent before this workflow remain in the response tracker.
- Only Issue can change the part master and review schedule. Check and Approve can read them; calculation-formula editing remains exclusive to Approve. Handlers enforce the same role and state checks as the visible buttons within this frontend prototype.
- **Sent price requests** tracks each requested pair separately: waiting for supplier, supplier preparation/approval, ROKI review, correction, rejected quotation awaiting replacement, completed, or superseded. Response overdue is a separate deadline indicator.
- Supplier **Submitted to ROKI** lists quotations that passed supplier approval, including subsequent returns and final decisions. Supplier Issue's own queue includes drafts and corrections.
- Quotation lists have stage filters with counts, supplier filtering, and a next-owner/action column. Thai status labels identify the exact ROKI role. Supplier internal drafts are not exposed to ROKI.
- Review timing, request progress, and quotation approval are separate statuses. Review dates never approve a price or send a request automatically.
- Internal RFQs store two independent fields: `approvalStatus` (Draft, Pending Check, Pending Approve, Approved, Returned, Rejected or Cancelled) and `deliveryStatus` (NotSent or Sent). The register has separate columns and combinable filters; detail screens have two status panels and separate internal-approval and Supplier-sending histories. Sending preserves Approved internally. Existing saved RFQs are migrated without losing their sending history; `status` remains a compatibility field for earlier demo records.
- Supplier requests are grouped by company only when Approve (or the originating Issue as a fallback) dispatches the approved RFQ. Dispatch records the originating RFQ ID and prevents duplicate sends. Buttons and confirmations explicitly distinguish submitting for internal approval from sending to Supplier.

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

## Shared fonts

Both `roki.html` and `supplier.html` load **`typography.css`**. The default font is **Prompt**, loaded from Google Fonts in that shared file. Change `--font-family-ui` in that file to change the main font for both portals, including forms, tables, dialogs and printed quotation text. Put custom font imports or `@font-face` declarations in the same file. `--font-size-base` controls the root font size; component-specific sizes remain in the layout styles. Code and simulated signature fonts are also configured there as `--font-family-code` and `--font-family-signature`.

## Customer formula sets

Injection, Rubber, Steel (from `docs/sample -QT.xls`) and Assembly · QT-ASSY (from `docs/QT-ASSY.pdf`) are built-in formula sets, selectable per part when a request is created. Differences handled: PM/interest basis (process cost vs each tool’s cost), per-line loss and maintenance, tool repayment, Common / New investment, packing as cost × used ÷ shared quantity, and rounding (none between steps in Excel; line by line on the paper form). The sets reproduce every example in the customer files exactly; see `QUOTATION-MAPPING.md`.

Assemblies: a new cost form gets one component row per BOM entry; where a component is a part of the same supplier with an approved quotation, its price is linked (read-only, refreshable, can be unlinked). Add part can also create the component parts that are missing from the list.

## Language selection

Switch between English and Thai with the **EN | ไทย** control on the login page and in the top bar (also on mobile). The choice is remembered in the browser. Thai text lives in `i18n-th.js` (exact strings and patterns); `i18n.js` applies it after each render, so part numbers, supplier names and text typed by users are never translated. To add UI text, add it to `i18n-th.js`; `verify-i18n.cjs` fails if any screen still shows untranslated text in Thai.

## Verification

Browser checks run against the installed Chrome (or Edge) through `playwright-core`; no browser download and no manual server are needed.

```sh
cd design-demos
npm install
npm run verify
```

- `verify-pages.cjs` – all 9 accounts open every page they can reach, in English and Thai, with no errors.
- `verify-workspace.cjs` – manual notification → supplier request → Issue → Supplier Approve → ROKI Issue → Check → Approve, supplier isolation, role gates, e-sign trail, price history, emails, schedule edits, mobile layout.
- `verify-revisions.cjs` – live cost calculation, validation, remarks kept across tabs, revision snapshots, mandatory return reason, comparison view, approved-only export.
- `verify-parts.cjs` – create/edit/delete parts, CSV import preview and errors, schedule creation from parts, supplier read-only view, first quotation for a part without a price, next review after approval.
- `verify-formulas.cjs` – formula editing: validation, versions with reasons, issued quotations keep their version, locks reach the supplier editor, restore an old version.
- `verify-i18n.cjs` – language switch and persistence, Thai filters/toasts/dialogs, data left untouched, no untranslated text on any screen.
- `render-previews.cjs` – regenerates the screenshots in `previews/` (English and Thai).

Set `CHROME_PATH` if no Chrome/Edge is found, or `BASE_URL` to test an already running server. The checks start from fresh browser data and rewrite some screenshots in `previews/`.

## Company logo

`branding.js` configures the WEBPARK name and the original horizontal/vertical PNG files in `assets/`. Both portals use the horizontal image in the login, sidebar and quotation letterhead. Replace the asset paths there when changing the company logo.

## Connected demo records

`demo-data.js` adds linked presentation scenarios for all nine accounts on first load. Each supplier has draft, supplier approval, WEBPARK review, returned, rejected and approved quotations, with approved baselines, readable sample PDF support, price history and simulated notifications. Internal requests cover preparation, checking, approval, dispatch and closed outcomes.

The additive migration retains existing browser records and marks completion with `demoDataVersion`. Refreshing or switching portals does not reinsert completed or removed examples. Internal and supplier approval remain separate, and supplier visibility still follows the selected company. Optional fields and future workflow steps remain empty when the business event has not happened.

Run `npm run verify:demo-data` to check migration, relational consistency, role menus, separated timelines and live approval/dispatch actions.

## Workflow and source tracking

Open **Workflow & source tracking / โฟลว์และติดตามต้นทาง** from either portal. The three phases are WEBPARK request approval, Supplier quotation approval, and WEBPARK price approval. Each part has a current owner, valid next action, and links to its source documents. Links opened from a quotation or internal request retain that document's cycle; the part-level view shows the latest cycle. See [คู่มือการทำงานและผู้รับผิดชอบแต่ละขั้น](WORKFLOW.md).

Approved status and price validity are independent. One approved quotation per item–supplier pair is active as of the current Bangkok day. Future-effective approvals stay scheduled; earlier effective approvals remain history. The review CSV includes active quotations only. Issued quotations capture their part identity; baseline snapshots keep their own quantity and drawing revision. Legacy unknown headers use a missing-value marker instead of copying the revised header.

Use the **Part family / รหัสกลุ่มชิ้นส่วนกลาง** field (or optional CSV `part_family`) to group equivalent parts whose supplier item codes differ. Price reports show the shared family and each source item code.

The browser checks use a fixed clock and a small base fixture for focused workflow tests. The populated-data check independently verifies the full migration and all accounts. `verify-lifecycle.cjs` verifies historical headers, future price approval, current-only export, equivalent parts, source links, role isolation and mobile layout. The shared test runner stubs external font CSS so font network access cannot fail business-flow tests.

## Separate pending queues

WEBPARK navigation and home tables separate **Awaiting internal WEBPARK approval** (`#internal-pending`) from **Awaiting Supplier response** (`#supplier-waiting`). The internal queue contains only unsent RFQs waiting for Check or Approve. The Supplier queue contains only latest, dispatched part–supplier pairs waiting for Supplier preparation, approval, correction or a replacement offer. Submitted quotations leave this queue for WEBPARK price review; completed and superseded work stays in the full sent-request register.

Approved requests awaiting Issue dispatch remain separate from both queues. Counters and home previews use the same predicates as their destination lists. Internal counts are requests; Supplier counts are part–supplier pairs. `verify-queue-separation.cjs` exercises the approval, dispatch, Supplier approval and return handoffs and checks counts, visibility and mobile layout.

## Request prices and quotation access

`request-documents.js` manages per-part RFQ reference snapshots and optional internal target unit prices in THB. Creating or editing an RFQ never changes an approved price or enters a Supplier offer. The reference quotation ID and price are saved in `priceLines`; target prices stay in WEBPARK request details and are excluded from Supplier notifications. Request revision snapshots retain previous values. Older requests without a snapshot explicitly show the current reference.

Reference and response quotation buttons are available in request queues, request details, Supplier request details and workflow tracking. Supplier drafts stay private until submitted to WEBPARK. A preview in the request dialog preserves unsaved form values. Every quotation row has a prominent detail action and a printable form link. Run `npm run verify:request-documents` for the end-to-end check.

Approve can send an approved RFQ directly from the same detail screen, without returning to Issue. Approval does not send automatically: the explicit dispatch confirmation records `sentBy` and a separate send event, keeps internal approval Approved, and switches delivery to Sent. The dispatch queue is available to Approve and Issue; Check cannot dispatch.

## Direct sourcing implementation

`sourcing.js` manages independent formula sets, version selection, per-item request specifications, blank cost templates and additive migration. `request-approval.js` now implements direct draft/send/cancel actions only. No WEBPARK request approval is required. Each Supplier notice snapshots its own assigned forms and formula-version IDs. Formula saves append versions within one named set and never rewrite existing costs. Issue and Approve can maintain the library; Check and Supplier accounts cannot edit formulas.

Use `npm run verify:direct-sourcing` and `npm run verify:sourcing-pages` for the current flow. Earlier request-approval tests describe the retired flow.

Issue can attach Drawing/specification files directly to a request (PDF, PNG, JPG, WebP; 5 files, 2 MB each, 4 MB total) and record each document revision. Drafts allow replacing/removing files; saved revisions remain in request history. Dispatch copies file contents and document revisions into the Supplier notice, independent of later changes to part master data or links. Supplier downloads the fixed files from request details; external links remain optional and their contents are not frozen. Browser storage limits still apply; a failed save restores the previous data.
