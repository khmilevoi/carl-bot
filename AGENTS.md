# AGENTS

- Use **npm** for dependencies. Run `npm install` when needed.
- After code changes, make sure the TypeScript build succeeds:
  ```bash
  npm run build
  ```
- Run the unit tests with:
  ```bash
  npm test
  npm run test:watch
  npm run test:coverage
  ```
- Useful npm scripts:
  - `npm run dev` – start in development mode
  - `npm run build` – compile TypeScript
  - `npm start` – run the built bot
  - `npm test` – run unit tests once
  - `npm run test:watch` – run tests in watch mode
  - `npm run test:coverage` – run tests with coverage
  - `npm run lint` – check lint errors
  - `npm run lint:fix` – fix lint errors
  - `npm run format` – verify formatting
  - `npm run format:fix` – format files
- `npm run prepare` – set up Git hooks
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

## Troubleshooting

- `npm run build` may fail with `swc: not found`. Run `npm install` to install
  dependencies before building.
- You might see `npm warn Unknown env config "http-proxy"` during npm commands.
  If this happens, remove or unset the `http-proxy` npm config with
  `npm config delete http-proxy`.
- `npm test` runs tests once. Use `npm run test:watch` for watch mode.
- If migrations fail because the existing database lacks the `migrations`
  table, the migration script will remove `memory.db` and recreate it
  automatically.
