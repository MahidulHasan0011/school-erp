import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  // Supabase pooler requires SSL
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  // Database-first project — schema is designed in Supabase, not by entities.
  // Keep false everywhere; evolve the schema with migrations.
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
}));
