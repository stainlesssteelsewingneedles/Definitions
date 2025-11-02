// ---------- Config ----------
const API_ENDPOINT = "https://YOUR-WORKER-OR-FUNCTION-URL.example.com/api/judge";
const WORDLIST_FILE = "wordlist.txt";

// SRS defaults (SM-2 style)
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

// Fast mode uses minutes instead of days (handy for testing)
const isFastMode = () => document.getElementById('fastMode').checked;

// ---------- State ----------
let words = [];               // ["boy","bat",...]
let srs = loadSrs();          // { [word]: { reps, ease, interval, dueISO, history:[] } }
let current = null;

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', async () => {
  await loadWordlist();
  wireUi();
  nextCard();
});

function wireUi() {
  document.getElementById('answerForm').addEventListener('submit', onSubmit);
  document.getElementById('skipBtn').addEventListener('click', () => { nextCard(true); });
  document.getElementById('showBtn').addEventListener('click', showHint);
  document.getElementById('exportBtn').addEventListener('click', exportProgress);
  document.getElementById('importBtn').addEventListener('click', importProgress);
  document.getElementById('fastMode').addEventListener('change', updateMeta);
}

async function loadWordlist() {
  const text = await fetch(WORDLIST_FILE).then(r => r.text());
  words = text.split(/[,\n]/).map(w => w.trim()).filter(Boolean);
  // ensure SRS objects exist
  for (const w of words) if (!srs[w]) srs[w] = freshCard();
  saveSrs();
}

// ---------- SRS helpers ----------
function freshCard() {
  return { reps: 0, ease: DEFAULT_EASE, interval: 0, dueISO: new Date().toISOString(), history: [] };
}
function daysFromNow(d) {
  if (isFastMode()) {
    const t = new Date(); t.setMinutes(t.getMinutes() + Math.max(1, Math.round(d))); return t;
  }
  const t = new Date(); t.setDate(t.getDate() + Math.max(1, Math.round(d))); return t;
}
function dueDateFromISO(iso) { return new Date(iso); }
function formatWhen(iso) {
  const d = new Date(iso); return isFastMode() ? `${Math.round((d - Date.now())/60000)} min` : d.toLocaleDateString();
}
function pickNext() {
  const now = Date.now();
  // Prioritize due, then least reviewed
  const sorted = words.slice().sort((a,b) => {
    const A = srs[a], B = srs[b];
    const da = new Date(A.dueISO).getTime() - now;
    const db = new Date(B.dueISO).getTime() - now;
    if ((da <= 0) !== (db <= 0)) return (da <= 0) ? -1 : 1;
    if (A.reps !== B.reps) return A.reps - B.reps;
    return (A.interval||0) - (B.interval||0);
  });
  return sorted[0];
}
function applySm2(state, quality) {
  // quality: 0..5
  const q = Math.max(0, Math.min(5, quality));
  // ease update
  state.ease = state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (state.ease < MIN_EASE) state.ease = MIN_EASE;

  if (q < 3) {
    state.reps = 0;
    state.interval = isFastMode() ? 0.05 : 1; // 3 minutes in fast mode, else 1 day
  } else {
    state.reps += 1;
    if (state.reps === 1) state.interval = isFastMode() ? 0.2 : 1;        // ~12 min or 1 day
    else if (state.reps === 2) state.interval = isFastMode() ? 1 : 6;     // ~1 hour or 6 days
    else state.interval = state.interval * state.ease;
  }
  state.dueISO = daysFromNow(state.interval).toISOString();
}

// ---------- Storage ----------
function loadSrs() {
  try { return JSON.parse(localStorage.getItem('vocab-srs') || '{}'); }
  catch { return {}; }
}
function saveSrs() {
  localStorage.setItem('vocab-srs', JSON.stringify(srs));
}

// ---------- UI logic ----------
function updateMeta() {
  const due = Object.values(srs).filter(x => new Date(x.dueISO).getTime() <= Date.now()).length;
  document.getElementById('dueInfo').textContent = `Due now: ${due}`;
  const nextDueIn = Math.min(...Object.values(srs).map(x => new Date(x.dueISO).getTime())) - Date.now();
  const mins = Math.max(0, Math.round(nextDueIn/60000));
  document.getElementById('queueInfo').textContent = `Next due in: ${mins} min`;
}

function setWord(w) {
  document.getElementById('word').textContent = w;
  document.getElementById('definition').value = '';
  document.getElementById('definition').focus();
  document.getElementById('feedback').className = 'feedback';
  document.getElementById('feedback').textContent = '';
  updateMeta();
}

function nextCard(skipped=false) {
  current = pickNext();
  if (!current) return;
  if (skipped) {
    // small nudge forward so skip doesn't immediately re-show
    const st = srs[current];
    st.dueISO = daysFromNow(isFastMode()? 0.2 : 0.5).toISOString();
    saveSrs();
  }
  setWord(current);
}

function showHint() {
  const fb = document.getElementById('feedback');
  fb.className = 'feedback warn';
  fb.textContent = 'Think of a concise, dictionary-style definition. Examples are not required.';
}

// ---------- Submit / Grade ----------
async function onSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('definition').value.trim();
  if (!input) return;

  const word = current;
  const fb = document.getElementById('feedback');
  fb.className = 'feedback'; fb.textContent = 'Grading…';

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, userDefinition: input })
    });
    if (!res.ok) throw new Error('Grader error');
    const { score, correct, explanation } = await res.json();

    const st = srs[word] || freshCard();
    st.history.push({ t: new Date().toISOString(), input, score });
    applySm2(st, score);
    srs[word] = st; saveSrs();

    fb.className = 'feedback ' + (score >= 4 ? 'ok' : score >= 2 ? 'warn' : 'bad');
    fb.textContent = `Score ${score}/5 — ${correct ? '✅ Close/correct.' : '❌ Needs work.'} ${explanation}`;

  } catch (err) {
    fb.className = 'feedback bad';
    fb.textContent = 'Could not grade. Check your grading endpoint.';
  } finally {
    // Auto-advance after a short pause
    setTimeout(() => nextCard(false), 900);
  }
}

// ---------- Import/Export ----------
function exportProgress() {
  const blob = new Blob([JSON.stringify(srs, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vocab-progress.json';
  document.body.appendChild(a); a.click(); a.remove();
}
function importProgress() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json';
  inp.onchange = () => {
    const file = inp.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => { srs = JSON.parse(r.result); saveSrs(); nextCard(false); };
    r.readAsText(file);
  };
  inp.click();
}
