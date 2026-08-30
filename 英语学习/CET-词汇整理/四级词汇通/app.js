/* ============================================================
 * 英语词汇通 - 核心学习逻辑
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

/* 设置缺省值(旧存档缺字段时合并;自由拼写/听写配置也存这里) */
const DEFAULT_SETTINGS = {
  dailyNew: 20, dailyReview: 30, autoSpeak: true, lib: 'cet4',
  spellScope: 'all', spellCount: 20, spellWords: [],      // 自由拼写:范围 + 数量 + 自选词单
  dictScope: 'all', dictCount: 10, dictMode: 'judge',     // 听写:范围 + 数量 + 作答方式(judge判分/listen自查/auto自动轮播)
  dictWords: [],                                          // 听写自选词单
  dictPause: 1, dictRate: 0.9, dictOrder: 'random', dictLoop: false,  // 轮间停顿秒/语速/顺序/循环
};

/* 自定义拼写/听写的取词范围 */
const SCOPES = [
  { key: 'all', label: '全部' },
  { key: 'unseen', label: '未学习' },
  { key: 'learning', label: '学习中' },
  { key: 'mastered', label: '已掌握' },
  { key: 'book', label: '生词本' },
];

/* ---------------- 词库注册 ----------------
 * 内置四级词库：VOCAB 定义在 vocab-data.js：[单词, 释义]
 * 扩展词库：VOCAB_LIBS 定义在 vocab-libs.js（build-libs.js 从 lib-sources/*.json 生成）
 * VOCAB_EXTRA 定义在 vocab-extra.js：{ 单词: "巧记" }（按单词查，各词库通用）
 * 巧记只覆盖四级难词，其他词库查不到会静默降级为无巧记
 */
const LIBS = Object.assign(
  { cet4: { name: '四级词汇', words: (typeof VOCAB !== 'undefined' ? VOCAB : []) } },
  (typeof VOCAB_LIBS !== 'undefined' ? VOCAB_LIBS : {})
);

/* 每个词库的单词集合（导入进度时过滤用） */
const LIB_WORD_SETS = {};
for (const k of Object.keys(LIBS)) {
  LIB_WORD_SETS[k] = new Set(LIBS[k].words.map(([w]) => w));
}

/* 每个词库的释义表（学习记录按归属词库查释义，避免跨库显示空释义） */
const LIB_DEF_MAPS = {};
for (const k of Object.keys(LIBS)) {
  LIB_DEF_MAPS[k] = new Map(LIBS[k].words);
}

/* 在指定词库里查单词释义 */
function defInLib(lib, word) {
  const m = LIB_DEF_MAPS[lib];
  return m ? (m.get(word) || '') : '';
}

/* 听写播报用的汉译:剥离全部词性标记(多词性释义如 "adv. 在下面 prep. 在..下面 n. 底部"
 * 只读中文部分,避免 TTS 读出 "adv"/"prep"/"n" */
function speakableDef(word) {
  const raw = WORD_MAP.get(word) || '';
  const def = raw
    .replace(/(adj\.|adv\.|n\.|v\.|vt\.|vi\.|prep\.|conj\.|pron\.|int\.|num\.|art\.|abbr\.)/g, '，')
    .replace(/[;；/]/g, '，')
    .replace(/\s*，\s*/g, '，')
    .replace(/，+/g, '，')
    .replace(/^，|，$/g, '')
    .trim();
  return def || raw.trim();
}

let WORD_MAP = new Map();
let WORD_LIST = [];

/* 按当前词库重建 WORD_MAP / WORD_LIST（启动和切换词库时调用） */
function rebuildWordData() {
  const lib = LIBS[libKey()];
  WORD_MAP = new Map();
  WORD_LIST = lib.words.map(([w, m]) => { WORD_MAP.set(w, m); return w; });
}

const EXTRA_MAP = new Map(typeof VOCAB_EXTRA !== 'undefined' ? Object.entries(VOCAB_EXTRA) : []);

/* 巧记查询：无数据的词（简单词）返回空串 */
function memoOf(word) {
  const m = EXTRA_MAP.get(word);
  return (typeof m === 'string' && m.trim()) ? m.trim() : '';
}

/* ---------------- 全局状态 ----------------
 * 学习进度按词库隔离：state.libs[libKey].words[word] = {
 *   stage: 0新词, 1-5复习级, 5已掌握
 *   due:   下次复习时间戳(仅 stage>=1 使用)
 *   right: 累计答对
 *   wrong: 累计答错
 *   inBook: 是否在生词本
 *   created: 首次学习时间戳
 * }
 * 每日目标/学习记录(history)是全局的，不随词库切换分开
 */
const defaultState = () => ({
  settings: Object.assign({}, DEFAULT_SETTINGS),
  libs: {},      // libs[libKey].words = { 单词: 学习记录 }
  today: todayStr(),
  learnedToday: [],
  reviewedToday: [],
  history: {},   // history['YYYY-MM-DD'] = { learned:[], reviewed:[], wrongs:[] }，条目为 [词库key, 单词]
});

let state = loadState();

/* 当前词库 key（存档里没有或已失效时回落到内置四级） */
function libKey() {
  const k = state.settings && state.settings.lib;
  return (k && LIBS[k]) ? k : 'cet4';
}

/* 当前词库的学习记录表（懒创建） */
function curWords() {
  const k = libKey();
  if (!state.libs) state.libs = {};
  if (!state.libs[k]) state.libs[k] = { words: {} };
  if (!state.libs[k].words) state.libs[k].words = {};
  return state.libs[k].words;
}

/* 切换词库：仅切设置，进度天然隔离；调用方负责清掉进行中的会话 */
function setLibrary(key) {
  if (!LIBS[key] || key === libKey()) return;
  state.settings.lib = key;
  saveState();
  rebuildWordData();
}

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

/* ---------------- 学习记录（history） ----------------
 * 条目格式 [词库key, 单词]：各词库的词在记录里可区分、释义按归属词库查。
 * 旧版条目是纯字符串，渲染时用 normHistEntry 兼容归属。
 */
function histHas(list, word, lib) {
  return list.some(e => Array.isArray(e) ? (e[1] === word && e[0] === lib) : e === word);
}
function histAdd(list, word) {
  const lib = libKey();
  if (!histHas(list, word, lib)) list.push([lib, word]);
}

/* 学习记录条目规范化 → [lib, word]；无法归属返回 null */
function normHistEntry(e) {
  if (Array.isArray(e) && LIBS[e[0]] && typeof e[1] === 'string' && e[1]) return e;
  if (typeof e === 'string' && e) {
    const cur = libKey();
    if (LIB_WORD_SETS[cur] && LIB_WORD_SETS[cur].has(e)) return [cur, e];
    for (const k of Object.keys(LIB_WORD_SETS)) {
      if (LIB_WORD_SETS[k].has(e)) return [k, e];
    }
  }
  return null;
}

function recordLearned(word) {
  histAdd(todayRecord().learned, word);
  saveState();
}
function recordReviewed(word) {
  histAdd(todayRecord().reviewed, word);
  saveState();
}
function recordWrong(word) {
  histAdd(todayRecord().wrongs, word);
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
      // 设置项缺省合并（旧存档没有 autoSpeak/lib 及自由拼写/听写配置等新字段）
      const hadDictMode = s.settings && s.settings.dictMode != null;
      const legacyJudge = s.settings ? s.settings.dictJudge : undefined;
      s.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings);
      if (!LIBS[s.settings.lib]) s.settings.lib = 'cet4';
      // 旧存档只有 dictJudge(bool):迁移为 dictMode 三态(judge/listen/auto)
      if (!hadDictMode || !['judge', 'listen', 'auto'].includes(s.settings.dictMode)) {
        s.settings.dictMode = legacyJudge === false ? 'listen' : 'judge';
      }
      if (!Array.isArray(s.settings.spellWords)) s.settings.spellWords = [];
      if (!Array.isArray(s.settings.dictWords)) s.settings.dictWords = [];
      // 旧版存档迁移：state.words（单一词库）→ state.libs.cet4.words（按词库隔离）
      if (s.words && !s.libs) {
        s.libs = { cet4: { words: s.words } };
        delete s.words;
      }
      if (!s.libs) s.libs = {};
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
const EXPORT_VERSION = 2;

function exportProgress() {
  const data = { app: 'cet4-vocab', version: EXPORT_VERSION, exportedAt: Date.now(), state: state };
  return JSON.stringify(data);
}

function wordInAnyLib(w) {
  return Object.keys(LIB_WORD_SETS).some(k => LIB_WORD_SETS[k].has(w));
}

/* 导入文件的单词记录消毒:只接受预期字段和类型,防止恶意文件注入异常数据 */
function sanitizeWordRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const stage = Math.max(0, Math.min(STAGE_MASTERED, Math.floor(num(r.stage))));
  return {
    stage,
    // 已掌握词 due 恒为 Infinity(JSON 序列化成 null),其余用数值
    due: stage >= STAGE_MASTERED ? Infinity : num(r.due),
    right: num(r.right),
    wrong: num(r.wrong),
    inBook: r.inBook === true,
    created: num(r.created) || Date.now(),
  };
}

// 合并导入的数据；返回本次实际导入的单词数
// v2 存档按词库合并；v1 旧档（扁平 state.words）当作四级词库处理
function importProgress(json) {
  let data;
  try { data = JSON.parse(json); } catch (e) { throw new Error('文件内容不是有效的 JSON'); }
  if (!data || data.app !== 'cet4-vocab' || !data.state) throw new Error('这不是英语词汇通的进度文件');
  const incoming = data.state;
  const incLibs = incoming.libs || { cet4: { words: incoming.words || {} } };

  // 逐词库逐词合并：目标设备没有记录才写入
  let importedCount = 0;
  if (!state.libs) state.libs = {};
  for (const k of Object.keys(incLibs)) {
    if (!LIBS[k]) continue;   // 本地没有这个词库（版本过旧），跳过
    const incWords = incLibs[k].words || {};
    if (typeof incWords !== 'object') continue;
    if (!state.libs[k]) state.libs[k] = { words: {} };
    if (!state.libs[k].words) state.libs[k].words = {};
    const localWords = state.libs[k].words;
    for (const w of Object.keys(incWords)) {
      if (!LIB_WORD_SETS[k].has(w)) continue;   // 过滤该词库不存在的词
      if (localWords[w]) continue;              // 本地已有 → 不覆盖
      const rec = sanitizeWordRecord(incWords[w]);
      if (!rec) continue;                       // 记录形状不对 → 丢弃
      localWords[w] = rec;
      importedCount++;
    }
  }
  // 合并设置：保留两者较大值，避免覆盖用户已调好的计划；词库选择以本地为准
  if (incoming.settings) {
    state.settings = {
      dailyNew: Math.max(state.settings.dailyNew, incoming.settings.dailyNew || 0),
      dailyReview: Math.max(state.settings.dailyReview, incoming.settings.dailyReview || 0),
      autoSpeak: state.settings.autoSpeak,
      lib: libKey(),
    };
  }
  // 合并历史记录
  if (incoming.history) {
    if (!state.history) state.history = {};
    for (const day of Object.keys(incoming.history)) {
      if (!state.history[day]) state.history[day] = { learned: [], reviewed: [], wrongs: [] };
      for (const cat of ['learned', 'reviewed', 'wrongs']) {
        const list = incoming.history[day][cat] || [];
        for (const e of list) {
          // 条目兼容两种格式:[词库key, 单词] / 旧版纯字符串;拒绝超长垃圾项
          const isPair = Array.isArray(e);
          const w = isPair ? e[1] : e;
          const lib = isPair ? e[0] : null;
          if (typeof w !== 'string' || w.length > 64) continue;
          if (isPair && (!LIBS[lib] || !LIB_WORD_SETS[lib].has(w))) continue;
          if (!wordInAnyLib(w)) continue;
          if (!state.history[day][cat].some(x => Array.isArray(x) ? x[1] === w : x === w)) {
            state.history[day][cat].push(isPair ? e : w);
          }
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
  return WORD_LIST.filter(w => !curWords()[w] || curWords()[w].stage === 0);
}

function dueWords() {
  const now = Date.now();
  return WORD_LIST.filter(w => {
    const r = curWords()[w];
    return r && r.stage >= 1 && r.stage < STAGE_MASTERED && r.due <= now;
  });
}

function bookWords() {
  return WORD_LIST.filter(w => curWords()[w] && curWords()[w].inBook);
}

function masteredWords() {
  return WORD_LIST.filter(w => {
    const r = curWords()[w];
    return r && r.stage >= STAGE_MASTERED;
  });
}

/* 学习中：已学过、未掌握（stage 1-4，含待复习） */
function learningWords() {
  return WORD_LIST.filter(w => {
    const r = curWords()[w];
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

/* 自由拼写/听写的取词范围('custom' 为用户自选词单,取词表由 ui 层按模式提供) */
function normScope(v) {
  return (v === 'custom' || SCOPES.some(s => s.key === v)) ? v : 'all';
}
function wordsInScope(scope) {
  if (scope === 'unseen') return unseenWords();
  if (scope === 'learning') return learningWords();
  if (scope === 'mastered') return masteredWords();
  if (scope === 'book') return bookWords();
  return WORD_LIST.slice();
}

function classCount(cls) {
  return wordsByClass(cls).length;
}

/* 单个单词的掌握状态描述 */
function wordStatus(word) {
  const r = curWords()[word];
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
  delete curWords()[word];
  saveState();
}

/* 重置某分类全部单词 */
function resetWordsByClass(cls) {
  const list = wordsByClass(cls);
  for (const w of list) delete curWords()[w];
  saveState();
}

/* ---------------- 状态变更 ---------------- */

// 学习新词：识别阶段答对达标后记为已学
function learnWord(word) {
  let r = curWords()[word] || { stage: 0, right: 0, wrong: 0, inBook: false, created: Date.now() };
  if (!r.created) r.created = Date.now();
  r.right++;
  r.stage = 1;
  r.due = Date.now() + INTERVALS[0] * DAY_MS;
  curWords()[word] = r;
  if (!state.learnedToday.includes(word)) state.learnedToday.push(word);
  recordLearned(word);
  saveState();
}

// 复习答对：按艾宾浩斯升级
function reviewCorrect(word) {
  const r = curWords()[word] || { stage: 0, right: 0, wrong: 0, inBook: false, created: Date.now() };
  r.right++;
  if (r.stage < STAGE_MASTERED) r.stage++;
  if (r.stage >= STAGE_MASTERED) {
    // 完全记住，移出复习循环
    r.due = Infinity;
  } else {
    r.due = Date.now() + INTERVALS[r.stage - 1] * DAY_MS;
  }
  curWords()[word] = r;
  if (!state.reviewedToday.includes(word)) state.reviewedToday.push(word);
  recordReviewed(word);
  saveState();
}

// 复习答错：降级；addBook 决定是否进生词本
function reviewWrong(word, addBook) {
  const r = curWords()[word] || { stage: 1, right: 0, wrong: 0, inBook: false, created: Date.now() };
  r.wrong++;
  // 最低降到 1 级：stage 0 会被 dueWords 排除，导致「10 分钟后再复习」永远不出现
  r.stage = Math.max(1, r.stage - 2);
  r.due = Date.now() + 10 * 60 * 1000; // 10 分钟后重试
  if (addBook !== false) r.inBook = true;
  curWords()[word] = r;
  if (!state.reviewedToday.includes(word)) state.reviewedToday.push(word);
  recordReviewed(word);
  recordWrong(word);
  saveState();
}

function toggleBook(word) {
  const r = curWords()[word] || { stage: 0, right: 0, wrong: 0, inBook: false, created: Date.now() };
  r.inBook = !r.inBook;
  curWords()[word] = r;
  saveState();
}

// 会话中答错：累计错误次数，addBook 决定是否加入生词本
function noteWrong(word, addBook) {
  let r = curWords()[word] || { stage: 0, right: 0, wrong: 0, inBook: false, created: Date.now() };
  r.wrong++;
  if (addBook) r.inBook = true;
  curWords()[word] = r;
  recordWrong(word);
  saveState();
}

/* ---------------- 出题 ----------------
 * 英译汉：看单词选释义
 * 汉译英：看释义选单词（复习模式增强提取练习）
 */

/* 从释义提取词性标记，如 "adj." / "n." / "v." */
function posOf(def) {
  const m = /^(adj\.|adv\.|n\.|v\.|vt\.|vi\.|prep\.|conj\.|pron\.|int\.|num\.|art\.|abbr\.)/.exec(def || '');
  return m ? m[1] : '';
}

/* 抽优质干扰项：优先同词性、词长相近；排除与答案同释义的词，
 * 且干扰项之间释义也互不相同（74 组同释义词，两个同义干扰项会出重复选项） */
function pickDistractors(word, n) {
  const answerDef = WORD_MAP.get(word);
  const pool = WORD_LIST.filter(w => w !== word && WORD_MAP.get(w) !== answerDef);
  const myPos = posOf(answerDef);
  const myLen = word.length;
  const samePos = shuffle(pool.filter(w => posOf(WORD_MAP.get(w)) === myPos))
    .sort((a, b) => Math.abs(a.length - myLen) - Math.abs(b.length - myLen));
  const rest = shuffle(pool.filter(w => posOf(WORD_MAP.get(w)) !== myPos));
  const candidates = samePos.concat(rest);
  const picked = [];
  const usedDefs = new Set([answerDef]);
  for (const w of candidates) {
    const d = WORD_MAP.get(w);
    if (usedDefs.has(d)) continue;
    usedDefs.add(d);
    picked.push(w);
    if (picked.length >= n) break;
  }
  return picked;
}

/* 释义反查单词（答错提示/错误选项点看用）：优先跳过 excludeWord，避免同释义提示自己 */
function reverseDefToWord(def, excludeWord) {
  let found = null;
  for (const [w, d] of WORD_MAP) {
    if (d === def && w !== excludeWord) { found = w; break; }
  }
  if (!found) {
    for (const [w, d] of WORD_MAP) {
      if (d === def) { found = w; break; }
    }
  }
  return found;
}

function makeQuestion(word, reverse) {
  const answerDef = WORD_MAP.get(word);
  const distractorWords = pickDistractors(word, 3);
  if (reverse) {
    // 汉译英：看释义选单词（干扰项是英文单词）
    const texts = [word, ...distractorWords];
    return {
      type: '汉译英',
      prompt: answerDef,
      answer: word,
      speakWord: word,
      options: shuffle(texts.map(t => ({ text: t, isAnswer: t === word }))),
    };
  }
  // 英译汉：看单词选释义（干扰项是中文释义）
  const texts = [answerDef, ...distractorWords.map(w => WORD_MAP.get(w))];
  return {
    type: '英译汉',
    prompt: word,
    answer: answerDef,
    speakWord: word,
    options: shuffle(texts.map(t => ({ text: t, isAnswer: t === answerDef }))),
  };
}

/* ---------------- 统计 ---------------- */
function stats() {
  const total = WORD_LIST.length;
  const seen = Object.keys(curWords()).length;
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

/* ---------------- 启动 ---------------- */
/* 按存档里的词库设置初始化词表（ui.js 加载后 refreshHome 依赖 WORD_LIST） */
rebuildWordData();
