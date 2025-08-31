# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Build and Run:**

- `npm run build` - Build the project using RSBuild
- `npm start` - Run the built application
- `npm run dev` - Development mode with file watching

**Testing:**

- `npm test` - Run all tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

**Code Quality:**

- `npm run type:check` - TypeScript type checking
- `npm run lint` - ESLint code checking
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Check Prettier formatting
- `npm run format:fix` - Auto-fix formatting

**Database:**

- `npm run migration:up` - Apply database migrations
- `npm run migration:down` - Rollback database migrations
- `npm run migration:check` - Check migration status

## Architecture

This is a TypeScript Telegram bot using:

- **Dependency Injection**: Inversify container with interfaces and Symbol-based service registration
- **Clean Architecture**: Domain entities, application use-cases, infrastructure implementations
- **SQLite Database**: For message history, user data, chat configurations
- **OpenAI Integration**: ChatGPT 4o for AI responses

### Core Structure

**Entry Point:**

- `src/index.ts` - Application bootstrap with HTTP server and signal handling
- `src/container.ts` - Inversify DI container setup

**Domain Layer:**

- `src/domain/entities/` - Core entities (User, Chat, Message, etc.)
- `src/domain/repositories/` - Repository interfaces
- `src/domain/triggers/` - Bot trigger system

**Application Layer:**

- `src/application/interfaces/` - Service interfaces
- `src/application/use-cases/` - Business logic implementations
- `src/application/prompts/` - AI prompt building system

**Infrastructure Layer:**

- `src/infrastructure/persistence/sqlite/` - SQLite repository implementations
- `src/infrastructure/external/` - OpenAI service integration
- `src/infrastructure/config/` - Environment configuration

**View Layer:**

- `src/view/telegram/` - Telegram bot interface
- `src/view/telegram/inline-router/` - Custom inline keyboard router system

### Key Systems

**Prompt Architecture:**
Three-layer system for AI prompt generation:

1. `TemplateService` - Loads templates from `prompts/` directory
2. `PromptBuilder` - Chain-method template composition
3. `PromptDirector` - Orchestrates builders for specific scenarios

**Inline Router:**
Custom routing system in `src/view/telegram/inline-router/` for managing inline keyboard navigation with state management and rendering capabilities.

**Trigger Pipeline:**
Bot responds to mentions, replies, name triggers, or interest-based triggers through `src/view/telegram/triggers/`.

## Configuration

Environment variables in `.env`:

- `BOT_TOKEN` - Telegram bot token
- `OPENAI_KEY` - OpenAI API key
- `ADMIN_CHAT_ID` - Admin chat ID for bot management
- `LOG_PROMPTS` - Log AI prompts (optional)

## Code Conventions

- No `any` type or `@ts-` directives allowed
- Use dependency injection with Inversify
- Follow existing naming patterns and file structure
- Repository pattern for data access
- Interface-first design with Symbol-based registration
- No default exports
- Remove unused parameters when possible; otherwise prefix with underscore (`_param`)
- Use `void` for fire-and-forget Promises to avoid blocking execution
- Type object properties with `keyof` instead of casting to `any`

## Development Workflow

**Build Process:**

- Always run `npm run build` after code changes to ensure TypeScript compilation succeeds
- Run `npm install` when dependencies are updated
- Never commit `node_modules` or modify `package-lock.json` directly

**Testing:**

- Use `npm test` for single test runs
- Use `npm run test:coverage` for coverage reports
- Do NOT use `npm run test:watch` in automated workflows

**Pre-commit:**

- Never skip Husky pre-commit hooks (avoid `--no-verify`)
- Run `npm run format:fix` to fix formatting before committing
- Update `.env.example` when environment variables change

## Database Guidelines

- Database access through `DbProvider` interface only
- Business logic must use repository interfaces and remain database-agnostic
- Only SQLite-specific modules should depend on `SQLiteDbProvider`
- Use `npm run migration:up/down` for database schema changes

## Prompt System Guidelines

- Store prompt templates in `prompts/` directory
- Load templates through `PromptTemplateService` (not direct file reading)
- Build messages using `PromptBuilder` (create new builder for each prompt)
- Handle scenario selection logic in `PromptDirector`
- Declare interfaces and export Inversify symbols for new services/builders

## Troubleshooting

- Build failures with "swc: not found": Run `npm install` first
- "Unknown env config http-proxy" warning: Remove with `npm config delete http-proxy`
- Migration failures: Script auto-removes and recreates `memory.db` if migrations table missing
- отдавай предпочтение запуску сразу fix команд, некоторые ошибки сразу будут исправленны
- используй сразу npm run lint:fix
- запомни что можно использовать паттерн матчинг и давай ему предпочтение тернарным выражениям
