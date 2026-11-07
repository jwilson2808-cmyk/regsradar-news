# RegsRadar News — Expo mobile prototype

A **standalone, read-only prototype** of RegsRadar News for iPhone and Android. It does not connect to, modify, or authenticate with the live Base44 platform.

## Start

1. Install Node.js LTS and Expo Go on your phone.
2. Open this folder in a terminal (or in Codex).
3. Run `npm ci` then `npx expo start`.
4. Sign in to Expo CLI and Expo Go with the same Expo account if prompted.
5. Scan the QR code with the iPhone camera to open in Expo Go. Your development computer must remain on with the server running. If local networking fails, use `npx expo start --tunnel` (may require installing `@expo/ngrok`).

## Current prototype functionality

- Public news feed with category filters, search, and article detail pages.
- Account-gated tracking and preferences are **non-functional placeholders** with an explanatory alert.
- All article titles and summaries are **fictional**, clearly marked SAMPLE, and contain no live regulatory updates.
- Theme tokens are in `src/theme.ts` and are **provisional**; verify exact colors, typography, and logo against the live website before launch.
- No app icon, third-party branding asset, backend, credentials, push notifications, or direct regulatory feeds are included.

## Next tasks for Codex

1. Confirm the official RegsRadar branding and replace placeholder logo/colors.
2. Implement a validated, read-only news API adapter; do not invent articles or fall back silently to fake stories.
3. Write automated component and filtering tests.
4. Design secure identity integration with the existing Base44 organization and Stripe plan enforcement.
5. Add notification opt-in and verified source links after official-feed validation.
6. Run `npx expo install --fix` to reconcile SDK-compatible dependency versions if the Expo CLI flags any differences.

This is starter source code, not an installed app or a hosted preview. Codex or a local developer environment must run the Expo server to scan a preview QR code.

## Verified cloud development setup

The supplied source files are installed in `/workspace/regsradar-news`, including
`src/news.ts` and `src/theme.ts`. Dependencies are locked in `package-lock.json`.
React Native and expo-status-bar match Expo SDK 57's bundled compatibility table;
react-dom and react-native-web support the existing web command.

Cloud commands (no production connection or deployment):

```sh
cd /workspace/regsradar-news
export npm_config_cache=/workspace/.npm-cache
export XDG_CACHE_HOME=/workspace/.cache
export EXPO_NO_TELEMETRY=1
npm ci
npm run typecheck
EXPO_OFFLINE=1 npx expo install --check
EXPO_OFFLINE=1 npx expo export --platform all --max-workers 2
EXPO_OFFLINE=1 npx expo start --web --localhost --port 8081 --max-workers 2
```

Offline compatibility checks use the installed SDK's table; online Expo service
checks are blocked by the current network policy. A local export creates build
artifacts in `dist/`; it does not publish or deploy them.

Validation completed: TypeScript, iOS/Android/web bundle generation, and browser
smoke checks for sample notices, category filters, keyword search, article details,
Tracked/Account tabs, and empty results. There was no pre-existing automated test
suite. Mobile bundling does not establish physical-device behavior.

Brand colors remain provisional and the header uses a placeholder R mark.
The public branding website was blocked by environment network policy, so an
exact branding match has not been verified. No production API is configured.

For an iPhone, use an Expo Go version compatible with SDK 57. From a local computer,
run `npm ci` and `npx expo start`, keep the phone on the same network, and scan the
QR code with the iPhone camera. A cloud preview requires an explicitly started
tunnel (`npx expo start --tunnel`) and network access for Expo/tunnel services.
No tunnel has been started here. If the App Store Expo Go does not support SDK 57,
use a compatible SDK or an approved development build; native builds require a
separate setup and Apple signing. No build has been submitted to Apple.
