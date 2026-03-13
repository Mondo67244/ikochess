Original prompt: PLEASE IMPLEMENT THIS PLAN:

- Hardening implementation started.
- Focus order: signed play/watch URLs, active game persistence, atomic lifecycle transitions, OpenClaw URL consumption, then validation.
- Constraint recorded: existing secrets and token storage remain unchanged.
- Gameplay/UI pass added on top of hardening:
- Server now emits authoritative `move-applied` payloads, `move-rejected` rollback payloads, normalizes `moveHistory`, and guards AI against duplicate scheduled moves.
- Client now consumes authoritative move sync, shows a compact move-history sheet, highlights the latest move and kings in check, supports tap-to-move promotion choice, and fixes spectator game-over wording.
- Validation run: server `node --check` passed for touched files; client `npm run build` passed.
- Telegram UI pass:
- Added Telegram Mini App theme synchronization via `window.Telegram.WebApp.themeParams` with CSS variable mapping and fallback dark Telegram palette.
- Refreshed the shell, header, badges, buttons, emoji tray, history sheet, and board framing to feel closer to Telegram.
- Reworked `GameOverModal`, `Leaderboard`, `ThemeSelector`, and `PromotionPicker` into a coherent responsive modal/sheet system with scrollable bodies.
- Replaced blocking socket `alert(...)` errors with in-app notices.
- Validation run: client `npm run build` passed, Docker `chess-app` rebuilt and restarted, public `/health` returned `ok`.
- Visual verification attempt: created a temporary live AI game for UI checks, but the Playwright skill script and MCP browser were blocked by the current sandbox/browser installation constraints.
