require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  await supabase.from('candidates').update({ photo: '/candidates/TANAY KRISHNAKUMAR IX DAFFODIL.png' }).eq('name', 'Tanay Krishnakumar');
  await supabase.from('candidates').update({ photo: '/candidates/NIHAL KRISHNA S R IV ZINNIA.jpg' }).eq('name', 'Nihal Krishna S R');
  console.log("Updated!");
}
run();
