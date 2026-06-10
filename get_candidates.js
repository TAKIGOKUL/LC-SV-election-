import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uscqxgrcfziyuqqiifrz.supabase.co';
const supabaseKey = 'sb_publishable_xl8ULVYbWSYm4QjvyD7S_A_BG2BYqPS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: candidates, error } = await supabase.from('candidates').select('*');
  if (error) console.error(error);
  else console.log(JSON.stringify(candidates, null, 2));
}

run();
