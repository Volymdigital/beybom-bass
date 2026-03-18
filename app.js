// ═══════════════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════════════
const KEYS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
// Flat → sharp mapping for normalization
const FLAT_TO_SHARP = { 'Db':'C#', 'Eb':'D#', 'Fb':'E', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#', 'Cb':'B' };
// Preferred display: when to show flat vs sharp
const SHARP_TO_FLAT = { 'C#':'Db', 'D#':'Eb', 'G#':'Ab', 'A#':'Bb' };

function normalizeRoot(root) {
  return FLAT_TO_SHARP[root] || root;
}

// Prefer flats for display (musician convention)
function displayRoot(sharpRoot) {
  return SHARP_TO_FLAT[sharpRoot] || sharpRoot;
}

// Turn type enum
const TURN_TYPES = ['play','rest','warn','stop'];

function makeTurn(chords, instruction, bars, type) {
  const b = parseInt(bars) || 4;
  // chords: always array of length=bars, one chord string per slot ('' = empty)
  let slots;
  if (Array.isArray(chords)) {
    // Already array — pad/trim to bars length
    slots = Array.from({length: b}, (_, i) => (chords[i] || ''));
  } else if (typeof chords === 'string' && chords.trim()) {
    // Migrate string → split on space, fill slots left-to-right
    const tokens = chords.trim().split(/\s+/).filter(Boolean);
    slots = Array.from({length: b}, (_, i) => (tokens[i] || ''));
  } else {
    slots = Array(b).fill('');
  }
  return {
    id: Date.now() + Math.random(),
    chords: slots,
    instruction: instruction || '',
    bars: b,
    type: type || 'play'
  };
}

// Ensure turn.chords is array aligned to turn.bars
function normalizeTurn(turn) {
  const b = parseInt(turn.bars) || 4;
  if (!Array.isArray(turn.chords)) {
    turn.chords = makeTurn(turn.chords || '', '', b, turn.type).chords;
  }
  // Resize array if bars changed
  if (turn.chords.length !== b) {
    turn.chords = Array.from({length: b}, (_, i) => (turn.chords[i] || ''));
  }
  turn.bars = b;
  return turn;
}

function makeSection(name, turns) {
  return {
    id: Date.now() + Math.random(),
    name: name || 'SEKTION',
    turns: turns || []
  };
}

// ─── Parse legacy parseInstructions format into sections with turns ───
function parseLegacySections(rawSections, chordRaw) {
  if (!rawSections || rawSections.length === 0) return [];
  return rawSections.map(sec => {
    const chords = getChordsForSectionName(sec.name, chordRaw);
    let type = 'play';
    if (sec.type === 'rest') type = 'rest';
    else if (sec.type === 'warn') type = 'warn';
    else if (sec.type === 'danger') type = 'stop';
    const instr = sec.instruction || '';
    return makeSection(sec.name, [makeTurn(chords, instr, 4, type)]);
  });
}

// General-purpose chord detection regex — covers:
// Roots: A-G with optional # or b (e.g. C, C#, Bb, F#)
// Quality chain: m, maj, min, dim, aug, sus, add + chained modifiers
//   Handles: Am7, Cmaj7, Gsus4, Am7b5, Dmadd4, Cmaj7#11, Bbm7, etc.
// Slash bass: /C, /F#, /Bb (e.g. C/G, D/F#, Am/E)
const CHORD_RE = /^[A-G][#b]?(?:m(?:aj|in)?|maj|dim|aug|sus|add)?(?:(?:add|sus|dim|aug)?[#b]?\d+)*(?:\/[A-G][#b]?)?$/;

function isChordToken(w) {
  return CHORD_RE.test(w);
}

function getChordsForSectionName(sectionName, chordRaw) {
  if (!chordRaw || !sectionName) return '';
  const name = sectionName.toLowerCase().replace(/\s+\d+$/, '').trim();
  const lines = chordRaw.split('\n');
  let inSection = false;
  let result = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^(\[.*\]|##.*)$/.test(t)) {
      const lbl = t.replace(/[\[\]#]/g,'').trim().toLowerCase();
      inSection = lbl === name || lbl.startsWith(name);
      continue;
    }
    if (inSection && t) {
      const words = t.split(/\s+/);
      const cc = words.filter(w => isChordToken(w)).length;
      if (cc >= words.length * 0.5) {
        result.push(t);
        if (result.length >= 1) break;
      }
    }
  }
  return result.join(' ');
}

// ─── Legacy parseInstructions (for DEFAULT_SONGS) ───
function parseInstructions(raw) {
  if (!raw) return [];
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
  return lines.map(line => {
    const lower = line.toLowerCase();
    let type = 'play';
    if (lower.includes('ingen bas') || lower.includes('ingen bass') || lower.includes('tyst') || lower.includes('inget')) type = 'rest';
    else if (lower.includes('obs') || lower.includes('öva') || lower.includes('varning') || lower.includes('höjning') || lower.includes('annorlunda') || lower.includes('prickar')) type = 'warn';
    else if (lower.includes('stopp') || lower.includes('stop') || lower.includes('slut')) type = 'danger';
    const parts = line.split(/—|-/);
    const name = parts[0].trim();
    const instr = parts.slice(1).join(' — ').trim();
    return { id: Date.now() + Math.random(), name, type, instruction: instr, bars: '' };
  });
}


// ─── DEFAULT SONGS (all chordRaw preserved) ───
const DEFAULT_SONGS = [
  { title: 'Händerna mot himlen', artist: 'Petra Marklund', key: 'Bb', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse]\nBb C F Gm\nBb C Dm Gm\n\n[Chorus]\nBb C F Bb\nBb C F Dm`,
    legacySections: parseInstructions('Verser — Ingen bas\nChorus — Pump') },
  { title: 'Gimme! Gimme! Gimme!', artist: 'Molly Sandén', key: 'Am', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro/Verse]\nAm G Am G\n\n[Chorus]\nAm F C G\nAm F C G`,
    legacySections: parseInstructions('Intro — Ingen bas\nVerse — Off beat staccato bas\nPrechorus — Staccato\nChorus — Staccato\nM8 — Slapping på en ton (kort)') },
  { title: 'Proud Mary', artist: 'Tina Turner', key: 'D', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro]\nC A / C A G F / D\n\n[Verse]\nD D D D\n\n[Pre-Chorus]\nA Bm G\n\n[Chorus]\nD D D D`,
    legacySections: parseInstructions('Intro — Lugnt i början\nVerse — Snabb pump\nChorus — Basklättring (öva)') },
  { title: 'I Love It', artist: 'Icona Pop, Charli XCX', key: 'Ab', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse/Hook]\nAb Ab Db Db\nAb Ab Db Db\n\n[Chorus]\nAb Db Ab Db`,
    legacySections: parseInstructions('Intro chorus — Ingen bas\nChorus — Pump\nPre — Ingen bas\nM8 — Ingen bas') },
  { title: 'Shut Up and Dance', artist: 'WALK THE MOON', key: 'Db', keyOffset: 0, bpm: '', notes: 'Utan tracks', tracksMode: 'auto',
    chordRaw: `[Verse]\nDb F# Bbm Ab\nDb F# Bbm Ab\n\n[Pre-Chorus]\nF# Bbm / F# Ab\n\n[Chorus]\nDb F# Bbm Ab`,
    legacySections: parseInstructions('Intro — Pump hög oktav (en ton)\nVerse — Staccato\nPrechorus — Staccato markeringar\nChorus — Pump + markeringar\nM8 — Annorlunda ackord + Chorus + Intro (hög pumpbas) + Chorus\nSlut — Slutmarkeringar (sista 5st)') },
  { title: 'Slå mig hårt i ansiktet', artist: 'Thomas Stenström', key: 'C#', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse]\nC# F# C# G#\n\n[Pre-Chorus / Bridge]\nF# G# C# Bbm`,
    legacySections: parseInstructions('Verse 1 — Ingen bas\nVerse 2 — Bas\nChorus — Bass\nStopp — Sedan vers 2\nM8 — Hög pedalton') },
  { title: 'Teenage Dirtbag', artist: 'Wheatus', key: 'E', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro/Verse]\nE B E A\n\n[Pre-Chorus]\nC#m A B\n\n[Chorus]\nE A B C#m`,
    legacySections: parseInstructions('Intro — Trumintro\nVerse — Bass staccato') },
  { title: 'Sex on Fire', artist: 'Kings of Leon', key: 'E', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro]\nE C#m\n\n[Verse]\nE C#m A\n\n[Pre-Chorus]\nE Emaj7 C#m A\n\n[Chorus]\nE C#m A`,
    legacySections: parseInstructions('Intro — 4 takter tyst\nVerse — Staccato\nPrechorus — Pump\nChorus — Pump\nM8 — Staccato') },
  { title: 'Ramlar', artist: 'Håkan Hellström', key: 'C', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro]\nC Em F G\n\n[Verse]\nC Em F G\nC C/B F/A G\n\n[Chorus]\nF G F G`,
    legacySections: [] },
  { title: "Look Who's Laughing", artist: 'Benjamin Ingrosso', key: 'F', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro/Verse]\nF F Bb Bb\nF F Eb Bb\n\n[Chorus]\nF Bb Eb F\nF Bb Eb F`,
    legacySections: parseInstructions('Intro — Markeringar\nVerse — Pump\nChorus — Markeringar / Pump\nPrechorus — Markering andra toner\nM8 — Ingen bas (diffust)') },
  { title: 'Let Me Entertain You', artist: 'Robbie Williams', key: 'F', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro/Verse]\nF Ab Bb F\n\n[Chorus]\nF Ab Bb F`,
    legacySections: parseInstructions('Intro — Tyst\nChorus — Spela') },
  { title: 'Kan Inte Gå', artist: 'Bolaget', key: 'Bm', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse]\nBm G A D\nBm G A D\n\n[Pre-Chorus]\nBm G A D A Bm\n\n[Chorus]\nBm G A D\nBm G A D`,
    legacySections: [] },
  { title: 'Take Me Home, Country Roads', artist: 'John Denver', key: 'G', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse]\nG G Em D\nG G Em D G\n\n[Chorus]\nG D Em C\nG D C G`,
    legacySections: [] },
  { title: '(Du är så) Yeah Yeah', artist: 'Martin', key: 'C', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro/Verse]\nC G C G\nC G C G\n\n[Chorus]\nG D Em C\nG D C G`,
    legacySections: parseInstructions('Intro — Prickar direkt\nVerse — Bara bass') },
  { title: 'Kung för en dag', artist: 'Magnus Uggla', key: 'G', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro]\nC D G G\n\n[Verse]\nG C / G Em D\nG C / G Em B\n\n[Pre-Chorus]\nC Am D\n\n[Chorus]\nG C G C\nB Em C Am D\nG C G C\nB Em C D G`,
    legacySections: parseInstructions('Intro — Ingen bass\nVerse — Spela (obs upp på chorus)\nChorus — Spela\nM8 — Kvart upp\nChorus — Spela') },
  { title: 'Genom Eld & Vatten', artist: 'Sarek', key: 'C', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse]\nC G F C\nG F / G F\nC G / Em C D\n\n[Chorus]\nC G F G C\nAm G F Am G\nC G F G C`,
    legacySections: parseInstructions('Intro — Ingen bas\nVerse — Bas direkt offbeat\nPre — Offbeat\nChorus — Offbeat\nMellanspel — Ingen bas\nPre — Offbeat\nChorus — Offbeat\nMellanspel — Ingen bas') },
  { title: "I'm Gonna Be (500 Miles)", artist: 'The Proclaimers', key: 'E', keyOffset: 0, bpm: '', notes: 'Utan', tracksMode: 'auto',
    chordRaw: `[Verse]\nE E A B E\n\n[Chorus]\nE A B E\nE A B E\n\n[Da-da]\nE A B E`,
    legacySections: parseInstructions('Verse 1 — Ingen bas\nVerse 2 — Prickar\nChorus — Four on the floor\nVerse 3 — Spela') },
  { title: 'När vindarna viskar mitt namn', artist: 'Roger Pontare', key: 'Gm', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse]\nGm F Gm F\nGm F Gm F D\n\n[Pre-Chorus / Bridge]\nGm F Bb F Eb\nGm F D\n\n[Chorus]\nGm F Eb F\nGm F Eb F Gm`,
    legacySections: parseInstructions('Intro — Spela\nVerse — Shuffle bass') },
  { title: 'Angels', artist: 'Robbie Williams', key: 'G', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse]\nG D/F# Em C\nG D\n\n[Pre-Chorus]\nC D G Em\nC D\n\n[Chorus]\nG Em C D\nG Em C D G`,
    legacySections: [] },
  { title: "What's Up?", artist: '4 Non Blondes', key: 'A', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro]\nA Bm D A\n\n[Verse]\nA Bm D A\n\n[Chorus]\nA Bm D A`,
    legacySections: parseInstructions('Intro — Ingen bas\nVerse — Bas\nChorus — Bas') },
  { title: 'Basket Case', artist: 'Green Day', key: 'Eb', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse]\nEb Bb C# G#\nAb Eb Bb\n\n[Chorus]\nAb Bb Eb\nAb Bb Eb Db C#\nAb Bb`,
    legacySections: parseInstructions('Intro — Ingen bas\nVerse — Ingen bas') },
  { title: "Livin' On A Prayer", artist: 'Bon Jovi', key: 'Em', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro]\nEm C D Em\n\n[Verse]\nEm C D Em\n\n[Pre-Chorus]\nC D Em C D\n\n[Chorus]\nEm C D G C D\n\n[Key Change]\nBb Eb F Bb Eb F`,
    legacySections: parseInstructions('Intro — 4x tyst\nVerse — Basfigur\nChorus — Basfigur\nM8 — Höjning efter M8\nChorus — Basfigur') },
  { title: 'Hey Baby (Uhh, ahh)', artist: 'Anton, DJ Ötzi', key: 'A', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro]\nA F#m D E\n\n[Chorus]\nA F#m D E\n\n[Verse]\nA D A D E`,
    legacySections: parseInstructions('Intro — Ingen bas\nVerse — Bas\nChorus — Bas') },
  { title: 'Cotton Eye Joe', artist: 'Rednex', key: 'A', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Main]\nA A D D\nA E A`,
    legacySections: parseInstructions('Intro — Ingen bas\nVerse — Bas\nChorus — Bas') },
  { title: "I'm In The Band", artist: 'The Hellacopters', key: 'Eb', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Intro]\nEb Ab\n\n[Verse]\nEb Ab C# Eb\n\n[Pre-Chorus]\nCm Bb Ab Eb\n\n[Chorus]\nAb Bb Cm\nAb Bb Eb`,
    legacySections: parseInstructions('Intro — Ingen bas\nVerse — Bas\nChorus — Bas') },
  { title: 'Stad i ljus', artist: 'Tommy Körberg', key: 'G', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto',
    chordRaw: `[Verse]\nG D G Em D C G\nEm D G Em C D\n\n[Chorus]\nG C D Em C D B\nEm D C Am D\n\n[Bridge]\nG D G Em D G`,
    legacySections: [] },
];

// ─── Convert DEFAULT_SONGS to new sections format on first run ───
function migrateSong(song) {
  // Already in new format
  if (song.sections && song.sections.length > 0 && song.sections[0].turns) return song;

  let sections = [];
  const legacy = song.legacySections || song._rawLegacySections || [];

  if (legacy.length > 0) {
    sections = parseLegacySections(legacy, song.chordRaw);
  } else if (song.chordRaw) {
    // Auto-generate sections from chordRaw headings
    sections = parseSectionsFromChordRaw(song.chordRaw);
  }

  song.sections = sections;
  // Normalize all turns
  song.sections.forEach(sec => sec.turns.forEach(t => normalizeTurn(t)));
  return song;
}

function parseSectionsFromChordRaw(chordRaw) {
  if (!chordRaw) return [];
  const lines = chordRaw.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const t = line.trim();
    if (/^(\[.*\]|##.*)$/.test(t)) {
      if (current) sections.push(current);
      const name = t.replace(/[\[\]#]/g,'').trim().toUpperCase();
      current = { id: Date.now()+Math.random(), name, turns: [] };
    } else if (t && current) {
      const words = t.split(/\s+/);
      const cc = words.filter(w => isChordToken(w)).length;
      if (cc >= words.length * 0.5) {
        // Count actual chord tokens to determine bar count
        const chordCount = words.filter(w => isChordToken(w)).length;
        current.turns.push(makeTurn(t, '', chordCount, 'play'));
      }
    }
  }
  if (current) sections.push(current);

  // Keep ALL turns — each chord line = one turn with correct bar count
  return sections.map(s => ({
    ...s,
    turns: s.turns.length > 0 ? s.turns : [makeTurn('', '', 4, 'play')]
  }));
}


// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let songs = [];
let currentSongIndex = -1;
let _dirty = false;

// ─── UNDO / REDO (per-song, snapshot-based, max 10 steps) ───
const _undoStacks = new Map();  // songId → [snapshot, …]
const _redoStacks = new Map();  // songId → [snapshot, …]
const UNDO_MAX = 10;

function _songId() {
  return currentSongIndex >= 0 ? songs[currentSongIndex].id : null;
}
function _snapshot() {
  return JSON.parse(JSON.stringify(songs[currentSongIndex].sections));
}
function pushUndo() {
  const id = _songId();
  if (!id) return;
  if (!_undoStacks.has(id)) _undoStacks.set(id, []);
  const stack = _undoStacks.get(id);
  stack.push(_snapshot());
  if (stack.length > UNDO_MAX) stack.shift();
  // Clear redo on new action
  _redoStacks.set(id, []);
}
function undo() {
  const id = _songId();
  if (!id) return;
  const stack = _undoStacks.get(id);
  if (!stack || stack.length === 0) { showToast('Inget att ångra'); return; }
  // Push current state to redo
  if (!_redoStacks.has(id)) _redoStacks.set(id, []);
  _redoStacks.get(id).push(_snapshot());
  // Restore
  songs[currentSongIndex].sections = stack.pop();
  saveState();
  renderSections();
  showToast('Ångrat ↩');
}
function redo() {
  const id = _songId();
  if (!id) return;
  const stack = _redoStacks.get(id);
  if (!stack || stack.length === 0) { showToast('Inget att göra om'); return; }
  // Push current state to undo
  if (!_undoStacks.has(id)) _undoStacks.set(id, []);
  _undoStacks.get(id).push(_snapshot());
  // Restore
  songs[currentSongIndex].sections = stack.pop();
  saveState();
  renderSections();
  showToast('Omgjort ↪');
}
let isLiveMode = false;
let isEditMode = false;
let tracksGlobal = 'off';

// Setlists
let setlists = [];
let activeSetlistId = null;
let _setlistModalMode = 'create';
let _setlistModalTargetId = null;

// Layer visibility state
const layers = { blocks: true, chords: true, bars: true, lyrics: 'off', marks: false };

// UI state
let chordRefOpen = false;
let chordEditOpen = false;

// ═══════════════════════════════════════════════════
//  PERSISTENCE — state/state.json is the ONLY SSoT
//  No localStorage. Changes live in memory until SPARA.
// ═══════════════════════════════════════════════════
async function loadState() {
  // Try state/state.json first, fallback to legacy beybom-setlist.json
  let loaded = false;
  for (const url of ['state/state.json', 'beybom-setlist.json']) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const imported = await resp.json();
        if (Array.isArray(imported)) {
          songs = imported.map(s => migrateSong(s));
        } else {
          songs = (imported.songs || []).map(s => migrateSong(s));
          setlists = imported.setlists || [];
          activeSetlistId = imported.activeSetlistId || null;
        }
        console.log('Loaded', songs.length, 'songs from', url);
        loaded = true;
        break;
      }
    } catch(e) { /* try next */ }
  }
  if (!loaded) {
    console.warn('No state file found, using defaults');
    songs = DEFAULT_SONGS.map(s => migrateSong({...s}));
  }
  songs.forEach(s => {
    if (!s.sections) s.sections = [];
    if (!s.id) s.id = String(Date.now() + Math.random());
  });
}

function getFullState() {
  return { songs, setlists, activeSetlistId };
}

function saveState() {
  // In-memory only. Data persists via SPARA → File System API.
  _dirty = true;
}

function saveSong() {
  if (currentSongIndex < 0) return;
  songs[currentSongIndex].notes = document.getElementById('sv-notes').value;
  saveState();
}

function getTransposedKey(song) {
  // Parse root and quality suffix (e.g. "Dbm" → root="Db", suffix="m")
  const match = song.key.match(/^([A-G][b#]?)(.*)/);
  if (!match) return song.key;
  const root = match[1];
  const suffix = match[2] || '';
  const normalized = normalizeRoot(root);
  const idx = KEYS.indexOf(normalized);
  if (idx === -1) return song.key;
  const newSharp = KEYS[(idx + (song.keyOffset || 0) + 12) % 12];
  return displayRoot(newSharp) + suffix;
}

function transposeKey(delta) {
  if (currentSongIndex < 0) return;
  const song = songs[currentSongIndex];
  song.keyOffset = ((song.keyOffset || 0) + delta + 12) % 12;
  saveState();
  document.getElementById('sv-key-cur').textContent = getTransposedKey(song);
  renderSections();
}

function transposeChord(chord, semitones) {
  if (!semitones || semitones === 0) return chord;
  const noteRegex = /^([A-G][#b]?)(.*)/;
  const match = chord.match(noteRegex);
  if (!match) return chord;
  const rawRoot = match[1], suffix = match[2];
  const normalized = normalizeRoot(rawRoot);
  const idx = KEYS.indexOf(normalized);
  if (idx === -1) return chord;
  const newSharp = KEYS[(idx + semitones + 12) % 12];
  return displayRoot(newSharp) + suffix;
}

function parseAndTransposeChords(chordStr, offset) {
  if (!chordStr) return [];
  const CP = /^([A-G][#b]?)(m|maj|min|dim|aug|sus|add)?(\d+)?(\/[A-G][#b]?)?$/i;
  return chordStr.split(/\s+/).filter(Boolean).map(tok => {
    if (tok === '/' || tok === '|' || tok.startsWith('(')) return { raw: tok, root: tok, qual: '', bass: '', isText: true };
    const m = tok.match(/^([A-G][#b]?)(m(?:aj)?(?:\d+)?|maj\d+|dim|aug|sus\d?|add\d?|\d+)?(\/([A-G][#b]?))?$/);
    if (!m) return { raw: tok, root: tok, qual: '', bass: '', isText: true };
    const root = transposeChord(m[1], offset);
    const qual = m[2] || '';
    const bass = m[3] ? '/' + transposeChord(m[4], offset) : '';
    return { raw: tok, root, qual, bass, isText: false };
  });
}

// ═══════════════════════════════════════════════════
//  LAYERS
// ═══════════════════════════════════════════════════
function toggleLayer(name) {
  if (name === 'blocks') {
    layers.blocks = !layers.blocks;
    document.getElementById('lay-blocks').classList.toggle('active', layers.blocks);
    renderSections();
  } else if (name === 'chords') {
    layers.chords = !layers.chords;
    document.getElementById('lay-chords').classList.toggle('active', layers.chords);
    applyLayerClasses();
    // chord ref bar visibility
    document.getElementById('chord-ref-bar').classList.toggle('visible', layers.chords);
  } else if (name === 'bars') {
    layers.bars = !layers.bars;
    document.getElementById('lay-bars').classList.toggle('active', layers.bars);
    applyLayerClasses();
  } else if (name === 'marks') {
    layers.marks = !layers.marks;
    document.getElementById('lay-marks').classList.toggle('active', layers.marks);
  }
}

function cycleLyrics() {
  const states = ['off','full','cues'];
  const idx = states.indexOf(layers.lyrics);
  layers.lyrics = states[(idx+1) % states.length];
  const btn = document.getElementById('lay-lyrics');
  const labels = { off: 'LYRICS', full: 'LYRICS:FULL', cues: 'LYRICS:CUES' };
  btn.textContent = labels[layers.lyrics];
  btn.classList.toggle('active', layers.lyrics !== 'off');
  const panel = document.getElementById('lyrics-panel');
  panel.classList.toggle('visible', layers.lyrics !== 'off');
}

function applyLayerClasses() {
  const sc = document.getElementById('song-content');
  if (!sc) return;
  sc.classList.toggle('layer-chords-off', !layers.chords);
  sc.classList.toggle('layer-bars-off', !layers.bars);
}

// ═══════════════════════════════════════════════════
//  TRACKS
// ═══════════════════════════════════════════════════
function setTracksGlobal(val) {
  tracksGlobal = val;
  ['tb-tracks-off','tb-tracks-on','tb-tracks-notrack'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  const map = { off:'tb-tracks-off', on:'tb-tracks-on', notrack:'tb-tracks-notrack' };
  document.getElementById(map[val]).classList.add('active');
  updateTracksBadge();
}

function updateTracksBadge() {
  if (currentSongIndex < 0) return;
  const badge = document.getElementById('sv-tracks-badge');
  const song = songs[currentSongIndex];
  let effective = tracksGlobal;
  let source = 'GLOBAL';
  if (tracksGlobal === 'off') {
    effective = song.tracksMode || 'auto';
    source = 'LÅT';
  }
  const labels = { on:'TRACKS ON', notrack:'NO TRACKS', auto:'—', off:'—' };
  badge.textContent = (labels[effective] || '—') + (tracksGlobal !== 'off' ? ' (GLOBAL)' : '');
  badge.className = 'sh-tracks-badge' + (effective === 'on' ? ' on' : effective === 'notrack' ? ' off' : '');
}

// ═══════════════════════════════════════════════════
//  MODE
// ═══════════════════════════════════════════════════
function toggleMode() {
  if (currentSongIndex >= 0) {
    isEditMode = !isEditMode;
    document.body.classList.toggle('edit-mode', isEditMode);
    const btn = document.getElementById('tb-mode-btn');
    btn.textContent = isEditMode ? 'LIVE' : 'EDIT';
    btn.classList.toggle('active', isEditMode);
    
    document.getElementById('notes-area').style.display = isEditMode ? 'flex' : 'none';
    renderSections();
  } else {
    // On setlist: toggle live mode
    isLiveMode = !isLiveMode;
    document.body.classList.toggle('live-mode', isLiveMode);
  }
}

// ═══════════════════════════════════════════════════
//  SETLIST VIEW
// ═══════════════════════════════════════════════════
function showSetlist() {
  currentSongIndex = -1;
  sessionStorage.removeItem('beybom_songId');
  document.getElementById('setlist-view').style.display = 'flex';
  document.getElementById('song-view').style.display = 'none';
  document.getElementById('tb-nav-song').style.display = 'none';
  document.getElementById('tb-sep-nav').style.display = 'none';
  document.getElementById('tb-song-title').style.display = 'none';
  document.getElementById('tb-setlist-actions').style.display = 'flex';
  document.getElementById('tb-tracks-label').style.display = 'none';
  document.getElementById('tb-tracks-group').style.display = 'none';
  document.getElementById('tb-sep-tracks').style.display = 'none';
  document.getElementById('tb-layers').style.display = 'none';
  renderSetlistTabs();
  renderSetlist();
}

function getActiveSetlist() {
  if (!activeSetlistId) return null;
  return setlists.find(sl => sl.id === activeSetlistId) || null;
}

function getVisibleSongs() {
  const sl = getActiveSetlist();
  if (!sl) return songs; // master = all songs
  return sl.songIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
}

function renderSetlistTabs() {
  const bar = document.getElementById('setlist-tabs');
  if (!bar) return;
  bar.innerHTML = '';

  // Master tab
  const masterTab = document.createElement('button');
  masterTab.className = 'setlist-tab' + (!activeSetlistId ? ' active' : '');
  masterTab.textContent = 'ALLA LÅTAR';
  masterTab.onclick = () => { activeSetlistId = null; saveState(); renderSetlistTabs(); renderSetlist(); };
  bar.appendChild(masterTab);

  // Setlist tabs
  setlists.forEach(sl => {
    const tab = document.createElement('button');
    tab.className = 'setlist-tab' + (activeSetlistId === sl.id ? ' active' : '');
    tab.innerHTML = `${sl.name.toUpperCase()}<span class="setlist-tab-actions"><span class="setlist-tab-btn" data-action="rename" data-id="${sl.id}">✏</span><span class="setlist-tab-btn del" data-action="delete" data-id="${sl.id}">✕</span></span>`;
    tab.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        e.stopPropagation();
        if (btn.dataset.action === 'rename') openSetlistModal('rename', btn.dataset.id);
        else if (btn.dataset.action === 'delete') deleteSetlist(btn.dataset.id);
        return;
      }
      activeSetlistId = sl.id;
      saveState();
      renderSetlistTabs();
      renderSetlist();
    });
    tab.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      tab.classList.add('drag-over');
    });
    tab.addEventListener('dragleave', () => tab.classList.remove('drag-over'));
    tab.addEventListener('drop', e => {
      e.preventDefault();
      tab.classList.remove('drag-over');
      const songId = e.dataTransfer.getData('songId');
      if (!songId) return;
      if (!sl.songIds.includes(songId)) {
        sl.songIds.push(songId);
        saveState();
        renderSetlist();
      }
    });
    bar.appendChild(tab);
  });

  // + new setlist
  const addBtn = document.createElement('button');
  addBtn.className = 'setlist-tab-add';
  addBtn.title = 'Ny setlist';
  addBtn.textContent = '+';
  addBtn.onclick = () => openSetlistModal('create');
  bar.appendChild(addBtn);

  // Update title
  const sl = getActiveSetlist();
  const titleEl = document.getElementById('setlist-title');
  if (titleEl) titleEl.textContent = sl ? sl.name.toUpperCase() : 'ALLA LÅTAR';
}

function renderSetlist() {
  const list = document.getElementById('song-list');
  list.innerHTML = '';
  const sl = getActiveSetlist();
  let visible = getVisibleSongs();

  // Search filter — searches ALL songs by title/artist
  const searchInput = document.getElementById('song-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (query) {
    // When searching, search ALL songs regardless of setlist
    visible = songs.filter(s =>
      s.title.toLowerCase().includes(query) ||
      (s.artist && s.artist.toLowerCase().includes(query))
    );
  }

  visible.forEach((song, visibleIndex) => {
    const globalIndex = songs.indexOf(song);
    const displayNum = sl ? visibleIndex + 1 : globalIndex + 1;
    const row = document.createElement('div');
    row.className = 'song-row';
    row.style.cursor = 'grab';
    row.draggable = true;
    row.setAttribute('data-song-id', song.id);
    row.addEventListener('dragstart', e => {
      e.dataTransfer.setData('songId', song.id);
      e.dataTransfer.effectAllowed = 'copy';
      row.style.opacity = '0.5';
    });
    row.addEventListener('dragend', () => { row.style.opacity = ''; });

    let toggleBtn = '';
    if (sl) {
      toggleBtn = `<button class="song-row-setlist-toggle in"
        onclick="event.stopPropagation();toggleSongInSetlist('${sl.id}','${song.id}')">
        ✓ I LISTA
      </button>`;
    }

    row.innerHTML = `
      <div class="song-row-info">
        <div class="song-row-num">${String(displayNum).padStart(2,'0')}</div>
        <div class="song-row-title">${song.title}</div>
        <div class="song-row-artist">${song.artist}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="song-row-key">${getTransposedKey(song)}</div>
        ${toggleBtn}
        <button class="btn-open" onclick="openSong(${globalIndex})">ÖPPNA →</button>
      </div>
    `;
    list.appendChild(row);
  });

  // Sortable — works on both master list and setlists
  if (window._setlistSortable) window._setlistSortable.destroy();
  if (list && typeof Sortable !== 'undefined') {
    try { window._setlistSortable = Sortable.create(list, {
      animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
      filter: '.btn-open, .song-row-setlist-toggle',
      preventOnFilter: false,
      delay: 120,
      delayOnTouchOnly: true,
      onEnd(evt) {
        if (sl) {
          // Reorder within setlist
          const moved = sl.songIds.splice(evt.oldIndex, 1)[0];
          sl.songIds.splice(evt.newIndex, 0, moved);
        } else {
          // Reorder master list
          const moved = songs.splice(evt.oldIndex, 1)[0];
          songs.splice(evt.newIndex, 0, moved);
        }
        saveState(); renderSetlist();
      }
    }); } catch(e) { console.warn('Sortable setlist:', e); }
  }
}

// Setlist CRUD
function openSetlistModal(mode, id) {
  _setlistModalMode = mode;
  _setlistModalTargetId = id || null;
  const label = document.getElementById('setlist-modal-label');
  const input = document.getElementById('setlist-modal-input');
  if (mode === 'rename') {
    const sl = setlists.find(s => s.id === id);
    label.textContent = 'BYTA NAMN';
    input.value = sl ? sl.name : '';
  } else {
    label.textContent = 'NY SETLIST';
    input.value = '';
  }
  document.getElementById('setlist-modal-backdrop').style.display = 'flex';
  setTimeout(() => input.focus(), 50);
}

function closeSetlistModal() {
  document.getElementById('setlist-modal-backdrop').style.display = 'none';
}

function confirmSetlistModal() {
  const name = document.getElementById('setlist-modal-input').value.trim();
  if (!name) return;
  if (_setlistModalMode === 'create') {
    const id = 'sl_' + Date.now();
    setlists.push({ id, name, songIds: [] });
    activeSetlistId = id;
  } else {
    const sl = setlists.find(s => s.id === _setlistModalTargetId);
    if (sl) sl.name = name;
  }
  saveState();
  closeSetlistModal();
  renderSetlistTabs();
  renderSetlist();
}

function deleteSetlist(id) {
  setlists = setlists.filter(sl => sl.id !== id);
  if (activeSetlistId === id) activeSetlistId = null;
  saveState();
  renderSetlistTabs();
  renderSetlist();
}

function toggleSongInSetlist(slId, songId) {
  const sl = setlists.find(s => s.id === slId);
  if (!sl) return;
  const idx = sl.songIds.indexOf(songId);
  if (idx === -1) sl.songIds.push(songId);
  else sl.songIds.splice(idx, 1);
  saveState();
  renderSetlist();
}

// ═══════════════════════════════════════════════════
//  SONG VIEW
// ═══════════════════════════════════════════════════
function openSong(index) {
  currentSongIndex = index;
  const song = songs[index];
  sessionStorage.setItem('beybom_songId', song.id);

  document.getElementById('setlist-view').style.display = 'none';
  document.getElementById('song-view').style.display = 'flex';
  document.getElementById('song-view').style.flexDirection = 'column';

  // Topbar
  document.getElementById('tb-nav-song').style.display = 'flex';
  document.getElementById('tb-sep-nav').style.display = 'block';
  document.getElementById('tb-song-title').style.display = 'block';
  document.getElementById('tb-song-title').textContent = song.title;
  document.getElementById('tb-setlist-actions').style.display = 'none';
  document.getElementById('tb-tracks-label').style.display = 'block';
  document.getElementById('tb-tracks-group').style.display = 'flex';
  document.getElementById('tb-sep-tracks').style.display = 'block';
  document.getElementById('tb-layers').style.display = 'flex';

  // Song header — show setlist-local position if in a setlist
  const sl = getActiveSetlist();
  const navList = sl ? sl.songIds.map(id => songs.find(s => s.id === id)).filter(Boolean) : songs;
  const navIndex = navList.indexOf(song);
  const navTotal = navList.length;
  document.getElementById('sv-num').textContent = `${String(navIndex+1).padStart(2,'0')} / ${navTotal}`;
  document.getElementById('sv-title').textContent = song.title;
  document.getElementById('sv-artist').textContent = song.artist;
  document.getElementById('sv-key-orig').textContent = song.key;
  document.getElementById('sv-key-cur').textContent = getTransposedKey(song);
  document.getElementById('sv-notes').value = song.notes || '';
  document.getElementById('song-progress').textContent = `${navIndex+1} av ${navTotal}`;

  // Update bottom nav arrow visibility
  const prevBtn = document.getElementById('nav-prev-btn');
  const nextBtn = document.getElementById('nav-next-btn');
  if (prevBtn) prevBtn.style.visibility = navIndex <= 0 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.style.visibility = navIndex >= navTotal - 1 ? 'hidden' : 'visible';

  document.getElementById('sv-bpm').textContent = song.bpm || '—';

  updateTracksBadge();

  // Chord ref
  document.getElementById('chord-ref-edit').value = song.chordRaw || '';
  chordRefOpen = false;
  chordEditOpen = false;
  document.getElementById('chord-ref-panel').style.display = 'none';
  document.getElementById('chord-ref-edit').style.display = 'none';
  document.getElementById('chord-ref-bar').classList.toggle('visible', layers.chords);
  renderChordRef();

  // Edit mode UI
  
  document.getElementById('notes-area').style.display = isEditMode ? 'flex' : 'none';

  // Lyrics
  renderLyricsDisplay(song);

  renderSections();
  applyLayerClasses();
}

// ═══════════════════════════════════════════════════
//  CHORD REF PANEL
// ═══════════════════════════════════════════════════
function renderChordRef() {
  if (currentSongIndex < 0) return;
  const song = songs[currentSongIndex];
  const raw = song.chordRaw || '';
  const panel = document.getElementById('chord-ref-panel');
  if (!raw) { panel.innerHTML = '<span style="color:var(--text-muted);font-size:0.7rem;">Ingen ackordtext.</span>'; return; }
  const offset = song.keyOffset || 0;
  const CP = /^([A-G][#b]?)(m(?:aj)?(?:\d+)?|maj\d+|dim|aug|sus\d?|add\d?|\d+)?(\/([A-G][#b]?))?$/;
  const lines = raw.split('\n');
  let html = '';
  lines.forEach(line => {
    const t = line.trim();
    if (!t) { html += '\n'; return; }
    if (/^(\[.*\]|##.*)$/.test(t)) {
      html += `<span class="cr-section">▸ ${t.replace(/[\[\]#]/g,'').trim().toUpperCase()}</span>\n`;
      return;
    }
    const words = t.split(/\s+/);
    const CC = words.filter(w => w.match(CP)).length;
    if (CC >= words.length * 0.5) {
      const transposed = words.map(w => {
        if (w.match(CP)) return `<span class="cr-chord">${transposeChord(w.split('/')[0], offset)}${w.includes('/')? '/'+transposeChord(w.split('/')[1],offset):''}</span>`;
        return w;
      }).join('  ');
      html += transposed + '\n';
    } else {
      html += t + '\n';
    }
  });
  panel.innerHTML = html;
}

function toggleChordRef() {
  chordRefOpen = !chordRefOpen;
  document.getElementById('chord-ref-panel').style.display = chordRefOpen ? 'block' : 'none';
  if (chordEditOpen && chordRefOpen) { chordEditOpen = false; document.getElementById('chord-ref-edit').style.display = 'none'; }
}

function toggleChordEdit() {
  chordEditOpen = !chordEditOpen;
  document.getElementById('chord-ref-edit').style.display = chordEditOpen ? 'block' : 'none';
  if (chordRefOpen && chordEditOpen) { chordRefOpen = false; document.getElementById('chord-ref-panel').style.display = 'none'; }
}

function onChordRawEdit() {
  if (currentSongIndex < 0) return;
  songs[currentSongIndex].chordRaw = document.getElementById('chord-ref-edit').value;
  saveState();
}

// Parse + transpose single chord token → { root, qual, bass, display }
function parseChordToken(raw, offset) {
  if (!raw || !raw.trim()) return { root: '', qual: '', bass: '', display: '' };
  const m = raw.trim().match(/^([A-G][#b]?)(m(?:aj)?(?:\d+)?|maj\d+|dim|aug|sus\d?|add\d?|\d+)?(\/([A-G][#b]?))?$/);
  if (!m) return { root: raw, qual: '', bass: '', display: raw };
  const root = transposeChord(m[1], offset);
  const qual = m[2] || '';
  const bassNote = m[4] ? transposeChord(m[4], offset) : '';
  const bass = bassNote ? '/' + bassNote : '';
  return { root, qual, bass, display: root + qual + bass };
}

// S6: Inline slot editor
let _activeSlotInput = null;

function openSlotEdit(slotEl, si, ti, b) {
  // Close any open slot editor first
  if (_activeSlotInput) closeSlotEdit(false);

  const song = songs[currentSongIndex];
  const raw = song.sections[si].turns[ti].chords[b] || '';

  const input = document.createElement('input');
  input.className = 'slot-input';
  input.value = raw;
  input.placeholder = '—';
  input.maxLength = 24;
  slotEl.classList.add('editing');
  slotEl.appendChild(input);
  input.focus();
  input.select();
  _activeSlotInput = { input, slotEl, si, ti, b };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); closeSlotEdit(true); }
    if (e.key === 'Escape') closeSlotEdit(false);
  });
  input.addEventListener('blur', () => { setTimeout(() => closeSlotEdit(true), 80); });
}

function closeSlotEdit(save) {
  if (!_activeSlotInput) return;
  const { input, slotEl, si, ti, b } = _activeSlotInput;
  _activeSlotInput = null;
  if (save) {
    const val = input.value.trim();
    const song = songs[currentSongIndex];
    const oldVal = song.sections[si].turns[ti].chords[b] || '';
    if (val !== oldVal) pushUndo();
    song.sections[si].turns[ti].chords[b] = val;
    saveState();
  }
  slotEl.classList.remove('editing');
  if (input.parentNode) input.parentNode.removeChild(input);
  renderSections();
}

// ═══════════════════════════════════════════════════
let _sectionSortable = null;

// Section → color family mapping
const SECTION_FAMILIES = {
  'intro': 'slate', 'INTRO': 'slate',
  'vers': 'teal', 'verse': 'teal', 'VERS': 'teal', 'VERSE': 'teal',
  'pre': 'indigo', 'PRE': 'indigo', 'prechorus': 'indigo', 'PRE-CHORUS': 'indigo',
  'ref': 'chorus', 'REF': 'chorus', 'chorus': 'chorus', 'CHORUS': 'chorus', 'refräng': 'chorus', 'REFRÄNG': 'chorus',
  'bridge': 'bridge', 'BRIDGE': 'bridge', 'm8': 'bridge', 'M8': 'bridge',
  'solo': 'orange', 'SOLO': 'orange',
  'outro': 'dark-slate', 'OUTRO': 'dark-slate',
  'tag': 'end', 'TAG': 'end', 'end': 'end', 'END': 'end', 'ending': 'end', 'ENDING': 'end',
};
function getSectionFamily(name) {
  if (!name) return 'slate';
  // Try exact match first
  if (SECTION_FAMILIES[name]) return SECTION_FAMILIES[name];
  // Try case-insensitive prefix match
  const lower = name.toLowerCase().replace(/\s*\d+$/, '').trim();
  return SECTION_FAMILIES[lower] || 'slate';
}

function renderSections() {
  if (currentSongIndex < 0) return;
  const song = songs[currentSongIndex];
  const container = document.getElementById('song-content');
  container.innerHTML = '';

  // Track consecutive same-family for alternation
  let lastFamily = null;
  let familyAlt = false;

  (song.sections || []).forEach((sec, si) => {
    const family = getSectionFamily(sec.name);
    if (family === lastFamily) {
      familyAlt = !familyAlt;
    } else {
      familyAlt = false;
    }
    lastFamily = family;
    container.appendChild(buildSectionRow(sec, si, song, family, familyAlt));
  });

  applyLayerClasses();

  if (isEditMode) {
    if (_sectionSortable) _sectionSortable.destroy();
    if (typeof Sortable === "undefined" || !container) return;
    try { _sectionSortable = Sortable.create(container, {
      animation: 150, ghostClass: 'sortable-ghost',
      filter: '.turn-block, .sec-label-col button, .turn-edit-overlay',
      onEnd(evt) {
        pushUndo();
        const song = songs[currentSongIndex];
        const moved = song.sections.splice(evt.oldIndex, 1)[0];
        song.sections.splice(evt.newIndex, 0, moved);
        saveState(); renderSections();
      }
    }); } catch(e) { console.warn('Sortable:', e); }
  }
}

function buildSectionRow(sec, si, song, family, familyAlt) {
  const offset = song.keyOffset || 0;
  const row = document.createElement('div');
  row.className = 'section-row';

  // Color family CSS variable
  const familyCssVar = familyAlt ? `var(--sec-${family}-alt)` : `var(--sec-${family})`;
  const familyBorderColor = familyAlt ? `var(--sec-${family}-alt)` : `var(--sec-${family})`;

  // Label col
  const labelCol = document.createElement('div');
  labelCol.className = 'sec-label-col';
  labelCol.style.borderLeftColor = familyBorderColor;
  const repeatCount = sec.repeat || 1;
  const repeatLabel = repeatCount > 1 ? `<div class="sec-repeat-label">×${repeatCount}</div>` : '';
  labelCol.innerHTML = `
    <div class="sec-name">${sec.name}</div>
    ${repeatLabel}
    ${isEditMode ? `
      <div class="sec-label-actions">
        <button class="sec-action-btn" onclick="cycleRepeat(${si})" title="Repris">🔁</button>
        <button class="sec-action-btn" onclick="editSectionName(${si})" title="Byt namn">✏</button>
        <button class="sec-action-btn del" onclick="deleteSection(${si})" title="Ta bort">✕</button>
      </div>
    ` : ''}
  `;
  row.appendChild(labelCol);

  // Repeat start marker
  if (repeatCount > 1) {
    const repStart = document.createElement('div');
    repStart.className = 'repeat-start';
    repStart.textContent = '𝄆';
    row.appendChild(repStart);
  }

  // Turns container
  const turnsEl = document.createElement('div');
  turnsEl.className = 'turns-container';
  turnsEl.style.flexWrap = 'wrap';
  turnsEl.style.position = 'relative';

  (sec.turns || []).forEach((turn, ti) => {
    turnsEl.appendChild(buildTurnBlock(turn, si, ti, offset, song, family, familyAlt));
  });

  if (sec.turns.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'flex:1;background:var(--panel2);border-radius:2px;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    empty.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);">+ BLOCK</span>`;
    empty.onclick = () => addTurn(si);
    turnsEl.appendChild(empty);
  }

  // + block button and ⧉ duplicate section — always visible at end of row
  const addBtn = document.createElement('button');
  addBtn.className = 'turn-add-btn';
  addBtn.title = 'Lägg till block';
  addBtn.textContent = '+';
  addBtn.onclick = (e) => { e.stopPropagation(); addTurn(si); };
  turnsEl.appendChild(addBtn);

  const dupBtn = document.createElement('button');
  dupBtn.className = 'turn-add-btn';
  dupBtn.title = 'Duplicera rad';
  dupBtn.textContent = '⧉';
  dupBtn.onclick = (e) => { e.stopPropagation(); duplicateSection(si); };
  turnsEl.appendChild(dupBtn);

  row.appendChild(turnsEl);

  // Repeat end marker + badge
  if (repeatCount > 1) {
    const repEnd = document.createElement('div');
    repEnd.className = 'repeat-end';
    repEnd.textContent = '𝄇';
    row.appendChild(repEnd);
    // Badge
    const badge = document.createElement('div');
    badge.className = 'repeat-badge';
    badge.textContent = `×${repeatCount}`;
    row.style.position = 'relative';
    row.appendChild(badge);
  }
  return row;
}

function buildTurnBlock(turn, si, ti, offset, song, family, familyAlt) {
  normalizeTurn(turn);

  // Section color as primary background
  const secColor = familyAlt ? `var(--sec-${family}-alt)` : `var(--sec-${family})`;

  // Block type classes for secondary indicators
  const typeClass = turn.type === 'rest' ? 'type-rest' : turn.type === 'warn' ? 'type-warn' : turn.type === 'stop' ? 'type-stop' : '';
  const restClass = turn.type === 'rest' ? 'rest' : '';
  const block = document.createElement('div');
  block.className = `turn-block ${typeClass} ${restClass}`;
  block.style.background = secColor;
  block.style.position = 'relative';
  if (!layers.blocks) block.style.background = 'var(--panel2)';

  const bars = turn.bars;
  // Proportional 16-bar grid: each turn takes bars/16 of the row
  block.style.flex = `0 0 calc(${(bars / 16) * 100}% - 2px)`;

  // Volta bracket (ending indicator)
  if (turn.ending) {
    const volta = document.createElement('div');
    volta.className = 'volta-bracket';
    volta.textContent = `${turn.ending}.`;
    block.appendChild(volta);
    block.style.paddingTop = '16px';
  }
  const restIcon = turn.type === 'rest' ? '🔇' : '🔈';
  const restTitle = turn.type === 'rest' ? 'MUTAD — klicka för att spela' : 'SPELAR — klicka för att muta';

  // Top row
  const topEl = document.createElement('div');
  topEl.className = 'turn-top';
  topEl.innerHTML = `
    <div class="turn-bars">${bars} TAKT${bars !== 1 ? 'ER' : ''}</div>
    <div class="turn-top-actions">
      <button class="turn-rest-btn" title="${restTitle}" onclick="toggleTurnRest(${si},${ti})">${restIcon}</button>
      <button class="turn-delete-btn" title="Ta bort block" onclick="event.stopPropagation();deleteTurn(${si},${ti})">✕</button>
    </div>
  `;
  block.appendChild(topEl);

  // Chord slots grid
  const chordsEl = document.createElement('div');
  chordsEl.className = 'turn-chords';
  chordsEl.style.gridTemplateColumns = `repeat(${Math.min(bars, 16)}, 1fr)`;

  for (let b = 0; b < bars; b++) {
    const rawChord = turn.chords[b] || '';
    const slot = document.createElement('div');
    const isEmpty = !rawChord.trim();
    slot.className = `chord-slot${b === 0 ? ' beat1' : ''}${isEmpty ? ' empty' : ''}`;
    slot.dataset.si = si; slot.dataset.ti = ti; slot.dataset.b = b;

    // Check for multiple chords per bar (space-separated)
    const chordTokens = rawChord.trim().split(/\s+/).filter(Boolean);

    if (chordTokens.length > 1) {
      // Multi-chord: render sub-beat divisions
      const subBeats = document.createElement('div');
      subBeats.className = 'chord-sub-beats';
      chordTokens.forEach(token => {
        const { root, qual, bass } = parseChordToken(token, offset);
        const sub = document.createElement('div');
        sub.className = 'chord-sub-beat';
        sub.innerHTML = `<div class="chord-slot-text">${root}<span class="cq">${qual}</span><span class="cb">${bass}</span></div>`;
        subBeats.appendChild(sub);
      });
      slot.appendChild(subBeats);
    } else {
      // Single chord (original behavior)
      const { root, qual, bass } = parseChordToken(rawChord, offset);
      if (bass) slot.classList.add('has-bass');
      const bassHtml = bass ? `<span class="cs">/</span><span class="cb">${bass.slice(1)}</span>` : '';
      slot.innerHTML = `
        <div class="chord-slot-text">${isEmpty ? '–' : `${root}<span class="cq">${qual}</span>${bassHtml}`}</div>
      `;
    }

    // Slot always clickable for chord edit
    slot.style.cursor = 'pointer';
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      openSlotEdit(slot, si, ti, b);
    });
    chordsEl.appendChild(slot);
  }
  block.appendChild(chordsEl);

  // Instruction
  if (turn.instruction) {
    const instrEl = document.createElement('div');
    instrEl.className = 'turn-instruction';
    instrEl.textContent = turn.instruction;
    block.appendChild(instrEl);
  }

  // (ticks removed — slot numbers serve this purpose)

  // Edit mode: turn-level controls (instruction, type, bars, delete)
  if (isEditMode) {
    const ctrlEl = document.createElement('div');
    ctrlEl.style.cssText = 'display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding-top:4px;border-top:1px solid rgba(255,255,255,0.08);margin-top:4px;';
    ctrlEl.innerHTML = `
      <input class="te-input" style="flex:1;min-width:80px;font-size:0.65rem;" 
        value="${(turn.instruction||'').replace(/"/g,'&quot;')}" placeholder="Instruktion..."
        oninput="updateTurnInstruction(${si},${ti},this.value)">
      <button class="pill" style="padding:3px 6px;font-size:0.52rem;" onclick="changeTurnBars(${si},${ti},-1)">−</button>
      <span style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-dim);">${bars}T</span>
      <button class="pill" style="padding:3px 6px;font-size:0.52rem;" onclick="changeTurnBars(${si},${ti},1)">+</button>
      <select class="te-input te-select" style="max-width:72px;font-size:0.6rem;" onchange="updateTurnType(${si},${ti},this.value)">
        ${['play','rest','warn','stop'].map(t=>`<option value="${t}"${turn.type===t?' selected':''}>${t.toUpperCase()}</option>`).join('')}
      </select>
      <button class="pill" style="padding:3px 6px;font-size:0.52rem;" onclick="deleteTurn(${si},${ti})">✕</button>
      <button class="ending-btn${turn.ending ? ' active' : ''}" onclick="cycleEnding(${si},${ti})" title="Ending (volta)">${turn.ending ? turn.ending + '.' : '—'}</button>
    `;
    block.appendChild(ctrlEl);
  }

  return block;
}

// ═══════════════════════════════════════════════════
//  TURN EDITING
// ═══════════════════════════════════════════════════
function toggleTurnRest(si, ti) {
  pushUndo();
  const song = songs[currentSongIndex];
  const turn = song.sections[si].turns[ti];
  turn.type = turn.type === 'rest' ? 'play' : 'rest';
  saveState();
  renderSections();
}

function cycleRepeat(si) {
  pushUndo();
  const song = songs[currentSongIndex];
  const sec = song.sections[si];
  const cur = sec.repeat || 1;
  sec.repeat = cur >= 4 ? 1 : cur + 1;
  if (sec.repeat === 1) delete sec.repeat;
  saveState();
  renderSections();
}

function cycleEnding(si, ti) {
  pushUndo();
  const song = songs[currentSongIndex];
  const turn = song.sections[si].turns[ti];
  const cur = turn.ending || 0;
  turn.ending = cur >= 3 ? 0 : cur + 1;
  if (!turn.ending) delete turn.ending;
  saveState();
  renderSections();
}

function updateTurnInstruction(si, ti, value) {
  pushUndo();
  songs[currentSongIndex].sections[si].turns[ti].instruction = value;
  saveState();
}

function updateTurnType(si, ti, value) {
  pushUndo();
  songs[currentSongIndex].sections[si].turns[ti].type = value;
  saveState();
  renderSections();
}

// S7: Add/remove bars — resizes chords array
function changeTurnBars(si, ti, delta) {
  pushUndo();
  const song = songs[currentSongIndex];
  const turn = song.sections[si].turns[ti];
  const newBars = Math.max(1, Math.min(16, (turn.bars || 4) + delta));
  // Resize chords array
  if (newBars > turn.chords.length) {
    while (turn.chords.length < newBars) turn.chords.push('');
  } else {
    turn.chords = turn.chords.slice(0, newBars);
  }
  turn.bars = newBars;
  saveState();
  renderSections();
}

function deleteTurn(si, ti) {
  pushUndo();
  const song = songs[currentSongIndex];
  if (song.sections[si].turns.length <= 1) { showToast('Kan inte ta bort sista blocket'); return; }
  song.sections[si].turns.splice(ti, 1);
  saveState();
  renderSections();
}

function addTurn(si) {
  pushUndo();
  const song = songs[currentSongIndex];
  const turns = song.sections[si].turns;
  let newTurn;
  if (turns.length > 0) {
    const prev = turns[turns.length - 1];
    // Deep copy prev turn, new id
    newTurn = JSON.parse(JSON.stringify(prev));
    newTurn.id = Date.now() + Math.random();
  } else {
    newTurn = makeTurn('', '', 4, 'play');
  }
  turns.push(newTurn);
  saveState();
  renderSections();
}

// ═══════════════════════════════════════════════════
//  SECTION EDITING
// ═══════════════════════════════════════════════════
function openSectionPicker() {
  const el = document.getElementById('section-picker-backdrop');
  el.style.display = 'flex';
}

function closeSectionPicker() {
  document.getElementById('section-picker-backdrop').style.display = 'none';
}

function confirmAddSection(name) {
  if (currentSongIndex < 0) return;
  if (!name) return;
  pushUndo();
  songs[currentSongIndex].sections.push(makeSection(name, [makeTurn('','',4,'play')]));
  saveState();
  closeSectionPicker();
  renderSections();
  setTimeout(() => {
    const rows = document.querySelectorAll('.section-row');
    if (rows.length) rows[rows.length-1].scrollIntoView({behavior:'smooth', block:'nearest'});
  }, 50);
}

function addSection() { openSectionPicker(); }

function deleteSection(si) {
  pushUndo();
  songs[currentSongIndex].sections.splice(si, 1);
  saveState();
  renderSections();
}

function editBpm() {
  if (currentSongIndex < 0) return;
  const song = songs[currentSongIndex];
  const el = document.getElementById('sv-bpm');
  const cur = song.bpm || '';
  el.contentEditable = 'true';
  el.textContent = cur;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  el.onblur = () => {
    const val = el.textContent.trim().replace(/[^\d]/g, '');
    song.bpm = val;
    el.textContent = val || '—';
    el.contentEditable = 'false';
    saveState();
  };
  el.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = cur || '—'; el.contentEditable = 'false'; }
  };
}


function editSectionName(si) {
  const song = songs[currentSongIndex];
  const nameEl = document.querySelectorAll('.sec-name')[si];
  if (!nameEl) return;
  const cur = song.sections[si].name;
  nameEl.contentEditable = 'true';
  nameEl.focus();
  // Select all
  const range = document.createRange();
  range.selectNodeContents(nameEl);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  nameEl.onblur = () => {
    const val = nameEl.textContent.trim().toUpperCase();
    song.sections[si].name = val || cur;
    nameEl.contentEditable = 'false';
    saveState();
    renderSections();
  };
  nameEl.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    if (e.key === 'Escape') { nameEl.textContent = cur; nameEl.blur(); }
  };
}

// ═══════════════════════════════════════════════════
//  SONG MANAGEMENT
// ═══════════════════════════════════════════════════
function navSong(delta) {
  const sl = getActiveSetlist();
  if (sl) {
    // Navigate within setlist only
    const navList = sl.songIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
    const curSong = songs[currentSongIndex];
    const curNavIdx = navList.indexOf(curSong);
    const nextNavIdx = curNavIdx + delta;
    if (nextNavIdx >= 0 && nextNavIdx < navList.length) {
      openSong(songs.indexOf(navList[nextNavIdx]));
    }
  } else {
    const next = currentSongIndex + delta;
    if (next >= 0 && next < songs.length) openSong(next);
  }
}

// Swipe support for iPad/touch
let _swipeStartX = 0;
let _swipeStartY = 0;
document.addEventListener('touchstart', (e) => {
  if (!document.getElementById('song-view') || document.getElementById('song-view').style.display === 'none') return;
  _swipeStartX = e.touches[0].clientX;
  _swipeStartY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (!document.getElementById('song-view') || document.getElementById('song-view').style.display === 'none') return;
  const dx = e.changedTouches[0].clientX - _swipeStartX;
  const dy = e.changedTouches[0].clientY - _swipeStartY;
  if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0) navSong(1);  // swipe left = next
    else navSong(-1);         // swipe right = prev
  }
}, { passive: true });

function moveSongUp() {
  if (currentSongIndex <= 0) return;
  const s = songs.splice(currentSongIndex, 1)[0];
  songs.splice(currentSongIndex - 1, 0, s);
  currentSongIndex--;
  saveState();
  document.getElementById('sv-num').textContent = `${String(currentSongIndex+1).padStart(2,'0')} / ${songs.length}`;
  document.getElementById('song-progress').textContent = `${currentSongIndex+1} av ${songs.length}`;
  showToast('Flytt upp ✓');
}

function moveSongDown() {
  if (currentSongIndex >= songs.length - 1) return;
  const s = songs.splice(currentSongIndex, 1)[0];
  songs.splice(currentSongIndex + 1, 0, s);
  currentSongIndex++;
  saveState();
  document.getElementById('sv-num').textContent = `${String(currentSongIndex+1).padStart(2,'0')} / ${songs.length}`;
  document.getElementById('song-progress').textContent = `${currentSongIndex+1} av ${songs.length}`;
  showToast('Flytt ner ✓');
}

function duplicateSection(si) {
  pushUndo();
  const song = songs[currentSongIndex];
  const copy = JSON.parse(JSON.stringify(song.sections[si]));
  copy.id = Date.now() + Math.random();
  (copy.turns || []).forEach(t => { t.id = Date.now() + Math.random(); });
  song.sections.splice(si + 1, 0, copy);
  saveState();
  openSong(currentSongIndex);
  showToast('Rad duplicerad ⧉');
}

function deleteSong() {
  if (!confirm(`Ta bort "${songs[currentSongIndex].title}"?`)) return;
  songs.splice(currentSongIndex, 1);
  saveState();
  showSetlist();
}

function addNewSong() {
  const backdrop = document.getElementById('newsong-modal-backdrop');
  backdrop.style.display = 'flex';
  const inp = document.getElementById('newsong-title');
  inp.value = '';
  document.getElementById('newsong-artist').value = '';
  setTimeout(() => inp.focus(), 60);
}

function closeNewSongModal() {
  document.getElementById('newsong-modal-backdrop').style.display = 'none';
}

function confirmNewSongModal() {
  const title = document.getElementById('newsong-title').value.trim();
  if (!title) { document.getElementById('newsong-title').focus(); return; }
  const artist = document.getElementById('newsong-artist').value.trim();
  closeNewSongModal();

  const newSong = migrateSong({ title, artist, key: 'C', keyOffset: 0, bpm: '', notes: '', tracksMode: 'auto', chordRaw: '', legacySections: [], sections: [makeSection('VERSE', [makeTurn('','',4,'play')])] });
  newSong.id = String(Date.now() + Math.random());
  songs.push(newSong);

  // If viewing a setlist, add the new song to it
  const sl = getActiveSetlist();
  if (sl) {
    sl.songIds.push(newSong.id);
  }

  saveState();
  openSong(songs.length - 1);
}

// ═══════════════════════════════════════════════════
//  EXPORT / IMPORT
// ═══════════════════════════════════════════════════
function exportJSON() {
  const blob = new Blob([JSON.stringify(songs, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'beybom-setlist.json';
  a.click();
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      songs = JSON.parse(ev.target.result).map(s => migrateSong(s));
      saveState();
      showSetlist();
      showToast('Import klar!');
    } catch { showToast('Fel vid import'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ═══════════════════════════════════════════════════
//  LYRICS
// ═══════════════════════════════════════════════════
let currentLyricsTab = 'plain';

function renderLyricsDisplay(song) {
  song = song || songs[currentSongIndex];
  const box = document.getElementById('lyrics-display');
  const src = document.getElementById('lyrics-source');
  const lyr = currentLyricsTab === 'synced' ? (song.lyrics || song.lyricsPlain || '') : (song.lyricsPlain || song.lyrics || '');
  if (!lyr) { box.innerHTML = '<span class="lyrics-status">Tryck HÄMTA för att söka via LRCLIB.</span>'; src.textContent = ''; return; }
  src.textContent = song.lyricsTrackName ? `Källa: LRCLIB — "${song.lyricsTrackName}"` : '';
  const lines = lyr.split('\n');
  let html = '';
  lines.forEach(line => {
    if (/^\[.+\]$/.test(line.trim())) html += `<span class="lyrics-section-marker">${line.trim()}</span>`;
    else html += line + '\n';
  });
  box.innerHTML = html;
}

async function fetchLyrics() {
  if (currentSongIndex < 0) return;
  const song = songs[currentSongIndex];
  const btn = document.getElementById('lyrics-fetch-btn');
  const box = document.getElementById('lyrics-display');
  btn.disabled = true; btn.textContent = '...';
  box.innerHTML = '<span class="lyrics-status">Söker...</span>';
  try {
    const q = encodeURIComponent(`${song.title} ${song.artist}`);
    const res = await fetch(`https://lrclib.net/api/search?q=${q}`, { headers: {'User-Agent':'BEYBOM BassPlayer v2'} });
    const results = await res.json();
    if (!results || results.length === 0) { box.innerHTML = '<span class="lyrics-status">⚠ Inga lyrics hittades.</span>'; return; }
    const r = results[0];
    song.lyricsPlain = r.plainLyrics || '';
    song.lyrics = r.syncedLyrics || r.plainLyrics || '';
    song.lyricsTrackName = r.trackName;
    song.lyricsArtist = r.artistName;
    saveState();
    renderLyricsDisplay(song);
    showToast('Lyrics hämtade ✓');
  } catch(e) {
    box.innerHTML = `<span class="lyrics-status">⚠ Fel: ${e.message}</span>`;
  }
  btn.disabled = false; btn.textContent = '⬇ HÄMTA';
}

// ═══════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ═══════════════════════════════════════════════════
//  KEYBOARD
// ═══════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  // Undo / Redo — works even in inputs
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); redo(); return; }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (currentSongIndex === -1) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navSong(1);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navSong(-1);
  if (e.key === 'Escape') showSetlist();
  if (e.key === 'e' || e.key === 'E') toggleMode();
});

// ═══════════════════════════════════════════════════
//  PERSISTENCE — state/state.json via dev server POST
//  SPARA = POST to /state/state.json (server handles backup)
//  Fallback: file download if POST fails
// ═══════════════════════════════════════════════════
async function manualSave() {
  const state = getFullState();
  const btn = document.getElementById('btn-manual-save');
  if (btn) btn.textContent = 'SPARAR...';

  try {
    const resp = await fetch('state/state.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state, null, 2)
    });
    if (!resp.ok) throw new Error('Server responded ' + resp.status);
    showToast('Sparad ✓');
    _dirty = false;
  } catch (e) {
    console.warn('POST save failed, falling back to download:', e.message);
    // Fallback: download
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'state.json';
    a.click();
    showToast('Fil nedladdad ✓ (server ej tillgänglig)');
    _dirty = false;
  }

  if (btn) btn.textContent = 'SPARA';
}


// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
loadState().then(() => {
  // Restore last view from sessionStorage
  const savedId = sessionStorage.getItem('beybom_songId');
  console.log('[INIT] savedId:', savedId);
  if (savedId) {
    const idx = songs.findIndex(s => String(s.id) === String(savedId));
    console.log('[INIT] found song at index:', idx);
    if (idx >= 0) { openSong(idx); return; }
  }
  showSetlist();
});

window.addEventListener('beforeunload', (e) => {
  if (_dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
