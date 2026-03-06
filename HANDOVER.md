# BEYBOM Bass Player — AI Handover

> **Datum:** 2026-03-06  
> **Branch:** `dev`  
> **Repo:** `Volymdigital/beybom-bass`

---

## 1. Vad är BEYBOM?

En **single-page web-app** (ren HTML/CSS/JS, inga ramverk) för basister i liveband. Appen visar:

- **Setlist** med alla låtar (tonart, artist, BPM)
- **Låtvy** med sektioner (INTRO, VERS, REF etc.) och turn-block med ackord
- **Transponering** i halvsteg (real-time)
- **Edit-mode** för att redigera sektioner, block, ackord direkt i appen
- **Drag-and-drop** (Sortable.js) för att ordna låtar och sektioner
- **Chord reference panel** (rå ackordtext per låt)

---

## 2. Filer

| Fil | Beskrivning |
|---|---|
| `index.html` | Hela appen (~2400 rader: CSS + HTML + JS) |
| `beybom-setlist.json` | **SSoT** — alla låtar med sektioner, ackord, instruktioner (32 låtar, 124 KB) |
| `ai-song-template.json` | Mall + instruktioner för AI att generera nya låtar i appens format |
| `.live-server.json` | Config för live-server (ignorerar setlist-filen) |
| `AGENTS.md` | Agent governance (Antigravity) |
| `beybom-bass.html` | Äldre version — IGNORERA |

---

## 3. Datamodell (JSON-schema)

```
Song {
  title: string
  artist: string
  key: string              // "F", "Bb", "C#m" etc.
  keyOffset: number        // Halvsteg transponering (0 = originaltonart)
  bpm: string | number
  notes: string
  tracksMode: "auto"|"on"|"off"
  chordRaw: string         // Råtext med ackord för referenspanelen
  sections: Section[]
}

Section {
  id: number               // Unikt ID
  name: string             // "INTRO", "VERS", "REF", "BRIDGE" etc. (VERSALER)
  turns: Turn[]
}

Turn (= "block" i UI) {
  id: number
  bars: number             // Antal takter (vanligen 2 eller 4)
  chords: string[]         // En sträng per takt: "Am", "G/B", "" (tom)
  type: "play"|"rest"|"warn"|"stop"
  instruction: string      // Fritext, t.ex. "Pump", "Ingen bas"
}
```

---

## 4. Arkitektur

### Persistence (SSoT)

```
START → fetch('beybom-setlist.json') → songs[] → render
                     ↓ (misslyckad fetch)
         localStorage (offline fallback)
                     ↓ (ingen localStorage)
         DEFAULT_SONGS (hårdkodad i index.html)

SPARA-knapp → showSaveFilePicker → skriver songs[] till vald .json-fil
saveState() → skriver till localStorage (sessionscache vid varje ändring)
```

- **SSoT:** `beybom-setlist.json` fetchar vid varje sidladdning
- **localStorage:** Sessionscache. Varje ändring sparas automatiskt till localStorage
- **SPARA:** Manuell knapp i topbaren. Använder File System Access API (`showSaveFilePicker`)
- **Ingen databas, ingen backend, ingen IndexedDB** — allt är lokal JSON

### Rendering

```
showSetlist() → renderar låtlistan
openSong(i)  → renderar sektioner + turn-blocks
  └── renderSections() → itererar sections[]
       └── buildSectionRow() → sektionsrad med alla turn-blocks
            └── buildTurnBlock() → enskilt block med ackord, typ-farg, instruktion
```

### Transponering

```
songs[i].key = originaltonart (t.ex. "F")
songs[i].keyOffset = halvsteg (+/- heltal)
Visad tonart = transposeNote(key, keyOffset)
Visade ackord = transposeChord(chord, keyOffset)
```

### Lägen

- **LIVE** (default) — inga edit-kontroller synliga
- **EDIT** — knappar för att ändra ackord, instruktion, taktantal, typ, radera/duplicera block

---

## 5. Nyckel-funktioner i JS

| Funktion | Rad (ca) | Beskrivning |
|---|---|---|
| `loadState()` | 1298 | Fetchar SSoT, fallback till localStorage |
| `saveState()` | 1350 | Skriver till localStorage |
| `manualSave()` | 2357 | SPARA-knappen: File System API save picker |
| `showSetlist()` | 1416 | Renderar setlist-vyn |
| `openSong(i)` | 1710 | Öppnar låtvy, renderar sektioner |
| `renderSections()` | 1835 | Bygger alla sektionsrader |
| `buildSectionRow()` | 1880 | Bygger en sektionsrad med turn-blocks |
| `buildTurnBlock()` | 1940 | Bygger enskilt block (ackord, typ, instruktion) |
| `transposeNote()` | 2128 | Transponerar enskild not |
| `transposeChord()` | 2145 | Transponerar helt ackord (inkl. slash) |
| `migrateSong()` | 1269 | Migrerar äldre dataformat till nytt |
| `toggleMode()` | 1697 | Växlar LIVE/EDIT |
| `exportJSON()` | 2233 | Exporterar hela setlisten som JSON |
| `importJSON()` | 2250 | Importerar JSON-fil |

---

## 6. Styling

- **CSS Variables** definierade i `:root` (rad ~12–40)
- Dark theme med grön accent (`--accent: #6EE7B7`)
- Monospace-font (`JetBrains Mono`) för ackord och etiketter
- Turn-block-typer har färgkodning:
  - `play` → grön (accent)
  - `rest` → dämpad (ingen bas)
  - `warn` → gul/orange
  - `stop` → röd

---

## 7. AI Song Template

Filen `ai-song-template.json` innehåller:
- `_instructions` — steg-för-steg guide + promptmall
- `_schema` — alla fält förklarade
- `_example` — komplett exempellåt

**Flöde:**
1. Ge AI:n promptmallen + låtinfo (titel, artist, tonart, ackordschema)
2. AI returnerar JSON-array
3. Importera via **↑ JSON** i appen

---

## 8. Kända begränsningar

1. **Blandad data i SSoT** — `beybom-setlist.json` innehåller `legacySections` (äldre format) på befintliga låtar. `migrateSong()` hanterar detta men det bör städas bort vid tillfälle.
2. **Sortable.js inline** — hela biblioteket (rad 7–9, minifierat) ligger inlined i `<script>`. Borde extraheras till egen fil.
3. **DEFAULT_SONGS** — hårdkodade default-låtar i JS. Används som sista fallback om fetch + localStorage misslyckas. Kan tas bort om SSoT-filen alltid är tillgänglig.
4. **Setlists** — stöd finns men sparas enbart i localStorage (inte i SSoT-filen). Bör migreras till SSoT.
5. **Ingen autosave till fil** — enbart manuellt via SPARA. Autosave togs bort medvetet pga live-server-konflikter.

---

## 9. Utvecklingsflöde

```bash
# Starta dev-server (ignorerar beybom-setlist.json vid filändringar)
npx -y live-server --port=3000 --no-browser --ignore=beybom-setlist.json,.git

# Redigera index.html — live-reload sker automatiskt
# Redigera beybom-setlist.json — ladda om sidan manuellt

# Committa
git add -A && git commit -m "beskrivning" && git push origin dev
```

---

## 10. Framtida utveckling

Strategiska områden att vidareutveckla:

1. **PWA / Offline** — Service worker + manifest för installation som app
2. **Setlist-SSoT** — migrera setlists från localStorage till JSON-filen
3. **Audio tracks** — integration med ljudfiler per låt (play/pause per sektion)
4. **Multi-user sync** — t.ex. via GitHub raw file eller enkel backend
5. **AI-pipeline** — automatisera processen: noter → AI-analys → JSON → import
6. **PDF export** — för utskrift av setlist/ackordblad
7. **Performance view** — förenklad vy med scrollande ackord, tänkt för live-uppspelning

---

*Denna fil är avsedd att ges till en extern AI (ChatGPT, Claude, etc.) som kontext för att fortsätta utvecklingen.*
