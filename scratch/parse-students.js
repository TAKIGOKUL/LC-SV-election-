import fs from 'fs';
import path from 'path';

const htmlPath = '/home/taki/Downloads/student details (1).html';

function cleanText(txt) {
  if (!txt) return '';
  return txt
    .replace(/<[^>]*>/g, '') // strip html tags
    .replace(/&nbsp;/g, ' ')
    .replace(/ /g, ' ') // non-breaking spaces
    .trim();
}

function parse() {
  const content = fs.readFileSync(htmlPath, 'utf8');
  
  // Find all <tr> blocks
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match;
  const students = [];
  
  const uniqueStandards = new Set();
  const uniqueDivisions = new Set();
  const uniqueHouses = new Set();
  
  while ((match = trRegex.exec(content)) !== null) {
    const trContent = match[1];
    // Find all <td blocks
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    const cells = [];
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      cells.push(cleanText(tdMatch[1]));
    }
    
    if (cells.length >= 13) {
      const slno = cells[0];
      const adminNo = cells[1];
      const name = cells[2];
      const standard = cells[3];
      const division = cells[4];
      const sex = cells[5];
      const dob = cells[6];
      const fatherName = cells[7];
      const fatherMobile = cells[8];
      const motherName = cells[9];
      const motherMobile = cells[10];
      const email = cells[11];
      const house = cells[12];
      
      // Filter out header rows
      if (adminNo && adminNo !== 'AdminNo' && slno && !isNaN(slno.trim())) {
        students.push({
          slno: parseInt(slno.trim()),
          adminNo: adminNo.trim(),
          name: name.trim(),
          standard: standard.trim(),
          division: division.trim(),
          sex: sex.trim(),
          dob: dob.trim(),
          fatherName: fatherName.trim(),
          fatherMobile: fatherMobile.trim(),
          motherName: motherName.trim(),
          motherMobile: motherMobile.trim(),
          email: email.trim(),
          house: house.trim() || 'No House'
        });
        
        uniqueStandards.add(standard.trim());
        uniqueDivisions.add(division.trim());
        if (house.trim()) {
          uniqueHouses.add(house.trim());
        }
      }
    }
  }
  
  console.log(`Parsed ${students.length} students.`);
  console.log('Unique Standards:', Array.from(uniqueStandards));
  console.log('Unique Divisions:', Array.from(uniqueDivisions));
  console.log('Unique Houses:', Array.from(uniqueHouses));
  
  // Save to src/lib/students.json
  const outPath = '/home/taki/Desktop/LC SV/src/lib/students.json';
  fs.writeFileSync(outPath, JSON.stringify(students, null, 2));
  console.log(`Successfully saved roster to ${outPath}`);
}

parse();
