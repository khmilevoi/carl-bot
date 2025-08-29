# Inline Router Rewrite — Progress

This document tracks tasks, decisions, and issues while rewriting the inline router.

## Plan

1. Spec & docs (this lives in `src/view/telegram/inline-router/inline-router.ts` top block) — done
2. Add initial failing tests — done
3. Implement `createRouter` skeleton (wiring bot + stores) — todo
4. Render + state management (edit/replace/append/smart) — todo
5. `bot.action` handlers + navigation via callback_data — todo
6. `onText` input flow with cancel/back — todo
7. Per-button actions + `answerCbQuery` — todo
8. Auto `setMyCommands` merge from `actionName` — todo
9. Error handling (`RouterUserError`, `onError`) + per-user mutex — todo

## Notes

- Keep public types intact: `Route`, `Button`, `RouterState`, `StartOptions`, helpers `cb`, `parseCb`, `cbTok`, `DSL`.
- Focus on simple, predictable behavior first; add advanced details incrementally.

## Successes

- Added detailed spec at the top of the module to align expectations.
- Kept the helper functions and types available for early adoption.

## Issues / Risks

- Some features not yet implemented (bot.action callbacks, smart edit, onText flow). Tests will be expanded.
- Telegraf mocking needs to be minimal and robust in tests.
