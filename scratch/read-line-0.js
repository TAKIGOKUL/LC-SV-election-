import fs from 'fs';

const logPath = '/home/taki/.gemini/antigravity/brain/32fbd3db-7cd8-49b3-952d-eeb54ce63af4/.system_generated/logs/transcript.jsonl';

function readLine0() {
  const fileContent = fs.readFileSync(logPath, 'utf8');
  const lines = fileContent.split('\n');
  if (lines.length > 0 && lines[0]) {
    const parsed = JSON.parse(lines[0]);
    console.log('CONTENT:', parsed.content.substring(0, 2000));
    console.log('...');
    console.log('END CONTENT:', parsed.content.substring(parsed.content.length - 2000));
  }
}

readLine0();
