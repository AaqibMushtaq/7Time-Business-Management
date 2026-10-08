import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(Boolean).map(line => line.split('=')));

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpsert() {
  console.log('Testing Upsert...');
  const { data, error } = await supabase
    .from("naeem_monthly_balances")
    .upsert({ year: 2026, month: 10, opening_balance: 1180 }, { onConflict: 'year,month' })
    .select();

  if (error) {
    console.error("UPSERT ERROR:", error);
  } else {
    console.log("Success! Data:", data);
  }
}

testUpsert();
