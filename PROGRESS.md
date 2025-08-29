# Inline Router Rewrite — Progress

This document tracks tasks, decisions, and issues while rewriting the inline router.

## Plan

1. Spec & docs (this lives in `src/view/telegram/inline-router/inline-router.ts` top block) — done
2. Add initial failing tests — done
3. Implement `createRouter` skeleton (wiring bot + stores) — done (minimal runtime)
4. Render + state management (edit/replace/append/smart) - done
5. `bot.action` handlers + navigation via callback_data — done
6. `onText` input flow with cancel/back — done
7. Per-button actions + `answerCbQuery` — done
8. Auto `setMyCommands` merge from `actionName` — done
9. Error handling (`RouterUserError`, `onError`) + per-user mutex - done

## Notes

- Keep public types intact: `Route`, `Button`, `RouterState`, `StartOptions`, helpers `cb`, `parseCb`, `cbTok`, `DSL`.
- Focus on simple, predictable behavior first; add advanced details incrementally.

## Successes

- Detailed spec added at the top of the module to align expectations.
- Kept helper functions and types (`cb`, `parseCb`, `cbTok`, `DSL`) intact.
- Implemented minimal runtime: actionName commands, global callback_query handler, per-button actions with answerCbQuery, and onText prompt/cancel flow.
- setMyCommands merged from `actionName` and options, deduped.
- State persisted in memory; reply rendering with Back/Cancel row when applicable.
- Lint is clean; test suite green.

## Issues / Risks

- onEditFail policy implemented but may need real-world tuning.
- Message pruning (maxMessages) is basic FIFO; consider per-chat policy.
- Telegraf mocking kept minimal; expand as features grow.
