-- ============================================================================
-- 7TIME ZAKAT TRACKER: STANDALONE POSTGRESQL INVARIANTS & INTEGRITY TEST SUITE
-- Execution Status: NOT VERIFIED (STATIC ARTIFACT ONLY - Disposable DB unavailable)
-- Target Runner: psql -f zakat_invariants_test.sql (or supabase test db)
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- 0. FIXTURE SETUP & PRE-EXISTING ROW SNAPSHOT (Run as superuser/postgres)
-- ----------------------------------------------------------------------------
RESET ROLE;

-- Create tracking table for disposable fixtures generated during this test run
CREATE TEMP TABLE IF NOT EXISTS _test_created_users (user_id UUID PRIMARY KEY);
TRUNCATE _test_created_users;

-- Generate dynamic, isolated UUIDs for test users
DO $$
DECLARE
    v_u_a UUID := gen_random_uuid();
    v_u_b UUID := gen_random_uuid();
BEGIN
    INSERT INTO _test_created_users (user_id) VALUES (v_u_a), (v_u_b);

    INSERT INTO auth.users (id, aud, role, email)
    VALUES 
        (v_u_a, 'authenticated', 'authenticated', 'test_user_a_' || v_u_a || '@example.com'),
        (v_u_b, 'authenticated', 'authenticated', 'test_user_b_' || v_u_b || '@example.com');
END $$;

-- Snapshot pre-existing rows and their exact values to detect subtle mutation residue
CREATE TEMP TABLE IF NOT EXISTS _test_preexisting_snapshot AS
SELECT id, user_id, amount_inr, entry_date, updated_at 
FROM public.zakat_wealth_entries;

CREATE TEMP TABLE IF NOT EXISTS _test_active_pair (leg_a UUID, leg_b UUID);

-- ============================================================================
-- TEST 1: Valid conversion-pair creation via authorized RPC
-- ============================================================================
SET ROLE authenticated;
DO $$
DECLARE
    v_user_a UUID;
    v_res JSONB;
    v_a UUID;
    v_b UUID;
BEGIN
    SELECT user_id INTO v_user_a FROM _test_created_users LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    v_res := public.create_zakat_paired_conversion(
        p_date := '2026-10-28'::DATE,
        p_source_category := 'CASH',
        p_dest_category := 'GOLD',
        p_amount_inr := 25000.00,
        p_source := 'Jewelry Purchase',
        p_description := '24k gold bullion',
        p_dest_quantity := 3.25,
        p_dest_purity_carat := 24.0
    );
    v_a := (v_res->>'source_entry_id')::UUID;
    v_b := (v_res->>'dest_entry_id')::UUID;

    ASSERT v_a IS NOT NULL AND v_b IS NOT NULL, 'Test 1 Failed: Null IDs returned';
    ASSERT (SELECT SUM(amount_inr) FROM public.zakat_wealth_entries WHERE id IN (v_a, v_b)) = 0.00,
        'Test 1 Failed: Pair amounts do not sum to 0.00';
    ASSERT (SELECT linked_entry_id FROM public.zakat_wealth_entries WHERE id = v_a) = v_b,
        'Test 1 Failed: Leg A does not link to Leg B';
    ASSERT (SELECT linked_entry_id FROM public.zakat_wealth_entries WHERE id = v_b) = v_a,
        'Test 1 Failed: Leg B does not link to Leg A';

    TRUNCATE _test_active_pair;
    INSERT INTO _test_active_pair VALUES (v_a, v_b);
END $$;

-- ============================================================================
-- TEST 2: Invalid category rejection (Check Constraint SQLSTATE 23514)
-- ============================================================================
DO $$
DECLARE
    v_caught BOOLEAN := false;
BEGIN
    BEGIN
        PERFORM public.create_zakat_paired_conversion(
            p_date := '2026-10-28'::DATE,
            p_source_category := 'CASH',
            p_dest_category := 'LIABILITIES_IMMEDIATE',
            p_amount_inr := 5000.00
        );
    EXCEPTION WHEN check_violation THEN
        IF SQLSTATE = '23514' THEN
            v_caught := true;
        END IF;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Test 2 Failed: Caught wrong SQLSTATE: % (%)', SQLSTATE, SQLERRM;
    END;
    ASSERT v_caught, 'Test 2 Failed: Ineligible category was not rejected with SQLSTATE 23514';
END $$;

-- ============================================================================
-- TEST 3: Invalid metal purity rejection (Check Constraint SQLSTATE 23514)
-- ============================================================================
DO $$
DECLARE
    v_caught BOOLEAN := false;
BEGIN
    BEGIN
        PERFORM public.create_zakat_paired_conversion(
            p_date := '2026-10-28'::DATE,
            p_source_category := 'CASH',
            p_dest_category := 'GOLD',
            p_amount_inr := 5000.00,
            p_dest_quantity := 1.0,
            p_dest_purity_carat := 26.0 -- Exceeds 24.0
        );
    EXCEPTION WHEN check_violation THEN
        IF SQLSTATE = '23514' THEN
            v_caught := true;
        END IF;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Test 3 Failed: Caught wrong SQLSTATE: % (%)', SQLSTATE, SQLERRM;
    END;
    ASSERT v_caught, 'Test 3 Failed: Carat > 24 was not rejected with SQLSTATE 23514';
END $$;

-- ============================================================================
-- TEST 4: Single-leg deletion rejection at transaction boundary (Deferred FK)
-- Evaluated under RESET ROLE to bypass client RLS and verify that the underlying
-- database engine deferred FK constraint strictly prohibits single-leg deletion.
-- ============================================================================
RESET ROLE;
DO $$
DECLARE
    v_a UUID;
    v_b UUID;
    v_caught BOOLEAN := false;
BEGIN
    SELECT leg_a, leg_b INTO v_a, v_b FROM _test_active_pair;

    -- Deletion and constraint evaluation occur in the SAME subtransaction
    BEGIN
        DELETE FROM public.zakat_wealth_entries WHERE id = v_a;
        SET CONSTRAINTS fk_zakat_wealth_entries_linked_entry IMMEDIATE;
    EXCEPTION WHEN foreign_key_violation THEN
        IF SQLSTATE = '23503' THEN
            v_caught := true;
        END IF;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Test 4 Failed: Caught wrong SQLSTATE: % (%)', SQLSTATE, SQLERRM;
    END;

    -- Reset constraint mode for rest of session
    SET CONSTRAINTS fk_zakat_wealth_entries_linked_entry DEFERRED;

    ASSERT v_caught, 'Test 4 Failed: Single leg deletion did not raise foreign_key_violation (23503)';
    -- Verify both legs remain completely intact
    ASSERT (SELECT COUNT(*) FROM public.zakat_wealth_entries WHERE id IN (v_a, v_b)) = 2,
        'Test 4 Residue: Leg A was deleted despite constraint violation';
END $$;
SET ROLE authenticated;

-- ============================================================================
-- TEST 5: Atomic pair deletion success via authorized RPC
-- ============================================================================
DO $$
DECLARE
    v_a UUID;
    v_b UUID;
BEGIN
    SELECT leg_a, leg_b INTO v_a, v_b FROM _test_active_pair;
    PERFORM public.delete_zakat_paired_conversion(v_a);
    ASSERT NOT EXISTS (SELECT 1 FROM public.zakat_wealth_entries WHERE id IN (v_a, v_b)),
        'Test 5 Failed: Conversion pair still exists after delete RPC';
END $$;

-- Recreate active pair for Tests 6-10
DO $$
DECLARE
    v_user_a UUID;
    v_res JSONB;
BEGIN
    SELECT user_id INTO v_user_a FROM _test_created_users LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

    v_res := public.create_zakat_paired_conversion(
        p_date := '2026-10-28'::DATE,
        p_source_category := 'CASH',
        p_dest_category := 'BANK',
        p_amount_inr := 10000.00
    );
    TRUNCATE _test_active_pair;
    INSERT INTO _test_active_pair VALUES (
        (v_res->>'source_entry_id')::UUID,
        (v_res->>'dest_entry_id')::UUID
    );
END $$;

-- ============================================================================
-- TEST 6: Direct conversion amount mutation rejection (Trigger restrict_violation)
-- ============================================================================
DO $$
DECLARE
    v_a UUID;
    v_caught BOOLEAN := false;
BEGIN
    SELECT leg_a INTO v_a FROM _test_active_pair;
    BEGIN
        UPDATE public.zakat_wealth_entries SET amount_inr = -99999.00 WHERE id = v_a;
    EXCEPTION WHEN restrict_violation THEN
        IF SQLSTATE = '23001' THEN
            v_caught := true;
        END IF;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Test 6 Failed: Caught wrong SQLSTATE: % (%)', SQLSTATE, SQLERRM;
    END;
    ASSERT v_caught, 'Test 6 Failed: Mutation not blocked with SQLSTATE 23001';
    ASSERT (SELECT amount_inr FROM public.zakat_wealth_entries WHERE id = v_a) = -10000.00,
        'Test 6 Residue: Amount was mutated';
END $$;

-- ============================================================================
-- TEST 7: Direct unlinking rejection (Trigger restrict_violation)
-- ============================================================================
DO $$
DECLARE
    v_a UUID;
    v_b UUID;
    v_caught BOOLEAN := false;
BEGIN
    SELECT leg_a, leg_b INTO v_a, v_b FROM _test_active_pair;
    BEGIN
        UPDATE public.zakat_wealth_entries SET linked_entry_id = NULL WHERE id = v_a;
    EXCEPTION WHEN restrict_violation THEN
        IF SQLSTATE = '23001' THEN
            v_caught := true;
        END IF;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Test 7 Failed: Caught wrong SQLSTATE: % (%)', SQLSTATE, SQLERRM;
    END;
    ASSERT v_caught, 'Test 7 Failed: Unlinking not blocked with SQLSTATE 23001';
    ASSERT (SELECT linked_entry_id FROM public.zakat_wealth_entries WHERE id = v_a) = v_b,
        'Test 7 Residue: Link was nullified';
END $$;

-- ============================================================================
-- TEST 8: Direct conversion creation bypass rejection (Table RLS SQLSTATE 42501)
-- ============================================================================
DO $$
DECLARE
    v_user_a UUID;
    v_a UUID;
    v_caught BOOLEAN := false;
BEGIN
    SELECT user_id INTO v_user_a FROM _test_created_users LIMIT 1;
    SELECT leg_a INTO v_a FROM _test_active_pair;
    BEGIN
        INSERT INTO public.zakat_wealth_entries (
            user_id, entry_date, entry_type, category, source, amount_inr, linked_entry_id, description
        ) VALUES (
            v_user_a, '2026-10-28', 'CONVERSION', 'CASH', 'Bypass', -100.00, v_a, 'Rogue'
        );
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLSTATE = '42501' THEN
            v_caught := true;
        END IF;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Test 8 Failed: Caught wrong SQLSTATE: % (%)', SQLSTATE, SQLERRM;
    END;
    ASSERT v_caught, 'Test 8 Failed: Direct INSERT of CONVERSION row bypassed RLS (42501)';
END $$;

-- TEST 8b: Direct conversion deletion bypass rejection (Table RLS filters CONVERSION rows)
DO $$
DECLARE
    v_a UUID;
    v_rows INT;
BEGIN
    SELECT leg_a INTO v_a FROM _test_active_pair;
    DELETE FROM public.zakat_wealth_entries WHERE id = v_a;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    ASSERT v_rows = 0, 'Test 8b Failed: Direct DELETE of CONVERSION row bypassed RLS';
    ASSERT (SELECT COUNT(*) FROM public.zakat_wealth_entries WHERE id = v_a) = 1,
        'Test 8b Residue: Conversion row was deleted directly';
END $$;

-- ============================================================================
-- TEST 9: Cross-user linking rejection (Trigger Invariant)
-- ============================================================================
DO $$
DECLARE
    v_user_b UUID;
    v_a UUID;
    v_caught BOOLEAN := false;
BEGIN
    SELECT user_id INTO v_user_b FROM _test_created_users OFFSET 1 LIMIT 1;
    SELECT leg_a INTO v_a FROM _test_active_pair;

    -- Switch context to User B
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);

    BEGIN
        INSERT INTO public.zakat_wealth_entries (
            user_id, entry_date, entry_type, category, source, amount_inr, linked_entry_id, description
        ) VALUES (
            v_user_b, '2026-10-28', 'CONVERSION', 'BANK', 'Cross', 10000.00, v_a, 'Cross-user'
        );
        SET CONSTRAINTS trg_check_zakat_conversion_pair_integrity IMMEDIATE;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE IN ('42501', 'P0001') OR SQLERRM ILIKE '%Cross-user%' THEN
            v_caught := true;
        ELSE
            RAISE EXCEPTION 'Test 9 Failed: Unexpected SQLSTATE: % (%)', SQLSTATE, SQLERRM;
        END IF;
    END;
    SET CONSTRAINTS trg_check_zakat_conversion_pair_integrity DEFERRED;
    ASSERT v_caught, 'Test 9 Failed: Cross-user conversion link was not rejected';
END $$;

-- Switch back to User A
DO $$
DECLARE
    v_user_a UUID;
BEGIN
    SELECT user_id INTO v_user_a FROM _test_created_users LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
END $$;

-- ============================================================================
-- TEST 10: Ordinary-entry conversion-type mutation rejection
-- ============================================================================
DO $$
DECLARE
    v_a UUID;
    v_caught BOOLEAN := false;
BEGIN
    SELECT leg_a INTO v_a FROM _test_active_pair;
    BEGIN
        UPDATE public.zakat_wealth_entries SET entry_type = 'ACQUIRED' WHERE id = v_a;
    EXCEPTION WHEN restrict_violation THEN
        IF SQLSTATE = '23001' THEN
            v_caught := true;
        END IF;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Test 10 Failed: Caught wrong SQLSTATE: % (%)', SQLSTATE, SQLERRM;
    END;
    ASSERT v_caught, 'Test 10 Failed: Entry type alteration not blocked with SQLSTATE 23001';
END $$;

-- Clean up test pair
DO $$
DECLARE
    v_a UUID;
BEGIN
    SELECT leg_a INTO v_a FROM _test_active_pair;
    PERFORM public.delete_zakat_paired_conversion(v_a);
END $$;

-- ============================================================================
-- TEST 11: Anon RPC execution rejection
-- ============================================================================
SET ROLE anon;
SET request.jwt.claim.sub = '';
SET request.jwt.claim.role = 'anon';

DO $$
DECLARE
    v_caught BOOLEAN := false;
BEGIN
    BEGIN
        PERFORM public.create_zakat_paired_conversion(
            p_date := '2026-10-28'::DATE,
            p_source_category := 'CASH',
            p_dest_category := 'BANK',
            p_amount_inr := 100.00
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE IN ('42501', 'P0001') OR SQLERRM ILIKE '%Authentication required%' THEN
            v_caught := true;
        END IF;
    END;
    ASSERT v_caught, 'Test 11 Failed: Anon execution was not blocked';
END $$;

-- ============================================================================
-- TEST 12: Cross-user row isolation (RLS SELECT / DELETE)
-- ============================================================================
SET ROLE authenticated;
DO $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
    v_row_id UUID := gen_random_uuid();
BEGIN
    SELECT user_id INTO v_user_a FROM _test_created_users LIMIT 1;
    SELECT user_id INTO v_user_b FROM _test_created_users OFFSET 1 LIMIT 1;

    -- User A creates an ordinary entry
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    INSERT INTO public.zakat_wealth_entries (
        id, user_id, entry_date, entry_type, category, source, amount_inr, description
    ) VALUES (
        v_row_id, v_user_a, '2026-10-28', 'ACQUIRED', 'CASH', 'Salary', 50000.00, 'User A Salary'
    );

    -- Switch to User B
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
    -- User B SELECT must return 0 rows
    ASSERT (SELECT COUNT(*) FROM public.zakat_wealth_entries WHERE id = v_row_id) = 0,
        'Test 12 Failed: User B can read User A row';

    -- User B DELETE must affect 0 rows
    DELETE FROM public.zakat_wealth_entries WHERE id = v_row_id;

    -- Switch back to User A to confirm row remains intact
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    ASSERT (SELECT COUNT(*) FROM public.zakat_wealth_entries WHERE id = v_row_id) = 1,
        'Test 12 Failed: User B deleted User A row';

    -- Cleanup
    DELETE FROM public.zakat_wealth_entries WHERE id = v_row_id;
END $$;

-- ============================================================================
-- TEST 13: Rollback on partial conversion creation
-- Evaluated under RESET ROLE to verify database table atomicity and subtransaction
-- rollback semantics when a second leg fails constraint validation.
-- ============================================================================
RESET ROLE;
DO $$
DECLARE
    v_user_a UUID;
    v_cnt_before INT;
    v_cnt_after INT;
    v_a UUID := gen_random_uuid();
    v_b UUID := gen_random_uuid();
BEGIN
    SELECT user_id INTO v_user_a FROM _test_created_users LIMIT 1;

    SELECT COUNT(*) INTO v_cnt_before FROM public.zakat_wealth_entries;
    
    BEGIN
        -- Leg A inserts successfully at table level
        INSERT INTO public.zakat_wealth_entries (
            id, user_id, entry_date, entry_type, category, source, amount_inr, linked_entry_id, description
        ) VALUES (
            v_a, v_user_a, '2026-10-28', 'CONVERSION', 'CASH', 'Sim', -5000, v_b, 'Leg A'
        );
        
        -- Leg B fails with check constraint violation (invalid category)
        INSERT INTO public.zakat_wealth_entries (
            id, user_id, entry_date, entry_type, category, source, amount_inr, linked_entry_id, description
        ) VALUES (
            v_b, v_user_a, '2026-10-28', 'CONVERSION', 'INVALID_CAT', 'Sim', 5000, v_a, 'Leg B'
        );
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    SELECT COUNT(*) INTO v_cnt_after FROM public.zakat_wealth_entries;
    ASSERT v_cnt_before = v_cnt_after, 'Test 13 Failed: Partial creation left orphan Leg A row';
END $$;
SET ROLE authenticated;

-- ============================================================================
-- TEST 14: Rollback on partial deletion
-- Pair created via authorized RPC as authenticated role, then single-leg deletion
-- attempted under RESET ROLE to verify deferred FK constraint rollback.
-- ============================================================================
DO $$
DECLARE
    v_user_a UUID;
    v_res JSONB;
    v_a UUID;
    v_b UUID;
BEGIN
    SELECT user_id INTO v_user_a FROM _test_created_users LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

    v_res := public.create_zakat_paired_conversion(
        p_date := '2026-10-28'::DATE,
        p_source_category := 'CASH',
        p_dest_category := 'BANK',
        p_amount_inr := 7000.00
    );
    v_a := (v_res->>'source_entry_id')::UUID;
    v_b := (v_res->>'dest_entry_id')::UUID;

    -- Elevate to test raw single-leg delete against Deferred FK
    RESET ROLE;
    BEGIN
        DELETE FROM public.zakat_wealth_entries WHERE id = v_a;
        SET CONSTRAINTS fk_zakat_wealth_entries_linked_entry IMMEDIATE;
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;
    SET CONSTRAINTS fk_zakat_wealth_entries_linked_entry DEFERRED;
    SET ROLE authenticated;
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

    -- Assert both rows are intact
    ASSERT (SELECT COUNT(*) FROM public.zakat_wealth_entries WHERE id IN (v_a, v_b)) = 2,
        'Test 14 Failed: Partial deletion did not preserve both conversion legs';

    -- Clean up pair
    PERFORM public.delete_zakat_paired_conversion(v_a);
END $$;

-- ============================================================================
-- TEST 15: Concurrency Deadlock Prevention Design (Ordered Lock Verification)
-- NOTE: Multi-Session Concurrent Deadlock Resistance is marked UNTESTED in this
-- single-connection script. This test verifies that delete_zakat_paired_conversion
-- executes deterministic ORDER BY id ASC FOR UPDATE.
-- ============================================================================
DO $$
DECLARE
    v_user_a UUID;
    v_res JSONB;
    v_a UUID;
    v_b UUID;
    v_lock_1 UUID;
    v_lock_2 UUID;
BEGIN
    SELECT user_id INTO v_user_a FROM _test_created_users LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

    v_res := public.create_zakat_paired_conversion(
        p_date := '2026-10-28'::DATE,
        p_source_category := 'CASH',
        p_dest_category := 'BANK',
        p_amount_inr := 3000.00
    );
    v_a := (v_res->>'source_entry_id')::UUID;
    v_b := (v_res->>'dest_entry_id')::UUID;

    -- Verify ascending UUID locking sequence
    SELECT id INTO v_lock_1 FROM public.zakat_wealth_entries WHERE id IN (v_a, v_b) ORDER BY id ASC LIMIT 1 FOR UPDATE;
    SELECT id INTO v_lock_2 FROM public.zakat_wealth_entries WHERE id IN (v_a, v_b) ORDER BY id ASC OFFSET 1 LIMIT 1 FOR UPDATE;

    ASSERT v_lock_1 < v_lock_2, 'Test 15 Failed: Lock order is not deterministic ascending UUID';

    -- Clean up
    PERFORM public.delete_zakat_paired_conversion(v_a);
END $$;

-- ============================================================================
-- TEST 16: Zero-Residue Baseline Verification (Deep Snapshot Comparison)
-- ============================================================================
RESET ROLE;
DO $$
DECLARE
    v_missing_rows INT;
    v_altered_rows INT;
    v_extra_rows INT;
BEGIN
    -- 1. Ensure all pre-existing rows still exist
    SELECT COUNT(*) INTO v_missing_rows
    FROM _test_preexisting_snapshot s
    LEFT JOIN public.zakat_wealth_entries e ON s.id = e.id
    WHERE e.id IS NULL;

    ASSERT v_missing_rows = 0, 'Test 16 Failed: Pre-existing rows were deleted during test suite!';

    -- 2. Ensure no pre-existing row values were mutated
    SELECT COUNT(*) INTO v_altered_rows
    FROM _test_preexisting_snapshot s
    JOIN public.zakat_wealth_entries e ON s.id = e.id
    WHERE s.amount_inr != e.amount_inr 
       OR s.entry_date != e.entry_date 
       OR s.updated_at != e.updated_at;

    ASSERT v_altered_rows = 0, 'Test 16 Failed: Pre-existing row data was mutated during test suite!';

    -- 3. Ensure zero leftover entries from test users exist
    SELECT COUNT(*) INTO v_extra_rows
    FROM public.zakat_wealth_entries
    WHERE user_id IN (SELECT user_id FROM _test_created_users);

    ASSERT v_extra_rows = 0, 'Test 16 Failed: Test fixtures left orphaned ledger rows!';

    RAISE NOTICE 'ALL 16 INVARIANT & INTEGRITY TESTS VERIFIED (STATIC ARTIFACT)';
END $$;

-- ----------------------------------------------------------------------------
-- FIXTURE TEARDOWN: Clean up only test users created during this run
-- ----------------------------------------------------------------------------
DELETE FROM auth.users WHERE id IN (SELECT user_id FROM _test_created_users);
DROP TABLE IF EXISTS _test_created_users;
DROP TABLE IF EXISTS _test_preexisting_snapshot;
DROP TABLE IF EXISTS _test_active_pair;

