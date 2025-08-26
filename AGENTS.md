# AGENTS

- Use **npm** for dependencies. Run `npm install` when needed.
- After code changes, make sure the TypeScript build succeeds:
  ```bash
  npm run build
  ```
- Run the unit tests with:
  ```bash
  npm test
  npm run test:coverage
  ```
  Do **not** run `npm run test:watch`.
- Fix formatting before committing:
  ```bash
  npm run format:fix
  ```
- Useful npm scripts:
  - `npm run dev` – start in development mode
  - `npm run build` – compile TypeScript
  - `npm start` – run the built bot
  - `npm test` – run unit tests once
  - `npm run test:coverage` – run tests with coverage
  - `npm run test:watch` – run tests in watch mode (not required)
  - `npm run lint` – check lint errors
  - `npm run lint:fix` – fix lint errors
  - `npm run format` – verify formatting
  - `npm run format:fix` – format files
- `npm run prepare` – set up Git hooks
- Never skip Husky pre-commit hooks (avoid using `--no-verify`)
- `npm run migration:up` – apply database migrations
- `npm run migration:down` – revert the last migration
- Do not commit `node_modules` or `package-lock.json`.
- When environment variables change, update `.env.example` accordingly.
- When adding new services, define an interface and export an Inversify key (Symbol)
  so they can be bound in the container.
- Do not use default exports.
- Database access goes through the `DbProvider` interface which exposes `get()` and
  `listTables()`. Only modules that directly work with SQLite should depend on the
  `SQLiteDbProvider` implementation; business logic must use repository interfaces
  and remain database‑agnostic.

## Prompts

- Храните шаблоны промптов в каталоге `prompts/` и загружайте их через
  `PromptTemplateService` вместо прямого чтения файлов.
- Собирайте сообщения с помощью `PromptBuilder`, создавая новый билдер для
  каждого промпта.
- Логику выбора сценария выносите в `PromptDirector`.
- Для новых сервисов или билдеров объявляйте интерфейсы и экспортируйте
  символы Inversify.

## Code style

- Remove unused parameters when possible; otherwise prefix them with an underscore
  (`_param`) to satisfy `@typescript-eslint/no-unused-vars`.
- When a Promise should be fire-and-forget, call it with `void` to avoid blocking
  the main execution flow (e.g. `void this.logPrompt(...)`).
- When exporting or iterating over object properties (e.g. building CSV rows),
  type header arrays with `keyof` instead of casting entities to `any` or
  `Record<string, unknown>`. If a key cannot be typed, prefer `Reflect.get`.

## Troubleshooting

- `npm run build` may fail with `swc: not found`. Run `npm install` to install
  dependencies before building.
- You might see `npm warn Unknown env config "http-proxy"` during npm commands.
  If this happens, remove or unset the `http-proxy` npm config with
  `npm config delete http-proxy`.
- `npm test` runs tests once. `npm run test:watch` runs tests in watch mode, but is not required.
- If migrations fail because the existing database lacks the `migrations`
  table, the migration script will remove `memory.db` and recreate it
  automatically.
