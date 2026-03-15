#!/usr/bin/env node

/**
 * Run pending SQL migrations against the configured Neon database.
 *
 * Usage:
 *   node scripts/migrate.mjs          # apply pending migrations
 *   node scripts/migrate.mjs --status # list applied/pending migrations
 *
 * Requires DATABASE_URL in .env.local or environment.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';

// Load .env.local manually (avoids dotenv dependency)
try {
  const envPath = join(import.meta.dirname, '..', '.env.local');
  const envContent = await readFile(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local may not exist in CI */ }

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env.local or your environment.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

async function ensureTrackingTable() {
  // Rename legacy ip_migrations -> finpath_migrations if needed
  const legacy = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ip_migrations'
  `;
  const current = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'finpath_migrations'
  `;
  if (legacy.length > 0 && current.length === 0) {
    await sql.query('ALTER TABLE ip_migrations RENAME TO finpath_migrations');
    console.log('  Renamed ip_migrations -> finpath_migrations');
  }

  await sql`
    CREATE TABLE IF NOT EXISTS finpath_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function getApplied() {
  const rows = await sql`SELECT name FROM finpath_migrations ORDER BY name`;
  return new Set(rows.map((r) => r.name));
}

async function getMigrationFiles() {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter((f) => f.endsWith('.sql') && f !== '003_migration_tracking.sql')
    .sort();
}

function splitStatements(content) {
  // Handle DO $$ ... END$$; blocks and regular statements.
  const stmts = [];
  let current = '';
  let inDollarBlock = false;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) {
      if (inDollarBlock) current += line + '\n';
      continue;
    }

    current += line + '\n';

    if (trimmed.includes('DO $$') || trimmed.includes('DO $')) {
      inDollarBlock = true;
    }
    if (inDollarBlock && trimmed.match(/END\s*\$\$\s*;/)) {
      inDollarBlock = false;
      stmts.push(current.trim());
      current = '';
      continue;
    }

    if (!inDollarBlock && trimmed.endsWith(';')) {
      stmts.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) stmts.push(current.trim());
  return stmts.filter(Boolean);
}

async function applyMigration(file) {
  const filePath = join(MIGRATIONS_DIR, file);
  const content = await readFile(filePath, 'utf-8');
  const stmts = splitStatements(content);
  for (const stmt of stmts) {
    await sql.query(stmt);
  }
  await sql`INSERT INTO finpath_migrations (name) VALUES (${file}) ON CONFLICT DO NOTHING`;
  console.log(`  ✓ ${file}`);
}

async function main() {
  const statusOnly = process.argv.includes('--status');

  await ensureTrackingTable();
  const applied = await getApplied();
  const files = await getMigrationFiles();

  const pending = files.filter((f) => !applied.has(f));

  if (statusOnly) {
    console.log(`\nMigrations (${files.length} total, ${pending.length} pending):\n`);
    for (const f of files) {
      console.log(`  ${applied.has(f) ? '[applied]' : '[pending]'}  ${f}`);
    }
    return;
  }

  if (pending.length === 0) {
    console.log('All migrations are up to date.');
    return;
  }

  console.log(`Applying ${pending.length} migration(s):\n`);
  for (const f of pending) {
    await applyMigration(f);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
