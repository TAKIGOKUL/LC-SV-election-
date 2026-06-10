import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uscqxgrcfziyuqqiifrz.supabase.co';
const supabaseKey = 'sb_publishable_xl8ULVYbWSYm4QjvyD7S_A_BG2BYqPS';
const supabase = createClient(supabaseUrl, supabaseKey);

function parseFileName(filename) {
  const noExt = filename.replace(/\.[a-zA-Z]+$/, '');
  let namePart = noExt;
  let gradePart = '';
  if (noExt.includes('-')) {
    const parts = noExt.split('-');
    namePart = parts[0].trim();
    gradePart = parts[1].trim();
  } else {
    const match = noExt.match(/(.*?)\s+(IV|V|IX|X)\s+(.*)/i);
    if (match) {
      namePart = match[1].trim();
      gradePart = match[2].trim() + ' ' + match[3].trim();
    } else {
      namePart = noExt.trim();
    }
  }
  return { name: namePart.toLowerCase(), grade: gradePart, file: filename };
}

async function run() {
  const { data: candidates, error } = await supabase.from('candidates').select('id, name, grade, position');
  if (error) { console.error(error); return; }

  const juniorFiles = fs.readdirSync('JUNIOR GRADE').map(f => ({ folder: 'JUNIOR GRADE', orig: f, ...parseFileName(f) }));
  const seniorFiles = fs.readdirSync('SENIOR GRADE').map(f => ({ folder: 'SENIOR GRADE', orig: f, ...parseFileName(f) }));
  const allFiles = [...juniorFiles, ...seniorFiles];

  const matches = [];
  const unmatchedDb = [];
  
  for (const c of candidates) {
    const cNameLower = c.name.toLowerCase();
    
    // Exact or substring match
    let bestMatch = null;
    for (const f of allFiles) {
      // e.g. "aazim muhammed" includes "aazim"
      if (cNameLower.includes(f.name) || f.name.includes(cNameLower)) {
        bestMatch = f;
        break;
      }
    }
    
    if (!bestMatch) {
      // Try splitting names and finding overlap
      const cParts = cNameLower.split(/\s+/);
      for (const f of allFiles) {
        const fParts = f.name.split(/\s+/);
        // if first name matches
        if (cParts[0] === fParts[0]) {
          bestMatch = f;
          break;
        }
      }
    }

    // Special cases
    if (!bestMatch && cNameLower.includes('yuktha') && allFiles.find(f => f.name.includes('yukta'))) {
       bestMatch = allFiles.find(f => f.name.includes('yukta'));
    }

    if (bestMatch) {
      matches.push({
        candidate: c.name,
        candidate_id: c.id,
        file: bestMatch.orig,
        folder: bestMatch.folder
      });
      // remove from allFiles to avoid double matching
      const idx = allFiles.indexOf(bestMatch);
      if (idx !== -1) allFiles.splice(idx, 1);
    } else {
      unmatchedDb.push(c.name);
    }
  }

  console.log("=== MATCHED ===");
  matches.forEach(m => console.log(`${m.candidate} -> ${m.folder}/${m.file}`));
  
  console.log("\n=== UNMATCHED IN DB ===");
  unmatchedDb.forEach(m => console.log(m));
  
  console.log("\n=== UNMATCHED FILES ===");
  allFiles.forEach(f => console.log(`${f.folder}/${f.orig}`));
}

run();
