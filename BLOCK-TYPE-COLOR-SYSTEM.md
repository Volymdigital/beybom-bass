# Blad Songs — Block Type & Color System (Export for ChatGPT)

> **Datum:** 2026-03-06
> **Syfte:** Strategiunderlag för att vidareutveckla färgsättningen i appen

---

## 1. Begreppsmodell

```
Song
 └── Section (INTRO, VERS, REF, BRIDGE, OUTRO, etc.)
      └── Turn (= "block" i UI)
           ├── type: "play" | "rest" | "warn" | "stop"
           ├── chords: string[]     ← en per takt
           ├── bars: number         ← antal takter (2 eller 4)
           └── instruction: string  ← fritext, t.ex. "Pump", "Ingen bas"
```

Varje **Turn** (block) renderas som en `.turn-block` div i UI:t. Typen styr bakgrundsfärg.

---

## 2. De fyra blocktyperna

| Type | Internt värde | Syfte | Visuell indikation | Musikalisk betydelse |
|------|---------------|-------|---------------------|---------------------|
| **PLAY** | `"play"` | Spela normalt | Mörkgrön bakgrund | Basisten spelar |
| **REST** | `"rest"` | Tyst/ingen bas | Grå bakgrund, dämpad text/ackord | Basisten är tyst |
| **WARN** | `"warn"` | Obs/uppmärksamhet | Gul/bärnsten bakgrund | Ovanligt parti, öva extra |
| **STOP** | `"stop"` | Stopp/avbrott | Mörkröd bakgrund | Totalt stopp, farlig sektion |

---

## 3. CSS-variabler & hex-värden

Definierade i `:root` (index.html rad 30–38):

| CSS-variabel | Hex-värde | Typ | Beskrivning |
|---|---|---|---|
| `--play` | `#0B5A2A` | play, jämna block | Mörkgrön |
| `--play-alt` | `#07451F` | play, udda block | Ännu mörkare grön |
| `--rest` | `#3A3A3A` | rest, jämna block | Neutral grå |
| `--rest-alt` | `#2F2F2F` | rest, udda block | Mörkare grå |
| `--marks` | `#564300` | warn, jämna block | Bärnsten/gul |
| `--marks-alt` | `#433400` | warn, udda block | Mörkare bärnsten |
| `--stop` | `#3B0010` | stop, jämna block | Mörkröd |
| `--stop-alt` | `#2C000B` | stop, udda block | Ännu mörkare röd |

**Alternering:** Varannat block (udda index) får en `-alt`-variant för visuell separation.

### Övriga relevanta UI-variabler

| CSS-variabel | Hex-värde | Användning |
|---|---|---|
| `--bg` | `#0B0B0B` | App-bakgrund |
| `--panel` | `#121212` | Paneler |
| `--panel2` | `#161616` | Sekundära paneler |
| `--accent` | `#00E676` | Accentfärg (grön) |
| `--text` | `#EDEDED` | Primär text |
| `--text-dim` | `#B9B9B9` | Dämpad text |
| `--text-muted` | `#8A8A8A` | Mycket dämpad text |

---

## 4. CSS-klasser som appliceras

Definierade i index.html rad 427–445:

```css
/* Default (play, jämnt block) */
.turn-block { background: var(--play); }

/* Alternering (udda block) */
.turn-block.play-alt { background: var(--play-alt); }

/* Rest */
.turn-block.rest     { background: var(--rest); }
.turn-block.rest.alt { background: var(--rest-alt); }

/* Warn */
.turn-block.warn     { background: var(--marks); }
.turn-block.warn.alt { background: var(--marks-alt); }

/* Stop */
.turn-block.stop     { background: var(--stop); }
.turn-block.stop.alt { background: var(--stop-alt); }
```

### Tilläggseffekter för REST-block (dämpad rendering)

```css
.turn-block.rest .turn-rest-btn    { opacity: 0.6; color: #aaa; }
.turn-block.rest .chord-slot-text  { opacity: 0.4; }
.turn-block.rest .chord-token      { opacity: 0.45; }
.turn-block.rest .turn-instruction { color: rgba(255,255,255,0.3); }
```

---

## 5. JS-funktioner som hanterar typer

### `buildTurnBlock(turn, si, ti, offset, song)` — Rad 1949

Renderar ett block. Bestämmer CSS-klasser baserat på `turn.type`:

```javascript
const typeClass = turn.type === 'rest' ? 'rest'
                : turn.type === 'warn' ? 'warn'
                : turn.type === 'stop' ? 'stop'
                : '';  // play = ingen extra klass

const altClass = ti % 2 === 1
  ? (turn.type === 'play' ? 'play-alt' : 'alt')
  : '';

block.className = `turn-block ${typeClass} ${altClass}`;
```

### `makeTurn(chords, instruction, bars, type)` — Rad 1035

Skapar ett turn-objekt. Default type: `'play'`.

### `toggleTurnRest(si, ti)` — Rad 2030

Togglar ett block mellan `play` ↔ `rest`:

```javascript
turn.type = turn.type === 'rest' ? 'play' : 'rest';
```

### `updateTurnType(si, ti, value)` — Rad 2046

Sätter typen direkt (från dropdown i edit-mode):

```javascript
songs[currentSongIndex].sections[si].turns[ti].type = value;
// value = 'play' | 'rest' | 'warn' | 'stop'
```

### Edit-mode typ-dropdown — Rad 2020

```javascript
${['play','rest','warn','stop'].map(t =>
  `<option value="${t}"${turn.type===t?' selected':''}>${t.toUpperCase()}</option>`
).join('')}
```

### `parseInstructions(raw)` — Rad 1121 (legacy)

Auto-detektering av typ baserat på nyckelord i instruktioner:

| Nyckelord | → type |
|---|---|
| `ingen bas`, `ingen bass`, `tyst`, `inget` | `rest` |
| `obs`, `öva`, `varning`, `höjning`, `annorlunda`, `prickar` | `warn` |
| `stopp`, `stop`, `slut` | `danger` → `stop` |

### `parseLegacySections(rawSections, chordRaw)` — Rad 1081

Konverterar legacy-format. Mappar `type === 'danger'` → `'stop'`.

---

## 6. Layer-system

Block-bakgrund kan avaktiveras via layers:

```javascript
if (!layers.blocks) block.style.background = 'var(--panel2)';
```

`var(--panel2)` = `#161616` (neutral, ingen typfärg).

---

## 7. Sammanfattande dataflöde

```
beybom-setlist.json
  └── turn.type: "play"|"rest"|"warn"|"stop"
       │
       ├── buildTurnBlock() → CSS-klass: "", "rest", "warn", "stop"
       │                    → Alt-klass: "play-alt" / "alt" (varannat block)
       │
       ├── CSS → bakgrundsfärg via --play/--rest/--marks/--stop
       │       → dämpad text/ackord-opacity för rest
       │
       ├── toggleTurnRest() → togglar play ↔ rest (snabbknapp)
       │
       └── updateTurnType() → sätter valfri typ (dropdown i edit-mode)
```

---

## 8. Strategisk analys för färgsättning

### Nuvarande tillstånd

- **Play** och **Play-alt** skiljer sig minimalt (`#0B5A2A` vs `#07451F`) — kan vara svårt att se skillnaden
- **Rest** använder neutral grå — bra, men ingenting särskiljer det på långt håll
- **Warn** använder bärnsten — fungerar men är väldigt mörkt (`#564300`)
- **Stop** använder mörkröd — svår att urskilja mot `--bg` (#0B0B0B)

### Möjliga förbättringsområden

1. **Kontrast:** Alla typfärger är väldigt mörka. Överväg ljusare nyanser eller thinner color accents (border-left, gradient)
2. **Border/pip-system:** Istället för (eller utöver) bakgrund, använd en vänster-border-pip med starkare färg
3. **Icon/emoji:** Visa typspecifika ikoner (▶ play, ◼ rest, ⚠ warn, ⛔ stop)
4. **Sektionsheader-färg:** Sektionsnamnet (INTRO, VERS etc.) kan ärva sin dominerande block-typ-färg
5. **Print-läge:** Rest-block kan vara helt gråskalade, stop-block kan ha en tydlig röd markering
6. **Accessibility:** Testa WCAG-kontrast mot bakgrunden — särskilt `--stop` mot `--bg`

---

*Denna fil är avsedd att ges till ChatGPT som kontext för att utveckla en färgstrategi för Blad Songs-appen.*
