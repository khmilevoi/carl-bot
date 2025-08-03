import 'dotenv/config';

import { getDataSource } from '@/services/storage/dataSource';

async function migrate() {
  const ds = await getDataSource();
  const cmd = process.argv[2];

  if (cmd === 'up') {
    await ds.runMigrations();
  } else if (cmd === 'down') {
    await ds.undoLastMigration();
  } else if (cmd === 'check') {
    await ds.showMigrations();
  } else {
    console.error('Unknown command');
  }
  await ds.destroy();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
