import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(Boolean).map(line => line.split('=')));

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
  console.log('Testing RPC get_naeem_opening_balance...');
  const { data, error, status, statusText } = await supabase
    .rpc("get_naeem_opening_balance", { p_year: 2026, p_month: 10 });

  console.log({ data, error, status, statusText });
}

testFetch();
