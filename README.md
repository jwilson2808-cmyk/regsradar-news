# RegsRadar News

Standalone Expo SDK 58 mortgage regulatory and legislative monitoring prototype.
Production Base44, RegsRadar accounts, subscriptions, and authentication are not
connected or modified. Branding, navigation, and existing placeholder account
behavior are preserved. No app deployment is configured.

## iPhone preview

Use Node.js 22.13+ and SDK 58 Expo Go. Run `npm ci`, then `npx expo start --clear`.
Keep the Mac and iPhone on the same Wi-Fi and signed into the same Expo account
if prompted. Keep Metro running during development.

The app reads the verified JSON feed from this repository on launch, on foreground
return after an hour, and on pull-to-refresh. It falls back to its bundled feed on
network errors, independently hiding articles outside the 14-day freshness window.
This read-only GitHub connection is separate from production RegsRadar. Once the
app code is updated, later data-only refreshes do not require downloading the feed
again. This is a development preview, not an App Store release.

## Feed behavior

The active feed contains publications or verified material legislative actions
from the preceding 14 Pacific calendar dates, inclusive. The original publication
date is preserved. A website's modified date, RSS upload date, or XML packaging
date is never treated as a new legal development. Future-dated publications are
excluded. Market surveys, earnings, securities transactions, loan sales, awards,
financial-education events, and routine licensing lists are excluded.

The mobile screen offers Past 7 days, Past 14 days, All available, and Custom dates.
These filter the active feed; dates before the loaded 14-day window are rejected
with a clear message. Older reviewed records are retained for audit in the archive,
not silently presented as fresh news. The old weekly banner and source-survey
paragraphs have been removed. No redesign or unrelated feature change was made.

Details retain official titles, issuing authority, original dates, source URLs,
references where available, summary, what changed, why it matters, affected area,
and only explicitly verified effective dates. Proposals, final regulations,
legislation, guidance, enforcement, and regulatory notices have distinct labels.
A proposed bill is never labeled enacted merely because it passed one chamber.

## Monitoring

```sh
npm run news:monitor
# Reproduce a specific monitoring date:
npm run news:monitor -- 2026-11-07
```

`news:refresh` is an alias for the same monitor. Ordinary development commands run
in the project directory. In cloud, use `/workspace/regsradar-news` and set
`npm_config_cache=/workspace/.npm-cache` when necessary. Cloud tasks are already
isolated; use the existing checkout rather than creating a worktree.

Federal Register keyword search discovers candidates; only explicitly reviewed
mortgage-related results in `src/data/editorial-review.json` enter the feed. That
review records title identity, relevance, type, and verification timestamp.
Curated GSE/state sources are reviewed in `src/data/curated-news.json` and rechecked
against their specific official documents. A changed reviewed title is rejected
until reviewed again. Unreviewed candidates are recorded in a review queue.

A bounded set of configured agency and regulator indexes is also scanned. HTML
and supported official PDF circulars must provide a specific document, publication
date, source text, and mortgage-policy significance. Generic indexes, ambiguous
publication dates, and unsupported formats are rejected and logged. Source failures
are isolated. Limited scans and index accessibility are not reported as exhaustive
monitoring. The source registry is `scripts/news-sources.json`.

GovInfo's public RSS and official Library of Congress bill-status XML provide a
keyless federal legislative adapter. Significant action dates are read from the
XML, not the feed upload time. Discovery is bounded and not exhaustive. No Congress
API key or other new credential is required by the code or workflow. An earlier
optional Congress API draft requirement can be removed in environment settings;
the available draft tool cannot delete it.

Responses use ETag/Last-Modified conditional requests and a local `.news-cache/`
response cache. Canonical URLs and document references prevent exact duplicates
before summaries are retained. Unchanged documents reuse their existing summary
and first-seen timestamp; new scans do not make them new regulatory developments.
No AI summarization API or bill-status inference from free-form reporting is used.

## Daily job

`.github/workflows/news-monitor.yml` registers a daily 08:30 UTC run and manual
`workflow_dispatch`. It runs tests, monitors official sources, checks types, and
commits the verified feed/archive and source reports to this repository. It does
not deploy a site, submit an app, or connect to production. PDF extraction uses
Poppler. GitHub Actions must be enabled and allowed to write repository contents;
branch protections may require adjusting this data-update workflow. Local execution
is verified separately from the first actual GitHub job and future scheduled runs.

## Coverage and known gaps

Read [the source coverage report](reports/news-source-coverage.md) and its JSON
counterpart for outcomes and individual failures. The registry includes the
requested federal agencies/programs, all 50 state banking-regulator directory
entries, and all 50 legislative index endpoints. That registry is not a claim of
complete regulatory or legislative monitoring.

Working publication paths currently include reviewed Federal Register mortgage
rules/notices, Fannie Mae policy announcements, and supported VA circulars. State
regulator discovery is partial. Current state legislative checks establish index
access only; jurisdiction-specific substantive bill/action adapters remain
unimplemented. Direct Congress.gov public access may be blocked, while GovInfo
works without a key. Freddie Mac's JavaScript Guide, some HUD/FHA/Ginnie Mae/USDA
program documents, and other agency indexes remain partial or unparseable. State
attorney-general and housing-finance-agency sources are not comprehensively
configured. The report explicitly records these gaps; no secondary story, guessed
date, or fabricated article is substituted to fill them.

## Validation

```sh
npm test
npm run typecheck
EXPO_OFFLINE=1 npx expo install --check
EXPO_OFFLINE=1 npx expo export --platform all --max-workers 2
```

Tests cover freshness boundaries, publication versus modification dates, material
actions, proposed/enacted status, source rejection, unreviewed content, duplicate
prevention, unchanged summary reuse, isolated failures, official circular parsing,
remote-feed validation, and date/category/search combinations. Fixtures are never
bundled as application news. Live-source checks and browser smoke tests are
additional validation, not replaced by fixture tests.
