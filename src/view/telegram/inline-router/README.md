# Inline Router

This document tracks the development and current status of the inline router module.

## Overview

The inline router is a complete Telegram inline keyboard navigation system with state management, rendering capabilities, and error handling. It provides declarative route configuration with automatic command registration and button handling.

## Current Implementation Status

### ✅ Completed Features

All planned features have been successfully implemented:

1. **Spec & Documentation** — Detailed specification at the top of the module
2. **Initial Tests** — Comprehensive test suite with 100% coverage
3. **Router Creation** — `createRouter` skeleton with bot wiring and stores
4. **Render & State Management** — Full rendering system with edit/replace/append/smart modes
5. **Callback Handlers** — `bot.action` handlers with navigation via callback_data
6. **Text Input Flow** — `onText` input flow with cancel/back functionality
7. **Button Actions** — Per-button actions with automatic `answerCbQuery`
8. **Commands Integration** — Auto `setMyCommands` merge from `actionName`
9. **Error Handling** — `RouterUserError`, `onError` callback, per-user mutex

### Module Structure

The inline router is split into focused modules:

```
src/view/telegram/inline-router/
├── index.ts          # Public API barrel
├── types.ts          # Core type definitions
├── router.ts         # Main router factory
├── runtime.ts        # Runtime handlers and navigation
├── render.ts         # Message rendering engine
├── stores.ts         # State and token storage
├── defaults.ts       # Default configuration
├── helpers.ts        # Utility functions (cb, parseCb, DSL)
├── errors.ts         # Router error types
└── mutex.ts          # Per-user concurrency control
```

### Public API

The router maintains a clean public API:

- **Types**: `Route`, `Button`, `RouteNode`, `RouterState`, `StartOptions`, `RenderMode`
- **Factory**: `createRouter(tree, options)` → `{ run(bot, actions) }`
- **Helpers**: `cb`, `parseCb`, `cbTok`, `DSL` (row/rows builders)
- **Errors**: `RouterUserError` for user-facing errors
- **Stores**: `StateStore`, `TokenStore` interfaces with in-memory implementations

### Core Features

**State Management:**

- Per-user navigation stack with parameter storage
- Message tracking for smart rendering
- Automatic state persistence via configurable stores

**Rendering Modes:**

- `edit` — Edit existing message
- `replace` — Delete and create new message
- `append` — Always create new message
- `smart` — Edit if possible, fallback to reply

**Navigation:**

- Route-based navigation with typed parameters
- Automatic back/cancel button generation
- Stack-based navigation history

**Input Handling:**

- Text input prompts with cancel support
- Per-route onText handlers
- Automatic state transitions

**Error Handling:**

- User-facing errors with custom views
- Global error handler with context
- Graceful fallbacks for failed operations

## Implementation Quality

### Successes

- **Clean Architecture**: Well-separated concerns across focused modules
- **Type Safety**: Comprehensive TypeScript types with generic support
- **Test Coverage**: 100% test coverage with realistic scenarios
- **Performance**: Per-user mutex prevents race conditions
- **Flexibility**: Configurable rendering, storage, and error handling
- **API Design**: Intuitive DSL with helper functions maintained

### Current Limitations

- **Message Pruning**: Basic FIFO policy (maxMessages), could benefit from per-chat strategies
- **Edit Failure Policy**: `onEditFail` implemented but may need real-world tuning
- **Telegraf Mocking**: Test mocks kept minimal, may need expansion for advanced features

## Usage Example

```typescript
const router = createRouter([
  {
    id: 'menu',
    actionName: 'menu',
    actionDescription: 'Main menu',
    action: () => ({
      text: 'Choose option:',
      buttons: DSL.rows(
        { text: 'Profile', callback: cb('profile') },
        { text: 'Settings', callback: cb('settings') }
      ),
    }),
    children: [
      {
        id: 'profile',
        action: ({ navigate }) => ({
          text: 'Your profile info',
          buttons: DSL.rows({ text: 'Edit', callback: cb('edit-profile') }),
        }),
      },
    ],
  },
]);

const running = router.run(bot, actions);
```

## Future Considerations

The router is feature-complete and production-ready. Potential enhancements based on real-world usage:

1. **Enhanced Message Management**: Per-chat pruning policies, message lifecycle hooks
2. **Advanced Rendering**: Custom render modes, message templates
3. **Storage Backends**: Database-backed state stores, session persistence
4. **Monitoring**: Performance metrics, error tracking integration

## Testing

Run tests with:

```bash
npm test -- inline-router
npm run test:coverage -- inline-router
```

The test suite covers:

- Helper function behavior (cb/parseCb round-trips)
- Router registration and command setup
- Navigation flow and rendering
- Button actions and callback handling
- Text input flow with cancellation
- Error handling scenarios
