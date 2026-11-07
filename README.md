# RegsRadar News — Expo mobile prototype

Standalone Expo SDK 58 prototype. No connection to production RegsRadar,
Base44, subscriptions, credentials, or account APIs. No deployment is configured.

## Preview

Use Node.js 22.13+ (22 LTS supports the user's macOS Monterey setup), install
with `npm ci`, then run `npx expo start --clear`. Keep the Mac and iPhone on
the same Wi-Fi, use SDK 58 Expo Go, and sign into the same Expo account in
CLI and Expo Go if required. Keep Metro running while previewing.

## Weekly official news

Fictional sample articles have been replaced with five official Federal Register
publications. Each source page was opened and its title, date, and document
number checked on November 7, 2026.
The requested week is November 1–7, 2026 inclusive, using Pacific calendar dates.

Refresh the dated edition from the official Federal Register API:

```sh
npm run news:refresh -- 2026-11-07
```

Omitting the date selects the current date in America/Los_Angeles and the
preceding six dates. The importer queries publications matching `mortgage`,
loads all pages, validates dates and official HTTPS source URLs, and saves
`src/data/weekly-news.json` only after the complete fetch succeeds. Failed
fetches preserve the existing file; no fixture or sample fallback is used.
The app displays publisher abstracts (or indicates when none is provided),
publication dates, and buttons opening official publications. No compliance
analysis or effective date is invented. Empty verified results and unavailable
results are distinct. This is a dated bundled edition, not a background live feed.

Coverage is limited to Federal Register mortgage search results; it does not
establish exhaustive mortgage regulatory coverage. GSE and state sources are
not included in this importer. The Federal Register API is a discovery source;
users should consult its official publication and linked legal document for
applicability, deadlines, and the official edition.

Live-source access now works in the published development environment. The
November 1–7 edition contains five verified publications from CFPB, HUD, FDIC,
and NCUA. The current importer only fetches Federal Register; permission to
access other publishers does not establish that they are included in this feed.

## Checks

```sh
npm test
npm run typecheck
EXPO_OFFLINE=1 npx expo install --check
EXPO_OFFLINE=1 npx expo export --platform all --max-workers 2
```

Importer tests use clearly labeled fixtures in tests only, never application data.
They validate calendar dates, pagination, attribution, source rejection, incomplete
responses, empty results, and preservation of saved data on failure. They do not
establish live-source connectivity or authenticity of unqueried publications.

For cloud use, set `npm_config_cache=/workspace/.npm-cache` and
`EXPO_NO_TELEMETRY=1`; work in `/workspace/regsradar-news`. Existing checkouts
are isolated per task; do not create a worktree unless requested. Source and
branding changes are separate from production. Cloud tunnel attempts failed;
local Mac Expo Go preview has been confirmed by the user.

## Design and remaining features

The white header, navy controls, gray canvas, and charcoal headings follow the
supplied website screenshot. Exact colors, font, and the official logo still need
approved assets. Account, tracking, and notification actions remain placeholders.
