import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load .env when this file is executed standalone by the TypeORM CLI
loadEnv();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  // Glob the compiled/ts entities and migrations
  entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
  // migrations/ = টেবিল/schema, views/ = CREATE VIEW migration — দুটোই একই
  // migrations টেবিলে track হয়; timestamp দিয়ে order হয় (folder-নিরপেক্ষ)।
  migrations: [
    __dirname + '/migrations/*{.ts,.js}',
    __dirname + '/views/*{.ts,.js}',
  ],
  synchronize: false, // CLI/migrations must never auto-sync
  logging: process.env.DB_LOGGING === 'true',
};

// Used by the TypeORM CLI: `typeorm migration:run -d dist/database/data-source.js`
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
