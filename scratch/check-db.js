import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load .env
const envText = fs.readFileSync('.env', 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('Anon key prefix:', supabaseAnonKey.substring(0, 15));

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('Fetching settings...');
  const { data: settings, error: sErr } = await supabase.from('settings').select('*');
  console.log('Settings:', settings, sErr);

  console.log('Fetching positions...');
  const { data: positions, error: pErr } = await supabase.from('positions').select('*');
  console.log('Positions count:', positions?.length, pErr);

  console.log('Fetching candidates...');
  const { data: candidates, error: cErr } = await supabase.from('candidates').select('*');
  console.log('Candidates count:', candidates?.length, cErr);

  console.log('Fetching voters sample...');
  const { data: voters, error: vErr } = await supabase.from('voters').select('*').limit(1);
  console.log('Voters sample:', voters, vErr);
  if (voters && voters.length > 0) {
    console.log('Voters columns:', Object.keys(voters[0]));
  }

  console.log('Fetching students sample...');
  const { data: students, error: stdErr } = await supabase.from('students').select('*').limit(5);
  console.log('Students sample:', students, stdErr);
  if (students && students.length > 0) {
    console.log('Students columns:', Object.keys(students[0]));
  }
}

check();
