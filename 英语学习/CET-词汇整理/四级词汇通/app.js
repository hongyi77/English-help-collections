/* ============================================================
 * 四级词汇通 - 核心学习逻辑
 * 功能：新学 / 复习(艾宾浩斯) / 生词本 / 统计
 * 题型：英译汉（看单词选释义）
 * 数据：localStorage 持久化，双击 index.html 即可使用
 * ============================================================ */

/* ---------------- 艾宾浩斯复习间隔(天) ----------------
 * 一个单词每复习正确一次，升一级，下一次复习间隔按此表放大。
 * 达到最高级(5)且答对 → 判定"完全记住"，移出复习循环。
 */
const INTERVALS = [1, 2, 4, 7, 15]; // 升到 stage1..5 后的间隔天数
const STAGE_MASTERED = INTERVALS.length; // 5 = 已掌握

const STATE_KEY = 'cet4_study_state_v1';
const DAY_MS = 24 * 60 * 60 * 1000;

/* ---------------- 单词数据 ----------------
 * VOCAB 定义在 vocab-data.js：[单词, 释义]
 */
const WORD_MAP = new Map();
const WORD_LIST = VOCAB.map(([w, m]) => { WORD_MAP.set(w, m); return w; });

/* ---------------- 全局状态 ----------------
 * state.words[word] = {
 *   stage: 0新词, 1-5复习级, 5已掌握
 *   due:   下次复习时间戳(仅 stage>=1 使用)
 *   right: 累计答对
 *   wrong: 累计答错
 *   inBook: 是否在生词本
 *   created: 首次学习时间戳
 * }
 */
const defaultState = () => ({
  settings: { dailyNew: 20, dailyReview: 30 },
  words: {},
  today: todayStr(),
  learnedToday: [],
  reviewedToday: [],
  masteredTotal: 0,
  history: {},   // history['YYYY-MM-DD'] = { learned:[], reviewed:[], wrongs:[] }
});

let state = loadState();

function todayStr() {
  return new Date().toDateString();
}

/* 日期 key：YYYY-MM-DD（用于 history） */
function dateKey(ts) {
  const d = ts ? new Date(ts) : new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* 当日 history 记录（懒创建） */
function todayRecord() {
  const k = dateKey();
  if (!state.history) state.history = {};
  if (!state.history[k]) state.history[k] = { learned: [], reviewed: [], wrongs: [] };
  return state.history[k];
}

function recordLearned(word) {
  const rec = todayRecord();
  if (!rec.learned.includes(word)) rec.learned.push(word);
  saveState();
}
function recordReviewed(word) {
  const rec = todayRecord();
  if (!rec.reviewed.includes(word)) rec.reviewed.push(word);
  saveState();
}
function recordWrong(word) {
  const rec = todayRecord();
  if (!rec.wrongs.includes(word)) rec.wrongs.push(word);
  saveState();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // 跨天重置当日计数
      if (s.today !== todayStr()) {
        s.today = todayStr();
        s.learnedToday = [];
        s.reviewedToday = [];
      }
      return s;
    }
  } catch (e) { /* 损坏则重建 */ }
  return defaultState();
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) { /* 存储满/不可用，忽略 */ }
}

/* ---------------- 进度导出 / 导入（跨设备同步） ---------------- */
const EXPORT_VERSION = 1;

function exportProgress() {
  const data = { app: 'cet4-vocab', version: EXPORT_VERSION, exportedAt: Date.now(), state: state };
  return JSON.stringify(data);
}

// 合并导入的数据；返回本次实际导入的单词数
function importProgress(json) {
  let data;
  try { data = JSON.parse(json); } catch (e) { throw new Error('文件内容不是有效的 JSON'); }
  if (!data || data.app !== 'cet4-vocab' || !data.state) throw new Error('这不是四级词汇通的进度文件');
  const incoming = data.state;
  const incomingWords = incoming.words || {};

  // 逐词合并：目标设备没有记录才写入；已掌握数按 source 来源
  let importedCount = 0;
  for (const w of Object.keys(incomingWords)) {
    if (!WORD_MAP.has(w)) continue;          // 过滤本词库不存在的词
    if (!state.words[w]) {                   // 本地没有 → 直接导入
      state.words[w] = incomingWords[w];
      importedCount++;
    }
  }
  // 合并设置：保留两者较大值，避免覆盖用户已调好的计划
  if (incoming.settings) {
    state.settings = {
      dailyNew: Math.max(state.settings.dailyNew, incoming.settings.dailyNew || 0),
      dailyReview: Math.max(state.settings.dailyReview, incoming.settings.dailyReview || 0),
    };
  }
  // 合并历史记录
  if (incoming.history) {
    if (!state.history) state.history = {};
    for (const day of Object.keys(incoming.history)) {
      if (!state.history[day]) state.history[day] = { learned: [], reviewed: [], wrongs: [] };
      for (const cat of ['learned', 'reviewed', 'wrongs']) {
        const list = incoming.history[day][cat] || [];
        for (const w of list) {
          if (WORD_MAP.has(w) && !state.history[day][cat].includes(w)) state.history[day][cat].push(w);
        }
      }
    }
  }
  saveState();
  return importedCount;
}

/* ---------------- 工具函数 ---------------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function pickRandom(arr, n) {
  return shuffle(arr).slice(0, n);
}

function daysBetween(fromTs, toTs) {
  return Math.floor((toTs - fromTs) / DAY_MS);
}

/* ---------------- 词汇池 ---------------- */
function unseenWords() {
  return WORD_LIST.filter(w => !state.words[w] || state.words[w].stage === 0);
}

function dueWords() {
  const now = Date.now();
  return WORD_LIST.filter(w => {
    const r = state.words[w];
    return r && r.stage >= 1 && r.stage < STAGE_MASTERED && r.due <= now;
  });
}

function bookWords() {
  return WORD_LIST.filter(w => state.words[w] && state.words[w].inBook);
}

function masteredWords() {
  return WORD_LIST.filter(w => {
    const r = state.words[w];
    return r && r.stage >= STAGE_MASTERED;
  });
}

/* 学习中：已学过、未掌握（stage 1-4，含待复习） */
function learningWords() {
  return WORD_LIST.filter(w => {
    const r = state.words[w];
    return r && r.stage >= 1 && r.stage < STAGE_MASTERED;
  });
}

/* 分类：unlearned / learning / due / mastered */
function wordsByClass(cls) {
  if (cls === 'unlearned') return unseenWords();
  if (cls === 'mastered') return masteredWords();
  if (cls === 'due') return dueWords();
  return learningWords();
}

function classCount(cls) {
  return wordsByClass(cls).length;
}

/* 单个单词的掌握状态描述 */
function wordStatus(word) {
  const r = state.words[word];
  if (!r || r.stage === 0) {
    return { cls: 'unlearned', label: '未学习', stage: 0, right: 0, wrong: 0, due: null };
  }
  if (r.stage >= STAGE_MASTERED) {
    return { cls: 'mastered', label: '已掌握', stage: r.stage, right: r.right, wrong: r.wrong, due: null };
  }
  const dueNow = r.due <= Date.now();
  return {
    cls: dueNow ? 'due' : 'learning',
    label: dueNow ? '待复习' : '学习中',
    stage: r.stage,
    right: r.right,
    wrong: r.wrong,
    due: r.due,
  };
}

/* 重置单个单词：删除记录，回到未学习 */
function resetWord(word) {
  delete state.words[word];
  saveState();
}

/* 重置某分类全部单词 */
function resetWordsByClass(cls) {
  const list = wordsByClass(cls);
  for (const w of list) delete state.words[w];
  saveState();
}

/* ---------------- 状态变更 ---------------- */

// 学习新词：self 认识=true/false
function learnWord(word, known) {
  let r = state.words[word] || { stage: 0, right: 0, wrong: 0, inBook: false, created: Date.now() };
  if (!r.created) r.created = Date.now();
  if (known) {
    r.right++;
    r.stage = 1;
    r.due = Date.now() + INTERVALS[0] * DAY_MS;
  } else {
    r.wrong++;
    r.stage = 0;             // 没记住，保持新词，稍后再来
    r.due = Date.now() + 10 * 60 * 1000; // 10 分钟后可再复习
    r.inBook = true;          // 自动进生词本
  }
  state.words[word] = r;
  if (!state.learnedToday.includes(word)) state.learnedToday.push(word);
  recordLearned(word);
  saveState();
}

// 复习答对：按艾宾浩斯升级
function reviewCorrect(word) {
  const r = state.words[word] || { stage: 0, right: 0, wrong: 0, inBook: false, created: Date.now() };
  r.right++;
  if (r.stage < STAGE_MASTERED) r.stage++;
  if (r.stage >= STAGE_MASTERED) {
    // 完全记住，移出复习循环
    r.due = Infinity;
    state.masteredTotal++;
  } else {
    r.due = Date.now() + INTERVALS[r.stage - 1] * DAY_MS;
  }
  state.words[word] = r;
  if (!state.reviewedToday.includes(word)) state.reviewedToday.push(word);
  recordReviewed(word);
  saveState();
}

// 复习答错：降级；addBook 决定是否进生词本
function reviewWrong(word, addBook) {
  const r = state.words[word] || { stage: 1, right: 0, wrong: 0, inBook: false, created: Date.now() };
  r.wrong++;
  r.stage = Math.max(0, r.stage - 2); // 连降两级
  r.due = Date.now() + 10 * 60 * 1000; // 10 分钟后重试
  if (addBook !== false) r.inBook = true;
  state.words[word] = r;
  if (!state.reviewedToday.includes(word)) state.reviewedToday.push(word);
  recordReviewed(word);
  recordWrong(word);
  saveState();
}

function toggleBook(word) {
  const r = state.words[word] || { stage: 0, right: 0, wrong: 0, inBook: false, created: Date.now() };
  r.inBook = !r.inBook;
  state.words[word] = r;
  saveState();
}

// 会话中答错：累计错误次数，addBook 决定是否加入生词本
function noteWrong(word, addBook) {
  let r = state.words[word] || { stage: 0, right: 0, wrong: 0, inBook: false, created: Date.now() };
  r.wrong++;
  if (addBook) r.inBook = true;
  state.words[word] = r;
  recordWrong(word);
  saveState();
}

/* ---------------- 出题（英译汉：看单词选释义） ---------------- */
function makeQuestion(word) {
  // 干扰项：从词库随机抽 3 个不同的词
  const others = pickRandom(WORD_LIST.filter(w => w !== word), 3);
  const distractors = others.map(w => WORD_MAP.get(w));
  return {
    type: '英译汉',
    prompt: word,
    answer: WORD_MAP.get(word),
    options: shuffle([WORD_MAP.get(word), ...distractors].map(m => ({ text: m, isAnswer: m === WORD_MAP.get(word) }))),
  };
}

/* ---------------- 统计 ---------------- */
function stats() {
  const total = WORD_LIST.length;
  const seen = Object.keys(state.words).length;
  const mastered = masteredWords().length;
  const inBook = bookWords().length;
  const due = dueWords().length;
  const unseen = total - seen;
  return { total, seen, mastered, inBook, due, unseen, learning: classCount('learning'), learnedToday: state.learnedToday.length, reviewedToday: state.reviewedToday.length };
}

/* ---------------- 每日目标 ---------------- */
function goalInfo() {
  const target = state.settings.dailyNew;
  const learned = state.learnedToday.length;
  const dueToday = dueWords().length;
  const allDone = learned >= target && unseenWords().length === 0;
  return {
    target,
    learned,
    remaining: Math.max(0, target - learned),
    done: learned >= target,
    allDone,
    dueToday,
    reviewedToday: state.reviewedToday.length,
  };
}
