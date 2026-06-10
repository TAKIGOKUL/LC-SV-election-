import fs from 'fs';

const htmlPath = '/home/taki/Downloads/student details (1).html';

function test() {
  const content = fs.readFileSync(htmlPath, 'utf8');
  console.log('File size:', content.length);
  
  // Let's find some table rows and print them
  const rows = [];
  let pos = 0;
  while (true) {
    const start = content.indexOf('<tr', pos);
    if (start === -1) break;
    const end = content.indexOf('</tr>', start);
    if (end === -1) break;
    rows.push(content.substring(start, end + 5));
    pos = end + 5;
  }
  
  console.log(`Found ${rows.length} rows.`);
  console.log('Sample Row 0:', rows[0]);
  console.log('Sample Row 1:', rows[1]);
  console.log('Sample Row 2:', rows[2]);
  console.log('Sample Row 3:', rows[3]);
  console.log('Sample Row 4:', rows[4]);
  console.log('Sample Row 5:', rows[5]);
}

test();
