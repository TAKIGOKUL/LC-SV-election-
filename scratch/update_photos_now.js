import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uscqxgrcfziyuqqiifrz.supabase.co';
const supabaseKey = 'sb_publishable_xl8ULVYbWSYm4QjvyD7S_A_BG2BYqPS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  await supabase.from('candidates').update({ photo: '/candidates/TANAY KRISHNAKUMAR IX DAFFODIL.png' }).eq('name', 'Tanay Krishnakumar');
  await supabase.from('candidates').update({ photo: '/candidates/NIHAL KRISHNA S R IV ZINNIA.jpg' }).eq('name', 'Nihal Krishna S R');
  console.log("Updated photos!");
}
run();
