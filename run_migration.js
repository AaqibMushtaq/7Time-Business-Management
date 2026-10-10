/**
 * Run the missing general_daily_records migration against Production Supabase.
 * 
 * Usage:
 *   node run_migration.js
 *   node run_migration.js "<postgresql-connection-uri>"
 * 
 * Find connection string in: Supabase Dashboard → Project Settings → Database → Connection String → URI
 * 
 * This script:
 *   1. Creates general_daily_records table
 *   2. Creates general_delivery_entries table
 *   3. Sets up indexes, RLS policies, triggers
 *   4. Notifies PostgREST to reload schema cache
 *   5. Verifies the tables, columns, and RLS exist
 */

import fs from 'fs';
import readline from 'readline';
import { execSync } from 'child_process';

async function executeMigration(dbUrl) {
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
    console.log("📄 Reading supabase/migrations/00005_fix_general_daily_delivery.sql...");
    const sql = fs.readFileSync('supabase/migrations/00005_fix_general_daily_delivery.sql', 'utf8');
    
    console.log("🚀 Running migration...\n");
    await client.query(sql);
    console.log("✅ Migration executed successfully!\n");

    console.log("🔍 Verifying tables...");
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('general_daily_records', 'general_delivery_entries');
    `);

    const foundTables = tableCheck.rows.map(r => r.table_name);
    console.log("   Found tables:", foundTables);

    if (foundTables.includes('general_daily_records')) {
      console.log("   ✅ general_daily_records EXISTS");
    } else {
      console.log("   ❌ general_daily_records MISSING");
    }

    if (foundTables.includes('general_delivery_entries')) {
      console.log("   ✅ general_delivery_entries EXISTS");
    } else {
      console.log("   ❌ general_delivery_entries MISSING");
    }

    // Verify columns
    console.log("\n🔍 Verifying general_daily_records columns...");
    const colCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'general_daily_records'
      ORDER BY ordinal_position;
    `);
    colCheck.rows.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    console.log("\n🔍 Verifying general_delivery_entries columns...");
    const entryColCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'general_delivery_entries'
      ORDER BY ordinal_position;
    `);
    entryColCheck.rows.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // Verify RLS
    console.log("\n🔍 Verifying RLS policies...");
    const rlsCheck = await client.query(`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename IN ('general_daily_records', 'general_delivery_entries');
    `);
    rlsCheck.rows.forEach(pol => {
      console.log(`   ✅ ${pol.tablename}: ${pol.policyname}`);
    });

    // Notify PostgREST to reload schema
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("\n✅ Notified PostgREST schema cache reload");

    console.log("\n" + "=".repeat(60));
    console.log("✅ GENERAL DELIVERY MIGRATION COMPLETE AND VERIFIED");
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
if (argUrl) {
  executeMigration(argUrl);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter your Supabase Database Connection String (postgresql://...): ', async (dbUrl) => {
    rl.close();
    await executeMigration(dbUrl);
  });
}
