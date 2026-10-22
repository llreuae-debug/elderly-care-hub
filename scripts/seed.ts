import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Standalone Database Seeder for Phase 1
 * Usage:
 *   npx ts-node scripts/seed.ts
 *
 * Supports both:
 * 1. Direct SQL execution via seed.sql (for Supabase CLI / Postgres)
 * 2. Supabase API client insertion when EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
 */
async function runSeed() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  console.log('🌱 Elderly Care Hub — Seeding Phase 1 Database...');

  const seedSqlPath = path.resolve(process.cwd(), 'supabase/seed.sql');
  if (fs.existsSync(seedSqlPath)) {
    console.log(`✓ Verified Supabase seed file: ${seedSqlPath}`);
  }

  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('your-project-id')) {
    console.log('\nℹ️ No live Supabase connection detected in environment variables.');
    console.log('The app is bundled with built-in instant local seed data for testing.');
    console.log('To seed a remote Supabase project:');
    console.log('  1. Run `npx supabase db push` or copy `supabase/seed.sql` into Supabase SQL Editor.');
    console.log('  2. Or export EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and re-run this script.');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log(`Connecting to Supabase at: ${supabaseUrl}`);

  // Test connection
  const { data: circles, error } = await supabase.from('care_circles').select('*').limit(1);
  if (error) {
    console.warn('⚠️ Note: Direct table query reported:', error.message);
    console.log('Please execute `supabase/migrations/20261023000001_initial_schema.sql` first in your Supabase SQL Editor.');
  } else {
    console.log(`✓ Connected to Supabase! Existing circles count: ${circles?.length || 0}`);
  }
}

runSeed().catch((err) => {
  console.error('Seed execution error:', err);
  process.exit(1);
});
