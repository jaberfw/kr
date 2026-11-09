/* ==========================================================================
   data.js
   Static config + pure data helpers for the EPS Korean Vocabulary Quiz.
   No DOM access happens in this file — it only loads/filters/shapes data
   for script.js to render. Depends on database.json (fetched at runtime).
   ========================================================================== */

/** Path to the vocabulary database, relative to index.html. */
const DATABASE_PATH = 'database.json';

/**
 * Path to the word images, relative to index.html. image.json is an array of
 * { id, korean, english, svg } joined to the vocabulary by `id`.
 * It is optional: if the file is missing the app simply shows no images.
 */
const IMAGE_PATH = 'image.json';

/** Lessons in display order (1-60). Only lessons that have words are shown as chips. */
const LEVEL_ORDER = Array.from({ length: 60 }, (_, i) => String(i + 1));

/** Every exam offers exactly this many MCQ options per question. */
const OPTIONS_PER_QUESTION = 4;

/** Question-count choices offered on the start screen. 'all' uses the entire filtered pool. */
const QUESTION_COUNT_CHOICES = [10, 20, 30, 50, 'all'];

/** Count choices in Reading mode: multiples of 6 (one page = 6 words). */
const READING_COUNT_CHOICES = [6, 12, 18, 24, 30, 'all'];

/** Bucket size (in words) used to build the "how many words" choices in Listen mode. */
const LISTEN_RANGE_STEP = 5;

/** Listen mode starts on the first batch. */
const DEFAULT_LISTEN_RANGE_ID = `1-${LISTEN_RANGE_STEP}`;

/**
 * Builds the "how many words" choices offered in Listen mode, sized to the current
 * filtered pool. Each choice is a *slice* of the pool (words 1-5, 6-10, 11-15, …) in
 * steps of `LISTEN_RANGE_STEP`, so the number and range of buckets always matches how
 * many words are actually available in the selected lessons. An "All" choice
 * is appended once there's more than one bucket. `end: null` on the "All" entry means
 * "to the end of the pool".
 * @param {number} poolSize - size of the currently filtered word pool.
 * @returns {Array<{id:string, label:string, start:number, end:number|null}>}
 */
function buildListenRanges(poolSize) {
  if (!poolSize || poolSize < 1) {
    return [{ id: 'all', label: 'All', start: 1, end: null }];
  }

  const ranges = [];
  let start = 1;
  while (start <= poolSize) {
    const end = Math.min(start + LISTEN_RANGE_STEP - 1, poolSize);
    const label = start === 1 ? `${end}` : `${start}-${end}`;
    ranges.push({ id: `${start}-${end}`, label, start, end });
    start = end + 1;
  }

  // A lone bucket already covers the whole pool, so only add a separate
  // "All" chip once there's more than one bucket to choose between.
  if (ranges.length > 1) {
    ranges.push({ id: 'all', label: 'All', start: 1, end: null });
  }
  return ranges;
}

/** Looks up a Listen range by id within `choices`, falling back to the first entry. */
function listenRangeById(id, choices) {
  const list = choices && choices.length ? choices : [{ id: 'all', label: 'All', start: 1, end: null }];
  return list.find((r) => r.id === id) || list[0];
}

/** Returns the words of `pool` that fall inside `range` (1-based, inclusive). */
function sliceByRange(pool, range) {
  if (!range || range.id === 'all') return pool.slice();
  const from = Math.max(0, range.start - 1);
  const to = range.end == null ? pool.length : range.end;
  return pool.slice(from, to);
}

/** Minimum words a filtered pool must contain to generate a valid exam (1 correct + 3 distractors). */
const MIN_POOL_SIZE = OPTIONS_PER_QUESTION;

/** Words shown per page in Reading mode (laid out in 2 columns). */
const READING_PAGE_SIZE = 6;

/**
 * Audio folders. Every clip is named after the word's numeric id in database.json,
 * e.g. the word with id 42 -> audio/kor/42.mp3, audio/bng/42.mp3, audio/eng/42.mp3.
 */
const AUDIO_KO_PREFIX = 'audio/kor/';
const AUDIO_BN_PREFIX = 'audio/bng/';
const AUDIO_EN_PREFIX = 'audio/eng/';
const AUDIO_EXTENSION = '.mp3';

/** How-many-times-to-repeat choices offered for Listen mode. Default is 3. */
const REPEAT_COUNT_CHOICES = [1, 2, 3, 5, 10];
const DEFAULT_REPEAT_COUNT = 3;

/** localStorage key for persisted lifetime stats. */
const STATS_STORAGE_KEY = 'epsKoreanQuiz.stats.v1';

/** localStorage key for the saved theme preference. */
const THEME_STORAGE_KEY = 'epsKoreanQuiz.theme.v1';

/** Shape used for the persisted stats object (also the default/reset value). */
const DEFAULT_STATS = Object.freeze({
  attempts: 0,
  bestScore: 0,
  totalCorrect: 0,
  totalWrong: 0,
  scoreSum: 0,
});

/**
 * Topik grouping. Lessons 61-66 are "Topik 1" - "Topik 6" (extra vocabulary) and use
 * each word's own `category` as the second-level filter. Lessons 1-30 are "Textbook 1"
 * and lessons 31-60 are "Textbook 2"; their second-level filter is the lesson itself
 * ("Lesson 6"), so a word's original category is kept in `topicCategory`.
 */
function topicInfoForLesson(lessonNumber) {
  if (lessonNumber >= 61) {
    const n = lessonNumber - 60;
    return { key: `topic${n}`, label: `Topik ${n}`, short: `Topik ${n}`, order: 10 + n, byLesson: false };
  }
  if (lessonNumber <= 30) {
    return { key: 'textbook1', label: 'Textbook 1', short: 'Textbook 1', order: 1, byLesson: true };
  }
  return { key: 'textbook2', label: 'Textbook 2', short: 'Textbook 2', order: 2, byLesson: true };
}

/** True for the two textbook groups (whose categories are lessons). */
function isTextbookTopic(topicKey) {
  return topicKey === 'textbook1' || topicKey === 'textbook2';
}

/** Short tag for a word's source, e.g. 'Topik 3' or 'Lesson 7'. */
function wordTag(word) {
  return isTextbookTopic(word.topic) ? levelLabel(word.level) : topicInfoForLesson(word.lesson).short;
}

/** Longer tag for a word's source, e.g. 'Topik 3 · Daily Actions' or 'Lesson 7 · Book 1 · p.82 · Places'. */
function wordDetailTag(word) {
  if (isTextbookTopic(word.topic)) {
    const page = word.page !== '' && word.page != null ? ` · p.${word.page}` : '';
    const cat = word.topicCategory ? ` · ${word.topicCategory}` : '';
    return `${levelLabel(word.level)} · Book ${word.book}${page}${cat}`;
  }
  return `${wordTag(word)} · ${word.category}`;
}

/**
 * Filters `words` by a selection: a Map of topic key -> Set of selected category names.
 * A word is kept when its topic is in the map and its category is in that topic's set.
 */
function wordsForSelection(words, selection) {
  if (!selection || selection.size === 0) return [];
  return words.filter((w) => {
    const cats = selection.get(w.topic);
    return cats && cats.has(w.category);
  });
}

/**
 * Loads and caches the vocabulary database, then flattens its lessons into one
 * word list. database.json is shaped { lessons: [{ lesson, book, title_ko,
 * title_bn, words: [{ id, korean, bengali, page }] }] }.
 *
 * Each flattened word looks like:
 *   { id, korean, bangla, page, level:'6', lesson:6, book:1, lessonTitleKo, lessonTitleBn }
 * ("level" is the lesson number as a string — it is the key the lesson filter uses.)
 *
 * @returns {Promise<{words:Array, levels:Object, levelBook:Object}>}
 */
let _dbPromise = null;
let _wordsById = new Map();
function loadDatabase() {
  if (!_dbPromise) {
    // image.json is optional: any problem loading it (missing, invalid) just means "no images".
    const imagesPromise = fetch(IMAGE_PATH)
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => (Array.isArray(list) ? list : []))
      .catch(() => []);

    _dbPromise = fetch(DATABASE_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load database (${res.status})`);
        return res.json();
      })
      .then((raw) => imagesPromise.then((images) => [raw, images]))
      .then(([raw, images]) => {
        // id -> image entry. Entries with an empty svg (words that cannot be drawn) are ignored.
        const imageById = new Map();
        images.forEach((img) => {
          if (img && img.id != null && typeof img.svg === 'string' && img.svg.trim()) imageById.set(Number(img.id), img);
        });

        const words = [];
        const levels = {};     // lesson key -> number of words
        const levelBook = {};  // lesson key -> book number (1 or 2)
        const topicMap = {};   // topic key -> { key, label, short, order, count, cats: {name: count} }

        (raw.lessons || []).forEach((lesson) => {
          const key = String(lesson.lesson);
          const topic = topicInfoForLesson(lesson.lesson);
          (lesson.words || []).forEach((w) => {
            const rawCategory = w.category || 'Other';
            // Textbook words are filtered by lesson; Topik words by their own category.
            const category = topic.byLesson ? levelLabel(key) : rawCategory;
            words.push({
              id: w.id,
              korean: w.korean,
              bangla: w.bengali,
              english: w.english || '',
              // Optional SVG image (markup string), looked up in image.json by id. Empty when the word has none.
              imgSvg: (imageById.get(Number(w.id)) || {}).svg || '',
              options: Array.isArray(w.options) ? w.options : [],
              page: w.page,
              level: key,
              lesson: lesson.lesson,
              book: lesson.book,
              lessonTitleKo: lesson.title_ko,
              lessonTitleBn: lesson.title_bn,
              topic: topic.key,
              category,
              topicCategory: topic.byLesson ? rawCategory : '',
            });
            levels[key] = (levels[key] || 0) + 1;
            levelBook[key] = lesson.book;

            const t = topicMap[topic.key] || (topicMap[topic.key] = { ...topic, count: 0, cats: {}, lessonNo: {} });
            t.count += 1;
            t.cats[category] = (t.cats[category] || 0) + 1;
            if (topic.byLesson) t.lessonNo[category] = lesson.lesson;
          });
        });

        // Ordered topic list; Topik categories sorted by size (then A-Z), textbook lessons in lesson order.
        const topics = Object.values(topicMap)
          .sort((a, b) => a.order - b.order)
          .map((t) => ({
            key: t.key,
            label: t.label,
            short: t.short,
            count: t.count,
            categories: Object.entries(t.cats)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => (t.byLesson
                ? t.lessonNo[a.name] - t.lessonNo[b.name]
                : b.count - a.count || a.name.localeCompare(b.name))),
          }));

        // id -> word lookup over the WHOLE database (options may point outside the selected lessons).
        _wordsById = new Map(words.map((w) => [w.id, w]));

        return { words, levels, levelBook, topics };
      });
  }
  return _dbPromise;
}

/** Human-friendly label for a lesson key ('6' -> 'Lesson 6'). */
function levelLabel(level) {
  return `Lesson ${level}`;
}

/** Filters `words` down to those whose lesson is in `levelSet` (Set of string keys). */
function wordsForLevels(words, levelSet) {
  if (!levelSet || levelSet.size === 0) return [];
  return words.filter((w) => levelSet.has(w.level));
}

/**
 * Meaning language chosen on the start screen: 'bangla' or 'english'. It decides which
 * meaning text Exam options, Reading cards, Listen and the result/review lists show
 * (Korean + Bangla, or Korean + English). script.js sets it via setMeaningLanguage().
 */
let _meaningLanguage = 'bangla';

function setMeaningLanguage(language) {
  _meaningLanguage = language === 'english' ? 'english' : 'bangla';
}

/**
 * Text shown for a word's meaning, in the selected language. If a word has no English
 * text in database.json, its Bangla meaning is shown instead so a card is never blank.
 */
function meaningInLanguage(word) {
  if (_meaningLanguage === 'english' && word.english) return word.english;
  return word.bangla || word.english || '—';
}

/** Display text for an MCQ option / flashcard. */
function optionLabel(word) {
  return meaningInLanguage(word);
}

/** Fisher-Yates shuffle. Returns a new array; does not mutate input. */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Picks `count` unique random items from `arr`, excluding any whose `key(item)` is in `excludeKeys`. */
function pickUniqueBy(arr, count, key, excludeKeys) {
  const excluded = new Set(excludeKeys);
  const seen = new Set();
  const pool = arr.filter((item) => {
    const k = key(item);
    if (excluded.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return shuffle(pool).slice(0, count);
}

/**
 * Builds a fresh exam from `pool` (already lesson-filtered). Exam mode plays the
 * Korean audio and asks the learner to pick the matching meaning among distractors.
 * @param {Array} pool - filtered word list to draw from.
 * @param {number} count - number of questions to generate.
 * @param {'random'|'serial'} [order='random'] - 'random' shuffles which words are asked
 *   and in what order; 'serial' keeps the pool's original order (first `count` words).
 * @returns {Array<{word:Object, options:Array, correctKey:string}>}
 */
function buildExam(pool, count, order = 'random') {
  const limit = Math.min(count, pool.length);
  const chosenWords = order === 'serial' ? pool.slice(0, limit) : shuffle(pool).slice(0, limit);
  const idKey = (w) => String(w.id);
  // Distractors must differ in *meaning text*, otherwise two options could look identical.
  const meaningKey = (w) => optionLabel(w);

  return chosenWords.map((word) => {
    // Distractors come from the word's own `options` id list (similar words), 3 picked at random.
    const need = OPTIONS_PER_QUESTION - 1;
    const optionPool = (word.options || []).map((id) => _wordsById.get(id)).filter(Boolean);
    let distractorWords = pickUniqueBy(optionPool, need, meaningKey, [meaningKey(word)]);
    if (distractorWords.length < need) {
      // Fallback (no/short options data): fill the rest from the selected pool.
      const used = [meaningKey(word), ...distractorWords.map(meaningKey)];
      distractorWords = distractorWords.concat(pickUniqueBy(pool, need - distractorWords.length, meaningKey, used));
    }
    const optionWords = shuffle([word, ...distractorWords]);

    const options = optionWords.map((w) => ({
      key: idKey(w),
      korean: w.korean,
      meaning: optionLabel(w),
    }));

    return {
      word,
      options,
      correctKey: idKey(word),
    };
  });
}

/**
 * Builds a Reading session: a slice of `pool`, later paged `READING_PAGE_SIZE`
 * words at a time. Reading mode is a study/flashcard flow (word + audio + answer shown
 * up front) rather than a scored quiz.
 * @param {Array} pool - filtered word list to draw from.
 * @param {number} count - number of words to include (already resolved from 'all').
 * @param {'random'|'serial'} [order='random'] - 'random' shuffles the words; 'serial'
 *   keeps the pool's original order (first `count` words).
 * @returns {Array} words for the session.
 */
function buildReadingSession(pool, count, order = 'random') {
  const limit = Math.min(count, pool.length);
  return order === 'serial' ? pool.slice(0, limit) : shuffle(pool).slice(0, limit);
}

/**
 * Returns the words of `pool` covered by one or more Listen ranges (kept in pool order).
 * @param {Array} pool
 * @param {Object|Array<Object>} ranges - a buildListenRanges() entry or a list of them.
 */
function sliceByRanges(pool, ranges) {
  const list = Array.isArray(ranges) ? ranges : [ranges];
  if (!list.length || list.some((r) => !r || r.id === 'all')) return pool.slice();
  const keep = new Set();
  list.forEach((r) => {
    const from = Math.max(0, r.start - 1);
    const to = r.end == null ? pool.length : r.end;
    for (let i = from; i < to && i < pool.length; i += 1) keep.add(i);
  });
  return pool.filter((_, i) => keep.has(i));
}

/**
 * Builds a Listen session: the words inside the chosen range(s) (such as words 11-15,
 * or several ranges at once), played back continuously by script.js — Korean audio
 * followed immediately by the Bangla or English audio, repeated.
 * @param {Array} pool - filtered word list to draw from.
 * @param {Object|Array<Object>} ranges - which slice(s) of the pool to study (see buildListenRanges()).
 * @param {'random'|'serial'} [order='random'] - 'random' shuffles the batch; 'serial'
 *   keeps the pool's original order.
 * @returns {Array} words for the session.
 */
function buildListenSession(pool, ranges, order = 'random') {
  const batch = sliceByRanges(pool, ranges);
  return order === 'serial' ? batch : shuffle(batch);
}

/** Path to a word's Korean audio file: audio/kor/<id>.mp3 */
function korAudioPath(word) {
  return word && word.id != null ? `${AUDIO_KO_PREFIX}${word.id}${AUDIO_EXTENSION}` : null;
}

/** Path to a word's Bangla audio file: audio/bng/<id>.mp3 */
function bnAudioPath(word) {
  return word && word.id != null ? `${AUDIO_BN_PREFIX}${word.id}${AUDIO_EXTENSION}` : null;
}

/** Path to a word's English audio file: audio/eng/<id>.mp3 */
function enAudioPath(word) {
  return word && word.id != null ? `${AUDIO_EN_PREFIX}${word.id}${AUDIO_EXTENSION}` : null;
}

/**
 * The meaning-side audio that should follow the Korean clip, matching whichever
 * language the learner picked on the start screen.
 * @param {Object} word
 * @param {'bangla'|'english'} [language='bangla']
 */
function meaningAudioPath(word, language = 'bangla') {
  return language === 'bangla' ? bnAudioPath(word) : enAudioPath(word);
}
