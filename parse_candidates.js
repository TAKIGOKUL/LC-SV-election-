import fs from 'fs';
import path from 'path';

function parseFileName(filename) {
  const noExt = filename.replace(/\.[a-zA-Z]+$/, '');
  let namePart = noExt;
  let gradePart = '';
  
  // Some files have a dash e.g. "AARON G JAMES-IV IRIS"
  if (noExt.includes('-')) {
    const parts = noExt.split('-');
    namePart = parts[0].trim();
    gradePart = parts[1].trim();
  } else {
    // Try to find roman numerals for grades: IV, V, IX, X
    const match = noExt.match(/(.*?)\s+(IV|V|IX|X)\s+(.*)/i);
    if (match) {
      namePart = match[1].trim();
      gradePart = match[2].trim() + ' ' + match[3].trim();
    } else {
      // Just take the whole name
      namePart = noExt.trim();
    }
  }
  return { name: namePart, grade: gradePart, file: filename };
}

const juniorFiles = fs.readdirSync('JUNIOR GRADE');
const seniorFiles = fs.readdirSync('SENIOR GRADE');

const allFiles = [
  ...juniorFiles.map(f => ({ folder: 'JUNIOR GRADE', ...parseFileName(f) })),
  ...seniorFiles.map(f => ({ folder: 'SENIOR GRADE', ...parseFileName(f) }))
];

console.log(JSON.stringify(allFiles, null, 2));
