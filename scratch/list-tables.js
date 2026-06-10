import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env
const envPath = path.resolve('../.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  envContent = fs.readFileSync('.env', 'utf8');
}

const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) {
    env[key.trim()] = val.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // We can query supabase.from('voters').select('*') to check the count
  const { data: voters, error: vErr } = await supabase.from('voters').select('*');
  console.log('Voters rows count:', voters ? voters.length : 0);
  
  const { data: candidates, error: cErr } = await supabase.from('candidates').select('*');
  const totalVotes = candidates ? candidates.reduce((sum, c) => sum + c.votes, 0) : 0;
  console.log('Total candidate votes sum:', totalVotes);
}
run();
