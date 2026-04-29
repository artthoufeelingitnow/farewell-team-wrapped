# Goodbye Wrapped — Project Context

## What this is

A personal goodbye gift for colleagues at **Pathlight School (Digital Academy)**. Built by Michael as a single self-contained HTML file. Each colleague gets their own custom Spotify-Wrapped-style slide deck — gated behind a password they receive privately.

The vibe: a heartfelt mini-memoir, framed as a wrapped recap. Not a generic "thanks for everything" — each deck is custom-built per person.

## Architecture

**One file, three modes**, switched by URL hash:

| Route | Mode | Who sees it |
|---|---|---|
| `#` (default) | **Landing** | Visitors — bubble grid of names |
| `#admin` | **Admin tool** | Michael only — build/edit decks |
| (internal) | **Player** | Visitors after password auth |

State machine lives in `state.view` (`'landing' | 'admin' | 'player'`).

### Data model

```js
state.data = {
  meta: { title, subtitle, farewellNote },
  colleagues: [
    {
      id, name, passwordHash,  // SHA-256 of password
      slides: [
        { type, bg, ...typeSpecificFields, songUrl?, songStart?, songDuration? }
      ]
    }
  ]
}
```

**Slide types** (registered in `SLIDE_TYPES`):
- `intro` — opener with eyebrow + title + sub
- `stat` — big number/text + label + caption
- `photo` — single polaroid-framed photo with caption
- `quote` — large italic quote + attribution
- `podium` — top 3 ranked items (visually arranged 2nd / 1st / 3rd)
- `letter` — long-form heartfelt message (scrollable)
- `mosaic` — 3x3 photo grid
- `signoff` — final card with replay/close buttons

### Persistence

- **During editing:** `localStorage` under key `goodbye_wrapped_data_v1` (auto-saves on every input)
- **For sharing:** admin "Export final file" button bakes data into a `<script id="embedded-data" type="application/json">` tag inside a copy of the HTML. The exported file checks for this tag on boot via `loadEmbeddedData()` — if present, it overrides localStorage.

### Audio engine

- **Source:** iTunes Search API (`https://itunes.apple.com/search`) — no auth, ~20 req/min, returns 30s preview URLs
- **Why not Spotify:** Spotify killed `previewUrl` for new apps in late 2024; not coming back
- **Playback:** two `Audio` elements (`audio.current`, `audio.next`) for crossfading between slides
- **Fade:** 600ms (`FADE_MS` constant), 20-step volume ramp via `fadeAudio()`
- **Autoplay:** password unlock counts as user gesture, so `play()` resolves; if it rejects, `showUnmutePrompt()` overlay appears
- **Per-slide config:** `songStart` (0–25s into the 30s preview) and `songDuration` (3000–30000ms, drives both audio length and slide duration)

## Conventions

### Fonts
- **Display:** Jua (Google Fonts) — Michael's signature font, single weight 400
- **Body:** Nunito — paired with Jua for readability
- Defined as CSS vars: `--font-display`, `--font-body`
- **Jua applies to:** landing title, name bubbles, password modal greeting, slide titles/eyebrows/big numbers, quote bodies, podium ranks, letter greeting + signoff
- **Nunito applies to:** letter bodies, all admin UI, small text

### Color palette (slide gradients)
```
bg-pink   FF6B9D → C9184A
bg-orange FF8C42 → D32F2F
bg-teal   4ECDC4 → 1A535C
bg-purple B57EDC → 5E2A8C
bg-yellow FFC75F → F39C12  (uses dark text)
bg-green  06D6A0 → 115E47
bg-blue   4FC3F7 → 1E3A8A
bg-dark   1a1a1a → 000
bg-cream  FFF8E7 → F5DEB3  (uses dark text)
```

### Code style
- **Vanilla JS, no frameworks, no build step** — keep it that way
- Single render function per view (`renderLanding`, `renderAdmin`, `renderPlayer`) — innerHTML the world, then re-bind events
- Event delegation via `data-*` attributes
- Always `escapeHtml()` user content before injecting into innerHTML
- Helper `escapeAttr()` is just `escapeHtml()` — use it for clarity in attributes
- `uid()` returns 8-char base36 IDs

## Gotchas (Michael, READ THIS)

### 1. The `</script>` parsing trap
The HTML parser closes a `<script>` tag the moment it sees `</script>` *anywhere* inside, including in string literals and regexes. This already bit us once.

**Never write `</script>` as a literal inside the main script block.** Use string concatenation:
```js
const closeTag = '<' + '/' + 'script>';  // safe
const closeTagRe = new RegExp('<' + '\\/' + 'script>', 'g');
```
Search `buildExportHtml()` for the pattern.

### 2. Transient admin state in the data
Admin-only UI state leaks into `state.data.colleagues[].slides[]`:
- `showSongPicker`, `songSearchQuery`, `songSearchResults`, `songSearching`, `songSearchTimer`

These get auto-saved to localStorage. The `exportFinal()` function strips them before bake. **If you add new transient fields, add them to the strip list in `exportFinal()`** or the export will bloat with stale search results.

### 3. Search input focus stealing
Typing in the song search would lose focus on every keystroke if we re-rendered the whole admin. `renderSongResultsOnly()` does a surgical update of just the results div. Don't replace it with a full re-render.

### 4. iTunes preview URLs are fixed
The 30s clip Apple returns always starts at the same point in the song (usually the chorus). `songStart` only skips forward inside that 30s window — it can't reach into other parts of the original track.

### 5. Photo size
Each photo is base64-embedded. `compressImage()` shrinks to 900px max @ 0.85 JPEG quality. A colleague with 9 mosaic photos + 3 single photos can easily push their slice past 5MB. Watch the export size; if it gets unwieldy, drop maxDim or be more selective with photos.

### 6. localStorage scope
Editing on laptop ≠ editing on phone. They have separate localStorage. **Pick one device for admin work**, or export frequently as a manual backup.

### 7. Songs need internet at view time
Song URLs reference Apple's CDN, not embedded audio. Colleagues must be online when they view their wrapped. Acceptable tradeoff (each song = ~150 chars vs. ~500KB embedded).

### 8. Password security caveat
Passwords are SHA-256 hashed before storage, but this is static HTML — a determined techie could view source, see the hashes, and brute-force or just bypass the check entirely. **Goal is casual privacy, not real security.** Don't put anything in a deck that would be a problem if leaked.

## Common tasks

| Task | Where to look |
|---|---|
| Add a new slide type | `SLIDE_TYPES` registry → `makeDefaultSlide()` → `renderSlideContent()` → `renderSlideFields()` |
| Add a new admin field | Find the slide editor's `renderSlideFields()` case → add `f('fieldname', 'Label')` |
| Tweak slide timing | `DEFAULT_SLIDE_DURATION` constant (per-slide `songDuration` overrides) |
| Tweak crossfade | `FADE_MS` constant |
| Change slide gradient | `bg-*` CSS classes near top of `<style>` |
| Modify export packaging | `exportFinal()` and `buildExportHtml()` |
| Touch the password flow | `promptPassword()` and `sha256()` |

## Hosting

The exported file is fully self-contained except for fonts (Google Fonts CDN) and song URLs (Apple CDN). Both need internet at view time.

**Hosting options:**
- **Netlify Drop** — drag and drop, no repo, source not browseable. Best for private sharing.
- **GitHub Pages** — public repo means source is browseable. Fine for the website itself (passwords gate the content), but the repo lays bare the underlying photos and letter text.

**Before sharing:** test the exported file end-to-end yourself. Open it, click a name, type the password, watch the deck through with sound on.

## Don't break

- The single-file constraint
- The "no build step" rule — no React, no bundlers
- Auto-save on every edit (don't introduce a manual "save" requirement)
- The export flow (it's the entire point of the admin tool)
- The password gate (no plaintext passwords in the file, ever)
