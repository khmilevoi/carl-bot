# AGENTS

- Use **npm** for dependencies. Run `npm install` when needed.
- After code changes, make sure the TypeScript build succeeds:
  ```bash
  npm exec tsc
  ```
- Run the unit tests with:
  ```bash
  npm test
  ```
- Useful npm scripts:
  - `npm run dev` – start in development mode
  - `npm run build` – compile TypeScript
  - `npm start` – run the built bot
  - `npm run coverage` – run tests with coverage
  - `npm run lint` – check lint errors
  - `npm run lint:fix` – fix lint errors
  - `npm run format` – verify formatting
  - `npm run format:fix` – format files
- Do not commit `node_modules` or `package-lock.json`.
