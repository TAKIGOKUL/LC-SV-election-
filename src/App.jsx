import React, { useState, useEffect, useRef } from 'react';
import { Award, CheckCircle, Upload, Trash2, Settings, LogOut, Check, Download } from 'lucide-react';
import './index.css';
import { supabase } from './lib/supabase';
import html2canvas from 'html2canvas';
import studentList from './lib/students.json';

// ── CHILD-FRIENDLY INTERACTIVE SYNTHESIZED SOUND EFFECTS ──
let soundEnabled = true;

const haptic = (pattern) => {
  if (navigator.vibrate && soundEnabled) {
    try { navigator.vibrate(pattern); } catch(e) {}
  }
};

let globalAudioCtx = null;
const initAudio = () => {
  if (!globalAudioCtx) {
    try { globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
};

const playChime = (tones, delay, volume, decay, type = 'sine') => {
  if (!soundEnabled) return;
  try {
    const ctx = initAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + i * delay);
      gain.gain.setValueAtTime(0, now + i * delay);
      gain.gain.linearRampToValueAtTime(volume, now + i * delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * delay + decay);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + i * delay);
      osc.stop(now + i * delay + decay);
    });
  } catch(e) {}
};

const playSound = {
  // Bouncy double-pop select sound -> longer sparkly arpeggio
  select: () => {
    haptic([15, 30, 20]);
    playChime([523.25, 783.99, 1046.50], 0.08, 0.4, 0.8, 'sine');
  },
  
  // Smooth ascending slide / whoosh for next transition
  next: () => {
    haptic([25]);
    playChime([440, 554.37, 659.25, 880], 0.06, 0.3, 0.8, 'triangle');
  },
  
  // Smooth descending slide / whoosh for back transition
  back: () => {
    haptic([25]);
    playChime([880, 659.25, 554.37, 440], 0.06, 0.3, 0.8, 'triangle');
  },
  
  // Magical sweep chime for reviewing ballot or previewing candidates
  preview: () => {
    haptic([10, 20, 10, 20, 30]);
    playChime([523.25, 659.25, 783.99, 1046.50, 1318.51], 0.1, 0.3, 1.2, 'sine');
  },
  
  // Glorious multi-tone victory fanfare on successful submission
  success: () => {
    haptic([30, 40, 30, 40, 50, 40, 80]);
    playChime([392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00], 0.12, 0.45, 2.5, 'triangle');
  },
  
  // Soft buzz for warning or wrong passwords
  error: () => {
    haptic([50, 50, 50]);
    playChime([200, 150], 0.15, 0.5, 0.6, 'sawtooth');
  },
  
  // Bubble tap sound for clicking tabs
  tabClick: () => {
    haptic([15]);
    playChime([600, 800], 0.05, 0.3, 0.4, 'sine');
  },

  // Tiny quiet woody hover click
  hover: () => playChime([1200], 0, 0.05, 0.1, 'sine'),

  // Soft typing/tick sound
  inputTick: () => playChime([1800], 0, 0.04, 0.1, 'sine'),

  // Triumphant upward arpeggio for starting election
  startElection: () => {
    haptic([20, 30, 40, 50]);
    playChime([261.63, 329.63, 392.00, 523.25, 659.25, 783.99], 0.08, 0.4, 1.5, 'triangle');
  },

  // Descending winding down chime for stopping election
  stopElection: () => {
    haptic([50, 40, 30, 20]);
    playChime([783.99, 659.25, 523.25, 392.00, 329.63, 261.63], 0.1, 0.4, 1.5, 'triangle');
  },

  // Soft zip-whoosh for deletion
  delete: () => {
    haptic([40, 20, 40]);
    playChime([300, 200, 100], 0.05, 0.4, 0.6, 'sawtooth');
  }
};

const parseGrade = (gradeStr) => {
  if (!gradeStr) return { standard: '—', division: '—' };
  const divisions = [
    'tube rose', 'hazel', 'snowdrop', 'cherry blossom', 'bluebell', 'bluebell horizon', 'daisy',
    'rose', 'rose horizon', 'violet', 'violet horizon', 'lily', 'lily horizon', 'lotus', 'lotus horizon',
    'iris', 'zinnia', 'dahlia', 'tulip', 'buttercup', 'begonia', 'orchid', 'daffodil', 'periwinkle', 'aster'
  ];
  const lower = gradeStr.toLowerCase();
  let foundDiv = '—';
  let foundStd = gradeStr;
  
  const sortedDivs = [...divisions].sort((a,b) => b.length - a.length);
  for (const div of sortedDivs) {
    if (lower.endsWith(div)) {
      foundDiv = gradeStr.slice(-div.length).trim();
      foundStd = gradeStr.slice(0, -div.length).trim();
      break;
    }
  }
  if (foundDiv === '—') {
    const idx = gradeStr.lastIndexOf(' ');
    if (idx !== -1) {
      foundStd = gradeStr.substring(0, idx).trim();
      foundDiv = gradeStr.substring(idx + 1).trim();
    }
  }
  return { standard: foundStd, division: foundDiv };
};

export default function App() {
  const [splash, setSplash] = useState('in');
  const [tab, setTab] = useState(() => sessionStorage.getItem('lc_sv_active_tab') || 'dashboard');
  const [toast, setToast] = useState(null);
  const [electionActive, setElectionActive] = useState(false);
  const [electionName, setElectionName] = useState('School Elections 2025');
  const [electionDate, setElectionDate] = useState('');
  const [positions, setPositions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [facultyCount, setFacultyCount] = useState(0);
  const [votedAdminNos, setVotedAdminNos] = useState([]);
  const [facultyVoterSession, setFacultyVoterSession] = useState(null);
  const [bgIndex, setBgIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(() => {
    const saved = localStorage.getItem('lc_sv_sound_enabled');
    return saved !== 'false';
  });

  useEffect(() => {
    soundEnabled = soundOn;
    localStorage.setItem('lc_sv_sound_enabled', soundOn);
  }, [soundOn]);

  useEffect(() => {
    if (tab === 'dashboard' || tab === 'vote') {
      const interval = setInterval(() => {
        setBgIndex(prev => (prev + 1) % 3);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [tab]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) {
      soundEnabled = true;
      playSound.select();
    }
  };

  useEffect(() => {
    // Phase 1: Serene Valley branding shown for 5 seconds
    const t1 = setTimeout(() => setSplash('crest'), 5000);
    // Phase 2: LCSV.png crest shown for 2 seconds
    const t2 = setTimeout(() => setSplash('out'), 5000 + 2000);
    // Phase 3: Fade out (0.6 s) then reveal app
    const t3 = setTimeout(() => setSplash('done'), 5000 + 2000 + 600);
    
    // Celebratory initial welcome sound when kids tap anywhere for the first time
    const onClick = () => { 
      playSound.success();
      window.removeEventListener('click', onClick); 
    };
    window.addEventListener('click', onClick);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); window.removeEventListener('click', onClick); };
  }, []);

  useEffect(() => {
    fetchData();
    // Poll Supabase database every 5 seconds to automatically update the dashboard, leaderboard, and results
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    const { data: s, error } = await supabase.from('settings').select('*').eq('id',1).single();
    if (error) { setDbError(true); return; }
    if (s) { setElectionActive(s.election_active); setElectionName(s.election_name); setElectionDate(s.election_date || ''); }
    const { data: p } = await supabase.from('positions').select('*');
    if (p) setPositions(p.map(x => x.name));
    const { data: c } = await supabase.from('candidates').select('*');
    if (c) setCandidates(c);
    const { data: v } = await supabase.from('voters').select('roll_number, grade');
    if (v) {
      setVotedAdminNos(v.map(row => String(row.roll_number)));
      setFacultyCount(v.filter(row => row.grade === 'Faculty').length);
    }
    setDbError(false);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  if (splash !== 'done') {
    // Phase 2 → Show the LCSV school crest full-screen
    if (splash === 'crest' || splash === 'out') {
      return (
        <div className="splash splash-crest" style={{ opacity: splash === 'out' ? 0 : 1 }}>
          <img src="/LCSV.png" className="splash-crest-img" alt="Lecole Chempaka Serene Valley Crest" />
          <img src="/HNW.png" className="splash-hnw-img" alt="HNW Logo" />
        </div>
      );
    }
    // Phase 1 → Serene Valley branding
    return (
      <div className="splash">
        <img src="/logo.png" className="splash-logo-img" alt="Serene Valley Crest Logo" />
        <div className="splash-title">🗳️ Election System 🌟</div>
        <div className="splash-sub">Serene Valley</div>
        <div className="progress-bar"><div className="progress-fill" style={{ animationDuration: '5s' }} /></div>
      </div>
    );
  }

  const changeTab = (t) => {
    playSound.tabClick();
    setTab(t);
    sessionStorage.setItem('lc_sv_active_tab', t);
    fetchData();

    // Automatically switch to fullscreen mode for a focused kid-friendly voting screen
    if (t === 'vote') {
      try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari */
          elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
          elem.msRequestFullscreen();
        }
      } catch (e) {}
    }
  };

  const calculatedVoters = positions.length ? Math.max(...positions.map(pos => 
    candidates.filter(c => c.position === pos).reduce((sum, c) => sum + (c.votes || 0), 0)
  ), 0) : 0;

  return (
    <div>
      {/* Background Slideshow or Blobs */}
      {(tab === 'dashboard' || tab === 'vote') ? (
        <div className="slideshow-bg">
          <div className={`slide ${bgIndex === 0 ? 'active' : ''}`} style={{ backgroundImage: "url('/lc1.jpg')" }} />
          <div className={`slide ${bgIndex === 1 ? 'active' : ''}`} style={{ backgroundImage: "url('/lc2.jpg')" }} />
          <div className={`slide ${bgIndex === 2 ? 'active' : ''}`} style={{ backgroundImage: "url('/lc3.jpg')" }} />
        </div>
      ) : (
        <div className="blob-container">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
          <div className="blob blob-4" />
        </div>
      )}
      <div className={`glass-overlay ${(tab === 'dashboard' || tab === 'vote') ? 'slideshow-active' : ''}`} />

      <nav className="nav">
        <span className="nav-brand" onClick={() => changeTab('dashboard')} onMouseEnter={() => playSound.hover()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="Serene Valley logo" style={{ height: '36px', width: '36px', objectFit: 'contain' }} />
          <span>Serene Valley</span>
        </span>
        {['Dashboard', 'Candidates', 'Vote'].map(t => (
          <button key={t} className={`nav-btn ${tab === t.toLowerCase() ? 'active' : ''}`} onClick={() => changeTab(t.toLowerCase())} onMouseEnter={() => playSound.hover()}>{t}</button>
        ))}
        <button className="nav-btn nav-sound" onClick={toggleSound} onMouseEnter={() => playSound.hover()} title={soundOn ? "Mute Sounds" : "Unmute Sounds"}>
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button className={`nav-btn nav-admin ${tab === 'admin' ? 'active' : ''}`} onClick={() => changeTab('admin')} onMouseEnter={() => playSound.hover()} title="Admin">🔒</button>
      </nav>

      <div className="page pop-entrance" key={tab}>
        {dbError && (
          <div className="card card-sm mb-3" style={{background:'#ffebee',border:'4px solid var(--text)',color:'#c62828'}}>
            ⚠ Database not set up. Please run the SQL schema in your Supabase project.
          </div>
        )}
        {tab === 'dashboard'   && <Dashboard candidates={candidates} positions={positions} electionDate={electionDate} electionActive={electionActive} changeTab={changeTab} voterCount={calculatedVoters} />}
        {tab === 'candidates'  && <Candidates candidates={candidates} positions={positions} />}
        {tab === 'vote'        && <Vote candidates={candidates} positions={positions} electionActive={electionActive} hasVoted={hasVoted} setHasVoted={setHasVoted} showToast={showToast} fetchData={fetchData} changeTab={changeTab} facultyVoterSession={facultyVoterSession} setFacultyVoterSession={setFacultyVoterSession} votedAdminNos={votedAdminNos} />}
        {tab === 'results'     && <Results candidates={candidates} positions={positions} />}
        {tab === 'admin'       && <Admin adminLoggedIn={adminLoggedIn} setAdminLoggedIn={setAdminLoggedIn} electionActive={electionActive} electionName={electionName} electionDate={electionDate} positions={positions} candidates={candidates} showToast={showToast} setHasVoted={setHasVoted} fetchData={fetchData} changeTab={changeTab} facultyCount={facultyCount} setFacultyVoterSession={setFacultyVoterSession} setVotedAdminNos={setVotedAdminNos} />}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ── DASHBOARD ──
function Dashboard({ candidates, positions, electionDate, electionActive, changeTab, voterCount }) {
  const validCandidates = candidates.filter(c => positions.includes(c.position));
  const total = voterCount;
  const top5 = [...validCandidates].sort((a,b) => b.votes - a.votes).slice(0,5);
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const dateStr = electionDate ? new Date(electionDate).toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'}) : '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="page-title">✨ School Overview ✨</div>
          <div className="page-subtitle">📅 {dateStr}</div>
        </div>
        <span className="badge badge-green">
          <span className={`dot ${electionActive ? 'dot-green' : 'dot-amber'}`} />
          {electionActive ? 'Active 🟢' : total > 0 ? 'Closed 🔴' : 'Not started 🟡'}
        </span>
      </div>

      <div className="stat-strip">
        <div className="stat-box"><div className="stat-num">👥 {validCandidates.length}</div><div className="stat-label">Candidates</div></div>
        <div className="stat-box"><div className="stat-num">🏆 {positions.length}</div><div className="stat-label">Positions</div></div>
        <div className="stat-box"><div className="stat-num">🗳️ {total}</div><div className="stat-label">Votes Cast</div></div>
      </div>

      <div className="card">
        <div className="section-header"><span className="section-title">⭐ Leadership Leaderboard ⭐</span></div>
        {top5.length === 0 && <p className="text-muted" style={{fontSize:15, textAlign: 'center', padding: '20px 0'}}>No votes recorded yet. Let's start voting! 🗳️</p>}
        {top5.map((c,i) => (
          <div key={c.id} className="lb-row">
            <span className="lb-rank">{medals[i]}</span>
            <Avatar name={c.name} photo={c.photo} />
            <div className="lb-info">
              <div className="lb-name">{c.name}</div>
              <div className="lb-pos">🏅 {c.position}</div>
            </div>
            <span className="lb-votes">{c.votes} {c.votes === 1 ? 'vote' : 'votes'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CANDIDATES ──
function Candidates({ candidates, positions }) {
  const [sel, setSel] = useState(null);

  const openPromises = (c) => {
    playSound.preview();
    setSel(c);
  };

  const closePromises = () => {
    playSound.tabClick();
    setSel(null);
  };

  return (
    <div>
      <div className="page-title mb-4">⭐ Our Fantastic Candidates ⭐</div>
      {positions.map(pos => {
        const list = candidates.filter(c => c.position === pos);
        if (!list.length) return null;
        return (
          <div key={pos} className="pos-group">
            <div className="pos-group-title">🏅 {pos} · <span className="text-muted">{list.length} running</span></div>
            <div className="cand-grid">
              {list.map(c => (
                <div key={c.id} className="cand-tile" onClick={() => openPromises(c)} onMouseEnter={() => playSound.hover()}>
                  <div className="cand-tile-photo">
                    {c.photo ? <img src={c.photo} alt={c.name} crossOrigin="anonymous" /> : <span>{(c.name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</span>}
                    {c.symbol && <div className="cand-symbol-badge">{c.symbol}</div>}
                  </div>
                  <div className="cand-tile-info">
                    <div className="cand-tile-name">{c.name}</div>
                    <div className="cand-tile-meta">✨ Grade {c.grade}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {sel && (
        <div className="modal-bg" onClick={closePromises}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex-col items-center mb-4" style={{textAlign:'center'}}>
              <div className="cand-tile-photo" style={{width:110,height:110,fontSize:32,margin:'0 auto 16px', borderWidth: '4px', borderStyle: 'solid', borderColor: 'var(--text)', position: 'relative'}}>
                {sel.photo ? <img src={sel.photo} alt={sel.name} crossOrigin="anonymous" /> : <span>{(sel.name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</span>}
                {sel.symbol && <div className="cand-symbol-badge" style={{width: 36, height: 36, fontSize: 18, top: -8, right: -8}}>{sel.symbol}</div>}
              </div>
              <div style={{fontSize:22,fontWeight:800}}>{sel.name}</div>
              <div className="text-secondary" style={{fontSize:14, marginTop: 4}}>🏅 {sel.position} · ✨ Grade {sel.grade}</div>
              <span className="badge badge-green mt-3">{sel.votes} {sel.votes === 1 ? 'vote' : 'votes'}</span>
            </div>
            <hr className="divider" />
            <div className="section-title mb-3" style={{textAlign: 'center', fontSize: 14}}>🌟 My Promises To You 🌟</div>
            {(!sel.promises || sel.promises.length === 0) && <p className="text-muted" style={{fontSize: 14, textAlign: 'center'}}>I promise to do my absolute best for our school! 🏫</p>}
            {sel.promises && sel.promises.map((p,i) => (
              <div key={i} className="flex items-center gap-2 mb-2" style={{background: 'rgba(246, 197, 4, 0.08)', padding: '10px 14px', borderRadius: '16px', border: '2px solid var(--text)'}}>
                <span style={{fontSize:20}}>✨</span>
                <span style={{fontSize:14, fontWeight: '700', color: 'var(--text)'}}>{p}</span>
              </div>
            ))}
            <button className="btn primary w-full mt-4" onClick={closePromises}>Close 🌟</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VOTE ──
// Ordered list of grades eligible to vote (Standard IV to X only)
const VOTING_GRADES = ['IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function Vote({ candidates, positions, electionActive, hasVoted, setHasVoted, showToast, fetchData, changeTab, facultyVoterSession, setFacultyVoterSession, votedAdminNos }) {
  const [voter, setVoter] = useState(facultyVoterSession || null);
  const [tempGrade, setTempGrade] = useState('');
  const [tempDivision, setTempDivision] = useState('');
  const [tempStudentAdminNo, setTempStudentAdminNo] = useState('');

  const [sel, setSel] = useState({});
  const [step, setStep] = useState(0); 
  const [direction, setDirection] = useState('next'); 
  const [loading, setLoading] = useState(false);

  // Filter to positions that have MORE THAN ONE candidate (skip uncontested defaults)
  const activePositions = positions.filter(p => candidates.filter(c => c.position === p).length > 1);
  const autoWinPositions = positions.filter(p => candidates.filter(c => c.position === p).length === 1);
  const totalSteps = activePositions.length;
  const isReview = step >= totalSteps;
  const currentPos = activePositions[step];
  const currentCandidates = currentPos ? candidates.filter(c => c.position === currentPos) : [];

  // Voter Identification: Grade → Division → Name
  // Only show grades that exist in the student list AND are in the eligible voting grades
  const availableGrades = VOTING_GRADES.filter(g => studentList.some(s => s.standard === g));
  const gradeStudents = tempGrade ? studentList.filter(s => s.standard === tempGrade) : [];
  const divisionsInGrade = Array.from(new Set(gradeStudents.map(s => s.division))).filter(Boolean).sort();
  const filteredStudents = tempGrade && tempDivision
    ? gradeStudents.filter(s => s.division === tempDivision && !votedAdminNos.includes(String(s.adminNo)))
    : gradeStudents;

  // Reset division + student when grade changes
  useEffect(() => {
    setTempDivision('');
    setTempStudentAdminNo('');
  }, [tempGrade]);

  // Reset student when division changes
  useEffect(() => {
    setTempStudentAdminNo('');
  }, [tempDivision]);

  if (!electionActive) return (
    <div className="empty">
      <div style={{fontSize: 70, animation: 'pulseBouncy 2s infinite'}}>🔒</div>
      <div className="empty-title" style={{fontSize: 24, fontWeight: 800, marginTop: 10}}>Voting is Closed!</div>
      <div className="empty-sub" style={{fontSize: 15, marginBottom: 20}}>The election is currently stopped or has ended.</div>
    </div>
  );

  if (hasVoted) return (
    <div className="card text-center" style={{ maxWidth: '600px', margin: '60px auto', padding: '60px 40px' }}>
      <div style={{fontSize: 80, animation: 'pulseBouncy 1.5s infinite'}}>🎉</div>
      <div className="empty-title" style={{fontSize: 32, fontWeight: 800, marginTop: 16, color: '#1D1B1C'}}>Thank you for voting! 🌟</div>
      <div className="empty-sub" style={{fontSize: 18, color: '#1D1B1C', opacity: 0.8, marginTop: 12, lineHeight: 1.5}}>
        Your awesome ballot has been safely recorded.<br/>You did amazing! 🏫
      </div>
      <button className="btn primary mt-6" style={{ fontSize: '20px', padding: '16px 32px' }} onClick={() => window.location.reload()}>Next Voter 👤</button>
    </div>
  );

  // 1. Voter Identification Step
  if (!voter) {
    const isReady = tempGrade && tempDivision && tempStudentAdminNo;
    const selectedObj = studentList.find(s => s.adminNo === tempStudentAdminNo);

    return (
      <div className="card text-center" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px' }}>
        <div style={{ fontSize: '70px', animation: 'pulseBouncy 2s infinite' }}>🗳️</div>
        <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '16px', marginBottom: '8px' }}>Who is Voting today?</div>
        <div className="text-secondary mb-4" style={{ fontSize: '15px' }}>{
          !tempGrade ? 'First, tap on your Grade! 😊' :
          !tempDivision ? 'Great! Now tap on your Division 🌸' :
          !tempStudentAdminNo ? 'Awesome! Finally, find and tap your Name 👋' :
          'Perfect! Tap Start Voting to begin! 🚀'
        }</div>

        <div className="flex gap-4 mb-4 flex-col" style={{ width: '100%', alignItems: 'center' }}>
          
          <div className="text-left" style={{ width: '100%' }}>
            <label className="form-label" style={{ fontWeight: 800, fontSize: '16px', marginBottom: '12px', display: 'block', textAlign: 'center' }}>📝 Step 1: Choose Your Grade</label>
            <div className="choice-grid">
              {availableGrades.map(g => (
                <button 
                  key={g} 
                  className={`choice-btn ${tempGrade === g ? 'selected' : ''}`}
                  onClick={() => { setTempGrade(g); playSound.select(); }}
                  onMouseEnter={() => playSound.hover()}
                >
                  Grade {g}
                </button>
              ))}
            </div>
          </div>

          {tempGrade && (
            <div className="text-left mt-4" style={{ width: '100%', animation: 'popEntrance 0.4s ease-out' }}>
              <label className="form-label" style={{ fontWeight: 800, fontSize: '16px', marginBottom: '12px', display: 'block', textAlign: 'center' }}>🌸 Step 2: Choose Your Division</label>
              <div className="choice-grid">
                {divisionsInGrade.map(d => (
                  <button 
                    key={d} 
                    className={`choice-btn ${tempDivision === d ? 'selected' : ''}`}
                    onClick={() => { setTempDivision(d); playSound.select(); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100); }}
                    onMouseEnter={() => playSound.hover()}
                  >
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tempGrade && tempDivision && (
            <div className="text-left mt-4" style={{ width: '100%', animation: 'popEntrance 0.4s ease-out' }}>
              <label className="form-label" style={{ fontWeight: 800, fontSize: '16px', marginBottom: '12px', display: 'block', textAlign: 'center' }}>👋 Step 3: Find Your Name</label>
              <div className="choice-grid names-grid">
                {filteredStudents.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                  <button 
                    key={s.adminNo} 
                    className={`choice-btn ${tempStudentAdminNo === s.adminNo ? 'selected' : ''}`}
                    onClick={() => { setTempStudentAdminNo(s.adminNo); playSound.select(); }}
                    onMouseEnter={() => playSound.hover()}
                    style={{ fontSize: '16px', padding: '14px 10px' }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {isReady && (
          <button 
            className="btn primary w-full mt-4 primary-jump-breathe" 
            style={{ fontSize: '20px', padding: '20px' }}
            onClick={() => {
              playSound.success();
              setVoter(selectedObj);
            }}
            onMouseEnter={() => playSound.hover()}
          >
            Start Voting 🚀
          </button>
        )}
      </div>
    );
  }


  // 2. Voting Candidate Stepper Steps
  const selectCandidate = (id) => {
    playSound.select();
    setSel(p => ({...p, [currentPos]: p[currentPos] === id ? undefined : id}));
  };

  const goNext = () => { 
    if (step < totalSteps) {
      setDirection('next');
      setStep(step + 1);
      if (step + 1 === totalSteps) {
        playSound.preview();
      } else {
        playSound.next();
      }
    } 
  };
  
  const goBack = () => { 
    if (step > 0) {
      setDirection('back');
      setStep(step - 1);
      playSound.back();
    } else {
      playSound.back();
      if (facultyVoterSession) {
        setFacultyVoterSession(null);
        changeTab('admin');
      } else {
        setVoter(null);
      }
    }
  };

  const submit = async () => {
    setLoading(true);
    
    // Save to Local Storage Backup first for safety
    try {
      const localLog = JSON.parse(localStorage.getItem('lc_sv_vote_backup') || '[]');
      const voteRecord = {
        timestamp: new Date().toLocaleString(),
        voterName: voter.name,
        voterGrade: voter.standard,
        voterDivision: voter.division,
        selections: []
      };
      
      for (const pos of activePositions) {
        if (sel[pos]) {
          const c = candidates.find(x => x.id === sel[pos]);
          if (c) voteRecord.selections.push(`${pos}: ${c.name}`);
        }
      }
      for (const pos of autoWinPositions) {
        const c = candidates.find(x => x.position === pos);
        if (c) voteRecord.selections.push(`${pos}: ${c.name} (Auto-Win)`);
      }
      localLog.push(voteRecord);
      localStorage.setItem('lc_sv_vote_backup', JSON.stringify(localLog));
    } catch (e) {
      console.error('Failed to save local backup', e);
    }

    const { error: ve } = await supabase.from('voters').insert([{ grade: voter.standard, roll_number: voter.adminNo }]);
    if (ve) {
      playSound.error();
      showToast(ve.code === '23505' ? '⚠ You have already voted!' : 'Error: ' + ve.message);
      setLoading(false); return;
    }
    for (const pos of activePositions) {
      const id = sel[pos];
      if (id) {
        const { data: cd } = await supabase.from('candidates').select('votes').eq('id', id).single();
        if (cd) await supabase.from('candidates').update({ votes: cd.votes + 1 }).eq('id', id);
      }
    }
    for (const pos of autoWinPositions) {
      const c = candidates.find(x => x.position === pos);
      if (c) {
        const { data: cd } = await supabase.from('candidates').select('votes').eq('id', c.id).single();
        if (cd) await supabase.from('candidates').update({ votes: cd.votes + 1 }).eq('id', c.id);
      }
    }
    await fetchData();
    playSound.success();
    setHasVoted(true);
    setLoading(false);
    if (facultyVoterSession) {
      setFacultyVoterSession(null);
    }
  };

  return (
    <div>
      <div style={{marginBottom:32}}>
        <div className="flex items-center justify-between mb-3">
          <span className="section-title" style={{fontSize: 15}}>{isReview ? '✨ Review your ballot ✨' : `🏅 Position ${step + 1} of ${totalSteps}`}</span>
          <span className="badge badge-amber" style={{fontSize: 13}}>{activePositions.filter(p => sel[p]).length} / {totalSteps} chosen</span>
        </div>
        <div className="bar-bg" style={{height:18}}>
          <div className="bar-fill winner" style={{width:`${((isReview ? totalSteps : step) / totalSteps) * 100}%`,transition:'width 0.4s ease'}} />
        </div>
      </div>

      {!isReview ? (
        <div className={`card ${direction === 'next' ? 'slide-in-next' : 'slide-in-back'}`} key={`${currentPos}_${step}`}>
          <div className="flex justify-between items-center mb-4 pb-4" style={{ borderBottom: '3px dashed var(--border)' }}>
            <button className="btn" onClick={goBack} onMouseEnter={() => playSound.hover()}>← Back</button>
            <button className="btn primary" onClick={goNext} disabled={!sel[currentPos]} onMouseEnter={() => playSound.hover()}>
              {step === totalSteps - 1 ? 'Finish & Confirm →' : 'Next →'}
            </button>
          </div>

          <div style={{fontSize:24,fontWeight:800,marginBottom:6}}>🏅 Select {currentPos}</div>
          <div className="text-secondary mb-4" style={{fontSize:14}}>Choose one fantastic candidate for this role:</div>

          <div className="vote-grid">
            {currentCandidates.map(c => (
              <div key={c.id} className={`vote-tile ${sel[currentPos] === c.id ? 'selected' : ''}`} onClick={() => selectCandidate(c.id)} onMouseEnter={() => playSound.hover()}>
                <div className="vote-tile-photo-area">
                  {c.photo
                    ? <img src={c.photo} alt={c.name} crossOrigin="anonymous" />
                    : <span className="vote-tile-initials">{(c.name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</span>
                  }
                  {c.symbol && <div className="cand-symbol-badge">{c.symbol}</div>}
                </div>
                <div className="vote-tile-info">
                  <div className="cand-tile-name">{c.name}</div>
                  <div className="cand-tile-meta">✨ Grade {c.grade}</div>
                </div>
                <div className="vote-tile-action">🗳️ Tap to select</div>
                <div className="vote-tile-selected-strip">✅ Selected!</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`parallel-confirmation ${direction === 'next' ? 'slide-in-next' : 'slide-in-back'}`} key={`review_${step}`}>
          <div className="parallel-confirmation-title">Almost Done! 🎉</div>
          <div className="parallel-confirmation-subtitle">
            You are voting as <span style={{ color: 'var(--text)', fontWeight: 900 }}>{voter.name}</span><br />
            <span style={{ fontSize: '18px' }}>Grade {voter.standard} ({voter.division})</span>
          </div>

          <button 
            className="btn primary" 
            style={{ fontSize: '28px', padding: '24px 48px', borderRadius: '50px' }}
            onClick={submit} 
            disabled={loading} 
            onMouseEnter={() => playSound.hover()}
          >
            {loading ? 'Recording vote… 🗳️' : 'Confirm Vote 🚀'}
          </button>
        </div>
      )}
    </div>
  );
}
// ── RESULTS ──
function Results({ candidates, positions }) {
  const [viewMode, setViewMode] = useState('detailed'); // 'detailed' | 'winners'
  const detailRef  = useRef(null);
  const winnersRef = useRef(null);

  const getWinnersList = () =>
    positions
      .map(pos => {
        const list = candidates.filter(c => c.position === pos).sort((a,b) => b.votes - a.votes);
        if (!list.length) return null;
        const maxVotes = list[0].votes;
        const isTie = list.length > 1 && list[0].votes === list[1].votes;
        return { pos, list, winner: isTie ? null : list[0], isTie, maxVotes };
      })
      .filter(Boolean);

  // ── PNG Export (captures current visible view) ──
  const exportAsPng = () => {
    const el = viewMode === 'winners' ? winnersRef.current : detailRef.current;
    if (!el) return;
    
    playSound.preview();

    const options = {
      useCORS: true,
      allowTaint: false, // Prevents canvas tainting so toDataURL works!
      backgroundColor: '#F6F0F2',
      scale: 3, // 3x scale for ultra-crisp high-quality PNG
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.querySelector(
          viewMode === 'winners' ? '.results-winners-container' : '.results-detail-container'
        );
        if (clonedEl) {
          clonedEl.style.width = '1200px';
          clonedEl.style.maxWidth = '1200px';
          clonedEl.style.padding = '40px';
          clonedEl.style.margin = '0 auto';
          
          if (viewMode === 'winners') {
            const gridEl = clonedEl.querySelector('div[style*="grid"]');
            if (gridEl) {
              gridEl.style.gridTemplateColumns = 'repeat(4, 1fr)';
              gridEl.style.gap = '24px';
            }
          } else {
            clonedEl.style.display = 'grid';
            clonedEl.style.gridTemplateColumns = 'repeat(2, 1fr)';
            clonedEl.style.gap = '24px';
            
            const headerEl = clonedEl.querySelector('.detailed-header');
            if (headerEl) {
              headerEl.style.gridColumn = 'span 2';
              headerEl.style.marginBottom = '32px';
            }
          }
        }
      }
    };

    html2canvas(el, options)
      .then(canvas => {
        const link = document.createElement('a');
        link.download = `SV_Election_Results_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        playSound.success();
      })
      .catch(err => {
        console.error('Export PNG failed:', err);
      });
  };

  // ── CSV Export (full breakdown with split standard/division) ──
  const exportAsCSV = () => {
    const rows = [
      ['Position', 'Winner Name', 'Standard', 'Division', 'Winner Votes',
       '2nd Place', '2nd Votes', '3rd Place', '3rd Votes', 'Total Votes'],
    ];
    getWinnersList().forEach(({ pos, list, isTie }) => {
      const total = list.reduce((a, c) => a + c.votes, 0);
      const winnerParsed = isTie ? { standard: '—', division: '—' } : parseGrade(list[0]?.grade);
      rows.push([
        pos,
        isTie ? 'TIE' : (list[0] ? `${list[0].name}${list[0].symbol ? ` (${list[0].symbol})` : ''}` : '—'),
        winnerParsed.standard,
        winnerParsed.division,
        list[0]?.votes ?? 0,
        list[1] ? `${list[1].name}${list[1].symbol ? ` (${list[1].symbol})` : ''}` : '—',
        list[1]?.votes ?? '—',
        list[2] ? `${list[2].name}${list[2].symbol ? ` (${list[2].symbol})` : ''}` : '—',
        list[2]?.votes ?? '—',
        total,
      ]);
    });
    const csv = rows
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `SV_Election_Results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    playSound.success();
  };

  // ── PDF Export (browser print dialog) ──
  const exportAsPDF = () => {
    playSound.preview();
    window.print();
  };

  const winners = getWinnersList();

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 results-header-actions" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="page-title">✨ Election Results ✨</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '3px solid var(--text)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 3px 0 var(--text)' }}>
            <button
              style={{ padding: '7px 14px', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: viewMode === 'detailed' ? 'var(--primary)' : 'var(--surface)', border: 'none', borderRight: '3px solid var(--text)', transition: 'all 0.2s' }}
              onClick={() => setViewMode('detailed')} onMouseEnter={() => playSound.hover()}>📊 Detailed</button>
            <button
              style={{ padding: '7px 14px', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: viewMode === 'winners' ? 'var(--primary)' : 'var(--surface)', border: 'none', transition: 'all 0.2s' }}
              onClick={() => setViewMode('winners')} onMouseEnter={() => playSound.hover()}>🏆 Winners</button>
          </div>
          {/* Export buttons */}
          <button className="btn btn-sm" onClick={exportAsCSV} onMouseEnter={() => playSound.hover()} title="Download as spreadsheet (Excel/CSV)">
            <Download size={14} style={{ marginRight: 4 }} />📊 CSV
          </button>
          <button className="btn btn-sm" onClick={exportAsPDF} onMouseEnter={() => playSound.hover()} title="Print / Save as PDF">
            <Download size={14} style={{ marginRight: 4 }} />📄 PDF
          </button>
          <button className="btn primary btn-sm" onClick={exportAsPng} onMouseEnter={() => playSound.hover()} title="Download as image">
            <Download size={14} style={{ marginRight: 4 }} />📸 PNG
          </button>
        </div>
      </div>

      {/* ── Detailed bar-chart view ── */}
      {viewMode === 'detailed' && (
        <div ref={detailRef} className="results-detail-container" style={{ padding: '24px', borderRadius: '28px', background: '#F6F0F2' }}>
          {/* Branded school header for print/export quality */}
          <div className="detailed-header" style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo.png" alt="Serene Valley" style={{ width: 70, height: 70, objectFit: 'contain', marginBottom: 8 }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1D1B1C' }}>📊 Serene Valley — Election Results Breakdown 📊</div>
            <div style={{ fontSize: 13, color: '#5C5759', marginTop: 4 }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          {winners.map(({ pos, list, isTie, maxVotes }) => {
            const total = list.reduce((a,c) => a + c.votes, 0);
            return (
              <div key={pos} className="card mb-4" style={{ border: '4px solid #1D1B1C', background: '#FFFFFF', boxShadow: '0 8px 0 #1D1B1C', borderRadius: '28px', padding: '24px' }}>
                <div className="flex items-center justify-between mb-4">
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1D1B1C' }}>🏅 {pos}</span>
                  <span className="badge badge-amber" style={{ fontSize: 12, border: '2px solid #1D1B1C', background: '#FFF5E6', color: '#1D1B1C', borderRadius: '20px', padding: '6px 12px' }}>
                    {isTie ? '🤝 TIE' : `🏆 ${list[0].name} ${list[0].symbol || ''} · ${list[0].grade}`}
                  </span>
                </div>
                {list.map((c,i) => {
                  const isTiedWinner = c.votes === maxVotes;
                  return (
                    <div key={c.id} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar name={c.name} photo={c.photo} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: isTiedWinner ? 800 : 500, color: '#1D1B1C' }}>{c.name} {c.symbol ? `(${c.symbol})` : ''} {!isTie && i === 0 && '👑'}</div>
                          <div style={{ fontSize: 12, color: '#5C5759', fontWeight: 600 }}>✨ {c.grade}</div>
                        </div>
                        <span className="text-secondary" style={{ fontSize: 13, fontWeight: 700, color: '#5C5759' }}>{c.votes}v ({Math.round(c.votes/total*100||0)}%)</span>
                      </div>
                      <div className="bar-bg" style={{ height: 16, border: '3px solid #1D1B1C', background: 'rgba(29, 27, 28, 0.05)', borderRadius: '12px', overflow: 'hidden' }}><div className={`bar-fill ${isTiedWinner?'winner':''}`} style={{ width: `${c.votes/maxVotes*100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Winners Board grid ── */}
      {viewMode === 'winners' && (
        <div ref={winnersRef} className="results-winners-container" style={{ padding: '24px', borderRadius: '28px', background: '#F6F0F2' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo.png" alt="Serene Valley" style={{ width: 70, height: 70, objectFit: 'contain', marginBottom: 8 }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1D1B1C' }}>🏆 Serene Valley — Election Winners 🏆</div>
            <div style={{ fontSize: 13, color: '#5C5759', marginTop: 4 }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 20 }}>
            {winners.map(({ pos, winner, list, isTie, maxVotes }) => (
              <div key={pos} style={{ background: '#FFFFFF', border: '4px solid #1D1B1C', borderRadius: '28px', overflow: 'hidden', boxShadow: '0 8px 0 #1D1B1C', position: 'relative' }}>
                {/* Position header */}
                <div style={{ background: '#F6C504', padding: '10px 14px', borderBottom: '4px solid #1D1B1C', fontWeight: 800, fontSize: 12, color: '#1D1B1C', letterSpacing: '0.04em', textTransform: 'uppercase' }}>🏅 {pos}</div>
                {/* Winner photo / initials */}
                <div style={{ height: 260, background: '#FFF8D4', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '3px solid #1D1B1C', overflow: 'hidden', position: 'relative' }}>
                  {isTie ? (
                    <span style={{ fontSize: 64, fontWeight: 800 }}>🤝</span>
                  ) : winner.photo ? (
                    <img src={winner.photo} alt={winner.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom center' }} />
                  ) : (
                    <span style={{ fontSize: 64, fontWeight: 800 }}>👑</span>
                  )}
                  {!isTie && winner.symbol && <div className="cand-symbol-badge" style={{ width: 36, height: 36, fontSize: 18, top: 8, right: 8 }}>{winner.symbol}</div>}
                </div>
                {/* Winner details */}
                <div style={{ padding: '14px 14px 16px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#1D1B1C', lineHeight: 1.3 }}>{isTie ? "IT'S A TIE!" : winner.name}</div>
                  <div style={{ fontSize: 12, color: '#5C5759', marginTop: 4, fontWeight: 600 }}>✨ {isTie ? 'Multiple candidates tied' : winner.grade}</div>
                  <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F6C504', border: '2.5px solid #1D1B1C', borderRadius: 20, padding: '4px 14px', fontWeight: 800, fontSize: 13, color: '#1D1B1C' }}>
                    🗳️ {maxVotes} {maxVotes === 1 ? 'vote' : 'votes'}
                  </div>
                  {/* Runner-up */}
                  {!isTie && list[1] && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#5C5759', fontWeight: 600 }}>🥈 {list[1].name} {list[1].symbol || ''} · {list[1].votes}v</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Print-only layout (shown only when PDF print is triggered) ── */}
      <div className="print-results">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" style={{ width: 90, height: 90, objectFit: 'contain' }} alt="Serene Valley" />
          <h1 style={{ fontFamily: 'Arial, sans-serif', fontSize: 26, margin: '12px 0 4px' }}>Serene Valley — Election Results</h1>
          <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#555' }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F6C504' }}>
              {['Position', 'Winner', 'Standard', 'Division', 'Votes', '2nd Place', 'Votes', '3rd Place', 'Votes', 'Total'].map(h => (
                <th key={h} style={{ padding: '10px 12px', border: '2px solid #000', textAlign: 'left', fontWeight: 800 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {winners.map(({ pos, list, isTie }, idx) => {
              const total = list.reduce((a,c) => a + c.votes, 0);
              const winnerParsed = isTie ? { standard: '—', division: '—' } : parseGrade(list[0]?.grade);
              return (
                <tr key={pos} style={{ background: idx % 2 === 0 ? '#fff' : '#FFF8D4' }}>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc', fontWeight: 700 }}>{pos}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc', fontWeight: 800 }}>{isTie ? 'TIE' : (list[0] ? `${list[0].name}${list[0].symbol ? ` (${list[0].symbol})` : ''}` : '—')}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc', fontWeight: 700 }}>{winnerParsed.standard}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc' }}>{winnerParsed.division}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc', textAlign: 'center', fontWeight: 700 }}>{list[0]?.votes ?? 0}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc' }}>{list[1] ? `${list[1].name}${list[1].symbol ? ` (${list[1].symbol})` : ''}` : '—'}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc', textAlign: 'center' }}>{list[1]?.votes ?? '—'}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc' }}>{list[2] ? `${list[2].name}${list[2].symbol ? ` (${list[2].symbol})` : ''}` : '—'}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc', textAlign: 'center' }}>{list[2]?.votes ?? '—'}</td>
                  <td style={{ padding: '9px 12px', border: '1px solid #ccc', textAlign: 'center', fontWeight: 700 }}>{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#888', marginTop: 20, textAlign: 'center' }}>Generated by Serene Valley Election System · {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}

// ── ADMIN ──
function Admin({ adminLoggedIn, setAdminLoggedIn, electionActive, electionName, electionDate, positions, candidates, showToast, setHasVoted, fetchData, changeTab, facultyCount, setFacultyVoterSession, setVotedAdminNos }) {
  const [pwd, setPwd] = useState('');
  const [name, setName] = useState(electionName);
  const [date, setDate] = useState(electionDate);
  const [newPos, setNewPos] = useState('');
  const [cName, setCName] = useState(''); const [cGrade, setCGrade] = useState('');
  const [cPos, setCPos] = useState(''); const [cVotes, setCVotes] = useState(0);
  const [cPhoto, setCPhoto] = useState('');
  const [cSymbol, setCSymbol] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [facultyPhone, setFacultyPhone] = useState('');

  const launchFacultyVote = () => {
    if (!electionActive) {
      playSound.error();
      showToast('Voting is closed! Start the election first.');
      return;
    }
    if (!facultyName.trim() || !facultyPhone.trim()) {
      playSound.error();
      showToast('Please enter both name and phone number.');
      return;
    }
    playSound.success();
    setFacultyVoterSession({ name: facultyName.trim(), standard: 'Faculty', adminNo: facultyPhone.trim(), division: 'Staff' });
    setHasVoted(false);
    changeTab('vote');
  };

  if (!adminLoggedIn) return (
    <div className="empty" style={{minHeight:'50vh'}}>
      <div className="card" style={{width:'100%',maxWidth:400}}>
        <div style={{fontSize:22,fontWeight:800,marginBottom:20, textAlign: 'center'}}>🔒 Admin Security Sign In</div>
        <input type="password" className="input mb-3" placeholder="Enter Security Password" value={pwd} onChange={e => { setPwd(e.target.value); playSound.inputTick(); }}
          onKeyDown={async e => { 
            if(e.key==='Enter') { 
              if(pwd==='adminoflcsv'){
                playSound.success();
                await fetchData();
                setAdminLoggedIn(true);
                showToast('Welcome back, Admin!');
              } else {
                playSound.error();
                showToast('Wrong password! Please try again.');
              }
            } 
          }} />
        <button className="btn primary w-full" onMouseEnter={() => playSound.hover()} onClick={async () => { 
          if(pwd==='adminoflcsv'){
            playSound.success();
            await fetchData();
            setAdminLoggedIn(true);
            showToast('Welcome back, Admin!');
          } else {
            playSound.error();
            showToast('Wrong password! Please try again.');
          }
        }}>Sign In 🚀</button>
      </div>
    </div>
  );

  const save = async () => {
    const {error} = await supabase.from('settings').upsert({id:1,election_name:name,election_date:date,election_active:electionActive});
    if(error){playSound.error(); showToast('Error: '+error.message);return;}
    playSound.success();
    await fetchData(); showToast('Settings saved successfully!');
  };

  const toggle = async () => {
    const next = !electionActive;
    const {error} = await supabase.from('settings').upsert({id:1,election_active:next,election_name:electionName,election_date:electionDate});
    if(error){playSound.error(); showToast('Error: '+error.message);return;}
    if (next) {
      playSound.startElection();
    } else {
      playSound.stopElection();
    }
    if(!next) setHasVoted(false);
    await fetchData(); showToast(next ? 'Election started! 🟢' : 'Election stopped! 🔴');
  };

  const resetVoting = async () => {
    const confirmPhrase = prompt("⚠️ WARNING: This will permanently delete all votes and voter history! This action cannot be undone.\n\nTo confirm, type the exact phrase 'iagree':");
    if (confirmPhrase !== 'iagree') {
      playSound.error();
      showToast('Reset cancelled or incorrect phrase entered.');
      return;
    }
    
    try {
      const { error: ce } = await supabase.from('candidates').update({ votes: 0 }).gt('votes', -1);
      if (ce) {
        playSound.error();
        showToast('Error resetting candidates: ' + ce.message);
        return;
      }
      
      const { error: ve } = await supabase.from('voters').delete().not('roll_number', 'is', null);
      if (ve) {
        playSound.error();
        showToast('Error clearing voters: ' + ve.message);
        return;
      }
      
      // Also clear local device backup
      localStorage.removeItem('lc_sv_vote_backup');
      
      playSound.success();
      setHasVoted(false);
      setVotedAdminNos([]); // Instantly restore all student names in voting list
      await fetchData();
      showToast('All votes and voter records have been successfully reset! 🧹');
    } catch (err) {
      playSound.error();
      showToast('Reset failed: ' + err.message);
    }
  };

  const downloadLocalBackup = () => {
    playSound.select();
    const localLog = JSON.parse(localStorage.getItem('lc_sv_vote_backup') || '[]');
    if (localLog.length === 0) {
      showToast('No local votes saved on this device yet.');
      return;
    }
    
    const rows = [['Timestamp', 'Voter Name', 'Grade', 'Division', 'Selections']];
    localLog.forEach(v => {
      rows.push([
        v.timestamp,
        v.voterName,
        v.voterGrade,
        v.voterDivision,
        v.selections.join(' | ')
      ]);
    });
    
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Device_Backup_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Local backup downloaded! 💾');
  };

  const addPos = async () => {
    if(!newPos.trim()) return;
    const {error} = await supabase.from('positions').insert([{name:newPos.trim()}]);
    if(error){playSound.error(); showToast('Error: '+error.message);return;}
    playSound.success();
    setNewPos(''); await fetchData();
  };

  const delPos = async (p) => {
    const {error} = await supabase.from('positions').delete().eq('name',p);
    if(error){playSound.error(); showToast('Error: '+error.message);return;}
    playSound.delete();
    await fetchData();
  };

  const addCand = async () => {
    if(!cName.trim()){playSound.error(); showToast('Please enter candidate name!');return;}
    const pos = cPos || positions[0];
    if(!pos){playSound.error(); showToast('Select a position!');return;}
    const votesNum = parseInt(cVotes) || 0;
    const {error} = await supabase.from('candidates').insert([{name:cName,grade:cGrade,position:pos,promises:[],photo:cPhoto,votes:votesNum,symbol:cSymbol.trim()||null}]);
    if(error){playSound.error(); showToast('Error: '+error.message);return;}
    playSound.success();
    setCName('');setCGrade('');setCPos('');setCVotes(0);setCPhoto('');setCSymbol('');
    await fetchData(); showToast('Candidate added successfully! ✨');
  };

  const delCand = async (id) => {
    const {error} = await supabase.from('candidates').delete().eq('id',id);
    if(error){playSound.error(); showToast('Error: '+error.message);return;}
    playSound.delete();
    await fetchData();
  };

  const uploadPhoto = (e) => {
    const f = e.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
      playSound.select();
      setCPhoto(ev.target.result);
    };
    r.readAsDataURL(f);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="page-title">⚙️ Admin Control Panel</div>
        <div style={{display:'flex', gap:'8px'}}>
          <button className="btn primary btn-sm" onMouseEnter={() => playSound.hover()} onClick={() => { playSound.tabClick(); changeTab('results'); }}>📊 View Election Results</button>
          <button className="btn danger btn-sm" onMouseEnter={() => playSound.hover()} onClick={() => { playSound.tabClick(); setAdminLoggedIn(false); }}><LogOut size={14}/> Sign Out</button>
        </div>
      </div>

      {/* Settings */}
      <div className="card mb-4">
        <div className="section-title mb-3" style={{fontSize: 14}}>🏫 Election Settings</div>
        <div className="form-row"><label className="form-label">Election Name</label><input className="input" value={name} onChange={e=>{setName(e.target.value); playSound.inputTick();}}/></div>
        <div className="form-row"><label className="form-label">Election Date</label><input type="date" className="input" value={date} onChange={e=>{setDate(e.target.value); playSound.inputTick();}}/></div>
        <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={save} onMouseEnter={() => playSound.hover()}>Save Settings</button>
          <button className="btn danger" onClick={toggle} onMouseEnter={() => playSound.hover()}>{electionActive?'Stop Election 🔴':'Start Election 🟢'}</button>
          <button className="btn" onClick={downloadLocalBackup} onMouseEnter={() => playSound.hover()} style={{ background: '#FFF8D4', color: '#1D1B1C', border: '2px solid #1D1B1C', fontWeight: 800 }}>💾 Download Device Backup (CSV)</button>
          <button className="btn danger" onClick={resetVoting} onMouseEnter={() => playSound.hover()} style={{ background: '#FF5A5A', color: '#FFFFFF' }}>Reset Voting Data 🧹</button>
        </div>
      </div>

      {/* Faculty Portal */}
      <div className="card mb-4" style={{ background: '#FFF8D4', border: '4px solid #F6C504' }}>
        <div className="flex justify-between items-center mb-3">
          <div className="section-title" style={{fontSize: 14}}>🧑‍🏫 Faculty Voting Portal</div>
          <div className="badge badge-amber" style={{fontSize: 12}}>Total Faculty Votes: {facultyCount}</div>
        </div>
        <div className="flex gap-3 mb-3">
          <input className="input" placeholder="Faculty Name" value={facultyName} onChange={e => { setFacultyName(e.target.value); playSound.inputTick(); }} />
          <input className="input" placeholder="Phone Number" value={facultyPhone} onChange={e => { setFacultyPhone(e.target.value); playSound.inputTick(); }} />
        </div>
        <button className="btn primary w-full" onClick={launchFacultyVote} onMouseEnter={() => playSound.hover()}>Launch Faculty Vote 🚀</button>
      </div>

      {/* Positions */}
      <div className="card mb-4">
        <div className="section-title mb-3" style={{fontSize: 14}}>🏆 Manage Positions</div>
        <div className="flex gap-3 mb-4">
          <input className="input" placeholder="Enter New Position Title" value={newPos} onChange={e=>{setNewPos(e.target.value); playSound.inputTick();}} onKeyDown={e=>e.key==='Enter'&&addPos()}/>
          <button className="btn primary" onClick={addPos} onMouseEnter={() => playSound.hover()}>Add</button>
        </div>
        {positions.map(p => (
          <div key={p} className="flex items-center justify-between" style={{padding:'10px 14px',borderBottom:'3px dashed var(--border)', background: 'rgba(29, 27, 28, 0.02)', borderRadius: '12px', marginBottom: '8px', border: '3px solid var(--text)'}}>
            <span style={{fontSize:14, fontWeight: 700}}>🏅 {p}</span>
            <button className="btn danger btn-sm" onClick={()=>delPos(p)} onMouseEnter={() => playSound.hover()}><Trash2 size={13}/></button>
          </div>
        ))}
      </div>

      {/* Add candidate */}
      <div className="card mb-4">
        <div className="section-title mb-3" style={{fontSize: 14}}>👤 Add New Candidate</div>
        <div className="flex gap-3 mb-4 items-center">
          <label className="photo-upload" onMouseEnter={() => playSound.hover()}>
            <input type="file" style={{display:'none'}} accept="image/*" onChange={uploadPhoto}/>
            {cPhoto ? <img src={cPhoto} alt="preview"/> : <div style={{textAlign: 'center', fontSize: 11, color: 'var(--text)'}}>📷 Add Photo</div>}
          </label>
          <div className="flex-col gap-2 flex-1">
            <input className="input" placeholder="Name" value={cName} onChange={e=>{setCName(e.target.value); playSound.inputTick();}}/>
            <div className="flex gap-2 mb-2">
              <select className="input" value={cPos} onChange={e=>{setCPos(e.target.value); playSound.select();}} onMouseEnter={() => playSound.hover()}>
                <option value="" disabled>Select Role</option>
                {positions.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <input className="input" placeholder="Grade" value={cGrade} onChange={e=>{setCGrade(e.target.value); playSound.inputTick();}}/>
              <input type="number" className="input" style={{width: '90px'}} placeholder="Votes" min="0" value={cVotes} onChange={e=>{setCVotes(e.target.value); playSound.inputTick();}}/>
            </div>
            <div className="flex gap-2 items-center">
              <input className="input" placeholder="Voting Symbol (Emoji / Icon)" value={cSymbol} onChange={e=>{setCSymbol(e.target.value); playSound.inputTick();}} style={{ flex: 1 }}/>
              <div className="flex gap-1" style={{ flexWrap: 'wrap', maxWidth: '300px' }}>
                {['🦁', '🐯', '🦅', '🦈', '⚽', '🏀', '🎨', '🎵', '🌟', '🍀'].map(sym => (
                  <button key={sym} type="button" className="btn btn-sm" style={{ padding: '4px 8px', minWidth: '32px', transform: 'none', boxShadow: 'none' }} onClick={() => { playSound.select(); setCSymbol(sym); }}>
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <button className="btn primary w-full" onClick={addCand} onMouseEnter={() => playSound.hover()}>Create Candidate 👤</button>
      </div>

      {/* Manage */}
      <div className="card">
        <div className="section-title mb-3" style={{fontSize: 14}}>📋 Candidate Roster</div>
        <table className="table">
          <thead><tr><th>Name</th><th style={{textAlign: 'center'}}>Symbol</th><th>Role</th><th>Grade</th><th>Votes</th><th>Actions</th></tr></thead>
          <tbody>
            {candidates.map(c => (
              <tr key={c.id}>
                <td><div className="flex items-center gap-2" style={{fontWeight: 700}}><Avatar name={c.name} photo={c.photo}/>{c.name}</div></td>
                <td style={{textAlign: 'center'}}><span style={{fontSize: 20}}>{c.symbol || '—'}</span></td>
                <td><span className="badge badge-green" style={{background: 'var(--primary-light)', color: 'var(--text)', border: '2px solid var(--text)'}}>{c.position}</span></td>
                <td className="text-secondary" style={{fontWeight: 700}}>{c.grade}</td>
                <td style={{fontWeight: 800}}>{c.votes}</td>
                <td><button className="btn danger btn-sm" onClick={()=>delCand(c.id)} onMouseEnter={() => playSound.hover()}><Trash2 size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── AVATAR ──
function Avatar({ name, photo, lg, xl }) {
  const initials = (name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  const cls = `avatar ${lg?'avatar-lg':''} ${xl?'avatar-xl':''}`;
  if (photo) return <div className={cls}><img src={photo} alt={name} crossOrigin="anonymous"/></div>;
  return <div className={cls}>{initials}</div>;
}
