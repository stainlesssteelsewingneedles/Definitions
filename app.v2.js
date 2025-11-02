// ---------- Version banner ----------
console.log("Vocab Drill v2 — built:", new Date().toISOString());

// ---------- Config ----------
const PPQ_API_URL = "https://api.ppq.ai/chat/completions";
const PPQ_API_KEY = "sk-o847o1lAOeICRqfNP5OxUg";
const WORDLIST_FILE = "wordlist.txt";
const MODEL = "gpt-5-nano";

// SRS defaults (SM-2 style)
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

// Fast mode uses minutes instead of days (handy for testing)
const isFastMode = () => document.getElementById('fastMode')?.checked;

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

function byId(id){ return document.getElementById(id); }
function on(el, ev, fn){ if (el) el.addEventListener(ev, fn); }

// ---------- Wiring ----------
function wireUi() {
  const missing = [];
  for (const id of ['answerForm','skipBtn','revealBtn','nextBtn','exportBtn','importBtn','fastMode']) {
    if (!byId(id)) missing.push(id);
  }
  if (missing.length) {
    console.error("Missing elements in HTML:", missing);
    const fb = byId('feedback');
    if (fb) {
      fb.className = 'feedback bad';
      fb.textContent = `Error: Missing elements: ${missing.join(', ')}. Update index.html to include the buttons.`;
    }
  }

  on(byId('answerForm'), 'submit', onSubmit);
  on(byId('skipBtn'), 'click', () => nextCard(true));
  on(byId('revealBtn'), 'click', onReveal);
  on(byId('nextBtn'), 'click', () => nextCard(false));
  on(byId('exportBtn'), 'click', exportProgress);
  on(byId('importBtn'), 'click', importProgress);
  on(byId('fastMode'), 'change', updateMeta);
}

async function loadWordlist() {
  const text = await fetch(WORDLIST_FILE).then(r => r.text());
  words = text.split(/[,\n]/).map(w => w.trim()).filter(Boolean);
  for (const w of words) if (!srs[w]) srs[w] = freshCard();
  saveSrs();
}

// ---------- SRS helpers ----------
function freshCard() {
  return { reps: 0, ease: DEFAULT_EASE, interval: 0, dueISO: new Date().toISOString(), history: [] };
}
function daysFromNow(d) {
  const t = new Date();
  if (isFastMode()) t.setMinutes(t.getMinutes() + Math.max(1, Math.round(d)));
  else t.setDate(t.getDate() + Math.max(1, Math.round(d)));
  return t;
}
function pickNext() {
  const now = Date.now();
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
  const q = Math.max(0, Math.min(5, quality));
  state.ease = state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (state.ease < MIN_EASE) state.ease = MIN_EASE;

  if (q < 3) {
    state.reps = 0;
    state.interval = isFastMode() ? 0.05 : 1;
  } else {
    state.reps += 1;
    if (state.reps === 1) state.interval = isFastMode() ? 0.2 : 1;
    else if (state.reps === 2) state.interval = isFastMode() ? 1 : 6;
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

// ---------- UI ----------
function updateMeta() {
  const due = Object.values(srs).filter(x => new Date(x.dueISO).getTime() <= Date.now()).length;
  byId('dueInfo').textContent = `Due now: ${due}`;
  const nextDueIn = Math.min(...Object.values(srs).map(x => new Date(x.dueISO).getTime())) - Date.now();
  const mins = Math.max(0, Math.round(nextDueIn/60000));
  byId('queueInfo').textContent = `Next due in: ${mins} min`;
}

function setWord(w) {
  byId('word').textContent = w;
  byId('definition').value = '';
  byId('definition').focus();
  setFeedback('', '');
  setCanonical('');
  updateMeta();
}

function nextCard(skipped = false) {
  // IMPORTANT: if skipping, push the CURRENT word forward before picking a new one
  if (skipped && current) {
    const st = srs[current] || freshCard();
    st.dueISO = daysFromNow(isFastMode() ? 0.2 : 0.5).toISOString();
    srs[current] = st; saveSrs();
  }
  const next = pickNext();
  if (!next) return;
  current = next;
  setWord(current);
}

function setFeedback(text, cls='') {
  const fb = byId('feedback');
  fb.className = 'feedback' + (cls ? ' ' + cls : '');
  fb.textContent = text;
}
function setCanonical(text) {
  const el = byId('canon');
  el.className = 'feedback';
  el.textContent = text;
}

// ---------- PPQ helpers ----------
async function ppqChat(messages, temperature=0.1) {
  const res = await fetch(PPQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${PPQ_API_KEY}`
    },
    body: JSON.stringify({ model: MODEL, temperature, messages })
  });
  if (!res.ok) {
    const text = await res.text().catch(()=>"");
    throw new Error(`PPQ error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}

async function gradeWithPPQ(word, userDefinition) {
  const system = `You are a concise grader for ENGLISH dictionary-style definitions.
Score the user's definition of a given word from 0-5:
0=totally wrong or off-topic;
1=very incomplete or misleading;
2=partially correct but missing key idea;
3=mostly correct with minor gaps;
4=correct with good phrasing;
5=fully correct, crisp dictionary-level definition.
Return ONLY strict JSON: {"score":n,"correct":bool,"explanation":"short sentence"}.`;

  const user = `Word: "${word}"
User definition: "${userDefinition}"
Respond with JSON only.`;

  const text = await ppqChat(
    [{ role: "system", content: system }, { role: "user", content: user }],
    0.1
  );

  let parsed;
  try { parsed = JSON.parse(text); }
  catch { parsed = { score: 0, correct: false, explanation: "Could not parse model output." }; }

  const score = Math.max(0, Math.min(5, Number(parsed.score ?? 0)));
  const correct = Boolean(parsed.correct ?? (score >= 4));
  const explanation = String(parsed.explanation ?? "").slice(0, 200);

  return { score, correct, explanation };
}

async function fetchCanonicalDefinition(word) {
  const system = `You produce authoritative, one-sentence dictionary-style definitions (no examples, no synonyms, no extra lines).`;
  const user = `Give a single-sentence definition of "${word}" in clear, plain English. Limit to ~12–20 words.`;
  return await ppqChat(
    [{ role: "system", content: system }, { role: "user", content: user }],
    0
  );
}

// ---------- Submit / Grade ----------
async function onSubmit(e) {
  e.preventDefault();

  // extra hard stop against any accidental double submit/advance
  if (!current) return;

  const input = byId('definition').value.trim();
  if (!input) return;

  setFeedback('Grading…');

  try {
    const { score, correct, explanation } = await gradeWithPPQ(current, input);

    const st = srs[current] || freshCard();
    st.history.push({ t: new Date().toISOString(), input, score });
    applySm2(st, score);
    srs[current] = st; saveSrs();

    const cls = (score >= 4 ? 'ok' : score >= 2 ? 'warn' : 'bad');
    setFeedback(`Score ${score}/5 — ${correct ? '✅ Close/correct.' : '❌ Needs work.'} ${explanation}`, cls);
    // NO auto-advance here — user must click Next or Skip
  } catch (err) {
    setFeedback('Could not grade. ' + (err?.message || 'Check your API call.'), 'bad');
  }
}

// ---------- Reveal canonical ----------
async function onReveal() {
  if (!current) return;
  setCanonical('Fetching canonical definition…');
  try {
    const def = await fetchCanonicalDefinition(current);
    setCanonical(`Canonical: ${def}`);
  } catch (err) {
    setCanonical('Could not fetch canonical definition.');
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
