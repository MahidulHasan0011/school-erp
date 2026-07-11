import { readFileSync } from 'fs';
import { join } from 'path';
import dataSource from '../data-source';

/**
 * Runs the raw SQL seed file (seed.sql) through the TypeORM DataSource.
 *
 * Usage:  npm run seed
 *
 * The SQL file contains its own BEGIN/COMMIT, so it runs as a single
 * transactional batch. The pg driver executes multi-statement SQL in one call.
 */
async function run(): Promise<void> {
  const sqlPath = join(__dirname, 'seed.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  await dataSource.initialize();
  console.log('DataSource initialized — running seed.sql ...');

  try {
    await dataSource.query(sql);
    console.log('✅ Seed completed successfully.');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

void run();
