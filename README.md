# EPS Korean Vocabulary Quiz

A framework-free listening + reading quiz built from `database.json` — the
EPS-TOPIK Standard Korean Textbook 1 & 2 word list (Lessons 1–60, 1,502 words)
with Bangla meanings and per-word audio.

## Run it
Serve the folder with any static server (audio and `database.json` must be
fetched over HTTP, not `file://`), e.g.:

    npx serve .          # or: python3 -m http.server 8080

Then open the printed URL.

## Audio files
Every clip is named after the word's **`id`** in `database.json`:

| Folder | Plays | Example (word id 42) |
| --- | --- | --- |
| `audio/kor/` | the Korean word | `audio/kor/42.mp3` |
| `audio/bng/` | the Bangla word | `audio/bng/42.mp3` |
| `audio/eng/` | the English word | `audio/eng/42.mp3` |

If a file is missing, the play button shows an inline hint instead of failing
silently. In Listen mode a missing Bangla clip falls back to the English one;
if neither exists the app shows a brief hint and moves on instead of getting stuck.

## Modes
- **Exam** — hear the Korean audio, pick the matching meaning from four options.
- **Reading** — paginated flashcards (6 words per page, 2 columns): optional CSS-drawn image, Korean word,
  meaning, lesson and book page. Tap a card to hear it. Use the **Image** option on the start screen
  (With image / Only text) to show or hide images.
- **Listen** — hands-free drill: Korean audio followed immediately by the
  Bangla or English audio (whichever **Language** is selected), repeated 1–10×,
  moving to the next word automatically and looping until you press Stop.
  Choose a batch of the word list (5 / 6-10 / 11-15 / … / All).

## Filters
- **Lesson** chips (1–60; lessons with no words are hidden). Pick several
  lessons, use **Book 1** / **Book 2** to select a whole book, or **Select all**.
- **Order**: Random or Serial.
- **Language**: বাংলা or English — applies to Exam and Listen (Reading has no Language option and always shows Korean + Bangla + English): the
  on-screen meaning is the `bengali` or `english` text from `database.json`
  (Korean + Bangla, or Korean + English), and Listen plays the matching audio after
  the Korean clip. A word with no `english` text falls back to its Bangla meaning.

## database.json
```json
{
  "lessons": [
    { "lesson": 6, "book": 1, "title_ko": "...", "title_bn": "...",
      "words": [ { "id": 2, "korean": "나라", "bengali": "দেশ", "page": 67 } ] }
  ]
}
```
`id` is unique across all 1,502 words and is the audio filename.
Lessons 2–5 have no words (they are hangul / greeting lessons without a word-index entry).

## Files
- `index.html` – markup for all screens (start, quiz, reading, listen, result, review)
- `style.css`  – design tokens, light/dark themes, layout, animations
- `data.js`    – database loading, filtering, exam/session-building helpers, audio paths
- `script.js`  – app state, rendering, event wiring, localStorage stats
- `database.json` – the vocabulary source of truth

## Notes
- Exam questions draw unique words from the filtered pool; each question's 3
  distractors have different meanings and never equal the answer.
- Reading sessions are ungraded — they're for study, not scoring.
- Stats persist in `localStorage` under `epsKoreanQuiz.stats.v1` (Exam results only);
  theme under `epsKoreanQuiz.theme.v1`.
- Respects `prefers-reduced-motion` and is keyboard-navigable.

## Topik / category filter (start screen)
The chips are listed in this order: **Textbook 1**, **Textbook 2**, then **Topik 1 – 6**.

- **Topik 1 – 6** (lessons 61–66, extra vocabulary): pick a Topik, then choose from its categories. A newly selected Topik starts with only its first category selected.
- **Textbook 1** (lessons 1–30) and **Textbook 2** (lessons 31–60): their "categories" are the lessons.
- Mode and Order sit at the top; Order defaults to Random.
- **Multiple** checkboxes (default off) sit next to Topik, Category/Lesson and, in Listen mode, "How many words". Unchecked: choosing a chip selects only that one. Checked: chips toggle, so several can be selected at once (Select all / Clear all appear too).

## Reading counts
In Reading mode the count chips are multiples of 6 (6 / 12 / 18 / 24 / 30 / All) so every page is full.

## Word images (optional)
Images live in a separate file, `image.json`, next to `index.html`. It is an array of
`{ "id", "korean", "english", "svg" }` (`svg` is the SVG markup as a string, `viewBox='0 0 120 120'`),
joined to `database.json` by `id`. The app parses each SVG, strips scripts/event attributes and makes its ids unique. Reading mode shows it above the Korean word when **Image → With image** is selected.
Words that have no entry (or an empty `svg`) simply show no image, and if `image.json` is missing the app
still works without images. Like `database.json`, it must be served over HTTP.

## Listen mode: instant hand-off + speed
Listen mode runs on the Web Audio API so the Bangla/English clip follows the Korean word within ~5 ms (the limit is 10 ms):
- Both clips of a word are fetched and decoded **before** it plays, and the next 3 words are loaded while the current one plays.
- The Korean clip's real audible end is measured (trailing silence in the mp3 is ignored).
- Both clips are scheduled on the audio clock together: Korean at `t0`, meaning at `t0 + koreanAudibleEnd + 5 ms` (`KO_TO_MEANING_GAP` in `script.js`). No timers or `ended` events are involved in this hand-off.
- **Speed** chips (0.5× – 2×) use a pitch-preserving time-stretch (WSOLA), so the voice stays natural. Changing speed restarts the current word at the new speed; the choice is remembered in `localStorage` (`epsKoreanQuiz.listenSpeed.v1`).
- Audio must be served over HTTP (not `file://`) because clips are fetched and decoded.
