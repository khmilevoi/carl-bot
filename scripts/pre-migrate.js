/* eslint-env node */
/* eslint-disable import/no-unused-modules, @typescript-eslint/no-require-imports */
const { execSync } = require('node:child_process');

if (process.env.NODE_ENV === 'development') {
  execSync('npm run build', { stdio: 'inherit' });
}
