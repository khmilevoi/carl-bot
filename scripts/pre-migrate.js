require('dotenv/config');

const { execSync } = require('node:child_process');

if (process.env.NODE_ENV === 'development') {
  execSync('npm run build', { stdio: 'inherit' });
}
