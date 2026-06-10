import fs from 'fs';

const logPath = '/home/taki/.gemini/antigravity/brain/32fbd3db-7cd8-49b3-952d-eeb54ce63af4/.system_generated/logs/transcript.jsonl';

function test() {
  if (!fs.existsSync(logPath)) {
    console.error('Log file does not exist!');
    return;
  }
  const fileContent = fs.readFileSync(logPath, 'utf8');
  const lines = fileContent.split('\n');
  console.log(`Total lines in log: ${lines.length}`);
  
  // Find lines containing USER_INPUT
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed.type === 'USER_INPUT') {
        console.log(`Line ${i}: type=${parsed.type}, source=${parsed.source}, length=${parsed.content?.length}`);
      }
    } catch (e) {
      console.error(`Error parsing line ${i}:`, e.message);
    }
  }
}

test();
