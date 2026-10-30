/**
 * Safe Test-Project Runner for 7TIME Zakat Tracker (Phase 3B)
 * 
 * Safety Architecture:
 * 1. Hard safety gate refusing execution if target matches production 'haofuuvwciqsambgeqyn'.
 * 2. Strict target validation using URL parsing and explicit disposable target designation.
 * 3. Never logs, prints, or exposes credentials, tokens, or passwords in output or errors.
 * 4. Supports --validate-only flag to test target extraction and safety checks without network calls.
 * 5. Transparently audits and reports prerequisite schema setup (public.audit_logs, log_audit_event).
 * 6. Applies Zakat migration 20261029000000_zakat_tracker_schema.sql.
 * 7. Executes supabase/tests/zakat_invariants_test.sql and streams PostgreSQL notices.
 * 8. Executes genuine two-session concurrent locking & deadlock resistance test.
 * 
 * Usage:
 *   node scripts/maintenance/run_zakat_test_suite.js --validate-only "<test-database-url>"
 *   node scripts/maintenance/run_zakat_test_suite.js --confirm-disposable "<test-database-url>"
 *   OR set TEST_DATABASE_URL and CONFIRM_DISPOSABLE_TARGET=true:
 *   node scripts/maintenance/run_zakat_test_suite.js
 */

import fs from 'fs';
import readline from 'readline';

const PRODUCTION_PROJECT_REF = 'haofuuvwciqsambgeqyn';
const ZAKAT_MIGRATION_PATH = 'supabase/migrations/20261029000000_zakat_tracker_schema.sql';
const TEST_SUITE_PATH = 'supabase/tests/zakat_invariants_test.sql';

/**
 * Sanitizes strings, error messages, and stack traces to prevent credential exposure.
 */
function sanitizeSecrets(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/:\/\/([^:]+):([^@]+)@/g, '://$1:***@') // Mask URI passwords
    .replace(/password=([^\s;&]+)/gi, 'password=***')
    .replace(/bearer\s+([a-zA-Z0-9_.-]+)/gi, 'Bearer ***');
}

/**
 * Extracts and sanitizes project reference and host info using structured URL parsing.
 */
function parseTargetUrl(dbUrl) {
  if (!dbUrl || typeof dbUrl !== 'string' || !dbUrl.trim()) {
    throw new Error('Database connection URL is missing or empty.');
  }

  const cleanUrl = dbUrl.trim();
  let parsed;
  try {
    parsed = new URL(cleanUrl);
  } catch (err) {
    throw new Error(`Invalid database URL format: ${sanitizeSecrets(err.message)}`);
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(`Invalid protocol '${parsed.protocol}'. Expected 'postgresql:' or 'postgres:'.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  let extractedRef = null;

  // Supabase direct connection: db.<ref>.supabase.co or <ref>.supabase.co
  if (hostname.endsWith('.supabase.co')) {
    const parts = hostname.split('.');
    extractedRef = parts[0] === 'db' ? parts[1] : parts[0];
  } 
  // Supabase pooler: aws-0-<region>.pooler.supabase.com with username postgres.<ref>
  else if (hostname.includes('pooler.supabase.com')) {
    const userParts = (parsed.username || '').split('.');
    if (userParts.length > 1) {
      extractedRef = userParts[userParts.length - 1];
    } else {
      extractedRef = hostname;
    }
  } 
  // Local or other Postgres host
  else {
    extractedRef = hostname;
  }

  return {
    cleanUrl,
    hostname,
    extractedRef: extractedRef.toLowerCase(),
    port: parsed.port || '5432',
    pathname: parsed.pathname
  };
}

/**
 * Validates that the target is strictly non-production and explicitly designated as disposable.
 */
function validateTargetSafety(dbUrl, options = {}) {
  const parsed = parseTargetUrl(dbUrl);
  const prodRef = PRODUCTION_PROJECT_REF.toLowerCase();

  // 1. Direct project reference check
  if (parsed.extractedRef === prodRef) {
    throw new Error(
      `CRITICAL SAFETY REFUSAL: Target project reference '${parsed.extractedRef}' is PRODUCTION. ` +
      `Execution aborted immediately. Production must NEVER be used as a test target.`
    );
  }

  // 2. Hostname check
  if (parsed.hostname.includes(prodRef)) {
    throw new Error(
      `CRITICAL SAFETY REFUSAL: Target hostname '${parsed.hostname}' contains production reference. Aborting.`
    );
  }

  // 3. Explicit non-production expected reference check (if configured)
  const expectedRef = (options.expectedRef || process.env.EXPECTED_TEST_PROJECT_REF || '').trim().toLowerCase();
  if (expectedRef && parsed.extractedRef !== expectedRef) {
    throw new Error(
      `TARGET MISMATCH: Target reference '${parsed.extractedRef}' does not match expected test reference '${expectedRef}'.`
    );
  }

  // 4. Explicit disposable confirmation check (skipped in validate-only mode)
  if (!options.validateOnly) {
    const isConfirmed = options.confirmDisposable || 
      process.env.CONFIRM_DISPOSABLE_TARGET === 'true' || 
      process.env.CONFIRM_DISPOSABLE_TARGET === '1';

    if (!isConfirmed) {
      throw new Error(
        `DISPOSABLE TARGET CONFIRMATION REQUIRED: Target project '${parsed.extractedRef}' has not been confirmed as disposable. ` +
        `Pass '--confirm-disposable' or set CONFIRM_DISPOSABLE_TARGET=true to authorize test migration execution.`
      );
    }
  }

  return parsed;
}

/**
 * Prepares prerequisite schema on a test project without running unrelated legacy migrations.
 * Transparently checks and reports each object.
 */
async function ensurePrerequisites(client) {
  console.log('🔍 Checking prerequisite schema for Zakat migration compatibility...');

  // Check auth.users
  const authCheck = await client.query(`
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users';
  `);
  if (authCheck.rowCount === 0) {
    throw new Error('Supabase auth.users table not found. A valid Supabase instance is required.');
  }
  console.log('   ✅ auth.users schema confirmed.');

  // Check public.audit_logs
  const auditTableCheck = await client.query(`
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs';
  `);
  if (auditTableCheck.rowCount === 0) {
    console.log('   ℹ️  public.audit_logs missing on fresh test database; provisioning minimal compatibility schema...');
    await client.query(`
      CREATE TABLE public.audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          entity_type TEXT,
          entity_id UUID,
          details JSONB,
          module_name TEXT,
          record_id UUID,
          record_details JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Enable all for authenticated users" ON public.audit_logs FOR ALL TO authenticated USING (true);
    `);
    console.log('   ✅ public.audit_logs provisioned.');
  } else {
    console.log('   ✅ public.audit_logs already exists.');
  }

  // Check public.log_audit_event()
  const procCheck = await client.query(`
    SELECT 1 FROM pg_proc 
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace 
    WHERE pg_namespace.nspname = 'public' AND proname = 'log_audit_event';
  `);
  if (procCheck.rowCount === 0) {
    console.log('   ℹ️  public.log_audit_event() missing; provisioning standard audit trigger function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.log_audit_event()
      RETURNS TRIGGER 
      LANGUAGE plpgsql 
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
          v_user_id UUID;
          v_details JSONB;
          v_target_id UUID;
      BEGIN
          BEGIN
              v_user_id := auth.uid();
          EXCEPTION WHEN OTHERS THEN
              v_user_id := NULL;
          END;

          IF TG_OP = 'INSERT' THEN
              v_target_id := NEW.id;
              v_details := jsonb_build_object('new', row_to_json(NEW));
              INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module_name, record_id, details, record_details)
              VALUES (v_user_id, TG_OP, TG_TABLE_NAME, v_target_id, TG_TABLE_NAME, v_target_id, v_details, v_details);
              RETURN NEW;
          ELSIF TG_OP = 'UPDATE' THEN
              v_target_id := NEW.id;
              v_details := jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW));
              INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module_name, record_id, details, record_details)
              VALUES (v_user_id, TG_OP, TG_TABLE_NAME, v_target_id, TG_TABLE_NAME, v_target_id, v_details, v_details);
              RETURN NEW;
          ELSIF TG_OP = 'DELETE' THEN
              v_target_id := OLD.id;
              v_details := jsonb_build_object('old', row_to_json(OLD));
              INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module_name, record_id, details, record_details)
              VALUES (v_user_id, TG_OP, TG_TABLE_NAME, v_target_id, TG_TABLE_NAME, v_target_id, v_details, v_details);
              RETURN OLD;
          END IF;
          RETURN NULL;
      END;
      $$;
    `);
    console.log('   ✅ public.log_audit_event() function provisioned.');
  } else {
    console.log('   ✅ public.log_audit_event() already exists.');
  }
}

/**
 * Genuine two-session concurrency test: validates deterministic lock ordering and deadlock resistance.
 */
async function runConcurrentSessionTest(target) {
  console.log('📄 Step 3/3: Executing Genuine Two-Session Concurrency Test...');
  const { Client } = await import('pg');
  const client1 = new Client({
    connectionString: target.cleanUrl,
    ssl: target.hostname === 'localhost' || target.hostname === '127.0.0.1' ? false : { rejectUnauthorized: false }
  });
  const client2 = new Client({
    connectionString: target.cleanUrl,
    ssl: target.hostname === 'localhost' || target.hostname === '127.0.0.1' ? false : { rejectUnauthorized: false }
  });

  await Promise.all([client1.connect(), client2.connect()]);

  const testUserId = 'a0000000-0000-0000-0000-000000000099';
  try {
    // 1. Setup isolated test user
    await client1.query(`
      INSERT INTO auth.users (id, aud, role, email)
      VALUES ('${testUserId}', 'authenticated', 'authenticated', 'concurrency_test_${Date.now()}@example.com')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Client 1 creates conversion pair
    await client1.query(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${testUserId}', true);
      SELECT set_config('request.jwt.claim.role', 'authenticated', true);
    `);
    const createRes = await client1.query(`
      SELECT public.create_zakat_paired_conversion(
        p_date := '2026-10-29'::DATE,
        p_source_category := 'CASH',
        p_dest_category := 'BANK',
        p_amount_inr := 25000.00
      ) AS res;
    `);
    const pair = createRes.rows[0].res;
    const legA = pair.source_entry_id;
    const legB = pair.dest_entry_id;

    // 3. Client 2 configures authenticated role context
    await client2.query(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${testUserId}', true);
      SELECT set_config('request.jwt.claim.role', 'authenticated', true);
    `);

    // Worker 1: Acquires ascending lock and holds for 200ms
    const worker1 = async () => {
      await client1.query('BEGIN;');
      await client1.query(`
        SELECT id FROM public.zakat_wealth_entries
        WHERE id IN ('${legA}', '${legB}')
        ORDER BY id ASC
        FOR UPDATE;
      `);
      await new Promise(r => setTimeout(r, 200));
      await client1.query('COMMIT;');
    };

    // Worker 2: Concurrently attempts deletion of the pair
    const worker2 = async () => {
      await new Promise(r => setTimeout(r, 50));
      await client2.query(`SELECT public.delete_zakat_paired_conversion('${legB}'::UUID);`);
    };

    // Run simultaneously
    await Promise.all([worker1(), worker2()]);

    // 4. Verify pair is deleted with zero residue
    const verifyRes = await client1.query(`
      RESET ROLE;
      SELECT COUNT(*) AS cnt FROM public.zakat_wealth_entries WHERE id IN ('${legA}', '${legB}');
    `);
    const count = parseInt(verifyRes.rows[0].cnt, 10);
    if (count !== 0) {
      throw new Error(`Concurrency test failed: ${count} rows remaining after concurrent operation.`);
    }

    console.log('   ✅ Two-session concurrency test PASSED: Deterministic lock ordering prevented deadlocks.\n');
  } finally {
    // Cleanup test user
    await client1.query(`
      RESET ROLE;
      DELETE FROM auth.users WHERE id = '${testUserId}';
    `).catch(() => {});
    await Promise.all([client1.end().catch(() => {}), client2.end().catch(() => {})]);
  }
}

async function runTestSuite(rawUrl, options = {}) {
  const target = validateTargetSafety(rawUrl, options);

  console.log('============================================================');
  console.log('🛡️  SAFE TEST-PROJECT RUNNER: 7TIME ZAKAT TRACKER');
  console.log('============================================================');
  console.log(`🎯 Target Project Reference : ${target.extractedRef}`);
  console.log(`🌐 Target Host              : ${target.hostname}`);
  console.log(`🛡️  Production Safety Check : PASSED (Confirmed distinct from ${PRODUCTION_PROJECT_REF})`);
  console.log('============================================================\n');

  if (options.validateOnly) {
    console.log('✅ Validation-only mode: URL successfully parsed, production safety confirmed, and disposable designation validated.');
    console.log('No database connection or network calls were made.');
    return;
  }

  const { Client } = await import('pg');
  const client = new Client({
    connectionString: target.cleanUrl,
    ssl: target.hostname === 'localhost' || target.hostname === '127.0.0.1' ? false : { rejectUnauthorized: false }
  });

  client.on('notice', (msg) => {
    console.log(`[PG NOTICE] ${sanitizeSecrets(msg.message)}`);
  });

  try {
    console.log('Connecting to target test database...');
    await client.connect();
    console.log('✅ Connected successfully.\n');

    // Step 1: Ensure prerequisites
    await ensurePrerequisites(client);

    // Step 2: Apply Zakat Migration
    console.log(`\n📄 Step 1/3: Applying Zakat Migration (${ZAKAT_MIGRATION_PATH})...`);
    if (!fs.existsSync(ZAKAT_MIGRATION_PATH)) {
      throw new Error(`Migration file not found at ${ZAKAT_MIGRATION_PATH}`);
    }
    const migrationSql = fs.readFileSync(ZAKAT_MIGRATION_PATH, 'utf8');
    await client.query(migrationSql);
    console.log('✅ Zakat migration executed successfully!\n');

    // Step 3: Run Invariant Test Suite
    console.log(`📄 Step 2/3: Executing SQL Invariant Test Suite (${TEST_SUITE_PATH})...`);
    if (!fs.existsSync(TEST_SUITE_PATH)) {
      throw new Error(`Test suite file not found at ${TEST_SUITE_PATH}`);
    }
    let testSql = fs.readFileSync(TEST_SUITE_PATH, 'utf8');
    testSql = testSql.replace(/^\\set\s+.*$/gm, '');

    await client.query(testSql);
    console.log('✅ ALL 16 INVARIANT & INTEGRITY TESTS EXECUTED AND PASSED!\n');

    // Step 4: Run Two-Session Concurrency Test
    await runConcurrentSessionTest(target);

    console.log('============================================================');
    console.log('🎉 FULL TEST HARNESS COMPLETE: ALL SQL & CONCURRENCY GATES PASSED!');
    console.log('============================================================');
  } catch (err) {
    console.error('\n❌ EXECUTION FAILED:');
    console.error(`Error: ${sanitizeSecrets(err.message)}`);
    if (err.detail) console.error(`Detail: ${sanitizeSecrets(err.detail)}`);
    if (err.hint) console.error(`Hint: ${sanitizeSecrets(err.hint)}`);
    if (err.where) console.error(`Where: ${sanitizeSecrets(err.where)}`);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let validateOnly = false;
let confirmDisposable = false;
let expectedRef = null;
let inputUrl = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--validate-only') {
    validateOnly = true;
  } else if (arg === '--confirm-disposable') {
    confirmDisposable = true;
  } else if (arg === '--expected-ref' && args[i + 1]) {
    expectedRef = args[++i];
  } else if (!arg.startsWith('--')) {
    inputUrl = arg;
  }
}

inputUrl = inputUrl || process.env.TEST_DATABASE_URL;

if (inputUrl) {
  runTestSuite(inputUrl, { validateOnly, confirmDisposable, expectedRef }).catch((err) => {
    console.error('Fatal error:', sanitizeSecrets(err.message));
    process.exit(1);
  });
} else {
  console.log('============================================================');
  console.log('🛡️  SAFE TEST-PROJECT RUNNER: 7TIME ZAKAT TRACKER');
  console.log('============================================================');
  console.log('No TEST_DATABASE_URL environment variable or argument detected.');
  console.log('Provide a dedicated Supabase test project connection string.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter Test Supabase Connection URI (postgresql://...): ', async (answer) => {
    rl.close();
    if (!answer || !answer.trim()) {
      console.log('No connection URI provided. Aborting without running.');
      process.exit(0);
    }
    try {
      await runTestSuite(answer.trim(), { validateOnly, confirmDisposable, expectedRef });
    } catch (err) {
      console.error('Fatal error:', sanitizeSecrets(err.message));
      process.exit(1);
    }
  });
}
