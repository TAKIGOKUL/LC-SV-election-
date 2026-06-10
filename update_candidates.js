import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uscqxgrcfziyuqqiifrz.supabase.co';
const supabaseKey = 'sb_publishable_xl8ULVYbWSYm4QjvyD7S_A_BG2BYqPS';
const supabase = createClient(supabaseUrl, supabaseKey);

function parseFileName(filename) {
  const noExt = filename.replace(/\.[a-zA-Z]+$/, '');
  let namePart = noExt;
  if (noExt.includes('-')) {
    namePart = noExt.split('-')[0].trim();
  } else {
    const match = noExt.match(/(.*?)\s+(IV|V|IX|X)\s+(.*)/i);
    if (match) {
      namePart = match[1].trim();
    } else {
      namePart = noExt.trim();
    }
  }
  return { name: namePart.toLowerCase(), file: filename };
}

async function run() {
  const { data: candidates, error } = await supabase.from('candidates').select('id, name, grade, position');
  if (error) { console.error(error); return; }

  const juniorFiles = fs.readdirSync('JUNIOR GRADE').map(f => ({ folder: 'JUNIOR GRADE', orig: f, ...parseFileName(f) }));
  const seniorFiles = fs.readdirSync('SENIOR GRADE').map(f => ({ folder: 'SENIOR GRADE', orig: f, ...parseFileName(f) }));
  const allFiles = [...juniorFiles, ...seniorFiles];

  const matches = [];

  for (const c of candidates) {
    const cNameLower = c.name.toLowerCase();
    
    let bestMatch = null;
    for (const f of allFiles) {
      if (cNameLower.includes(f.name) || f.name.includes(cNameLower)) {
        bestMatch = f;
        break;
      }
    }
    
    if (!bestMatch) {
      const cParts = cNameLower.split(/\s+/);
      for (const f of allFiles) {
        const fParts = f.name.split(/\s+/);
        if (cParts[0] === fParts[0]) {
          bestMatch = f;
          break;
        }
      }
    }

    // manual overrides
    if (!bestMatch && cNameLower.includes('yuktha')) {
       bestMatch = allFiles.find(f => f.name.includes('yukta'));
    }
    if (!bestMatch && cNameLower.includes('dakshina')) {
       bestMatch = allFiles.find(f => f.orig.toLowerCase().includes('dakshinna'));
    }
    if (!bestMatch && cNameLower.includes('sanavsree')) {
       bestMatch = allFiles.find(f => f.orig.toLowerCase().includes('sanav sree'));
    }
    if (!bestMatch && cNameLower.includes('vedasree')) {
       bestMatch = allFiles.find(f => f.orig.toLowerCase().includes('vedhasree'));
    }
    if (!bestMatch && cNameLower.includes('harshita')) {
       bestMatch = allFiles.find(f => f.orig.toLowerCase().includes('harshitha'));
    }
    if (!bestMatch && cNameLower.includes('atharva')) {
       bestMatch = allFiles.find(f => f.orig.toLowerCase().includes('atharva.d'));
    }

    if (bestMatch) {
      matches.push({
        candidate_id: c.id,
        candidate_name: c.name,
        srcPath: path.join(bestMatch.folder, bestMatch.orig),
        destName: bestMatch.orig
      });
      const idx = allFiles.indexOf(bestMatch);
      if (idx !== -1) allFiles.splice(idx, 1);
    }
  }

  // Create public/candidates directory
  const destDir = path.join('public', 'candidates');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  let updatedCount = 0;
  for (const m of matches) {
    // Copy file
    const destPath = path.join(destDir, m.destName);
    fs.copyFileSync(m.srcPath, destPath);
    
    // Update Supabase
    const photoUrl = `/candidates/${encodeURIComponent(m.destName)}`;
    const { error: updErr } = await supabase.from('candidates').update({ photo: photoUrl }).eq('id', m.candidate_id);
    if (updErr) {
      console.error(`Failed to update ${m.candidate_name}:`, updErr);
    } else {
      updatedCount++;
    }
  }
  
  console.log(`Successfully matched and updated ${updatedCount} candidates with their photos.`);
  console.log(`\nThe following candidates have NO photo file matching their name:`);
  candidates.filter(c => !matches.find(m => m.candidate_id === c.id)).forEach(c => console.log(`- ${c.name} (${c.position})`));
  
  console.log(`\nThe following photos are leftover and not matched to any candidate in the database:`);
  allFiles.forEach(f => console.log(`- ${f.folder}/${f.orig}`));
}

run();
