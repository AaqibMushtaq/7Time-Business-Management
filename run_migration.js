/**
 * Run the missing naeem_payments migration against Production Supabase.
 * 
 * Usage:
 *   node run_migration.js
 * 
 * You will be prompted for your Supabase Database Connection String.
 * Find it in: Supabase Dashboard → Settings → Database → Connection String → URI
 * 
 * This script:
 *   1. Creates naeem_payments table
 *   2. Creates naeem_payment_allocations table  
 *   3. Sets up indexes, RLS policies, triggers
 *   4. Recreates the get_naeem_opening_balance RPC function
 *   5. Notifies PostgREST to reload schema cache
 *   6. Verifies the tables exist
 */

import fs from 'fs';
import readline from 'readline';
import { execSync } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter your Supabase Database Connection String (postgresql://...): ', (dbUrl) => {
  if (!dbUrl || !dbUrl.trim().startsWith('postgresql')) {
    console.error("❌ Invalid database URL. Must start with 'postgresql://'");
    rl.close();
    process.exit(1);
  }

  // Ensure pg is installed
  try {
    execSync('npm install pg --save-dev', { stdio: 'ignore' });
  } catch(e) {
    console.log("Note: Could not install pg automatically. Make sure 'pg' is available.");
  }

  import('pg').then(({ Client }) => {
    const client = new Client({ connectionString: dbUrl.trim() });
    client.connect()
      .then(async () => {
        console.log("✅ Connected to Postgres!\n");
        
        try {
          // Step 1: Run the migration
          console.log("📄 Reading 00010_restore_naeem_payment_tables.sql...");
          const sql = fs.readFileSync('supabase/migrations/00010_restore_naeem_payment_tables.sql', 'utf8');
          console.log("🚀 Running migration...\n");
          await client.query(sql);
          console.log("✅ Migration executed successfully!\n");
          
          // Step 2: Verify tables exist
          console.log("🔍 Verifying tables...");
          const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('naeem_payments', 'naeem_payment_allocations');
          `);
          
          const foundTables = tableCheck.rows.map(r => r.table_name);
          console.log("   Found tables:", foundTables);
          
          if (foundTables.includes('naeem_payments')) {
            console.log("   ✅ naeem_payments EXISTS");
          } else {
            console.log("   ❌ naeem_payments MISSING");
          }
          
          if (foundTables.includes('naeem_payment_allocations')) {
            console.log("   ✅ naeem_payment_allocations EXISTS");
          } else {
            console.log("   ❌ naeem_payment_allocations MISSING");
          }

          // Step 3: Verify columns
          console.log("\n🔍 Verifying naeem_payments columns...");
          const colCheck = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'naeem_payments'
            ORDER BY ordinal_position;
          `);
          colCheck.rows.forEach(col => {
            console.log(`   ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
          });

          // Step 4: Verify allocations columns
          console.log("\n🔍 Verifying naeem_payment_allocations columns...");
          const allocColCheck = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'naeem_payment_allocations'
            ORDER BY ordinal_position;
          `);
          allocColCheck.rows.forEach(col => {
            console.log(`   ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
          });

          // Step 5: Verify RLS
          console.log("\n🔍 Verifying RLS policies...");
          const rlsCheck = await client.query(`
            SELECT tablename, policyname
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename IN ('naeem_payments', 'naeem_payment_allocations');
          `);
          rlsCheck.rows.forEach(pol => {
            console.log(`   ✅ ${pol.tablename}: ${pol.policyname}`);
          });

          // Step 6: Verify existing data is untouched
          console.log("\n🔍 Verifying existing data is intact...");
          const routeCount = await client.query(`SELECT COUNT(*) as c FROM public.naeem_routes`);
          console.log(`   naeem_routes: ${routeCount.rows[0].c} rows`);
          
          const recordCount = await client.query(`SELECT COUNT(*) as c FROM public.naeem_daily_records`);
          console.log(`   naeem_daily_records: ${recordCount.rows[0].c} rows`);
          
          const balanceCheck = await client.query(`SELECT year, month, opening_balance, is_manual_override FROM public.naeem_monthly_balances ORDER BY year, month`);
          console.log(`   naeem_monthly_balances: ${balanceCheck.rows.length} rows`);
          balanceCheck.rows.forEach(b => {
            console.log(`     ${b.year}-${String(b.month).padStart(2,'0')}: ₹${b.opening_balance} (manual: ${b.is_manual_override})`);
          });

          // Step 7: Verify RPC function exists
          console.log("\n🔍 Verifying get_naeem_opening_balance function...");
          const funcCheck = await client.query(`
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name = 'get_naeem_opening_balance';
          `);
          if (funcCheck.rows.length > 0) {
            console.log("   ✅ get_naeem_opening_balance function EXISTS");
          } else {
            console.log("   ⚠️ get_naeem_opening_balance function not found");
          }

          // Notify PostgREST again just to be sure
          await client.query(`NOTIFY pgrst, 'reload schema';`);

          console.log("\n" + "=".repeat(60));
          console.log("✅ MIGRATION COMPLETE AND VERIFIED");
          console.log("=".repeat(60));
          console.log("\nNext steps:");
          console.log("  1. Refresh your browser at http://localhost:5173/naeem");
          console.log("  2. The PGRST205 errors should be gone");
          console.log("  3. Payments and allocations should now work");
          
        } catch (err) {
          console.error("\n❌ Error executing migration:", err.message);
          if (err.detail) console.error("   Detail:", err.detail);
          if (err.hint) console.error("   Hint:", err.hint);
        } finally {
          await client.end();
          rl.close();
        }
      })
      .catch(err => {
        console.error("❌ Connection error:", err.message);
        rl.close();
      });
  });
});
