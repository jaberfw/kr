/* ==========================================================================
   script.js
   All behaviour for the EPS Korean Vocabulary Quiz. Depends on the pure helpers +
   constants defined in data.js (loaded first in index.html).
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * DOM references
   * ------------------------------------------------------------------ */
  const $ = (selector) => document.querySelector(selector);

  const screens = {
    start: $('#screen-start'),
    quiz: $('#screen-quiz'),
    reading: $('#screen-reading'),
    listen: $('#screen-listen'),
    result: $('#screen-result'),
    review: $('#screen-review'),
  };

  const el = {
    themeToggle: $('#theme-toggle'),

    dbLoading: $('#db-loading'),
    dbError: $('#db-error'),
    setup: $('#setup'),

    topicChips: $('#topic-chips'),
    topicToggleAll: $('#topic-toggle-all'),
    topicMulti: $('#topic-multi'),
    rangeMulti: $('#range-multi'),
    rangeMultiWrap: $('#range-multi-wrap'),
    categoryGroups: $('#category-groups'),
    modeToggle: $('#mode-toggle'),
    modeHint: $('#mode-hint'),
    orderToggle: $('#order-toggle'),
    examStyleSection: $('#exam-style-section'),
    examStyleToggle: $('#exam-style-toggle'),
    examStyleHint: $('#exam-style-hint'),
    examAudioToggle: $('#exam-audio-toggle'),
    wrongStats: $('#wrong-stats'),
    wrongStatsList: $('#wrong-stats-list'),
    languageToggle: $('#language-toggle'),
    countChips: $('#count-chips'),
    countHeading: $('#count-heading'),
    repeatSection: $('#repeat-section'),
    repeatChips: $('#repeat-chips'),
    poolInfo: $('#pool-info'),
    setupError: $('#setup-error'),
    startBtn: $('#start-btn'),

    resultToggleBtn: $('#result-toggle-btn'),
    statsGrid: $('#stats-grid'),
    statAttempts: $('#stat-attempts'),
    statBest: $('#stat-best'),
    statAverage: $('#stat-average'),
    statCorrect: $('#stat-total-correct'),
    statWrong: $('#stat-total-wrong'),

    progressLabel: $('#progress-label'),
    progressFill: $('#progress-fill'),
    quizLevelTag: $('#quiz-level-tag'),

    listenZone: $('#listen-zone'),
    playBtn: $('#play-btn'),
    playHint: $('#play-hint'),
    questionWord: $('#question-word'),

    optionsGrid: $('#options-grid'),
    feedback: $('#feedback'),
    feedbackText: $('#feedback-text'),
    stamp: $('#stamp'),
    quitBtn: $('#quit-btn'),
    quizHomeBtn: $('#quiz-home-btn'),

    resultScore: $('#result-score'),
    resultCorrect: $('#result-correct'),
    resultWrong: $('#result-wrong'),
    resultPercent: $('#result-percent'),
    resultRing: $('#result-ring'),
    resultBest: $('#result-best-note'),
    resultTime: $('#result-time'),
    examTimer: $('#exam-timer'),
    retryBtn: $('#retry-btn'),
    newExamBtn: $('#new-exam-btn'),
    reviewBtn: $('#review-btn'),
    homeBtn: $('#home-btn'),

    reviewList: $('#review-list'),
    reviewBackBtn: $('#review-back-btn'),

    readingProgressLabel: $('#reading-progress-label'),
    readingProgressFill: $('#reading-progress-fill'),
    readingCards: $('#reading-cards'),
    readingMetaTag: $('#reading-meta-tag'),
    readingPrevBtn: $('#reading-prev-btn'),
    readingNextBtn: $('#reading-next-btn'),
    readingExitBtn: $('#reading-exit-btn'),
    brandHomeBtn: $('#brand-home-btn'),

    listenProgressLabel: $('#listen-progress-label'),
    listenProgressFill: $('#listen-progress-fill'),
    listenLevelTag: $('#listen-level-tag'),
    listenPillKo: $('#listen-pill-ko'),
    listenPillEn: $('#listen-pill-en'),
    listenRepeatBadge: $('#listen-repeat-badge'),
    listenKorean: $('#listen-korean'),
    listenMeaning: $('#listen-meaning'),
    listenSecondary: $('#listen-secondary'),
    listenLessonTag: $('#listen-category-tag'),
    listenHint: $('#listen-hint'),
    listenPrevBtn: $('#listen-prev-btn'),
    listenPlayPauseBtn: $('#listen-playpause-btn'),
    listenPlayIcon: $('#listen-play-icon'),
    listenPauseIcon: $('#listen-pause-icon'),
    listenNextBtn: $('#listen-next-btn'),
    listenQuitBtn: $('#listen-quit-btn'),
    listenHomeBtn: $('#listen-home-btn'),
  };

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  const state = {
    examStartedAt: 0,       // Date.now() when the current exam began
    examTimerId: null,      // setInterval id for the live exam timer
    db: null,               // flattened database ({words, levels, levelBook, topics})
    selection: new Map(),   // selected topics: topic key -> Set of selected category names (at least one topic/category always selected)
    mode: null,             // null | 'exam' | 'reading' — nothing selected until the learner picks one
    order: 'random',        // 'random' | 'serial' — order questions/cards are presented in
    language: 'bangla',     // 'bangla' | 'english' — meaning text (Exam, Reading, Listen) AND the audio after the Korean clip
    questionCount: null,    // null | 10 | 20 | 30 | 50 | 'all'
    listenRangeIds: new Set([DEFAULT_LISTEN_RANGE_ID]), // which batch(es) of the pool Listen mode plays (1-5 / 6-10 / … / all)
    multiTopic: false,      // checkbox next to Topik: off = picking a Topik selects only that one
    multiCategory: false,   // checkbox next to Category/Lesson: off = picking one selects only that one
    multiRange: false,      // checkbox next to "How many words" (Listen): off = one range at a time
    listenRanges: [],       // "how many words" choices for Listen mode, rebuilt whenever the pool size changes
    repeatCount: DEFAULT_REPEAT_COUNT, // how many times each word's Korean+meaning pair plays (Listen mode)

    pool: [],       // words matching the selected topics + categories
    questions: [],  // built exam: [{word, options, correctKey}]
    index: 0,
    answers: [],    // [{word, correctKey, chosenKey, isCorrect}]
    locked: false,

    examAudio: true,        // true = Korean audio plays + play button; false = text only
    examStyle: 'mastery',   // 'mastery' | 'normal' — mastery repeats wrong words until all are correct
    queue: [],              // mastery: questions still to ask this round
    retry: [],              // mastery: wrongly answered questions waiting for the next round
    round: 1,               // mastery: current round number
    mastered: 0,            // mastery: words answered correctly so far
    wrongCounts: new Map(), // mastery: word id -> number of wrong answers

    readingWords: [],    // words for the current Reading session
    readingIndex: 0,     // current page index (0-based)
    readingAudioToken: 0, // bumped to cancel a card's in-flight audio when the page changes

    listenWords: [],      // words for the current Listen session
    listenIndex: 0,       // current word index within listenWords
    listenRepeatIndex: 0, // how many ko+meaning pairs already played for this word (0-based)
    listenStage: 'ko',    // 'ko' | 'meaning' — 'meaning' is the Bangla or English clip
    listenPlaying: false, // true while the auto-advancing chain is actively running (not paused)
    listenToken: 0,       // bumped to cancel any in-flight audio callback chain
    listenAudio: null,    // the current Audio object, so pause/resume/stop can reach it
    listenAudioCleanup: null, // detaches the current clip's listeners when playback is cut short
  };

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ *
   * Exam timer (live at the bottom of the exam page, total shown on result)
   * ------------------------------------------------------------------ */
  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  }

  function tickExamTimer() {
    el.examTimer.textContent = formatDuration(Date.now() - state.examStartedAt);
  }

  function stopExamTimer() {
    if (state.examTimerId !== null) {
      clearInterval(state.examTimerId);
      state.examTimerId = null;
    }
  }

  function startExamTimer() {
    stopExamTimer();
    state.examStartedAt = Date.now();
    tickExamTimer();
    state.examTimerId = setInterval(tickExamTimer, 250);
  }

  function showScreen(name) {
    if (name !== 'quiz') stopExamTimer(); // leaving the exam freezes/clears the ticking timer
    Object.entries(screens).forEach(([key, node]) => {
      const active = key === name;
      node.classList.toggle('active', active);
      node.hidden = !active;
    });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ------------------------------------------------------------------ *
   * Stats persistence
   * ------------------------------------------------------------------ */
  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATS, ...parsed };
    } catch {
      return { ...DEFAULT_STATS };
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch {
      /* localStorage unavailable — fail silently */
    }
  }

  function recordExamResult(correctCount, totalCount, wrongCount) {
    const stats = loadStats();
    const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    stats.attempts += 1;
    stats.totalCorrect += correctCount;
    stats.totalWrong += wrongCount;
    stats.scoreSum += percent;
    stats.bestScore = Math.max(stats.bestScore, percent);

    saveStats(stats);
    return { stats, percent };
  }

  function renderStartStats() {
    const stats = loadStats();
    const average = stats.attempts > 0 ? Math.round(stats.scoreSum / stats.attempts) : 0;
    el.statAttempts.textContent = stats.attempts;
    el.statBest.textContent = `${stats.bestScore}%`;
    el.statAverage.textContent = `${average}%`;
    el.statCorrect.textContent = stats.totalCorrect;
    el.statWrong.textContent = stats.totalWrong;
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    el.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
    el.themeToggle.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }

  function initTheme() {
    let theme = localStorage.getItem(THEME_STORAGE_KEY);
    if (!theme) {
      theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------ *
   * Setup screen: lesson / mode / count chips
   * ------------------------------------------------------------------ */
  /** Topic metadata (from the database) for a topic key. */
  function topicByKey(key) {
    return state.db.topics.find((t) => t.key === key);
  }

  function renderTopicChips() {
    el.topicChips.innerHTML = '';
    state.db.topics.forEach((topic) => {
      const active = state.selection.has(topic.key);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.topic = topic.key;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
      btn.innerHTML = `${escapeHtml(topic.label)} <span class="chip-count">${topic.count}</span>`;
      btn.addEventListener('click', () => toggleTopic(topic.key));
      el.topicChips.appendChild(btn);
    });
    updateTopicToggleLabel();
    el.topicToggleAll.hidden = !state.multiTopic;
    renderCategoryGroups();
  }

  /** Under the topic chips: one block of category chips for every selected topic. */
  function renderCategoryGroups() {
    el.categoryGroups.innerHTML = '';
    state.db.topics.forEach((topic) => {
      const selected = state.selection.get(topic.key);
      if (!selected) return;

      const group = document.createElement('div');
      group.className = 'category-group';

      const head = document.createElement('div');
      head.className = 'setup-row';
      const allSelected = topic.categories.every((c) => selected.has(c.name));
      head.innerHTML = `<h3>${escapeHtml(topic.short)} · ${isTextbookTopic(topic.key) ? 'Lesson' : 'Category'}</h3>`;
      const tools = document.createElement('span');
      tools.className = 'setup-links';
      const multiLabel = document.createElement('label');
      multiLabel.className = 'multi-check';
      const multiBox = document.createElement('input');
      multiBox.type = 'checkbox';
      multiBox.checked = state.multiCategory;
      multiBox.addEventListener('change', () => setMultiCategory(multiBox.checked));
      const multiText = document.createElement('span');
      multiText.textContent = 'Multiple';
      multiLabel.append(multiBox, multiText);
      tools.appendChild(multiLabel);
      if (state.multiCategory) {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'link-btn';
        link.textContent = allSelected ? 'Clear all' : 'Select all';
        link.addEventListener('click', () => toggleAllCategories(topic.key));
        tools.appendChild(link);
      }
      head.appendChild(tools);
      group.appendChild(head);

      const chips = document.createElement('div');
      chips.className = 'chip-group chip-group--wrap lesson-scroll';
      chips.setAttribute('role', 'group');
      chips.setAttribute('aria-label', `${topic.short} ${isTextbookTopic(topic.key) ? 'lessons' : 'categories'}`);
      topic.categories.forEach((cat) => {
        const on = selected.has(cat.name);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip chip--category';
        btn.setAttribute('aria-pressed', String(on));
        btn.classList.toggle('is-active', on);
        btn.innerHTML = `${escapeHtml(cat.name)} <span class="chip-count">${cat.count}</span>`;
        btn.addEventListener('click', () => toggleCategory(topic.key, cat.name));
        chips.appendChild(btn);
      });
      group.appendChild(chips);
      el.categoryGroups.appendChild(group);
    });
  }

  function updateTopicToggleLabel() {
    const allSelected = state.db.topics.length > 0 && state.db.topics.every((t) => state.selection.has(t.key));
    el.topicToggleAll.textContent = allSelected ? 'Clear all' : 'Select all';
  }

  /** Every category of a topic, as a fresh Set (used by "Select all"). */
  function allCategoriesOf(topic) {
    return new Set(topic.categories.map((c) => c.name));
  }

  /** A newly selected topic starts with just its first category selected. */
  function defaultCategoriesOf(topic) {
    return new Set(topic.categories.slice(0, 1).map((c) => c.name));
  }

  function handleTopicToggleAll() {
    const topics = state.db.topics;
    const allSelected = topics.length > 0 && topics.every((t) => state.selection.has(t.key));
    if (allSelected) {
      // Keep at least one topic selected — collapse down to just the first.
      state.selection = new Map(topics.slice(0, 1).map((t) => [t.key, defaultCategoriesOf(t)]));
    } else {
      state.selection = new Map(topics.map((t) => [t.key, state.selection.get(t.key) || allCategoriesOf(t)]));
    }
    renderTopicChips();
    updatePoolInfo();
  }

  /** Checkbox next to Topik. Unchecking collapses the selection to a single Topik. */
  function setMultiTopic(on) {
    state.multiTopic = on;
    el.topicMulti.checked = on;
    if (!on && state.selection.size > 1) {
      const first = state.db.topics.find((t) => state.selection.has(t.key));
      state.selection = new Map([[first.key, state.selection.get(first.key)]]);
    }
    renderTopicChips();
    updatePoolInfo();
  }

  /** Checkbox next to Category/Lesson. Unchecking collapses every group to a single category. */
  function setMultiCategory(on) {
    state.multiCategory = on;
    if (!on) {
      state.db.topics.forEach((topic) => {
        const selected = state.selection.get(topic.key);
        if (selected && selected.size > 1) {
          const first = topic.categories.find((c) => selected.has(c.name));
          state.selection.set(topic.key, new Set([first.name]));
        }
      });
    }
    renderCategoryGroups();
    updatePoolInfo();
  }

  function toggleTopic(key) {
    if (!state.multiTopic) {
      // Single mode: choosing a Topik selects only that one (with its first category).
      if (state.selection.size === 1 && state.selection.has(key)) return;
      state.selection = new Map([[key, defaultCategoriesOf(topicByKey(key))]]);
      renderTopicChips();
      updatePoolInfo();
      return;
    }
    if (state.selection.has(key)) {
      if (state.selection.size === 1) return; // keep at least one topic selected
      state.selection.delete(key);
    } else {
      state.selection.set(key, defaultCategoriesOf(topicByKey(key)));
    }
    renderTopicChips();
    updatePoolInfo();
  }

  function toggleCategory(topicKey, name) {
    const selected = state.selection.get(topicKey);
    if (!selected) return;
    if (!state.multiCategory) {
      // Single mode: choosing a category selects only that one.
      if (selected.size === 1 && selected.has(name)) return;
      state.selection.set(topicKey, new Set([name]));
      renderCategoryGroups();
      updatePoolInfo();
      return;
    }
    if (selected.has(name)) {
      if (selected.size === 1) return; // keep at least one category per selected topic
      selected.delete(name);
    } else {
      selected.add(name);
    }
    renderCategoryGroups();
    updatePoolInfo();
  }

  function toggleAllCategories(topicKey) {
    const topic = topicByKey(topicKey);
    const selected = state.selection.get(topicKey);
    if (!topic || !selected) return;
    const allSelected = topic.categories.every((c) => selected.has(c.name));
    if (allSelected) {
      // Keep at least one category — collapse down to the first one.
      state.selection.set(topicKey, new Set([topic.categories[0].name]));
    } else {
      state.selection.set(topicKey, allCategoriesOf(topic));
    }
    renderCategoryGroups();
    updatePoolInfo();
  }

  /** Ranges currently selected for Listen mode, in list order. */
  function selectedListenRanges() {
    const chosen = state.listenRanges.filter((r) => state.listenRangeIds.has(r.id));
    return chosen.length ? chosen : state.listenRanges.slice(0, 1);
  }

  function toggleListenRange(id) {
    if (!state.multiRange) {
      state.listenRangeIds = new Set([id]); // single mode: only this range
      return;
    }
    const ids = new Set(state.listenRangeIds);
    if (id === 'all') {
      state.listenRangeIds = new Set(['all']); // "All" already covers every range
      return;
    }
    ids.delete('all');
    if (ids.has(id)) {
      if (ids.size === 1) return; // keep at least one range selected
      ids.delete(id);
    } else {
      ids.add(id);
    }
    state.listenRangeIds = ids;
  }

  /** Checkbox next to "How many words". Unchecking collapses to the first selected range. */
  function setMultiRange(on) {
    state.multiRange = on;
    el.rangeMulti.checked = on;
    if (!on && state.listenRangeIds.size > 1) {
      state.listenRangeIds = new Set([selectedListenRanges()[0].id]);
    }
    renderCountChips();
    updatePoolInfo();
    warmListenRange();
  }

  function renderCountChips() {
    el.countChips.innerHTML = '';

    // Listen mode studies a batch of the list (words 1-5, 5-10, …, or All)
    // rather than a plain question count, so it gets its own chips.
    if (state.mode === 'listen') {
      state.listenRanges.forEach((range) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip';
        btn.dataset.range = range.id;
        const active = state.listenRangeIds.has(range.id);
        btn.setAttribute('aria-pressed', String(active));
        btn.classList.toggle('is-active', active);
        btn.textContent = range.label;
        btn.addEventListener('click', () => {
          toggleListenRange(range.id);
          renderCountChips();
          updatePoolInfo();
          warmListenRange();
        });
        el.countChips.appendChild(btn);
      });
      return;
    }

    QUESTION_COUNT_CHOICES.forEach((count) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.count = String(count);
      const active = state.questionCount === count;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
      btn.textContent = count === 'all' ? 'All' : String(count);
      btn.addEventListener('click', () => {
        state.questionCount = count;
        renderCountChips();
        updatePoolInfo();
      });
      el.countChips.appendChild(btn);
    });
  }

  function renderRepeatChips() {
    el.repeatChips.innerHTML = '';
    REPEAT_COUNT_CHOICES.forEach((count) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.repeat = String(count);
      const active = state.repeatCount === count;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
      btn.textContent = `${count}×`;
      btn.addEventListener('click', () => {
        state.repeatCount = count;
        renderRepeatChips();
      });
      el.repeatChips.appendChild(btn);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    Array.from(el.modeToggle.children).forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
    if (mode === 'reading') {
      el.modeHint.textContent = 'See each Korean word with its meaning — 5 per page. Tap a card to hear it.';
      el.startBtn.textContent = 'Start reading';
    } else if (mode === 'exam') {
      el.modeHint.textContent = 'Listen to the Korean audio, then pick the matching meaning.';
      el.startBtn.textContent = 'Start exam';
    } else if (mode === 'listen') {
      el.modeHint.textContent = `Hear each word in Korean, then straight away in ${languageLabel()} — plays continuously until you stop it.`;
      el.startBtn.textContent = 'Start listening';
    } else {
      el.modeHint.textContent = 'Choose a mode to continue.';
      el.startBtn.textContent = 'Start';
    }
    el.repeatSection.hidden = mode !== 'listen';
    el.examStyleSection.hidden = mode !== 'exam';
    el.examStyleHint.hidden = mode !== 'exam';
    el.countHeading.textContent = mode === 'listen' ? 'How many words' : 'Questions';
    el.rangeMultiWrap.hidden = mode !== 'listen';
    renderCountChips();
    updatePoolInfo();
    warmListenRange();
  }

  /** Display name of the currently selected meaning language. */
  function languageLabel() {
    return state.language === 'bangla' ? 'বাংলা' : 'English';
  }

  function setOrder(order) {
    state.order = order;
    Array.from(el.orderToggle.children).forEach((btn) => {
      const active = btn.dataset.order === order;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }

  function setExamStyle(style) {
    state.examStyle = style;
    Array.from(el.examStyleToggle.children).forEach((btn) => {
      const active = btn.dataset.style === style;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
    el.examStyleHint.textContent = style === 'mastery'
      ? 'Wrong answers are not revealed. They come back at the end until every word is correct.'
      : 'Every question is asked once and the answer is shown right away.';
  }

  function setExamAudio(on) {
    state.examAudio = on;
    Array.from(el.examAudioToggle.children).forEach((btn) => {
      const active = (btn.dataset.audio === 'on') === on;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }

  function setLanguage(language) {
    state.language = language;
    setMeaningLanguage(language); // Exam, Reading and Listen all show meanings in this language
    Array.from(el.languageToggle.children).forEach((btn) => {
      const active = btn.dataset.language === language;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
    // Listen mode plays (and labels) the meaning clip in this language, so its
    // hint and stage pill have to follow the switch.
    if (state.mode === 'listen') {
      el.modeHint.textContent = `Hear each word in Korean, then straight away in ${languageLabel()} — plays continuously until you stop it.`;
      warmListenRange();
    }
    if (el.listenPillEn) el.listenPillEn.textContent = languageLabel();
  }

  function currentPool() {
    return wordsForSelection(state.db.words, state.selection);
  }

  function updatePoolInfo() {
    state.pool = currentPool();
    const size = state.pool.length;

    // Listen mode's "how many words" buckets are sized to the current pool
    // (steps of 5), so rebuild them whenever the pool changes and re-render
    // the chips if the selection they offer is no longer valid.
    state.listenRanges = buildListenRanges(size);
    const validIds = new Set(state.listenRanges.map((r) => r.id));
    const keptIds = new Set([...state.listenRangeIds].filter((id) => validIds.has(id)));
    state.listenRangeIds = keptIds.size ? keptIds : new Set([state.listenRanges[0].id]);
    if (state.mode === 'listen') renderCountChips();

    if (state.selection.size === 0) {
      el.poolInfo.textContent = 'Pick at least one Topik to continue.';
      el.startBtn.disabled = true;
      return;
    }
    if (!state.mode) {
      el.poolInfo.textContent = `${size} word${size === 1 ? '' : 's'} match. Choose a mode to continue.`;
      el.startBtn.disabled = true;
      return;
    }
    // Listen mode picks a batch of the list, so its readout talks in ranges.
    if (state.mode === 'listen') {
      const ranges = selectedListenRanges();
      const range = ranges[0];
      const batch = sliceByRanges(state.pool, ranges).length;
      if (batch < 1) {
        el.poolInfo.textContent = `${size} word${size === 1 ? '' : 's'} match — nothing in the ${range.label} range. Pick a lower range.`;
        el.startBtn.disabled = true;
        return;
      }
      if (ranges.length > 1) {
        el.poolInfo.textContent = `${size} words match — listening to ${batch} words from ${ranges.length} ranges.`;
      } else {
        el.poolInfo.textContent = range.id === 'all'
          ? `${size} words match — listening to all ${batch}.`
          : `${size} words match — listening to words ${range.start}–${Math.min(range.end, size)} (${batch} word${batch === 1 ? '' : 's'}).`;
      }
      el.startBtn.disabled = false;
      return;
    }

    if (!state.questionCount) {
      el.poolInfo.textContent = `${size} word${size === 1 ? '' : 's'} match. Choose how many words to practice.`;
      el.startBtn.disabled = true;
      return;
    }

    const minNeeded = state.mode === 'exam' ? MIN_POOL_SIZE : 1;
    if (size < minNeeded) {
      el.poolInfo.textContent = `${size} word${size === 1 ? '' : 's'} match — need at least ${minNeeded} to start.`;
      el.startBtn.disabled = true;
      return;
    }

    const requested = state.questionCount === 'all' ? size : state.questionCount;
    const usable = Math.min(requested, size);
    el.poolInfo.textContent = usable < requested
      ? `${size} words match — session will use all ${usable} of them.`
      : `${size} words match this selection.`;
    el.startBtn.disabled = false;
  }

  /* ------------------------------------------------------------------ *
   * Setup init
   * ------------------------------------------------------------------ */
  function initSetup() {
    // Default to the first topic with only its first category selected; mode, order,
    // and question count default to Reading / Random / All.
    // Default selection: Textbook 1 -> Lesson 6 (falls back to the first topic/category).
    const firstTopic = state.db.topics.find((t) => t.key === 'textbook1') || state.db.topics[0];
    const lesson6 = firstTopic && firstTopic.categories.find((c) => c.name === levelLabel('6'));
    state.selection = firstTopic
      ? new Map([[firstTopic.key, lesson6 ? new Set([lesson6.name]) : defaultCategoriesOf(firstTopic)]])
      : new Map();
    state.mode = null;
    state.questionCount = null;
    state.listenRangeIds = new Set([DEFAULT_LISTEN_RANGE_ID]);
    state.multiTopic = false;
    state.multiCategory = false;
    state.multiRange = false;
    el.topicMulti.checked = false;
    el.rangeMulti.checked = false;
    state.repeatCount = DEFAULT_REPEAT_COUNT;

    renderTopicChips();
    renderCountChips();
    renderRepeatChips();
    setMode('exam');
    setOrder('random');
    setExamStyle('mastery');
    setExamAudio(false);
    setLanguage('bangla');
    state.questionCount = 'all';
    renderCountChips();
    updatePoolInfo();
  }

  /* ------------------------------------------------------------------ *
   * Quiz rendering
   * ------------------------------------------------------------------ */
  function isMastery() {
    return state.examStyle === 'mastery';
  }

  function currentQuestion() {
    return isMastery() ? state.queue[0] : state.questions[state.index];
  }

  /** Mastery: (re)start a session over state.questions — every word must end up correct. */
  function beginMastery() {
    state.queue = state.questions.slice();
    state.retry = [];
    state.round = 1;
    state.mastered = 0;
    state.wrongCounts = new Map();
  }

  /** Mastery: a fresh question (new random distractors, new option order) for the same word. */
  function rebuildQuestion(word) {
    return buildExam([word, ...state.pool], 1, 'serial')[0];
  }

  function audioFor(word) {
    return new Audio(korAudioPath(word));
  }

  function renderQuestion() {
    const q = currentQuestion();
    state.locked = false;
    const total = state.questions.length;

    if (isMastery()) {
      el.progressLabel.textContent = `Round ${state.round} · ${state.mastered}/${total} correct`;
      el.progressFill.style.width = `${(state.mastered / total) * 100}%`;
    } else {
      el.progressLabel.textContent = `Question ${state.index + 1}/${total}`;
      el.progressFill.style.width = `${((state.index + 1) / total) * 100}%`;
    }
    el.quizLevelTag.textContent = wordTag(q.word);

    el.feedback.hidden = true;
    el.feedback.className = 'feedback';
    el.stamp.className = 'stamp';
    el.playHint.textContent = state.examAudio
      ? 'Press play, then choose the meaning of the word you hear.'
      : 'Choose the meaning of this word.';
    el.playBtn.style.display = state.examAudio ? '' : 'none';
    el.questionWord.textContent = q.word.korean;

    el.optionsGrid.innerHTML = '';
    q.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.setAttribute('data-key', opt.key);
      btn.setAttribute('aria-label', `Answer option: ${opt.meaning}`);
      btn.innerHTML = `<span class="option-value">${escapeHtml(opt.meaning)}</span>`;
      btn.addEventListener('click', () => handleAnswer(opt.key, btn));
      el.optionsGrid.appendChild(btn);
    });

    if (state.examAudio) {
      el.playBtn.focus({ preventScroll: true });
      playCurrentAudio();
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function playCurrentAudio() {
    const q = currentQuestion();
    const audio = audioFor(q.word);
    el.playBtn.classList.add('playing');
    audio.addEventListener('ended', () => el.playBtn.classList.remove('playing'));
    audio.play().catch((err) => {
      el.playBtn.classList.remove('playing');
      el.playHint.textContent = `Audio unavailable (${korAudioPath(q.word)}).`;
      console.error('Audio error:', err, 'Source:', audio.src);
    });
  }

  function handleAnswer(chosenKey, buttonEl) {
    if (state.locked) return;
    state.locked = true;

    const q = currentQuestion();
    const isCorrect = chosenKey === q.correctKey;

    if (isMastery()) {
      handleMasteryAnswer(q, chosenKey, isCorrect, buttonEl);
      return;
    }

    const chosenOption = q.options.find((o) => o.key === chosenKey);
    state.answers.push({
      word: q.word,
      correctKey: q.correctKey,
      chosenKey,
      chosenLabel: chosenOption ? chosenOption.meaning : '',
      isCorrect,
    });

    const buttons = Array.from(el.optionsGrid.children);
    buttons.forEach((btn) => {
      btn.disabled = true;
      const key = btn.getAttribute('data-key');
      if (key === q.correctKey) btn.classList.add('is-correct');
      if (key === chosenKey && !isCorrect) btn.classList.add('is-wrong');
    });

    el.stamp.textContent = isCorrect ? 'CORRECT' : 'WRONG';
    el.stamp.className = `stamp stamp--show ${isCorrect ? 'stamp--correct' : 'stamp--wrong'}`;

    playAnswerSound(isCorrect);


    if (buttonEl) buttonEl.classList.add('is-selected');

    // Normal style: auto-advance after a short pause (a bit longer when wrong, so the
    // correct answer can be seen). Skipped if Next was already pressed or the quiz was left.
    const answeredIndex = state.index;
    setTimeout(() => {
      if (screens.quiz.classList.contains('active') && !isMastery() && state.index === answeredIndex) handleNext();
    }, isCorrect ? 800 : 1500);
  }

  function handleMasteryAnswer(q, chosenKey, isCorrect, buttonEl) {
    const chosenOption = q.options.find((o) => o.key === chosenKey);
    state.answers.push({
      word: q.word,
      correctKey: q.correctKey,
      chosenKey,
      chosenLabel: chosenOption ? chosenOption.meaning : '',
      isCorrect,
    });
    state.queue.shift();
    Array.from(el.optionsGrid.children).forEach((btn) => { btn.disabled = true; });
    playAnswerSound(isCorrect);

    const buttons = Array.from(el.optionsGrid.children);
    if (isCorrect) {
      state.mastered += 1;
      buttons.forEach((btn) => {
        if (btn.getAttribute('data-key') === q.correctKey) btn.classList.add('is-correct');
      });
    } else {
      // Wrong: mark only the chosen option (the correct answer is NOT revealed),
      // count it, and queue the word for the next round.
      buttons.forEach((btn) => {
        if (btn.getAttribute('data-key') === chosenKey) btn.classList.add('is-wrong');
      });
      const id = q.word.id;
      state.wrongCounts.set(id, (state.wrongCounts.get(id) || 0) + 1);
      state.retry.push(rebuildQuestion(q.word));
    }
    el.stamp.textContent = isCorrect ? 'CORRECT' : 'WRONG';
    el.stamp.className = `stamp stamp--show ${isCorrect ? 'stamp--correct' : 'stamp--wrong'}`;
    if (buttonEl) buttonEl.classList.add('is-selected');

    // Auto-advance to the next question either way.
    setTimeout(() => {
      if (screens.quiz.classList.contains('active') && isMastery()) handleNext();
    }, 800);
  }

  /* ------------------------------------------------------------------ *
   * Answer sound effects (synthesized — no audio files needed)
   * ------------------------------------------------------------------ */
  let _sfxCtx = null;
  function getSfxContext() {
    if (!_sfxCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _sfxCtx = new AC();
    }
    if (_sfxCtx.state === 'suspended') _sfxCtx.resume();
    return _sfxCtx;
  }

  function playTone(ctx, freq, startTime, duration, type, peakGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  function playAnswerSound(isCorrect) {
    const ctx = getSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      if (isCorrect) {
        // Bright two-note ascending chime
        playTone(ctx, 880, now, 0.18, 'sine', 0.25);
        playTone(ctx, 1318.5, now + 0.1, 0.22, 'sine', 0.25);
      } else {
        // Low descending buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.37);
      }
    } catch {
      /* audio not available — fail silently */
    }
  }

  function handleNext() {
    if (isMastery()) {
      if (!state.queue.length && state.retry.length) {
        // End of the round: ask every wrong word again, in random order.
        state.queue = shuffle(state.retry);
        state.retry = [];
        state.round += 1;
      }
      if (!state.queue.length) finishExam();
      else renderQuestion();
      return;
    }
    state.index += 1;
    if (state.index >= state.questions.length) {
      finishExam();
    } else {
      renderQuestion();
    }
  }

  /* ------------------------------------------------------------------ *
   * Results
   * ------------------------------------------------------------------ */
  function finishExam() {
    const elapsedMs = Date.now() - state.examStartedAt;
    stopExamTimer();
    const total = state.questions.length;
    // Mastery: every word ends up correct, so the score is the words right on the first try.
    const correctCount = isMastery()
      ? total - state.wrongCounts.size
      : state.answers.filter((a) => a.isCorrect).length;
    const wrongCount = total - correctCount;
    const { stats, percent } = recordExamResult(correctCount, total, wrongCount);

    el.resultTime.textContent = formatDuration(elapsedMs);
    el.resultScore.textContent = `${correctCount} / ${total}`;
    el.resultCorrect.textContent = correctCount;
    el.resultWrong.textContent = wrongCount;
    el.resultPercent.textContent = `${percent}%`;

    const circumference = 2 * Math.PI * 54;
    el.resultRing.style.strokeDasharray = `${circumference}`;
    el.resultRing.style.strokeDashoffset = `${circumference * (1 - percent / 100)}`;

    el.resultBest.textContent =
      percent >= stats.bestScore && percent > 0
        ? 'New personal best — 축하해요 (congratulations)!'
        : `Personal best so far: ${stats.bestScore}%`;

    renderWrongStats();
    renderStartStats();
    showScreen('result');
  }

  function renderWrongStats() {
    el.wrongStatsList.innerHTML = '';
    if (!isMastery()) {
      el.wrongStats.hidden = true;
      return;
    }
    const rows = state.questions
      .map((q) => ({ word: q.word, wrong: state.wrongCounts.get(q.word.id) || 0 }))
      .filter((r) => r.wrong > 0)
      .sort((a, b) => b.wrong - a.wrong);
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'wrong-stats-item wrong-stats-item--none';
      li.textContent = 'No mistakes — every word was correct on the first try!';
      el.wrongStatsList.appendChild(li);
    }
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'wrong-stats-item';
      li.innerHTML = `<span class="wrong-stats-word">${escapeHtml(r.word.korean)} — ${escapeHtml(optionLabel(r.word))}</span>`
        + `<span class="wrong-stats-count">${r.wrong}× wrong</span>`;
      el.wrongStatsList.appendChild(li);
    });
    el.wrongStats.hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * Review
   * ------------------------------------------------------------------ */
  function renderReview() {
    el.reviewList.innerHTML = '';
    state.answers.forEach((answer, i) => {
      const item = document.createElement('li');
      item.className = `review-item ${answer.isCorrect ? 'review-item--correct' : 'review-item--wrong'}`;

      const replayBtn = document.createElement('button');
      replayBtn.type = 'button';
      replayBtn.className = 'review-play-btn';
      replayBtn.setAttribute('aria-label', `Replay audio for question ${i + 1}`);
      replayBtn.textContent = '▶';
      replayBtn.addEventListener('click', () => {
        audioFor(answer.word).play().catch(() => {});
      });

      const details = document.createElement('div');
      details.className = 'review-details';
      const chosenLabel = answer.isCorrect
        ? ''
        : `<span class="review-tag review-tag--wrong">You picked: ${escapeHtml(answer.chosenLabel)}</span>`;

      details.innerHTML = `
        <span class="review-index">Q${i + 1}</span>
        <span class="review-correct">${escapeHtml(answer.word.korean)} — ${escapeHtml(optionLabel(answer.word))}</span>
        ${answer.isCorrect ? '<span class="review-tag review-tag--correct">Correct</span>' : chosenLabel}
      `;

      item.appendChild(replayBtn);
      item.appendChild(details);
      el.reviewList.appendChild(item);
    });
    showScreen('review');
  }

  /* ------------------------------------------------------------------ *
   * Exam lifecycle actions
   * ------------------------------------------------------------------ */
  function resolvedCount() {
    return state.questionCount === 'all' ? state.pool.length : state.questionCount;
  }

  function startSession() {
    state.pool = currentPool();
    if (state.mode === 'reading') {
      startReadingSession();
    } else if (state.mode === 'listen') {
      startListenSession();
    } else {
      startExamSession();
    }
  }

  function startExamSession() {
    if (state.pool.length < MIN_POOL_SIZE) {
      el.setupError.textContent = `Not enough words match this selection (need at least ${MIN_POOL_SIZE}).`;
      el.setupError.hidden = false;
      return;
    }
    el.setupError.hidden = true;

    state.questions = buildExam(state.pool, resolvedCount(), state.order);
    state.index = 0;
    state.answers = [];
    state.locked = false;
    beginMastery();
    startExamTimer();

    el.progressFill.parentElement.setAttribute('aria-valuemax', String(state.questions.length));

    showScreen('quiz');
    renderQuestion();
  }

  function startAnotherExamSameRange() {
    state.questions = buildExam(state.pool, resolvedCount(), state.order);
    state.index = 0;
    state.answers = [];
    state.locked = false;
    beginMastery();
    startExamTimer();
    showScreen('quiz');
    renderQuestion();
  }

  function retrySameExam() {
    // Re-run the exact same words, but reshuffle each question's options.
    state.questions = state.questions.map((q) => ({ ...q, options: shuffle(q.options) }));
    state.index = 0;
    state.answers = [];
    state.locked = false;
    beginMastery();
    startExamTimer();
    showScreen('quiz');
    renderQuestion();
  }

  /* ------------------------------------------------------------------ *
   * Reading mode: paginated flashcards (5 words/page), audio plays on tap
   * ------------------------------------------------------------------ */
  function startReadingSession() {
    if (state.pool.length < 1) {
      el.setupError.textContent = 'Not enough words match this selection.';
      el.setupError.hidden = false;
      return;
    }
    el.setupError.hidden = true;

    state.readingWords = buildReadingSession(state.pool, resolvedCount(), state.order);
    state.readingIndex = 0;

    el.readingMetaTag.textContent = readingSessionMetaText();
    el.readingProgressFill.parentElement.setAttribute('aria-valuemax', String(totalReadingPages()));

    showScreen('reading');
    renderReadingPage();
  }

  function totalReadingPages() {
    return Math.max(1, Math.ceil(state.readingWords.length / READING_PAGE_SIZE));
  }

  /** Builds the "Topik 1, Topik 3 · 40 words" summary shown next to the reading page number. */
  function readingSessionMetaText() {
    const picked = state.db.topics.filter((t) => state.selection.has(t.key));
    const topicText = picked.length === 1
      ? picked[0].short
      : picked.length <= 4
        ? picked.map((t) => t.short).join(', ')
        : `${picked.length} topics`;
    const amount = state.readingWords.length;
    return `${topicText} · ${amount} word${amount === 1 ? '' : 's'}`;
  }

  function stopReadingAudio() {
    state.readingAudioToken += 1;
  }

  function renderReadingPage() {
    const total = totalReadingPages();
    const start = state.readingIndex * READING_PAGE_SIZE;
    const pageWords = state.readingWords.slice(start, start + READING_PAGE_SIZE);

    el.readingProgressLabel.textContent = `Page ${state.readingIndex + 1} of ${total} · Words ${start + 1}–${start + pageWords.length} of ${state.readingWords.length}`;
    el.readingProgressFill.style.width = `${((state.readingIndex + 1) / total) * 100}%`;

    el.readingCards.innerHTML = '';
    pageWords.forEach((word) => {
      const card = document.createElement('div');
      card.className = 'reading-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Play pronunciation for ${word.korean}`);

      card.innerHTML = `
        <span class="reading-card-korean">${escapeHtml(word.korean)}</span>
        <div class="reading-card-body">
          <span class="reading-card-meaning">${escapeHtml(optionLabel(word))}</span>
          <span class="reading-card-tag">${escapeHtml(wordDetailTag(word))}</span>
        </div>
        <span class="reading-card-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%"><path d="M6 9v6h3.5l4.5 4V5l-4.5 4H6Z" fill="currentColor" /><path d="M17 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </span>
      `;

      const playThisCard = () => {
        stopReadingAudio();
        playReadingCardAudio(word, card);
      };
      card.addEventListener('click', playThisCard);
      card.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') playThisCard();
      });

      el.readingCards.appendChild(card);
    });

    el.readingPrevBtn.disabled = state.readingIndex === 0;
    el.readingNextBtn.textContent = state.readingIndex >= total - 1 ? 'Finish' : 'Next page';

    // Audio does NOT auto-play in Reading mode — tap a card to hear it.
    stopReadingAudio();
  }

  /** Plays one word's audio, toggling its card's playing state. Resolves when done. */
  function playReadingCardAudio(word, card) {
    return new Promise((resolve) => {
      const audio = audioFor(word);
      card?.classList.add('is-playing');
      const finish = () => {
        card?.classList.remove('is-playing');
        resolve();
      };
      audio.addEventListener('ended', finish);
      audio.play().catch(finish);
    });
  }

  function handleReadingNext() {
    if (state.readingIndex >= totalReadingPages() - 1) {
      stopReadingAudio();
      showScreen('start');
      renderStartStats();
      return;
    }
    state.readingIndex += 1;
    renderReadingPage();
  }

  function handleReadingPrev() {
    if (state.readingIndex === 0) return;
    state.readingIndex -= 1;
    renderReadingPage();
  }

  /* ------------------------------------------------------------------ *
   * Listen mode: continuous Korean -> Bangla/English playback, repeated N times
   * per word, auto-advancing through the whole list and looping back to
   * the start — keeps going until the learner pauses, skips home, or stops.
   * ------------------------------------------------------------------ */
  function startListenSession() {
    if (state.pool.length < 1) {
      el.setupError.textContent = 'Not enough words match this selection.';
      el.setupError.hidden = false;
      return;
    }
    el.setupError.hidden = true;

    const ranges = selectedListenRanges();
    state.listenWords = buildListenSession(state.pool, ranges, state.order);
    if (!state.listenWords.length) {
      el.setupError.textContent = `No words in the ${ranges[0].label} range — pick a lower range.`;
      el.setupError.hidden = false;
      return;
    }

    state.listenIndex = 0;
    state.listenRepeatIndex = 0;
    state.listenStage = 'ko';
    state.listenPlaying = true;

    el.listenProgressFill.parentElement.setAttribute('aria-valuemax', String(state.listenWords.length));
    setListenPlayPauseUI(true);

    // Buffer the first few clips up front so the very first hand-off is instant.
    primeListenAudio(0);

    showScreen('listen');
    renderListenWord();
    advanceListenPlayback();
  }

  /** Renders the current word's card + progress, independent of which audio is playing. */
  function renderListenWord() {
    const word = state.listenWords[state.listenIndex];
    if (!word) return;

    el.listenProgressLabel.textContent = `Word ${state.listenIndex + 1} of ${state.listenWords.length}`;
    el.listenProgressFill.style.width = `${((state.listenIndex + 1) / state.listenWords.length) * 100}%`;
    el.listenLevelTag.textContent = wordTag(word);
    el.listenRepeatBadge.textContent = `Repeat ${state.listenRepeatIndex + 1}/${state.repeatCount}`;

    el.listenKorean.textContent = word.korean;
    el.listenMeaning.textContent = optionLabel(word);
    el.listenSecondary.textContent = '';
    el.listenSecondary.hidden = true;
    el.listenLessonTag.textContent = wordDetailTag(word);

    updateListenStagePills();
  }

  function updateListenStagePills() {
    el.listenPillEn.textContent = languageLabel();
    el.listenPillKo.classList.toggle('is-active', state.listenStage === 'ko');
    el.listenPillEn.classList.toggle('is-active', state.listenStage === 'meaning');
  }

  function setListenPlayPauseUI(playing) {
    el.listenPlayPauseBtn.classList.toggle('playing', playing);
    el.listenPlayPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    // Use inline style (not the `hidden` IDL property) — on some browsers/WebViews
    // `.hidden` isn't reliably wired up for inline <svg> elements, which left the
    // icon stuck showing the same state regardless of play/pause.
    el.listenPauseIcon.style.display = playing ? '' : 'none';
    el.listenPlayIcon.style.display = playing ? 'none' : '';
  }

  /* Preloaded <audio> elements keyed by src. Reusing already-buffered elements is
   * what makes the 한국어 → বাংলা/English hand-off instant: nothing has to be fetched
   * or decoded at the moment the first clip ends. */
  const audioCache = new Map();
  const AUDIO_CACHE_LIMIT = 150;

  /** Returns a buffered Audio element for `src`, creating and warming it if needed. */
  function preloadedAudio(src) {
    if (!src) return null;
    let audio = audioCache.get(src);
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.src = src;
      audio.load();
      audioCache.set(src, audio);
      if (audioCache.size > AUDIO_CACHE_LIMIT) {
        const oldest = audioCache.keys().next().value;
        if (oldest !== src) audioCache.delete(oldest);
      }
    }
    return audio;
  }

  /** The meaning clip that follows the Korean one: Bangla when বাংলা is picked, else English. */
  function listenMeaningSrc(word) {
    return meaningAudioPath(word, state.language) || enAudioPath(word);
  }

  /**
   * Pre-buffers the opening clips of the batch that's currently selected on the
   * start screen, so even the session's *first* Korean → meaning hand-off is instant
   * rather than waiting on a first download.
   */
  function warmListenRange() {
    if (state.mode !== 'listen' || !state.pool.length) return;
    const batch = sliceByRanges(state.pool, selectedListenRanges());
    batch.slice(0, 3).forEach((word) => {
      preloadedAudio(korAudioPath(word));
      preloadedAudio(listenMeaningSrc(word));
    });
  }

  /** Warms up the next few clips the Listen chain will need, so playback never waits. */
  function primeListenAudio(startIndex) {
    const words = state.listenWords;
    if (!words.length) return;
    for (let i = 0; i < 3; i += 1) {
      const word = words[(startIndex + i) % words.length];
      if (!word) continue;
      preloadedAudio(korAudioPath(word));
      preloadedAudio(listenMeaningSrc(word));
    }
  }

  /** Stops any in-flight audio and invalidates its callbacks, without changing position. */
  function haltListenAudio() {
    state.listenToken += 1;
    if (state.listenAudioCleanup) {
      state.listenAudioCleanup();
      state.listenAudioCleanup = null;
    }
    if (state.listenAudio) {
      state.listenAudio.pause();
      state.listenAudio = null;
    }
  }

  /**
   * Plays the current stage's audio for the current word, then — if still
   * playing — moves to the next stage/word/loop and calls itself again.
   * This single chain is what makes playback continue unattended.
   */
  function advanceListenPlayback() {
    if (!state.listenPlaying) return;
    const word = state.listenWords[state.listenIndex];
    if (!word) return;

    renderListenWord();

    const isKo = state.listenStage === 'ko';
    const token = state.listenToken;

    // Buffer what plays next *while* this clip is playing, so the next one can
    // start the instant this one ends.
    if (isKo) preloadedAudio(listenMeaningSrc(word));
    else primeListenAudio(state.listenIndex + 1);

    const step = () => {
      if (token !== state.listenToken) return; // superseded by pause/skip/stop
      state.listenAudio = null;
      state.listenAudioCleanup = null;

      if (state.listenStage === 'ko') {
        state.listenStage = 'meaning';
      } else {
        state.listenStage = 'ko';
        state.listenRepeatIndex += 1;
        if (state.listenRepeatIndex >= state.repeatCount) {
          state.listenRepeatIndex = 0;
          state.listenIndex += 1;
          if (state.listenIndex >= state.listenWords.length) {
            state.listenIndex = 0; // loop back to the start — keeps playing until stopped
            // In random order, reshuffle each time the batch loops so it doesn't
            // just replay the same random order over and over.
            if (state.order === 'random') {
              state.listenWords = shuffle(state.listenWords);
            }
          }
        }
      }

      if (state.listenPlaying) advanceListenPlayback();
    };

    /**
     * Plays `src` and chains on. If a Bangla clip is missing from audio/bng/, it
     * falls back to the English one so a gap in the folder never stalls playback.
     */
    const playSrc = (src, fallbackSrc) => {
      const giveUp = () => {
        if (fallbackSrc) {
          playSrc(fallbackSrc, null);
          return;
        }
        el.listenHint.textContent = `Audio unavailable for ${word.korean} (${src || 'no file'}) — continuing.`;
        step();
      };

      const audio = preloadedAudio(src);
      if (!audio || audio.error) {
        if (src) audioCache.delete(src);
        giveUp();
        return;
      }

      let settled = false;
      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };
      function onEnded() {
        if (settled) return;
        settled = true;
        cleanup();
        step();
      }
      function onError() {
        if (settled) return;
        settled = true;
        cleanup();
        audioCache.delete(src);
        giveUp();
      }

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      state.listenAudio = audio;
      state.listenAudioCleanup = cleanup;

      try { audio.currentTime = 0; } catch (e) { /* not seekable yet — it starts at 0 anyway */ }
      const started = audio.play();
      if (started && typeof started.catch === 'function') started.catch(onError);
    };

    // Bangla learners fall back to the English clip if the Bangla file is missing.
    const fallback = !isKo && state.language === 'bangla' ? enAudioPath(word) : null;
    playSrc(isKo ? korAudioPath(word) : listenMeaningSrc(word), fallback);
  }

  function toggleListenPlayPause() {
    if (state.listenPlaying) {
      state.listenPlaying = false;
      haltListenAudio();
      setListenPlayPauseUI(false);
    } else {
      state.listenPlaying = true;
      setListenPlayPauseUI(true);
      advanceListenPlayback();
    }
  }

  function skipListenWord(direction) {
    haltListenAudio();
    const total = state.listenWords.length;
    state.listenIndex = (state.listenIndex + direction + total) % total;
    state.listenRepeatIndex = 0;
    state.listenStage = 'ko';
    renderListenWord();
    if (state.listenPlaying) advanceListenPlayback();
  }

  function stopListenSession() {
    state.listenPlaying = false;
    haltListenAudio();
    showScreen('start');
    renderStartStats();
  }

  function quitReading() {
    stopReadingAudio();
    showScreen('start');
    renderStartStats();
  }

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */
  function bindEvents() {
    el.themeToggle.addEventListener('click', toggleTheme);
    el.startBtn.addEventListener('click', startSession);
    el.resultToggleBtn.addEventListener('click', () => {
      const show = el.statsGrid.hidden;
      if (show) renderStartStats();
      el.statsGrid.hidden = !show;
      el.resultToggleBtn.setAttribute('aria-expanded', String(show));
    });

    el.topicToggleAll.addEventListener('click', handleTopicToggleAll);
    el.topicMulti.addEventListener('change', () => setMultiTopic(el.topicMulti.checked));
    el.rangeMulti.addEventListener('change', () => setMultiRange(el.rangeMulti.checked));

    Array.from(el.modeToggle.children).forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    Array.from(el.orderToggle.children).forEach((btn) => {
      btn.addEventListener('click', () => setOrder(btn.dataset.order));
    });

    Array.from(el.examStyleToggle.children).forEach((btn) => {
      btn.addEventListener('click', () => setExamStyle(btn.dataset.style));
    });

    Array.from(el.examAudioToggle.children).forEach((btn) => {
      btn.addEventListener('click', () => setExamAudio(btn.dataset.audio === 'on'));
    });

    Array.from(el.languageToggle.children).forEach((btn) => {
      btn.addEventListener('click', () => setLanguage(btn.dataset.language));
    });

    el.playBtn.addEventListener('click', playCurrentAudio);
    el.quitBtn.addEventListener('click', () => {
      showScreen('start');
      renderStartStats();
    });
    el.quizHomeBtn.addEventListener('click', () => {
      showScreen('start');
      renderStartStats();
    });

    el.retryBtn.addEventListener('click', retrySameExam);
    el.newExamBtn.addEventListener('click', startAnotherExamSameRange);
    el.reviewBtn.addEventListener('click', renderReview);
    el.homeBtn.addEventListener('click', () => {
      showScreen('start');
      renderStartStats();
    });
    el.reviewBackBtn.addEventListener('click', () => showScreen('result'));

    el.brandHomeBtn.addEventListener('click', () => {
      stopReadingAudio();
      state.listenPlaying = false;
      haltListenAudio();
      showScreen('start');
      renderStartStats();
    });

    el.playBtn.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') playCurrentAudio();
    });

    el.readingNextBtn.addEventListener('click', handleReadingNext);
    el.readingPrevBtn.addEventListener('click', handleReadingPrev);
    el.readingExitBtn.addEventListener('click', quitReading);

    el.listenPlayPauseBtn.addEventListener('click', toggleListenPlayPause);
    el.listenPrevBtn.addEventListener('click', () => skipListenWord(-1));
    el.listenNextBtn.addEventListener('click', () => skipListenWord(1));
    el.listenQuitBtn.addEventListener('click', stopListenSession);
    el.listenHomeBtn.addEventListener('click', stopListenSession);
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  async function init() {
    initTheme();
    bindEvents();
    renderStartStats();
    showScreen('start');

    try {
      state.db = await loadDatabase();
      el.dbLoading.hidden = true;
      el.setup.hidden = false;
      initSetup();
    } catch (err) {
      console.error(err);
      el.dbLoading.hidden = true;
      el.dbError.textContent = 'Could not load database.json. Make sure you are serving this folder over HTTP.';
      el.dbError.hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
