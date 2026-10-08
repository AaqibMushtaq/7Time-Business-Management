import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
  console.log('Testing decoupled getnaeemRecords query...');
  const { data: recordsData, error: recordsError } = await supabase
    .from("naeem_daily_records")
    .select(`
      *,
      route:naeem_routes(*)
    `)
    .limit(5);

  if (recordsError) {
    console.error("NAEEM DELIVERY HISTORY ERROR:");
    console.error(JSON.stringify(recordsError, null, 2));
  } else {
    console.log("Success! Data:");
    console.log(recordsData);
  }
}

testQuery();
