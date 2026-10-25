# SheetJS Excel Export — Vendoring & Feature-Parity Research

Research date: 2026-10-22. Primary sources only: SheetJS official docs (docs.sheetjs.com), the SheetJS/sheetjs GitHub README, the published npm `xlsx` package contents (inspected directly via `npm pack`), and the `xlsx-js-style` npm/registry metadata.

## 1. Which file to vendor

**File:** `xlsx.full.min.js` (UMD/global build — no bundler, defines `window.XLSX`)

**Important version discrepancy — read before downloading:**

- The npm registry's `xlsx` package is **stuck at 0.18.5** (confirmed directly: `npm view xlsx version` → `0.18.5`; `npm pack xlsx@0.18.5` tarball contains `dist/xlsx.full.min.js`, `dist/xlsx.core.min.js`, `dist/xlsx.mini.min.js`, `xlsx.js`, `xlsx.mjs`, `LICENSE`, `package.json`).
- SheetJS's own docs state the npm registry is outdated: *"Older releases are technically available on the public npm registry as `xlsx`, but the registry is out of date. The latest version on that registry is 0.18.5."* SheetJS now treats **their own CDN (`cdn.sheetjs.com`) as the authoritative distribution channel**, currently shipping **0.20.3**, and recommends installing via `npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` rather than the bare `xlsx` npm name. (Source: https://docs.sheetjs.com/docs/getting-started/installation/nodejs — fetched 2026-10-22.) This is the supply-chain-driven change referenced in the task: after a known incident involving npm-registry trust, SheetJS moved to CDN-first, tarball-based distribution and de-emphasized the npm registry for anything beyond 0.18.5.

**Decision for this project:** vendor `xlsx.full.min.js` from the **0.20.3 CDN tarball** (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, extract `dist/xlsx.full.min.js`), not the npm 0.18.5 build, to get current bugfixes while still committing a single static file with no runtime CDN dependency — consistent with this repo's zero-build/no-runtime-CDN constraint. Commit it as `lib/xlsx.full.min.js`. Do not `<script src>` from `cdn.sheetjs.com` at runtime — only use the CDN as the one-time download source during vendoring, matching SheetJS's own vendoring guidance below.

- Source for exact file path confirmed by direct tarball inspection: `npm pack xlsx@0.18.5` → tarball root `package/dist/xlsx.full.min.js` (same file name is used in the 0.20.x CDN tarballs per SheetJS docs).
- Source for CDN tarball URL pattern and npm-vs-CDN version gap: https://docs.sheetjs.com/docs/getting-started/installation/nodejs (fetched 2026-10-22).

## 2. License

- The LICENSE file inside the actual npm tarball (`package/LICENSE`, `package/dist/LICENSE`) is the plain **Apache License, Version 2.0** (text confirmed by extracting and reading it directly from the downloaded tarball). `npm view xlsx license` also reports `Apache-2.0`.
- The community/free ("CE") distribution — including `xlsx.full.min.js` — is Apache-2.0 licensed in full. There is no separate/dual license on the free build; SheetJS Pro is a **separate commercial product/add-on**, not a different license tier of the same file.
- Apache-2.0 permits commercial and internal use, modification, and redistribution, with attribution/notice preservation, and is standard for vendoring into a project repository. **Safe to commit `xlsx.full.min.js` as-is**, provided the LICENSE file/notice is retained alongside it (good practice: copy `LICENSE` into `lib/` next to the vendored file).
- Citation: tarball `package/LICENSE` and `package/dist/LICENSE` (extracted directly from `xlsx-0.18.5.tgz`, fetched 2026-10-22); `npm view xlsx license` → `Apache-2.0`.

## 3. Feature parity table

| Feature | Free/community build? | Notes / workaround | Source |
|---|---|---|---|
| Multi-sheet workbook (`XLSX.utils.book_new()`, `book_append_sheet()`) | **Yes** | Core CSF (Common Spreadsheet Format) API, fully supported, no restrictions. | docs.sheetjs.com/docs/csf/sheet (fetched 2026-10-22) |
| Per-column widths (`worksheet['!cols']` with `wch`/`wpx`) | **Yes** | `!cols` is a standard array of column objects (width, level, hidden); documented as core CSF, not Pro-gated. Must set write option `cellStyles: true` for row/column metadata (widths, heights, outline/hidden flags) to actually be emitted by the writer — SheetJS docs: *"If the `cellStyles` option is `true`, other styling metadata including row and column [properties] will be exported."* | docs.sheetjs.com/docs/csf/sheet; docs.sheetjs.com/docs/api/write-options (fetched 2026-10-22) |
| Cell styling — font color, fill/background color, bold, borders | **No (Pro only)** | This is the key finding. The official SheetJS GitHub README explicitly markets styling as a Pro feature: *"SheetJS Pro offers solutions beyond data processing: ... let out your inner Picasso with styling."* The `write-options` doc is even more explicit: the free `cellStyles` option controls **only row/column metadata** (widths, heights, outline levels) — it does **not** touch font/fill/border styling — and the docs state directly: *"SheetJS Pro offers cell / text styling, conditional formatting and additional styling options."* The community `xlsx.full.min.js` can **read** style info from files that have it, but cannot reliably **write** custom font color / fill color / bold / borders into new output. | github.com/SheetJS/sheetjs README (fetched 2026-10-22); docs.sheetjs.com/docs/api/write-options (fetched 2026-10-22) |
| → Workaround: `xlsx-js-style` fork | **Exists, but unmaintained** | `xlsx-js-style` (npm) is a community fork of SheetJS that patches in `s` (style) object writing (bold, font color, fill color, borders) for the free tier. Confirmed via npm registry metadata: current version `1.2.0`, license `Apache-2.0`, **last published 2022-05-25** — over 4 years stale as of this research date (2026-10-22). Given no commits/releases in years, treat it as abandoned; do not build a long-term dependency on it without re-verifying it still works with current Excel files, and budget for forking/patching it ourselves if adopted. | `npm view xlsx-js-style version/license/time.modified` (direct registry query, fetched 2026-10-22); github.com/gitbrent/xlsx-js-style (repo url from npm metadata) |
| Frozen header row (`worksheet['!freeze']` / pane API) | **No documented community write support** | The CSF sheet-object docs (docs.sheetjs.com/docs/csf/sheet) and row-properties docs (docs.sheetjs.com/docs/csf/features/rowprops) do **not** mention `!freeze` or a sheet-view/pane property at all. No community CSF key for freeze panes was found anywhere in current SheetJS docs. This matches SheetJS's long-standing reputation for limited/no free-tier freeze-pane write support — confirmed here by its total absence from the current official schema docs rather than by an explicit "Pro only" statement. Treat frozen header row as **not supported** in the free build; do not rely on it. | docs.sheetjs.com/docs/csf/sheet; docs.sheetjs.com/docs/csf/features/rowprops (both fetched 2026-10-22, both silent on freeze/pane) |
| Outline/grouping levels (collapsible rows, `outlineLevel`) | **Partially yes** | Row objects support a `level` property (0–7, zero-indexed, where Excel's displayed base level 1 = SheetJS level 0), documented as a standard CSF row property: *"level ... expected to be a number between 0 and 7 inclusive."* `worksheet['!outline']` is also documented as a configurable sheet-level object controlling outline `above`/`left` summary-row placement, defaulting to Excel's own defaults. These read as core CSF (not Pro-gated) in the docs. However, the docs do **not** explicitly confirm that the writer guarantees `level` is honored on *write* for freshly generated files — the write-options doc's caveat ("Writers are not guaranteed to export row metadata" without `cellStyles: true`) implies this needs the `cellStyles: true` write flag and should be empirically verified once implemented. | docs.sheetjs.com/docs/csf/features/rowprops; docs.sheetjs.com/docs/csf/sheet (both fetched 2026-10-22) |
| AutoFilter (`worksheet['!autofilter']`) | **Yes** | Documented directly in the core sheet-object schema: `type AutoFilter = { ref: string }` (A1-style range for the filter table). No Pro/community distinction mentioned — treated as standard CSF. | docs.sheetjs.com/docs/csf/sheet (fetched 2026-10-22) |

## 4. SheetJS's own vendoring guidance

SheetJS's current official installation docs explicitly recommend self-hosting over CDN-at-runtime use:

> "For general stability, making a local copy of SheetJS scripts ('vendoring') is strongly recommended. Vendoring decouples websites from SheetJS infrastructure."

Their recommended flow is: download the tarball from `cdn.sheetjs.com` (now the authoritative distribution point, since npm lags at 0.18.5), extract `xlsx.full.min.js`, and commit/serve it locally rather than pointing `<script src>` at any CDN at runtime. This aligns exactly with this project's zero-runtime-CDN constraint — download once during vendoring, commit the file, never fetch it live.

Source: https://docs.sheetjs.com/docs/getting-started/installation/nodejs; https://docs.sheetjs.com/docs/getting-started/installation/standalone (both fetched 2026-10-22).

## 5. Sheet-by-sheet export plan

Given the parity findings above — **no custom font/fill/bold styling, no frozen panes, but working multi-sheet, column widths, autofilter, and (likely) outline levels** — the plan below keeps what's realistic and explicitly simplifies the rest rather than fighting the library or adding an unmaintained fork as a hard dependency.

General decisions applied to every sheet:
- **Frozen header row: drop.** Not supported for write in the community build. Substitute: repeat the header text styling cue by just keeping row 1 as a clear header row (bold via `xlsx-js-style` is optional/deferred — see below); users can manually freeze in Excel if desired. If "sticky header" is a hard requirement, it must go through the unmaintained `xlsx-js-style` fork, flagged as a known risk, not the stock `xlsx.full.min.js`.
- **Cell styling (bold headers, fill colors, borders): simplify to none in v1**, or isolate behind an optional `xlsx-js-style` code path that can be removed/swapped later without touching the data-generation logic. Do not block the export feature on styling.
- **Column widths (`!cols` with `wch`): keep.** Cheap, well-supported, high value (avoids "###"-width columns on open).
- **AutoFilter (`!autofilter`): keep** on every tabular sheet — fully supported, high value for a spreadsheet meant to be filtered/sorted by IT staff.
- **Outline levels (`!rows[i].level`, `!outline`): keep for the Baum/Tree sheet only**, where hierarchical collapse is the actual point; verify empirically after implementation that `cellStyles: true` is enough to make Excel honor collapse groups, since the docs don't explicitly guarantee this for freshly-written files.

| Sheet | Purpose | Styling/behavior kept | Simplified / dropped |
|---|---|---|---|
| Übersicht / Overview | Summary counts, generation metadata, legend | Column widths; no autofilter (not a data table) | No styling, no freeze |
| Baum / Tree | Hierarchical device/org structure | Column widths; **outline levels** (`!rows[].level`, `!outline`) to allow Excel collapse/expand of the tree | No cell-level styling; no freeze header (verify outline collapse behavior once implemented) |
| Devices | Table of all inventoried devices | Column widths; `!autofilter` | No freeze, no fill/bold styling in v1 |
| Users | Table of all users | Column widths; `!autofilter` | Same as above |
| Network | Network interface / IP table | Column widths; `!autofilter` | Same as above |
| Applications | Installed application inventory | Column widths; `!autofilter` | Same as above |
| Licenses | License assignments | Column widths; `!autofilter` | Same as above |
| Monitors | Monitor/display inventory | Column widths; `!autofilter` | Same as above |
| Locations | Site/location table | Column widths; `!autofilter` | Same as above |
| Mailboxes | Mailbox inventory | Column widths; `!autofilter` | Same as above |
| Ports | Switch/port mapping table | Column widths; `!autofilter` | Same as above |

**Future option, explicitly deferred:** if stakeholders insist on matching the PowerShell tool's colored/bold headers pixel-for-pixel, evaluate forking `xlsx-js-style` ourselves (it's Apache-2.0, so legally fine to fork) rather than depending on the upstream package, since it has had no release since 2022-05-25. This should be a separate follow-up decision, not bundled into the initial export feature.
