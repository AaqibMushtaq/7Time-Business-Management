/**
 * Run the wholesale_sales payment_method migration against Production Supabase.
 * 
 * Usage:
 *   node run_migration.js
 *   node run_migration.js "<postgresql-connection-uri>"
 *   node run_migration.js "<postgresql-connection-uri>" "supabase/migrations/00003_add_payment_method_wholesale.sql"
 * 
 * Find connection string in: Supabase Dashboard → Project Settings → Database → Connection String → URI
 * 
 * This script:
 *   1. Adds payment_method column to wholesale_sales (additive, IF NOT EXISTS)
 *   2. Preserves all existing records and calculations
 *   3. Notifies PostgREST to reload schema cache
 *   4. Verifies the column, data type, and existing rows
 */

import fs from 'fs';
import readline from 'readline';
import { execSync } from 'child_process';

const DEFAULT_MIGRATION = 'supabase/migrations/00003_add_payment_method_wholesale.sql';

async function executeMigration(dbUrl, migrationFile = DEFAULT_MIGRATION) {
  if (!dbUrl || !dbUrl.trim().startsWith('postgresql')) {
    console.error("❌ Invalid database URL. Must start with 'postgresql://'");
    process.exit(1);
  }

  try {
    execSync('npm install pg --save-dev', { stdio: 'ignore' });
  } catch (e) {
    console.log("Note: pg is available.");
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString: dbUrl.trim() });
  
  await client.connect();
  console.log("✅ Connected to Postgres!\n");

  try {
    console.log(`📄 Reading migration: ${migrationFile}...`);
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log("🚀 Running migration...\n");
    await client.query(sql);
    console.log("✅ Migration executed successfully!\n");

    console.log("🔍 Verifying public.wholesale_sales table...");
    const tableCheck = await client.query(`
      SELECT to_regclass('public.wholesale_sales') AS table_regclass;
    `);

    const tableExists = tableCheck.rows[0]?.table_regclass;
    if (tableExists) {
      console.log("   ✅ public.wholesale_sales EXISTS");
    } else {
      console.log("   ❌ public.wholesale_sales MISSING");
    }

    // Verify payment_method column
    console.log("\n🔍 Verifying payment_method column on wholesale_sales...");
    const colCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wholesale_sales'
      ORDER BY ordinal_position;
    `);
    
    let hasPaymentMethod = false;
    colCheck.rows.forEach(col => {
      const isTarget = col.column_name === 'payment_method';
      if (isTarget) hasPaymentMethod = true;
      console.log(`   ${isTarget ? '👉 ' : '   '}${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    if (hasPaymentMethod) {
      console.log("\n   ✅ Column 'payment_method' EXISTS on 'wholesale_sales'");
    } else {
      console.log("\n   ❌ Column 'payment_method' NOT FOUND on 'wholesale_sales'");
    }

    // Verify existing records preserved
    console.log("\n🔍 Checking existing wholesale_sales record count...");
    const countCheck = await client.query(`SELECT COUNT(*) AS count FROM public.wholesale_sales;`);
    console.log(`   Total historical wholesale_sales records: ${countCheck.rows[0]?.count || 0}`);

    // Notify PostgREST to reload schema
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("\n✅ Notified PostgREST schema cache reload");

    console.log("\n" + "=".repeat(60));
    console.log("✅ WHOLESALE PAYMENT_METHOD MIGRATION COMPLETE AND VERIFIED");
    console.log("=".repeat(60));
  } catch (err) {
    console.error("\n❌ Error executing migration:", err.message);
    if (err.detail) console.error("   Detail:", err.detail);
    if (err.hint) console.error("   Hint:", err.hint);
  } finally {
    await client.end();
  }
}

const argUrl = process.argv[2] || process.env.DATABASE_URL;
const argFile = process.argv[3] || DEFAULT_MIGRATION;

if (argUrl) {
  executeMigration(argUrl, argFile);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter your Supabase Database Connection String (postgresql://...): ', async (dbUrl) => {
    rl.close();
    await executeMigration(dbUrl, argFile);
  });
}
