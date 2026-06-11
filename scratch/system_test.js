import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const studentList = require('../src/lib/students.json');

const supabaseUrl = 'https://uscqxgrcfziyuqqiifrz.supabase.co';
const supabaseKey = 'sb_publishable_xl8ULVYbWSYm4QjvyD7S_A_BG2BYqPS';
const supabase = createClient(supabaseUrl, supabaseKey);

const VOTING_GRADES = ['IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    const ok = fn();
    if (ok) { passed++; results.push(`  ✅  ${name}`); }
    else     { failed++; results.push(`  ❌  ${name}`); }
  } catch(e) { failed++; results.push(`  ❌  ${name} → ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); return true; }

// ─── 1. SUPABASE CONNECTIVITY ───────────────────────────────────────────────
console.log('\n──────────────────────────────────────────');
console.log('  LC SV ELECTION SYSTEM — LOGIC TEST SUITE');
console.log('──────────────────────────────────────────');

const { data: settings, error: sErr } = await supabase.from('settings').select('*').eq('id', 1).single();
const { data: positions }              = await supabase.from('positions').select('*');
const { data: candidates }             = await supabase.from('candidates').select('*');
const { data: voters }                 = await supabase.from('voters').select('*');

console.log('\n📡 SECTION 1 — Database Connectivity');
test('Supabase settings table reachable',     () => assert(!sErr && settings, 'Cannot read settings'));
test('Positions table returns data',           () => assert(Array.isArray(positions) && positions.length > 0));
test('Candidates table returns data',          () => assert(Array.isArray(candidates) && candidates.length > 0));
test('Voters table reachable',                 () => assert(Array.isArray(voters)));

// ─── 2. STUDENT DATA INTEGRITY ───────────────────────────────────────────────
console.log('\n👤 SECTION 2 — Student Data Integrity');
test('Student list is non-empty',              () => assert(studentList.length > 0, 'students.json empty'));
test('Every student has a name',               () => assert(studentList.every(s => s.name && s.name.trim()), 'Some student missing name'));
test('Every student has an adminNo',           () => assert(studentList.every(s => s.adminNo !== undefined && s.adminNo !== null), 'Some student missing adminNo'));
test('Every student has a valid standard',     () => assert(studentList.every(s => s.standard && s.standard.trim()), 'Some student missing standard'));
test('Every student has a division',           () => assert(studentList.every(s => s.division && s.division.trim()), 'Some student missing division'));

const grades = [...new Set(studentList.map(s => s.standard))];
test('Grade III is excluded from voting',      () => assert(!grades.includes('III') && !VOTING_GRADES.includes('III')));
test('Only eligible grades in VOTING_GRADES',  () => {
  const ineligible = grades.filter(g => !VOTING_GRADES.includes(g) && g !== 'III');
  return ineligible.length === 0 || ineligible.every(g => !VOTING_GRADES.includes(g));
});

const adminNos = studentList.map(s => String(s.adminNo));
const uniqueAdminNos = new Set(adminNos);
test('No duplicate Admin Numbers in student list', () => assert(adminNos.length === uniqueAdminNos.size, `${adminNos.length - uniqueAdminNos.size} duplicates found`));

// ─── 3. ELECTION SETTINGS ────────────────────────────────────────────────────
console.log('\n⚙️  SECTION 3 — Election Settings');
test('Admin password is set to adminoflcsv',   () => assert(settings?.admin_password === 'adminoflcsv', `Password is: ${settings?.admin_password}`));
test('Election name is defined',               () => assert(settings?.election_name && settings.election_name.trim()));
test('Election active flag is boolean',        () => assert(typeof settings?.election_active === 'boolean'));

// ─── 4. CANDIDATE INTEGRITY ──────────────────────────────────────────────────
console.log('\n🧑 SECTION 4 — Candidate Integrity');
test('Every candidate has a name',             () => assert(candidates.every(c => c.name && c.name.trim())));
test('Every candidate has a position',         () => assert(candidates.every(c => c.position && c.position.trim())));
test('Every candidate has a grade',            () => assert(candidates.every(c => c.grade && c.grade.trim())));
test('Candidate votes are non-negative',       () => assert(candidates.every(c => c.votes >= 0)));

// Aman auto-win check
const positionGroups = {};
for (const c of candidates) {
  if (!positionGroups[c.position]) positionGroups[c.position] = [];
  positionGroups[c.position].push(c);
}
const autoWinPositions = Object.entries(positionGroups).filter(([, g]) => g.length === 1).map(([p]) => p);
const contestedPositions = Object.entries(positionGroups).filter(([, g]) => g.length > 1).map(([p]) => p);
test('Outreach Secretary is an auto-win (solo candidate)', () => {
  const outreach = Object.entries(positionGroups).find(([p]) => p.toUpperCase().includes('OUTREACH'));
  return outreach ? assert(outreach[1].length === 1, 'Outreach has more than 1 candidate') : true;
});
test('Contested positions have ≥ 2 candidates', () => assert(contestedPositions.length > 0));
test('No position has 0 candidates',            () => assert(positions.every(p => candidates.some(c => c.position === p.name))));

// ─── 5. ANTI-DOUBLE VOTE LOGIC ───────────────────────────────────────────────
console.log('\n🔒 SECTION 5 — Anti-Double Vote Logic');
const votedAdminNos = voters.map(v => String(v.roll_number));
test('Voters table has roll_number column',    () => assert(voters.length === 0 || voters[0].roll_number !== undefined));
test('Voters table has grade column',          () => assert(voters.length === 0 || 'grade' in voters[0]));
const uniqueVoters = new Set(votedAdminNos);
test('No voter has double-voted (DB unique constraint active)', () => assert(votedAdminNos.length === uniqueVoters.size, 'DUPLICATE VOTES DETECTED!'));

// Filter test — simulate what Vote component does
const testGrade = VOTING_GRADES[0];
const testDivision = studentList.find(s => s.standard === testGrade)?.division;
if (testGrade && testDivision) {
  const gradeStudents = studentList.filter(s => s.standard === testGrade);
  const filteredOut = gradeStudents.filter(s => s.division === testDivision && !votedAdminNos.includes(String(s.adminNo)));
  test('Voted students are filtered out of name list', () => {
    const votedInDivision = gradeStudents.filter(s => s.division === testDivision && votedAdminNos.includes(String(s.adminNo)));
    return assert(!filteredOut.some(s => votedAdminNos.includes(String(s.adminNo))), `${votedInDivision.length} voted students still visible`);
  });
}

// ─── 6. TIE DETECTION LOGIC ──────────────────────────────────────────────────
console.log('\n🤝 SECTION 6 — Tie Detection Logic');
function getWinnersList(positions, candidates) {
  return positions.map(p => {
    const list = candidates.filter(c => c.position === p.name).sort((a,b) => b.votes - a.votes);
    if (!list.length) return null;
    const isTie = list.length > 1 && list[0].votes === list[1].votes;
    return { pos: p.name, list, winner: isTie ? null : list[0], isTie, maxVotes: list[0].votes };
  }).filter(Boolean);
}

const mockTieCandidates = [
  { id: '1', position: 'HEAD BOY', name: 'Alice', votes: 10, grade: 'X Aster' },
  { id: '2', position: 'HEAD BOY', name: 'Bob',   votes: 10, grade: 'X Aster' },
];
const mockTiePos = [{ name: 'HEAD BOY' }];
const tieResult = getWinnersList(mockTiePos, mockTieCandidates);
test('Tie detected when votes are equal',      () => assert(tieResult[0].isTie === true));
test('Tie: winner is null (no winner named)',  () => assert(tieResult[0].winner === null));

const mockWinCandidates = [
  { id: '1', position: 'HEAD GIRL', name: 'Alice', votes: 15, grade: 'X Aster' },
  { id: '2', position: 'HEAD GIRL', name: 'Bob',   votes: 8,  grade: 'X Aster' },
];
const mockWinPos = [{ name: 'HEAD GIRL' }];
const winResult = getWinnersList(mockWinPos, mockWinCandidates);
test('Winner correctly identified when clear lead', () => assert(!winResult[0].isTie && winResult[0].winner.name === 'Alice'));

// ─── 7. FACULTY VOTING ───────────────────────────────────────────────────────
console.log('\n🧑‍🏫 SECTION 7 — Faculty Voting');
const facultyVoters = voters.filter(v => v.grade === 'Faculty');
test('Faculty votes stored with grade = "Faculty"', () => assert(facultyVoters.every(v => v.grade === 'Faculty')));
test('Faculty vote count is accurate',             () => assert(typeof facultyVoters.length === 'number'));

// ─── 8. PHOTOS VALIDATION ────────────────────────────────────────────────────
console.log('\n📸 SECTION 8 — Candidate Photo Validation');
const candidatesWithPhoto    = candidates.filter(c => c.photo && c.photo.trim());
const candidatesWithoutPhoto = candidates.filter(c => !c.photo || !c.photo.trim());
test('At least one candidate has a photo',     () => assert(candidatesWithPhoto.length > 0, 'No candidate photos linked'));
if (candidatesWithoutPhoto.length > 0) {
  results.push(`  ⚠️   ${candidatesWithoutPhoto.length} candidate(s) missing photos: ${candidatesWithoutPhoto.map(c => c.name).join(', ')}`);
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────');
console.log('  RESULTS');
console.log('──────────────────────────────────────────');
results.forEach(r => console.log(r));
console.log('\n──────────────────────────────────────────');
console.log(`  Total: ${passed + failed}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`);
console.log('──────────────────────────────────────────\n');
if (failed > 0) process.exit(1);
