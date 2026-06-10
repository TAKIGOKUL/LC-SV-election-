import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const candidateData = [
  { position: "HEAD BOY", candidates: [
    { name: "Madhav S", grade: "X Aster" },
    { name: "Achyut Aji Purushothaman", grade: "X Aster" }
  ]},
  { position: "HEAD GIRL", candidates: [
    { name: "Sanjana Suresh", grade: "X Aster" },
    { name: "Shruthy Pillai", grade: "X Aster" },
    { name: "Ameya Ajai", grade: "X Aster" }
  ]},
  { position: "ASSISTANT HEAD BOY", candidates: [
    { name: "Aaditya Ajeet", grade: "IX DAFFODIL" },
    { name: "Abhinav R", grade: "IX DAFFODIL" }
  ]},
  { position: "ASSISTANT HEAD GIRL", candidates: [
    { name: "Dhwani S R", grade: "IX Periwinkle" },
    { name: "Ananya Yadav", grade: "IX Daffodil" }
  ]},
  { position: "SPORTS CAPTAIN", candidates: [
    { name: "Siya Aji Felix", grade: "X Aster" },
    { name: "Aazim Muhammed", grade: "X Aster" }
  ]},
  { position: "ASSISTANT SPORTS CAPTAIN", candidates: [
    { name: "Anagh A R", grade: "IX Periwinkle" },
    { name: "Tanay Krishnakumar", grade: "IX Daffodil" }
  ]},
  { position: "CULTURAL SECRETARY", candidates: [
    { name: "Sreevardhan A B", grade: "X Aster" },
    { name: "Meghna Mahesh", grade: "X Aster" },
    { name: "S Mahadev", grade: "X Aster" },
    { name: "Dakshina Raj", grade: "X Aster" }
  ]},
  { position: "ASSISTANT CULTURAL SECRETARY", candidates: [
    { name: "Haima S Nair", grade: "IX Daffodil" },
    { name: "Saran Manoj", grade: "IX Periwinkle" }
  ]},
  { position: "OUTREACH PROGRAM SECRETARY", candidates: [
    { name: "Aman A Abhiram", grade: "IX Periwinkle" }
  ]},
  { position: "HEAD PREFECT BOY", candidates: [
    { name: "C A Ananthapadmanabha", grade: "V Tulip" },
    { name: "Balram K Aravind", grade: "V Tulip" },
    { name: "Aryan S", grade: "V Dahlia" },
    { name: "Nihit Nair A", grade: "V Dahlia" }
  ]},
  { position: "HEAD PREFECT GIRL", candidates: [
    { name: "Yuktha Arun", grade: "V Tulip" },
    { name: "Janaki Anooj", grade: "V Tulip" },
    { name: "Ann Maria Stanly", grade: "V Tulip" },
    { name: "Leona J B", grade: "V Tulip" },
    { name: "Saira Sabu", grade: "V Dahlia" },
    { name: "Vedasree M P", grade: "V Dahlia" },
    { name: "Harshita A L", grade: "V Dahlia" },
    { name: "Malavika M", grade: "V Dahlia" },
    { name: "Satvika S Nidhin", grade: "V Dahlia" }
  ]},
  { position: "ASSISTANT HEAD PREFECT BOY", candidates: [
    { name: "Sanavsree Nair", grade: "IV Iris" },
    { name: "Aaron G James", grade: "IV Iris" },
    { name: "Rian S Reji", grade: "IV Iris" },
    { name: "Muhammed Nadal N", grade: "IV Iris" },
    { name: "Kevin Thomas Roy", grade: "IV Zinnia" },
    { name: "Nihal Krishna S R", grade: "IV Zinnia" },
    { name: "Srishankar M Nair", grade: "IV Zinnia" },
    { name: "Sreepath Raj", grade: "IV Zinnia" }
  ]},
  { position: "ASSISTANT HEAD PREFECT GIRL", candidates: [
    { name: "Niharika", grade: "IV Iris" },
    { name: "Marvel Biveesh", grade: "IV Zinnia" },
    { name: "Serah Jinil", grade: "IV Zinnia" },
    { name: "Atharva D Renjith", grade: "IV Zinnia" },
    { name: "Margazhi Jinoj", grade: "IV Zinnia" },
    { name: "Saventhika Vyshakh", grade: "IV Zinnia" },
    { name: "Siya Sree Nair", grade: "IV Iris" },
    { name: "Madhavi Yadav", grade: "IV Iris" },
    { name: "Sukritha Senu", grade: "IV Iris" }
  ]}
];

async function run() {
  console.log("1. Deleting all existing candidates...");
  // Use a text field filter that covers all rows
  const { error: delCandErr } = await supabase.from('candidates').delete().neq('name', 'nonexistent_placeholder_xyz');
  if (delCandErr) {
    console.error("Error deleting candidates:", delCandErr);
    return;
  }
  console.log("Candidates deleted successfully.");

  console.log("2. Deleting all existing positions...");
  // Use a text field filter that covers all rows
  const { error: delPosErr } = await supabase.from('positions').delete().neq('name', 'nonexistent_placeholder_xyz');
  if (delPosErr) {
    console.error("Error deleting positions:", delPosErr);
    return;
  }
  console.log("Positions deleted successfully.");

  console.log("3. Inserting new positions...");
  const uniquePositions = candidateData.map(p => ({ name: p.position }));
  const { data: posData, error: insPosErr } = await supabase.from('positions').insert(uniquePositions).select();
  if (insPosErr) {
    console.error("Error inserting positions:", insPosErr);
    return;
  }
  console.log(`Inserted ${posData.length} positions.`);

  console.log("4. Inserting candidates...");
  const candidatesToInsert = [];
  for (const posGroup of candidateData) {
    for (const c of posGroup.candidates) {
      candidatesToInsert.push({
        name: c.name,
        grade: c.grade,
        position: posGroup.position,
        promises: [],
        photo: "",
        votes: 0
      });
    }
  }

  const { data: insertedCands, error: insCandErr } = await supabase.from('candidates').insert(candidatesToInsert).select();
  if (insCandErr) {
    console.error("Error inserting candidates:", insCandErr);
    return;
  }
  console.log(`Successfully inserted ${insertedCands.length} candidates.`);
}

run();
