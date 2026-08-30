/* ============================================================
 * 英语词汇通 - 界面交互层
 * 依赖：app.js（逻辑）+ vocab-data.js（数据）
 * ============================================================ */

/* ---------------- 导航与页面切换 ---------------- */
const SCREEN_TITLES = {
  'screen-home': '学习',
  'screen-study': '学习新词',
  'screen-review': '复习单词',
  'screen-spell': '自由拼写',
  'screen-dictate': '听写',
  'screen-vocab': '词汇',
  'screen-dict': '词典',
  'screen-settings': '设置',
};
/* 有底部导航的页面;答题会话页隐藏底栏,沉浸作答 */
const TAB_SCREENS = ['screen-home', 'screen-vocab', 'screen-dict', 'screen-settings'];

function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const t = SCREEN_TITLES[id] || '';
  document.getElementById('topTitle').textContent = t;
  const tabbed = TAB_SCREENS.includes(id);
  const tabbar = document.getElementById('tabbar');
  if (tabbar) tabbar.style.display = tabbed ? 'flex' : 'none';
  document.getElementById('topBack').style.display = tabbed ? 'none' : 'inline';
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  // 学习页顶栏右侧显示当前词库名
  document.getElementById('topSub').textContent = (id === 'screen-home') ? LIBS[libKey()].name : '';
  // 离开听写页时停止播报
  if (id !== 'screen-dictate') stopDictPlayback();
  if (id === 'screen-home') refreshHome();
  if (id === 'screen-vocab') renderVocab();
  if (id === 'screen-settings') refreshSettings();
  if (id === 'screen-spell') renderSpellConfig();
  if (id === 'screen-dictate') renderDictConfig();
}

function goHome() { go('screen-home'); }

/* ---------------- 首页（学习 Tab） ---------------- */
function refreshHome() {
  const s = stats();
  document.getElementById('statTotal').textContent = s.total;
  document.getElementById('statMastered').textContent = s.mastered;
  document.getElementById('statDue').textContent = s.due;
  document.getElementById('statUnseen').textContent = s.unseen;
  document.getElementById('badgeNew').textContent = Math.min(s.unseen, state.settings.dailyNew);
  document.getElementById('badgeReview').textContent = s.due;
  // tab 徽章:待复习数 / 生词本数
  setTabBadge('tabBadgeStudy', s.due);
  setTabBadge('tabBadgeBook', s.inBook);
  // 听写依赖发音能力:在线音源(音频元素)或系统 TTS 二有其一;微信/QQ 内置等无 TTS 仍可用在线音源
  const dictEntry = document.getElementById('dictationEntry');
  if (dictEntry) dictEntry.style.display = (ttsSupported() || canUseOnlineVoice()) ? 'flex' : 'none';
  renderLibPicker();
  renderGoalCard();
}

function setTabBadge(id, n) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = n > 0 ? (n > 99 ? '99+' : n) : '';
  el.style.display = n > 0 ? 'block' : 'none';
}

function renderGoalCard() {
  const g = goalInfo();
  const d = new Date();
  document.getElementById('goalDate').textContent = `${d.getMonth() + 1}月${d.getDate()}日`;
  const newNum = document.getElementById('goalNewNum');
  const newBar = document.getElementById('goalNewBar');
  const newStatus = document.getElementById('goalNewStatus');
  newNum.textContent = `${Math.min(g.learned, g.target)}/${g.target}`;
  const pct = Math.min(100, (g.learned / g.target) * 100);
  newBar.style.width = pct + '%';
  if (g.allDone) {
    newStatus.textContent = '全部学完';
    newStatus.className = 'goal-status done';
  } else if (g.done) {
    newStatus.textContent = '已完成 ✓';
    newStatus.className = 'goal-status done';
  } else {
    newStatus.textContent = `还差 ${g.remaining} 个`;
    newStatus.className = 'goal-status';
  }
  const revNum = document.getElementById('goalReviewNum');
  const revStatus = document.getElementById('goalReviewStatus');
  const revBar = document.getElementById('goalReviewBar');
  revNum.textContent = `${g.dueToday} 词`;
  if (revBar) {
    // 复习目标进度：今日已复习 / 每日复习计划
    const revPct = Math.min(100, (g.reviewedToday / Math.max(1, state.settings.dailyReview)) * 100);
    revBar.style.width = revPct + '%';
  }
  if (g.reviewedToday >= state.settings.dailyReview) {
    revStatus.textContent = '复习目标达成 ✓';
    revStatus.className = 'goal-status done';
  } else if (g.dueToday > 0) {
    revStatus.textContent = `有到期复习 · 已复习 ${g.reviewedToday}/${state.settings.dailyReview}`;
    revStatus.className = 'goal-status';
  } else {
    revStatus.textContent = g.reviewedToday > 0
      ? `今日已复习 ${g.reviewedToday} 词`
      : '今日无待复习';
    revStatus.className = 'goal-status';
  }
}

/* 未完成会话不再弹首页横幅提示:快照静默保留当天,跨天自动失效(loadSessionSnapshot 里重置) */

/* ---------------- 设置 ---------------- */
function refreshSettings() {
  document.getElementById('setNew').textContent = state.settings.dailyNew;
  document.getElementById('setReview').textContent = state.settings.dailyReview;
  const speakBtn = document.getElementById('setSpeak');
  if (speakBtn) speakBtn.textContent = !ttsSupported() ? '不支持' : (state.settings.autoSpeak ? '开' : '关');
  renderVoiceSettings();
  renderLibPicker();
}

/* ---------------- 发音设置（音源/口音/试听/设备TTS声音选择器） ---------------- */
function renderVoiceSettings() {
  const srcOn = canUseOnlineVoice();
  const srcBtn = document.getElementById('setOnlineVoice');
  if (srcBtn) {
    srcBtn.textContent = srcOn ? '在线真人' : '设备TTS';
    srcBtn.classList.toggle('active', srcOn);
    srcBtn.disabled = typeof Audio === 'undefined';   // 连音频元素都没有的环境没有可选项
  }
  const accWrap = document.getElementById('voiceAccChips');
  if (accWrap) {
    accWrap.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', Number(b.dataset.acc) === (state.settings.audioAcc || 1)));
  }
  fillTTSVoiceSelect('setTtsEngVoice', 'en-US', state.settings.ttsEngVoiceName);
  fillTTSVoiceSelect('setTtsZhVoice', 'zh-CN', state.settings.ttsZhVoiceName);
}

/* 设备TTS声音下拉：首项「自动优选」+ 按女声/男声/其他分组;
 * 收录在 VOICE_META 里的声音显示中文名并标注性别,未收录的显示原名归「其他」 */
function fillTTSVoiceSelect(id, lang, sel) {
  const el = document.getElementById(id);
  if (!el) return;
  refreshTTSVoices();
  const wantZh = /^zh/.test(lang);
  const pool = ttsVoices.filter(v => {
    const l = (v.lang || '').replace('_', '-').toLowerCase();
    return wantZh ? (l === 'zh-cn' || l === 'zh-hans' || l === 'zh') : l.indexOf('en') === 0;
  });
  const groups = { f: [], m: [], o: [] };   // 女声/男声/其他
  for (const v of pool) {
    const meta = voiceMeta(v);
    const tag = meta.g === 'f' ? '（女）' : meta.g === 'm' ? '（男）' : '';
    const label = escapeHtml(meta.zh || v.name) + tag;
    const selected = sel && v.name === sel ? ' selected' : '';
    groups[meta.g === 'f' ? 'f' : meta.g === 'm' ? 'm' : 'o'].push(
      `<option value="${escapeAttr(v.name)}"${selected}>${label}</option>`
    );
  }
  const best = pickBestTTSVoice(ttsVoices, lang);
  const bm = best ? voiceMeta(best) : null;
  const autoTag = bm ? (bm.g === 'f' ? ' · 女' : bm.g === 'm' ? ' · 男' : '') : '';
  const autoLabel = '自动优选' + (best ? `（${escapeHtml(bm.zh || best.name)}${autoTag}）` : '');
  const group = (title, opts) => opts.length ? `<optgroup label="${title}">${opts.join('')}</optgroup>` : '';
  el.innerHTML = `<option value="">${autoLabel}</option>` +
    group('女声', groups.f) + group('男声', groups.m) + group('其他', groups.o);
}

function setOnlineVoice(on) {
  state.settings.onlineVoice = !!on;
  saveState();
  refreshSettings();
}

function setAudioAcc(v) {
  state.settings.audioAcc = v ? 1 : 0;
  saveState();
  refreshSettings();
}

function onTTSVoiceChange(which, val) {
  if (which === 'en') state.settings.ttsEngVoiceName = val;
  else state.settings.ttsZhVoiceName = val;
  saveState();
}

/* 试听：走真实播放链（音源优先，TTS 兜底） */
function previewVoice(kind) {
  unlockPlayback();
  if (kind === 'zh') speakDictText('你好，这是标准普通话发音测试', 'zh-CN', 1);
  else speakWord('vocabulary');
}

/* 词库选择器（设置页）：chip 列表，当前词库高亮；点击弹确认后切换 */
function renderLibPicker() {
  const el = document.getElementById('libList');
  if (!el) return;
  const cur = libKey();
  el.innerHTML = Object.keys(LIBS).map(k => {
    const lib = LIBS[k];
    const act = k === cur ? 'active' : '';
    const n = LIB_WORD_SETS[k].size;
    return `<button class="master-tab ${act}" data-lib="${k}" onclick="confirmSwitchLib('${k}')">
      ${escapeHtml(lib.name)} <span class="mt-cnt">${n}</span>
    </button>`;
  }).join('');
  const note = document.getElementById('libNote');
  if (note) note.textContent = `当前词库：${LIBS[cur].name}（${WORD_LIST.length} 词）。各词库学习进度独立保存，可随时切换。`;
  // 题卡右上角角标跟随当前词库（CSS content 用 --lib-badge 变量）
  const root = document.documentElement;
  if (root && root.style) root.style.setProperty('--lib-badge', JSON.stringify(LIBS[cur].name));
}

/* ---------------- 词汇 Tab（生词本/掌握情况/学习记录 分段） ---------------- */
let vocabSeg = 'book';

function setVocabSeg(seg) {
  vocabSeg = seg;
  renderVocab();
}

function renderVocab() {
  document.querySelectorAll('#vocabSegs button').forEach(b => b.classList.toggle('active', b.dataset.seg === vocabSeg));
  ['book', 'master', 'history'].forEach(s => {
    const el = document.getElementById('seg-' + s);
    if (el) el.style.display = s === vocabSeg ? 'block' : 'none';
  });
  if (vocabSeg === 'book') renderBook();
  else if (vocabSeg === 'master') renderMaster();
  else renderHistory();
}

/* ---------------- 词典 Tab ---------------- */
let dictQ = '';   // 保留搜索词，答题等操作返回后可恢复结果

function onDictInput(v) {
  dictQ = v;
  renderDictResults();
}

function renderDictResults() {
  const el = document.getElementById('dictList');
  const hint = document.getElementById('dictHint');
  if (!el) return;
  const q = dictQ.trim().toLowerCase();
  const input = document.getElementById('dictInput');
  if (input && input.value !== dictQ) input.value = dictQ;
  if (!q) {
    el.innerHTML = '';
    hint.textContent = '跨全部词库查询 · 点小喇叭听发音';
    return;
  }
  // 全词库顺序扫描(约1.6万词,毫秒级);同一单词只保留最先命中的词库
  const rows = [];
  const seen = new Set();
  for (const k of Object.keys(LIBS)) {
    for (const [w, def] of LIBS[k].words) {
      if (seen.has(w)) continue;
      const wl = w.toLowerCase();
      let score = -1;
      if (wl === q) score = 0;
      else if (wl.startsWith(q)) score = 1;
      else if (wl.includes(q)) score = 2;
      else if (def.toLowerCase().includes(q)) score = 3;
      if (score < 0) continue;
      seen.add(w);
      rows.push({ w, def, lib: k, score });
    }
  }
  rows.sort((a, b) => a.score - b.score || a.w.localeCompare(b.w));
  const shown = rows.slice(0, 50);
  hint.textContent = rows.length
    ? `匹配 ${rows.length} 个单词${rows.length > 50 ? '，显示前 50 个' : ''}`
    : '没有匹配的单词';
  if (!shown.length) { el.innerHTML = ''; return; }
  const cur = libKey();
  el.innerHTML = shown.map(r => {
    const inCur = LIB_WORD_SETS[cur].has(r.w);
    const inBookNow = !!(curWords()[r.w] && curWords()[r.w].inBook);
    const libTag = LIBS[r.lib].name.replace('词汇', '');
    return `<div class="list-card"><div class="list-item">
      <span class="list-word">${escapeHtml(r.w)}</span>
      <span class="dict-lib">${escapeHtml(libTag)}</span>
      <span class="list-def">${escapeHtml(r.def)}</span>
      ${memoOf(r.w) ? `<button class="list-memo-btn" title="巧记" onclick="toggleMemoRow('${escapeAttr(r.w)}', this)">${icon('lightbulb')}</button>` : ''}
      <button class="list-speak" title="发音" onclick="speakWord('${escapeAttr(r.w)}')">${icon('volume-2')}</button>
      ${inCur ? `<button class="list-del ${inBookNow ? 'in-book' : ''}" title="${inBookNow ? '从生词本移除' : '加入生词本'}" onclick="toggleDictBook('${escapeAttr(r.w)}')">${inBookNow ? icon('bookmark-check') : icon('bookmark-plus')}</button>` : ''}
    </div></div>`;
  }).join('');
}

function toggleDictBook(word) {
  toggleBook(word);
  renderDictResults();
}

let pendingLib = null;
function confirmSwitchLib(key) {
  if (key === libKey() || !LIBS[key]) return;
  pendingLib = key;
  const hasSession = hasSnapshot();
  document.getElementById('switchLibTitle').textContent = `切换到「${LIBS[key].name}」？`;
  document.getElementById('switchLibDesc').textContent = hasSession
    ? '进行中的学习会话将被放弃。各词库进度独立，切换后原词库进度保留，可随时切回。'
    : '各词库学习进度独立保存，切换后原词库进度保留，可随时切回。';
  document.getElementById('switchLibModal').classList.add('show');
}
function closeSwitchLib() {
  pendingLib = null;
  document.getElementById('switchLibModal').classList.remove('show');
}
function doSwitchLib() {
  if (pendingLib && LIBS[pendingLib]) {
    // 放弃进行中的会话（队列属于旧词库，切过去无法继续）
    session = null;
    clearSessionSnapshot();
    setLibrary(pendingLib);
    refreshSettings();   // 设置页 chips 高亮与说明刷新
    refreshHome();       // 首页统计与 tab 徽章同步
  }
  closeSwitchLib();
}

function adjSetting(key, delta) {
  const v = state.settings[key] + delta;
  state.settings[key] = Math.max(1, Math.min(100, v));
  saveState();
  refreshSettings();
}

function toggleAutoSpeak() {
  if (!ttsSupported()) return;   // 浏览器不支持时按钮显示「不支持」，不可切换
  state.settings.autoSpeak = !state.settings.autoSpeak;
  saveState();
  refreshSettings();
}

function confirmReset() { document.getElementById('resetModal').classList.add('show'); }
function closeReset() { document.getElementById('resetModal').classList.remove('show'); }
function doReset() {
  if (lastResetWord) {
    resetWord(lastResetWord);
    lastResetWord = null;
    closeReset();
    renderMaster();
    refreshHome();
    return;
  }
  state = defaultState();
  saveState();
  rebuildWordData();   // 重置回到默认四级词库
  closeReset();
  go('screen-home');
}

/* ---------------- 导出 / 导入进度 ---------------- */
function exportProgressFile() {
  const json = exportProgress();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  a.href = url;
  a.download = `英语词汇通_进度_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setImportMsg('✅ 已导出进度文件，把它发到另一台设备即可', 'ok');
}

function handleImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  // 安全限制:进度文件最大 10MB,拒绝异常巨大的文件
  if (file.size > 10 * 1024 * 1024) {
    setImportMsg('❌ 文件超过 10MB，不是有效的进度文件', 'err');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const n = importProgress(String(reader.result));
      setImportMsg(`✅ 导入成功，同步了 ${n} 个单词的学习记录`, 'ok');
      refreshHome();
      if (masterTab) renderMaster();
      renderBook();
    } catch (e) {
      setImportMsg('❌ 导入失败：' + e.message, 'err');
    }
  };
  reader.onerror = () => setImportMsg('❌ 读取文件失败', 'err');
  reader.readAsText(file, 'utf-8');
  event.target.value = ''; // 允许重复选择同一文件
}

function setImportMsg(text, kind) {
  const el = document.getElementById('importMsg');
  if (!el) return;
  el.textContent = text;
  el.style.color = kind === 'ok' ? 'var(--green)' : 'var(--pen-red)';
  setTimeout(() => { el.textContent = ''; }, 6000);
}

/* ============================================================
 * 答题会话（学习 / 复习 共用）
 * ============================================================
 * 三段式流程（学习与复习逻辑一致）：
 *   1. 识别阶段：英译汉（看单词选释义），逐词出题
 *      答错/不会 → 不卡住，刷新下一个词，该词进入「错词池」
 *      （记几次错，延迟到本阶段收尾才重新出现，须再答对多次）
 *   2. 全部识别完后，询问是否进入拼写阶段（可拒绝）
 *   3. 拼写阶段：看释义拼写，连对达标才完成
 *   拼写答错时不卡住：进拼写错词池，先出下一个词，稍后穿插重现
 *   答错时：可自选是否加入生词本
 */
let session = null;
/* 会话状态: { mode, queue, pending(识别队列), idx, correct, wrong,
 *   records: Map(word -> { errors, corrects, spellCorrects, done }),
 *   spellOn(是否进入拼写), phase('recognize'|'spell'|'done'),
 *   retries(识别错词池), spellRetries(拼写错词池), sinceSpellRetry(拼写穿插计数) }
 */
const RECOG_REQUIRED = 3;   // 错词重新出现后需累计答对次数（多次）
const SPELL_REQUIRED = 2;   // 拼写需连续答对次数
const ERROR_POOL = 3;       // 错词延迟：约每3个新词后重新出现一次

function makeRecord() { return { errors: 0, corrects: 0, spellCorrects: 0, done: false }; }

/* ---------------- 会话快照（断点续学） ----------------
 * 每次答题后把当前 session 进度存入 localStorage，
 * 刷新/关闭后可从上次中断处继续。
 */
const SESSION_KEY = 'cet4_session_snapshot_v1';

function saveSessionSnapshot() {
  if (!session) return;
  try {
    const snap = {
      mode: session.mode,
      day: dateKey(),          // 快照归属日:跨天自动失效(次日重置)
      queue: session.queue,
      pending: session.pending || [],
      retries: session.retries || [],
      sinceRetry: session.sinceRetry || 0,
      idx: session.idx || 0,
      correct: session.correct || 0,
      wrong: session.wrong || 0,
      spellOn: !!session.spellOn,
      phase: session.phase || 'recognize',
      spellRetries: session.spellRetries || [],
      sinceSpellRetry: session.sinceSpellRetry || 0,
      records: Array.from((session.records || new Map()).entries()).map(([w, r]) => [w, {
        errors: r.errors, corrects: r.corrects, spellCorrects: r.spellCorrects, done: !!r.done,
      }]),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(snap));
  } catch (e) { /* 忽略 */ }
}

function clearSessionSnapshot() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* 忽略 */ }
}

function loadSessionSnapshot() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || !Array.isArray(snap.queue) || !snap.queue.length) return null;
    // 跨天快照失效:未完成的会话只保留当天,第二天自动清除重置
    if (snap.day && snap.day !== dateKey()) {
      clearSessionSnapshot();
      return null;
    }
    // 恢复 records
    const records = new Map();
    (snap.records || []).forEach(([w, r]) => {
      records.set(w, {
        errors: r.errors || 0, corrects: r.corrects || 0,
        spellCorrects: r.spellCorrects || 0, done: !!r.done,
      });
    });
    snap.records = records;
    return snap;
  } catch (e) { return null; }
}

function hasSnapshot() {
  return !!loadSessionSnapshot();
}

function startStudy() {
  const g = goalInfo();
  if (g.allDone) {
    const el = document.getElementById('studyQuiz');
    el.innerHTML = allLearnedHtml();
    go('screen-study');
    return;
  }
  if (g.done) {
    const el = document.getElementById('studyQuiz');
    el.innerHTML = goalDoneHtml();
    go('screen-study');
    return;
  }
  const unseen = unseenWords();
  const n = Math.min(g.remaining, unseen.length);
  const picked = pickRandom(unseen, n);
  const records = new Map();
  picked.forEach(w => records.set(w, makeRecord()));
  session = {
    mode: 'study',
    queue: picked,             // 全部新学单词
    pending: picked.slice(),   // 待识别队列
    retries: [],               // 答错待重记队列
    sinceRetry: 0,             // 距上次穿插错词的间隔
    idx: 0,
    correct: 0, wrong: 0,
    records, spellOn: false, phase: 'recognize',
  };
  clearSessionSnapshot();
  go('screen-study');
  renderStudyRecognize();
}

function goalDoneHtml() {
  const g = goalInfo();
  return `
    <div class="quiz-card session-done">
      <div class="icon">${icon("target")}</div>
      <h2>今日新学目标已完成！</h2>
      <p>今天已学 <b>${g.learned}</b> 个新词，目标 ${g.target} 个。<br>坚持就是胜利，明天再来吧 🌙</p>
      <div class="modal-btns" style="max-width:320px;margin:0 auto;flex-direction:column;gap:10px">
        <button class="next-btn" onclick="goHome()">回到首页</button>
        <button class="btn-ghost" onclick="go('screen-settings')">调整每日目标，继续学习</button>
      </div>
    </div>
  `;
}

function allLearnedHtml() {
  return `
    <div class="quiz-card session-done">
      <div class="icon">${icon("trophy")}</div>
      <h2>全部单词已学完！</h2>
      <p>当前词库 ${WORD_LIST.length} 个单词你已经全部学过了，太棒了！<br>去「掌握情况」看看你的成果吧。</p>
      <div class="modal-btns" style="max-width:320px;margin:0 auto;flex-direction:column;gap:10px">
        <button class="next-btn" onclick="goHome()">回到首页</button>
      </div>
    </div>
  `;
}

function startReview() {
  const due = dueWords();
  if (!due.length) {
    // 无到期复习：给出友好提示，不创建空会话
    const el = document.getElementById('reviewQuiz');
    el.innerHTML = noReviewHtml();
    go('screen-review');
    return;
  }
  const n = Math.min(state.settings.dailyReview, due.length);
  const picked = pickRandom(due, n);
  const records = new Map();
  picked.forEach(w => records.set(w, makeRecord()));
  session = {
    mode: 'review',
    queue: picked,
    pending: picked.slice(),
    retries: [],
    sinceRetry: 0,
    idx: 0,
    correct: 0, wrong: 0,
    records, spellOn: false, phase: 'recognize',
  };
  clearSessionSnapshot();
  go('screen-review');
  renderStudyRecognize();
}

function noReviewHtml() {
  const g = goalInfo();
  return `
    <div class="quiz-card session-done">
      <div class="icon">${icon("coffee")}</div>
      <h2>暂无到期复习</h2>
      <p>今天没有待复习的单词。<br>新学的词会从明天起按记忆曲线陆续到期（今日已复习 ${g.reviewedToday} 词）。</p>
      <div class="modal-btns" style="max-width:320px;margin:0 auto;flex-direction:column;gap:10px">
        <button class="next-btn" onclick="goHome()">回到首页</button>
      </div>
    </div>
  `;
}

/* ---------- 识别阶段（学习/复习共用） ----------
 * 队列模型：
 *   session.pending  尚未完成识别的词（新词，答对一次即过）
 *   session.retries  答错过需重记的词（须再答对 RECOG_REQUIRED 次）
 * 交杂规则：每学 3 个新词，穿插 1 个错词重现
 */
const RETRY_INTERVAL = 3;   // 每学几个新词穿插一个错词

function renderStudyRecognize() {
  const el = document.getElementById(session.mode === 'study' ? 'studyQuiz' : 'reviewQuiz');
  const pending = session.pending || [];
  const retries = session.retries || [];

  // 识别全部完成 → 询问拼写
  if (!pending.length && !retries.length) {
    session.phase = 'spellAsk';
    el.innerHTML = spellAskHtml();
    return;
  }

  let word;
  if (pending.length) {
    // 有未学新词：学满 RETRY_INTERVAL 个后穿插重现一个错词
    if (retries.length && (session.sinceRetry || 0) >= RETRY_INTERVAL) {
      word = retries[0];
      session.sinceRetry = 0;
      rotateRetries();
    } else {
      word = pending[0];
      session.sinceRetry = (session.sinceRetry || 0) + 1;
    }
  } else {
    // 新词学完只剩错词：轮转重现，避免同一个错词连续重复
    word = retries[0];
    rotateRetries();
  }
  session.word = word;
  session.answered = false;
  renderRecognizeOne(word);
}

/* 轮转错词队列：把刚出题的错词移到队尾，让多个错词交替重现 */
function rotateRetries() {
  if (session.retries && session.retries.length > 1) {
    session.retries.push(session.retries.shift());
  }
}

function renderRecognizeOne(word) {
  const el = document.getElementById(session.mode === 'study' ? 'studyQuiz' : 'reviewQuiz');
  // 学习/复习识别阶段固定英译汉；汉译英考察由拼写阶段承担（看释义写单词）
  const q = makeQuestion(word);
  session.q = q;
  session.answered = false;
  const rec = session.records.get(word) || makeRecord();
  const isRelearn = rec.errors > 0;
  const typeLabel = (isRelearn ? '重记' : session.mode === 'study' ? '学习' : '复习') + ' · ' + q.type;
  const promptCls = 'quiz-prompt';
  const speakBtn = ttsSupported() ? `<button class="speak-btn" title="发音" onclick="speakCurrent()">${icon('volume-2')}</button>` : '';
  const optionsHtml = q.options.map((o, i) =>
    `<button class="opt" data-ans="${o.isAnswer}" onclick="recognizeAnswer(${i}, this)">${escapeHtml(o.text)}</button>`
  ).join('');
  const retryNote = isRelearn ? `<div class="retry-note">重记词 · 还需答对 ${Math.max(0, RECOG_REQUIRED - rec.corrects)} 次</div>` : '';
  el.innerHTML = `
    <div class="quiz-card">
      <span class="quiz-type${session.mode === 'review' ? ' rev' : ''}">${typeLabel}</span>
      <div class="${promptCls}">${escapeHtml(q.prompt)}${speakBtn}</div>
      <div class="progress-line">${session.mode === 'study' ? '学习新词' : '复习'}　·　✓ ${session.correct} ✗ ${session.wrong}</div>
      <div class="options">${optionsHtml}</div>
      ${retryNote}
      <div class="show-ans-wrap">
        <button class="show-ans-btn" onclick="showAnswer()">${icon('eye')} 不会，看答案</button>
      </div>
      <div id="feedbackZone"></div>
    </div>
  `;
  if (state.settings.autoSpeak) speakWord(word);
}

function recognizeAnswer(idx, btnEl) {
  if (session.answered) return;
  session.answered = true;
  const word = session.word;
  const isCorrect = session.q.options[idx].isAnswer;
  const rec = session.records.get(word) || makeRecord();

  document.querySelectorAll('.opt').forEach(b => {
    if (b.dataset.ans === 'true') b.classList.add('correct');
  });
  if (!isCorrect) btnEl.classList.add('wrong');

  if (isCorrect) {
    session.correct++;
    rec.corrects++;
    session.records.set(word, rec);
    const need = rec.errors > 0 ? RECOG_REQUIRED : 1;
    if (rec.corrects >= need) {
      // 已达标 → 从待识别队列移除，并在此刻正式提交学习/复习结果
      removeFromQueue(word);
      if (session.mode === 'study') learnWord(word);
      else reviewCorrect(word);
    }
    // 答对即刷新到下一个词，不停留
    saveSessionSnapshot();
    session.answered = false;
    renderStudyRecognize();
    return;
  }
  // 答错：不卡住，移到错词池，显示反馈（可选生词本）后刷新
  session.wrong++;
  rec.errors++;
  rec.corrects = 0;
  session.records.set(word, rec);
  // 写回学习状态（生词本由按钮控制，这里不强制加入）
  if (session.mode === 'study') noteWrong(word, false);
  else reviewWrong(word, false);
  addToRetries(word);
  session.sinceRetry = 0;  // 答错后重新开始计数，避免错词紧跟重现
  saveSessionSnapshot();
  showWrongFeedback(word, session.q.options[idx].text);
}

/* ---------------- 发音引擎 ----------------
 * 两层结构：在线真人音源优先（单词=有道词典 dictvoice，汉译=百度翻译 gettts 标准普通话），
 * 失败/关闭/离线未缓存时自动降级为设备 speechSynthesis。
 * 音源接口无 CORS 头，页面 fetch 不到数据，播放一律走 <audio> 元素（媒体元素不受
 * CORS 限制）；<audio> 是真音频流，熄屏/切后台浏览器会继续播（播客模式），离线复用
 * 由 Service Worker 缓存（sw.js 的 cet4-audio-v1）。
 * 设备TTS 的坑统一处理：
 * 1. iOS 要求首次 speak() 发生在用户手势里 → 首次触摸时用空 utterance 解锁
 * 2. 部分安卓浏览器把 cancel() 后立即 speak() 的语音静默丢弃 → 只在播报中才 cancel，
 *    且 speak 后 250ms 检查是否真的开始，没开始重试一次
 * 3. 微信/QQ 等内置浏览器可能没有 speechSynthesis → 还有在线音源可用，两者皆无才隐藏
 */
function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function canUseOnlineVoice() {
  return state.settings.onlineVoice !== false && typeof Audio !== 'undefined';
}

/* 当前正在播的 <audio>（全局只有一个，新的播报顶掉旧的；stopDictPlayback 负责掐掉） */
let currentAudioEl = null;
function stopSpeakAudio() {
  if (currentAudioEl) {
    try { currentAudioEl.pause(); } catch (e) { /* 忽略 */ }
    currentAudioEl = null;
  }
}

let ttsUnlocked = false;
function unlockTTS() {
  if (ttsUnlocked || !ttsSupported()) return;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    ttsUnlocked = true;
  } catch (e) { /* 忽略 */ }
}

/* 静音 wav：首次用户手势里 play() 一次，解锁后续程序化触发的 <audio> 播放（iOS/安卓） */
const SILENT_WAV = 'data:audio/wav;base64,UklGRoQJAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YWAJAAAA';
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked || typeof Audio === 'undefined') return;
  try {
    const a = new Audio(SILENT_WAV);
    a.volume = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => { audioUnlocked = false; });
    audioUnlocked = true;
  } catch (e) { /* 忽略 */ }
}
function unlockPlayback() { unlockTTS(); unlockAudio(); }
document.addEventListener('pointerdown', unlockPlayback, { once: true });
document.addEventListener('touchstart', unlockPlayback, { once: true });

/* 设备TTS声音列表（Chrome/安卓异步加载，监听 voiceschanged） */
let ttsVoices = [];
function refreshTTSVoices() {
  if (!ttsSupported()) return;
  try {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length) ttsVoices = v;   // 拿不到(未就绪/不支持)时保留旧列表
  } catch (e) { /* 保留旧列表 */ }
}
if (typeof window !== 'undefined' && ttsSupported()) {
  refreshTTSVoices();
  try {
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', refreshTTSVoices);
    } else if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = refreshTTSVoices;
    }
  } catch (e) { /* 忽略 */ }
}

/* 按设置解析声音：显式指定的名字优先，其次按语言自动优选 */
function resolveTTSVoice(name, lang) {
  refreshTTSVoices();
  if (name) {
    const hit = ttsVoices.find(v => v.name === name);
    if (hit) return hit;
  }
  return pickBestTTSVoice(ttsVoices, lang);
}

function speakWord(word, rate) {
  unlockPlayback();
  if (canUseOnlineVoice() && speakWordOnline(word, rate || 0.9)) return;
  speakWordTTS(word);
}

/* 在线音源播单词（有道词典发音）；返回 false 表示不可用，调用方降级 TTS */
function speakWordOnline(word, rate) {
  if (!canUseOnlineVoice()) return false;
  try {
    stopSpeakAudio();
    const el = new Audio(onlineVoiceUrl(word, false, state.settings.audioAcc));
    el.playbackRate = rate;
    currentAudioEl = el;
    let settled = false;
    const fallback = () => {
      if (settled || currentAudioEl !== el) return;   // 已被新播报顶掉就不再降级
      settled = true;
      speakWordTTS(word);
    };
    el.addEventListener('error', fallback);
    const p = el.play();
    if (p && p.catch) p.catch(fallback);
    return true;
  } catch (e) { return false; }
}

/* 设备TTS播单词（原 speechSynthesis 逻辑 + 声音优选） */
function speakWordTTS(word) {
  if (!ttsSupported()) return;
  unlockTTS();
  try {
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    const v = resolveTTSVoice(state.settings.ttsEngVoiceName, 'en-US');
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = 0.9;
    let started = false;
    u.onstart = () => { started = true; };
    u.onerror = () => { started = true; };   // 出错也算已处理，避免无意义重试
    synth.speak(u);
    setTimeout(() => {
      try {
        if (!started && !synth.speaking) synth.speak(u);
      } catch (e) { /* 忽略 */ }
    }, 250);
  } catch (e) { /* 不支持则静默跳过 */ }
}

function speakCurrent() {
  if (session && session.q && session.q.speakWord) speakWord(session.q.speakWord);
}

function showWrongFeedback(word, wrongText) {
  const el = document.getElementById(session.mode === 'study' ? 'studyQuiz' : 'reviewQuiz');
  const fb = document.getElementById('feedbackZone');
  const inBook = curWords()[word] && curWords()[word].inBook;
  const def = WORD_MAP.get(word);

  // 选错选项的翻译提示（英译汉：选项是中文释义 → 反查提示它的英文单词）
  let wrongHint = '';
  if (wrongText) {
    const foundWord = reverseDefToWord(wrongText, word);
    if (foundWord) wrongHint = `<div class="wrong-hint">「${escapeHtml(wrongText)}」的英语是：${escapeHtml(foundWord)}</div>`;
  }

  // 其余错误选项可点看对应单词（点「不会」没有选错项，全部干扰项都可点）
  const chips = session.q && session.q.type === '英译汉'
    ? session.q.options.map((o, i) => ({ text: o.text, isAnswer: o.isAnswer, i }))
        .filter(o => !o.isAnswer && o.text !== wrongText)
    : [];
  const chipsHtml = chips.length ? `
    <div class="def-chips">${chips.map(o =>
      `<button class="def-chip" onclick="toggleDefChip(this, ${o.i})">${icon('eye')} ${escapeHtml(o.text)}</button>`
    ).join('')}</div>` : '';

  const card = fb.closest('.quiz-card');
  if (card) card.classList.add('with-ans');
  fb.innerHTML = `
    <div class="feedback bad">
      <div class="fb-title">${icon('circle-x')} 答错了，稍后会再考你</div>
      <div class="wrong-pair">
        <span class="wp-ans">${escapeHtml(word)}</span>
        <span class="wp-def">${escapeHtml(def)}</span>
      </div>
      ${wrongHint}
      ${chipsHtml}
      ${memoOf(word) ? `<div class="wrong-memo">${icon('lightbulb')} ${escapeHtml(memoOf(word))}</div>` : ''}
    </div>
    <div class="wrong-actions">
      <button class="book-toggle ${inBook ? 'in-book' : ''}" id="wrongBookBtn" onclick="toggleWrongBook('${escapeAttr(word)}')">
        ${inBook ? icon('bookmark-check') + ' 已在生词本' : icon('bookmark-plus') + ' 加入生词本'}
      </button>
      <button class="next-btn" onclick="advanceAfterWrong()">下一个 →</button>
    </div>
  `;
  el.querySelectorAll('.opt').forEach(b => b.disabled = true);
}

/* 点错误选项标签 → 展开该选项释义对应的英文单词（再点收起） */
function toggleDefChip(btn, optIdx) {
  if (!session || !session.q || !session.q.options[optIdx]) return;
  const def = session.q.options[optIdx].text;
  const wrap = btn.closest('.def-chips');
  const card = btn.closest('.feedback');
  if (!wrap || !card) return;
  card.querySelectorAll('.def-chip-ans').forEach(x => x.remove());
  const opened = btn.dataset.open === '1';
  wrap.querySelectorAll('.def-chip').forEach(b => b.dataset.open = '');
  if (opened) return;   // 再点同一个 = 收起
  btn.dataset.open = '1';
  const w = reverseDefToWord(def, session.word);
  const div = document.createElement('div');
  div.className = 'def-chip-ans';
  div.textContent = '「' + def + '」的英语是：' + (w || '（词库中未找到）');
  wrap.parentNode.insertBefore(div, wrap.nextSibling);
}

function toggleWrongBook(word) {
  toggleBook(word);
  const inBook = curWords()[word] && curWords()[word].inBook;
  const b = document.getElementById('wrongBookBtn');
  if (b) {
    b.innerHTML = inBook ? icon('bookmark-check') + ' 已在生词本' : icon('bookmark-plus') + ' 加入生词本';
    b.classList.toggle('in-book', inBook);
  }
}

function advanceAfterWrong() {
  session.answered = false;
  renderStudyRecognize();
}

function showAnswer() {
  if (session.answered) return;
  session.answered = true;
  const word = session.word;
  const rec = session.records.get(word) || makeRecord();
  rec.errors++;
  rec.corrects = 0;
  session.records.set(word, rec);
  session.wrong++;
  if (session.mode === 'study') noteWrong(word, false);
  else reviewWrong(word, false);
  addToRetries(word);
  session.sinceRetry = 0;  // 点「不会」同答错，重新开始穿插计数
  saveSessionSnapshot();
  showWrongFeedback(word);
}

/* 队列辅助 */
function addToRetries(word) {
  // 答错的词：从 pending 移出（不再作为"新词一次即过"），进入 retries 重记
  if (session.pending) session.pending = session.pending.filter(w => w !== word);
  if (!session.retries) session.retries = [];
  if (!session.retries.includes(word)) session.retries.push(word);
}
function removeFromQueue(word) {
  if (session.pending) session.pending = session.pending.filter(w => w !== word);
  if (session.retries) session.retries = session.retries.filter(w => w !== word);
}

/* ---------- 拼写询问（可选） ---------- */
function spellAskHtml() {
  const elId = session.mode === 'study' ? 'studyQuiz' : 'reviewQuiz';
  const total = session.queue.length;
  const hard = session.queue.filter(w => (session.records.get(w) || {}).errors > 0).length;
  const btn = session.mode === 'study' ? '开始拼写' : '开始拼写';
  return `
    <div class="quiz-card session-done">
      <div class="icon">${icon("keyboard")}</div>
      <h2>识别完成！</h2>
      <p>共 ${total} 词 · 答错 ${session.wrong} · ${hard} 个需重记</p>
      <p style="margin-top:6px;font-size:14px;color:var(--ink-soft)">要不要基于刚才的单词练习拼写？可跳过。</p>
      <div class="modal-btns" style="max-width:320px;margin:0 auto;flex-direction:column;gap:10px">
        <button class="next-btn" onclick="startSpellStage()">${icon('keyboard')} ${btn}</button>
        <button class="btn-ghost" onclick="finishSession()">跳过，直接完成</button>
      </div>
    </div>
  `;
}

function startSpellStage() {
  session.spellOn = true;
  session.phase = 'spell';
  session.idx = 0;
  renderSpellStage();
}

function renderSpellStage() {
  const el = document.getElementById(session.mode === 'study' ? 'studyQuiz' : 'reviewQuiz');
  const remaining = session.queue.filter(w => {
    const rec = session.records.get(w) || makeRecord();
    return !rec.done;
  });
  if (!remaining.length) {
    el.innerHTML = doneHtml();
    return;
  }
  // 拼写错词穿插：与识别阶段一致，每拼 RETRY_INTERVAL 个词穿插重现 1 个拼写错词
  if (session.spellRetries) {
    session.spellRetries = session.spellRetries.filter(w => !(session.records.get(w) || makeRecord()).done);
  }
  const spellRetries = session.spellRetries || [];
  let word;
  if (spellRetries.length && (session.sinceSpellRetry || 0) >= RETRY_INTERVAL) {
    word = spellRetries[0];
    session.sinceSpellRetry = 0;
    rotateSpellRetries();
  } else {
    // 优先出未拼错的词（拼错进池的稍后再出，避免紧跟重现）
    const fresh = remaining.filter(w => !spellRetries.includes(w));
    const pool = fresh.length ? fresh : remaining;
    word = pool[session.idx % pool.length];
    session.sinceSpellRetry = (session.sinceSpellRetry || 0) + 1;
  }
  session.word = word;
  session.answered = false;
  const hint = WORD_MAP.get(word);
  el.innerHTML = `
    <div class="quiz-card">
      <span class="quiz-type">拼写</span>
      <div class="quiz-prompt small">${escapeHtml(hint)}</div>
      <div class="spell-input-wrap">
        <input type="text" id="spellInput" class="spell-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="输入英文单词">
        <button class="spell-check" onclick="checkSpell()">${icon('check')} 提交</button>
      </div>
      <div class="progress-line">剩余 ${remaining.length} 词　·　✓ ${session.correct} ✗ ${session.wrong}</div>
      <div id="spellFeedback"></div>
    </div>
  `;
  setTimeout(() => {
    const inp = document.getElementById('spellInput');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.stopPropagation();  // 防止全局快捷键重复响应
        if (session.answered) {
          // 已出反馈：Enter 前进（答对→下一个；答错→下一个，错词稍后重现）
          const good = document.querySelector('#spellFeedback .feedback.good');
          if (good) nextSpell(); else advanceSpellAfterWrong();
        } else {
          checkSpell();
        }
      });
    }
  }, 120);
}

function checkSpell() {
  if (session.answered) return;
  session.answered = true;
  const word = session.word;
  const val = (document.getElementById('spellInput') && document.getElementById('spellInput').value || '').trim().toLowerCase();
  const isCorrect = val === word.toLowerCase();
  const rec = session.records.get(word) || makeRecord();

  const fbEl = document.getElementById('spellFeedback');
  if (isCorrect) {
    rec.spellCorrects = (rec.spellCorrects || 0) + 1;
    session.correct++;
    session.records.set(word, rec);
    if (rec.spellCorrects >= SPELL_REQUIRED) {
      rec.done = true;
      session.records.set(word, rec);
      // 已拼写达标 → 移出错词池（若在里面）
      if (session.spellRetries) session.spellRetries = session.spellRetries.filter(w => w !== word);
      // 识别阶段已提交学习/复习结果，拼写是纯练习，不再重复提交
      saveSessionSnapshot();
      if (state.settings.autoSpeak) speakWord(word);
      const card = fbEl.closest('.quiz-card');
      if (card) card.classList.add('with-ans');
      fbEl.innerHTML = `
        <div class="feedback good">
          <div class="fb-title">${icon('circle-check')} 拼写正确！</div>
          <div class="ans-word">${escapeHtml(word)}</div>
        </div>
        <button class="next-btn" onclick="nextSpell()">下一个 →</button>
      `;
    } else {
      const card = fbEl.closest('.quiz-card');
      if (card) card.classList.add('with-ans');
      saveSessionSnapshot();
      fbEl.innerHTML = `
        <div class="feedback good">
          <div class="fb-title">${icon('circle-check')} 拼写正确！再写一次加深记忆</div>
          <div class="ans-word">${escapeHtml(word)}</div>
        </div>
        <button class="next-btn" onclick="nextSpell()">下一个 →</button>
      `;
    }
  } else {
    rec.spellCorrects = 0;
    rec.errors++;
    session.wrong++;
    session.records.set(word, rec);
    // 拼写是纯练习，不改学习状态（识别阶段已提交）
    // 答错不卡住：进拼写错词池，稍后穿插重现
    if (!session.spellRetries) session.spellRetries = [];
    if (!session.spellRetries.includes(word)) session.spellRetries.push(word);
    session.sinceSpellRetry = 0;  // 答错后重新计数，避免错词紧跟重现
    saveSessionSnapshot();
    const inBook = curWords()[word] && curWords()[word].inBook;
    const card = fbEl.closest('.quiz-card');
    if (card) card.classList.add('with-ans');
    fbEl.innerHTML = `
      <div class="feedback bad">
        <div class="fb-title">${icon('circle-x')} 拼错了，稍后会再考你</div>
        <div class="wrong-pair">
          <span class="wp-ans">${escapeHtml(word)}</span>
          <span class="wp-def">${escapeHtml(WORD_MAP.get(word))}</span>
        </div>
        ${memoOf(word) ? `<div class="wrong-memo">💡 ${escapeHtml(memoOf(word))}</div>` : ''}
      </div>
      <div class="wrong-actions">
        <button class="book-toggle ${inBook ? 'in-book' : ''}" id="wrongBookBtn" onclick="toggleWrongBook('${escapeAttr(word)}')">
          ${inBook ? '✓ 已在生词本' : '📌 加入生词本'}
        </button>
        <button class="next-btn" onclick="advanceSpellAfterWrong()">下一个 →</button>
      </div>
    `;
  }
}

function nextSpell() {
  session.idx++;
  renderSpellStage();
  // 全部拼完 → 清除快照（已完成）
  const remaining = session.queue.filter(w => {
    const rec = session.records.get(w) || makeRecord();
    return !rec.done;
  });
  if (!remaining.length) clearSessionSnapshot();
}
/* 拼写答错后前进：不卡住，先出下一个词，拼错的词稍后穿插重现 */
function advanceSpellAfterWrong() {
  session.idx++;
  renderSpellStage();
  const remaining = session.queue.filter(w => {
    const rec = session.records.get(w) || makeRecord();
    return !rec.done;
  });
  if (!remaining.length) clearSessionSnapshot();
}
/* 轮转拼写错词队列：把刚出题的错词移到队尾，让多个错词交替重现 */
function rotateSpellRetries() {
  if (session.spellRetries && session.spellRetries.length > 1) {
    session.spellRetries.push(session.spellRetries.shift());
  }
}

/* ---------- 完成页 ---------- */
function finishSession() {
  clearSessionSnapshot();
  const el = document.getElementById(session.mode === 'study' ? 'studyQuiz' : 'reviewQuiz');
  el.innerHTML = doneHtml();
}

function doneHtml() {
  const mode = session.mode === 'study' ? '学习' : '复习';
  const total = session.queue.length;
  const hardCount = session.queue.filter(w => (session.records.get(w) || {}).errors > 0).length;
  const g = goalInfo();
  const goalNote = session.mode === 'study' && g.done
    ? `<p class="goal-done-note">${icon('target')} 今日新学目标 ${g.target} 个已达成！明天继续坚持，复习会在明天自动出现。</p>`
    : '';
  const list = session.queue.map(w => {
    const rec = session.records.get(w) || {};
    const hard = rec.errors > 0;
    return `<div class="list-card"><div class="list-item">
      <span class="list-word">${escapeHtml(w)}</span>
      <span class="list-def">${escapeHtml(WORD_MAP.get(w) || '')}</span>
      ${hard ? '<span class="ms-badge ms-due">反复记</span>' : ''}
    </div></div>`;
  }).join('');
  return `
    <div class="quiz-card session-done" style="text-align:left">
      <div style="text-align:center">
        <div class="icon">${icon("party-popper")}</div>
        <h2>${mode}完成！</h2>
        <p>共 ${total} 词 · 答对 ${session.correct} · 答错 ${session.wrong} · ${hardCount} 个反复记忆</p>
        ${goalNote}
      </div>
      <div style="margin-top:18px">
        <h3 style="font-family:var(--serif);font-size:16px;color:var(--ink-blue);margin-bottom:10px">本次${mode}单词（${total}）</h3>
        ${list}
      </div>
      <button class="next-btn" style="max-width:320px;margin:18px auto 0" onclick="goHome()">回到首页</button>
    </div>
  `;
}

/* 点 💡 展开该词的巧记（生词本/掌握情况列表通用） */
function toggleMemoRow(word, btn) {
  const card = btn.closest('.list-card');
  const next = card.nextElementSibling;
  if (next && next.classList && next.classList.contains('memo-panel')) { next.remove(); return; }
  const div = document.createElement('div');
  div.className = 'memo-panel';
  div.textContent = '💡 ' + memoOf(word);
  card.parentNode.insertBefore(div, card.nextSibling);
}

/* ============================================================
 * 自由拼写（自定义拼写练习，纯练习不改动学习进度）
 * 看释义输单词；答错不卡住直接跳过，错词每过 3 个词穿插重现，
 * 重现时答对 1 次即完成（比复习拼写的连对 2 次宽松）
 * ============================================================ */
function spellCfgHtml(kind) {
  // kind: 'spell' | 'dict'，配置项存 settings.spellXxx / dictXxx
  const scopeKey = kind + 'Scope';
  const countKey = kind + 'Count';
  const scope = normScope(state.settings[scopeKey]);
  const count = state.settings[countKey] || 1;
  const pickedN = practicePicked(kind).length;
  return `
    <div class="cfg-title">选择范围</div>
    <div class="cfg-chips">${SCOPES.map(s => {
      const n = wordsInScope(s.key).length;
      return `<button class="master-tab ${s.key === scope ? 'active' : ''}" onclick="setPracticeCfg('${scopeKey}','${s.key}')">${s.label} <span class="mt-cnt">${n}</span></button>`;
    }).join('')}
      <button class="master-tab ${scope === 'custom' ? 'active' : ''}" onclick="setPracticeCfg('${scopeKey}','custom')">自选 <span class="mt-cnt">${pickedN}</span></button>
    </div>
    <div style="margin:8px 0 4px"><button class="cfg-pick-btn" onclick="openWordPicker('${kind}')">${icon('list-plus')} 选定具体单词（当前词库：${escapeHtml(LIBS[libKey()].name)}）</button></div>
    <div class="cfg-title">数量 <span class="mt-cnt">（1 ~ ${WORD_LIST.length}，实际取词不足时按剩余数）</span></div>
    <div class="set-ctrl" style="justify-content:flex-start">
      <button onclick="adjPracticeCount('${kind}',-1)">−</button>
      <input type="number" id="${kind}CountInput" class="count-input" inputmode="numeric" min="1" max="${WORD_LIST.length}"
        value="${count}" oninput="setPracticeCount('${kind}', this.value)" onchange="this.value = state.settings.${countKey}">
      <button onclick="adjPracticeCount('${kind}',1)">+</button>
    </div>
  `;
}

/* 数量自定义:任意整数,限制在 1 ~ 当前词库总词数 */
function setPracticeCount(kind, v) {
  let n = parseInt(v, 10);
  if (!isFinite(n) || n < 1) n = 1;
  if (n > WORD_LIST.length) n = WORD_LIST.length;
  state.settings[kind + 'Count'] = n;
  saveState();
  updatePracticeStartLabel(kind);
}

function adjPracticeCount(kind, delta) {
  setPracticeCount(kind, (state.settings[kind + 'Count'] || 1) + delta);
  const inp = document.getElementById(kind + 'CountInput');
  if (inp) inp.value = state.settings[kind + 'Count'];
}

/* 数量变化时就地更新开始按钮文案(不重渲染配置页,避免输入框失焦) */
function updatePracticeStartLabel(kind) {
  const btn = document.getElementById(kind === 'spell' ? 'spellStartBtn' : 'dictStartBtn');
  if (!btn) return;
  const pool = practicePool(kind);
  const custom = normScope(state.settings[kind + 'Scope']) === 'custom';
  const n = custom ? pool.length : Math.min(state.settings[kind + 'Count'] || 1, pool.length);
  btn.textContent = (kind === 'spell' ? '开始拼写（' : '开始听写（') + n + ' 词）';
  btn.disabled = !pool.length;
}

/* 自选词单（按当前词库过滤，切词库后他库词自动忽略） */
function practicePicked(kind) {
  const list = state.settings[kind + 'Words'];
  const set = LIB_WORD_SETS[libKey()];
  return (Array.isArray(list) ? list : []).filter(w => set.has(w));
}

/* 某模式的实际取词池：自选范围用词单，其余按范围取 */
function practicePool(kind) {
  const scope = normScope(state.settings[kind + 'Scope']);
  if (scope === 'custom') {
    const picked = practicePicked(kind);
    return picked.length ? picked : [];
  }
  return wordsInScope(scope);
}

function setPracticeCfg(key, val) {
  state.settings[key] = val;
  saveState();
  if (key.indexOf('spell') === 0) renderSpellConfig();
  else renderDictConfig();
}

function renderSpellConfig() {
  const el = document.getElementById('spellQuiz');
  if (!el) return;
  const pool = practicePool('spell');
  const custom = normScope(state.settings.spellScope) === 'custom';
  const count = custom ? pool.length : Math.min(state.settings.spellCount || 20, pool.length);
  el.innerHTML = `
    <div class="quiz-card" style="text-align:left">
      <span class="quiz-type">${icon('pencil-line')} 自由拼写</span>
      <p class="cfg-note">看释义拼写单词，答错不卡住、稍后穿插重现；纯练习，不影响学习进度。</p>
      ${spellCfgHtml('spell')}
      ${pool.length ? '' : (custom ? '<div class="empty-tip" style="padding:20px 0">词单还是空的，点上面「选定具体单词」去勾选</div>' : '<div class="empty-tip" style="padding:20px 0">该范围暂无单词</div>')}
      <button class="next-btn" id="spellStartBtn" onclick="startCustomSpell()" ${pool.length ? '' : 'disabled'}>开始拼写（${count} 词）</button>
    </div>
  `;
}

function startCustomSpell() {
  const pool = practicePool('spell');
  if (!pool.length) return;
  const custom = normScope(state.settings.spellScope) === 'custom';
  // 自选词单：全部采用（顺序随机）；其他范围：按数量抽选
  const picked = custom ? shuffle(pool) : pickRandom(pool, Math.min(state.settings.spellCount || 20, pool.length));
  session = {
    mode: 'spell',
    phase: 'cspell',          // 避开全局快捷键对复习拼写阶段的接管
    queue: picked,
    spellRetries: [],
    sinceSpellRetry: 0,
    idx: 0,
    correct: 0, wrong: 0,
    records: new Map(picked.map(w => [w, makeRecord()])),
  };
  renderCustomSpell();
}

function renderCustomSpell() {
  const el = document.getElementById('spellQuiz');
  const remaining = session.queue.filter(w => !(session.records.get(w) || makeRecord()).done);
  if (!remaining.length) {
    el.innerHTML = practiceDoneHtml('拼写练习', '自由拼写');
    return;
  }
  session.spellRetries = (session.spellRetries || []).filter(w => !(session.records.get(w) || makeRecord()).done);
  const spellRetries = session.spellRetries;
  let word;
  if (spellRetries.length && (session.sinceSpellRetry || 0) >= RETRY_INTERVAL) {
    word = spellRetries[0];
    session.sinceSpellRetry = 0;
    rotateSpellRetries();
  } else {
    const fresh = remaining.filter(w => !spellRetries.includes(w));
    const pool2 = fresh.length ? fresh : remaining;
    word = pool2[session.idx % pool2.length];
    session.sinceSpellRetry = (session.sinceSpellRetry || 0) + 1;
  }
  session.word = word;
  session.answered = false;
  const rec = session.records.get(word) || makeRecord();
  const retryNote = rec.errors > 0 ? `<div class="retry-note">重记词 · 答对 1 次即完成</div>` : '';
  el.innerHTML = `
    <div class="quiz-card">
      <span class="quiz-type">${icon('pencil-line')} 自由拼写</span>
      <div class="quiz-prompt small">${escapeHtml(WORD_MAP.get(word) || '')}</div>
      <div class="spell-input-wrap">
        <input type="text" id="spellInput" class="spell-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="输入英文单词">
        <button class="spell-check" onclick="customSpellCheck()">${icon('check')} 提交</button>
      </div>
      <div class="progress-line">剩余 ${remaining.length} 词　·　✓ ${session.correct} ✗ ${session.wrong}</div>
      ${retryNote}
      <div id="spellFeedback"></div>
    </div>
  `;
  setTimeout(() => {
    const inp = document.getElementById('spellInput');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.stopPropagation();
        if (session.answered) customSpellNext(); else customSpellCheck();
      });
    }
  }, 120);
}

function customSpellCheck() {
  if (session.answered) return;
  session.answered = true;
  const word = session.word;
  const val = ((document.getElementById('spellInput') && document.getElementById('spellInput').value) || '').trim().toLowerCase();
  const isCorrect = val === word.toLowerCase();
  const rec = session.records.get(word) || makeRecord();
  const fbEl = document.getElementById('spellFeedback');
  const card = fbEl.closest('.quiz-card');
  if (card) card.classList.add('with-ans');
  const inBook = curWords()[word] && curWords()[word].inBook;
  if (isCorrect) {
    rec.done = true;   // 宽松规则:重现后答对 1 次即完成
    session.records.set(word, rec);
    session.correct++;
    session.spellRetries = (session.spellRetries || []).filter(w => w !== word);
    if (state.settings.autoSpeak) speakWord(word);
    fbEl.innerHTML = `
      <div class="feedback good">
        <div class="fb-title">${icon('circle-check')} 拼写正确！</div>
        <div class="ans-word">${escapeHtml(word)}</div>
        <div class="ans-def">${escapeHtml(WORD_MAP.get(word) || '')}</div>
      </div>
      <button class="next-btn" onclick="customSpellNext()">下一个 →</button>
    `;
  } else {
    rec.errors++;
    session.wrong++;
    session.records.set(word, rec);
    if (!session.spellRetries) session.spellRetries = [];
    if (!session.spellRetries.includes(word)) session.spellRetries.push(word);
    session.sinceSpellRetry = 0;
    fbEl.innerHTML = `
      <div class="feedback bad">
        <div class="fb-title">${icon('circle-x')} 拼错了，过几个词再考你</div>
        <div class="wrong-pair">
          <span class="wp-ans">${escapeHtml(word)}</span>
          <span class="wp-def">${escapeHtml(WORD_MAP.get(word) || '')}</span>
        </div>
        ${memoOf(word) ? `<div class="wrong-memo">${icon('lightbulb')} ${escapeHtml(memoOf(word))}</div>` : ''}
      </div>
      <div class="wrong-actions">
        <button class="book-toggle ${inBook ? 'in-book' : ''}" id="wrongBookBtn" onclick="toggleWrongBook('${escapeAttr(word)}')">
          ${inBook ? icon('bookmark-check') + ' 已在生词本' : icon('bookmark-plus') + ' 加入生词本'}
        </button>
        <button class="next-btn" onclick="customSpellNext()">下一个 →</button>
      </div>
    `;
  }
}

function customSpellNext() {
  session.answered = false;
  session.idx++;
  renderCustomSpell();
}

/* 练习完成页（自由拼写 / 听写共用；纯练习不写学习状态） */
function practiceDoneHtml(title, typeName) {
  practiceMode = session.mode === 'dict' ? 'dict' : 'spell';
  const total = session.queue.length;
  const hard = session.queue.filter(w => (session.records.get(w) || {}).errors > 0).length;
  const list = session.queue.map(w => {
    const err = (session.records.get(w) || {}).errors > 0;
    return `<div class="list-card"><div class="list-item">
      <span class="list-word">${escapeHtml(w)}</span>
      <span class="list-def">${escapeHtml(WORD_MAP.get(w) || '')}</span>
      ${err ? '<span class="ms-badge ms-due">曾出错</span>' : ''}
    </div></div>`;
  }).join('');
  return `
    <div class="quiz-card session-done" style="text-align:left">
      <div style="text-align:center">
        <div class="icon">${icon('trophy')}</div>
        <h2>${title}完成！</h2>
        <p>共 ${total} 词 · 答对 ${session.correct} · 答错 ${session.wrong} · ${hard} 个曾出错</p>
      </div>
      <div style="margin-top:18px">
        <h3 style="font-family:var(--serif);font-size:16px;color:var(--ink-blue);margin-bottom:10px">本次${typeName}单词（${total}）</h3>
        ${list}
      </div>
      <div class="modal-btns" style="max-width:320px;margin:18px auto 0;flex-direction:column;gap:10px">
        <button class="next-btn" onclick="practiceAgain()">再来一组</button>
        <button class="btn-ghost" onclick="goHome()">回到首页</button>
      </div>
    </div>
  `;
}

/* 练习完成页「再来一组」：回到本次练习模式（spell/dict）的配置页 */
let practiceMode = 'spell';
function practiceAgain() {
  go(practiceMode === 'dict' ? 'screen-dictate' : 'screen-spell');
}

/* ---------------- 自选词单选词器(自由拼写/听写共用) ----------------
 * 搜索 + 按范围筛选 + 点行勾选;词单存 settings.spellWords/dictWords,按当前词库过滤生效
 */
let pickerKind = null;      // 'spell' | 'dict'
let pickerSearch = '';
let pickerFilter = 'all';   // SCOPES key | 'picked'
let pickerLimit = 100;

function openWordPicker(kind) {
  pickerKind = kind;
  pickerSearch = '';
  pickerFilter = 'all';
  pickerLimit = 100;
  renderWordPicker();
}

function pickerPool() {
  let words;
  if (pickerFilter === 'picked') words = practicePicked(pickerKind);
  else if (pickerFilter !== 'all') words = wordsInScope(pickerFilter);
  else words = WORD_LIST.slice();
  const q = pickerSearch.toLowerCase();
  if (q) {
    words = words.filter(w => w.toLowerCase().includes(q) || (WORD_MAP.get(w) || '').toLowerCase().includes(q));
  }
  return words;
}

function renderWordPicker() {
  const el = document.getElementById(pickerKind === 'dict' ? 'dictQuiz' : 'spellQuiz');
  if (!el || !pickerKind) return;
  const picked = practicePicked(pickerKind);
  const pickedSet = new Set(picked);
  const words = pickerPool();
  const shown = words.slice(0, pickerLimit);
  const rows = shown.map(w => {
    const sel = pickedSet.has(w);
    return `<div class="list-card picker-row ${sel ? 'picked' : ''}" data-w="${escapeHtml(w)}" onclick="pickerToggleWord('${escapeAttr(w)}', this)">
      <div class="list-item">
        <span class="list-word">${escapeHtml(w)}</span>
        <span class="list-def">${escapeHtml(WORD_MAP.get(w) || '')}</span>
        <span class="pick-check">${icon(sel ? 'circle-check' : 'circle')}</span>
      </div>
    </div>`;
  }).join('');
  const moreBtn = words.length > shown.length
    ? `<div style="text-align:center;margin:10px 0"><button class="toolbar-btn" onclick="pickerLimit += 200; renderWordPicker()">显示更多（还有 ${words.length - shown.length} 个）</button></div>`
    : '';
  el.innerHTML = `
    <div class="quiz-card" style="text-align:left">
      <span class="quiz-type">${icon('list-plus')} 选定单词</span>
      <p class="cfg-note">点行勾选/取消；<b>长按一行后往下拖</b>可连续选（拖过已选的则连续取消）；词单按当前词库（${escapeHtml(LIBS[libKey()].name)}）保存，切词库后他库词不参与。</p>
      <div class="master-search-wrap"><input id="pickerSearchInput" class="master-search" placeholder="搜索单词或释义…" value="${escapeHtml(pickerSearch)}" oninput="onPickerSearch(this.value)"></div>
      <div class="cfg-chips">${SCOPES.map(s =>
        `<button class="master-tab ${pickerFilter === s.key ? 'active' : ''}" onclick="setPickerFilter('${s.key}')">${s.label}</button>`
      ).join('')}<button class="master-tab ${pickerFilter === 'picked' ? 'active' : ''}" onclick="setPickerFilter('picked')">已选 ${picked.length}</button></div>
      <div id="pickerList">${rows || '<div class="empty-tip" style="padding:24px 0">没有匹配的单词</div>'}${moreBtn}</div>
    </div>
    <div class="picker-foot">
      <span class="picker-count">已选 <b id="pickerCount">${picked.length}</b> 个</span>
      <button class="btn-ghost" onclick="pickerSelectAll()">全选</button>
      <button class="btn-ghost" onclick="pickerClear()">清空</button>
      <button class="next-btn" onclick="pickerDone()">完成</button>
    </div>
  `;
  attachPickerGestures(document.getElementById('pickerList'));
}

/* ---------------- 长按拖动连续选择 ----------------
 * 长按一行(350ms)进入连续模式:以该行的反向状态为基准,手指滑过哪些行就统一设成该状态;
 * 松手结束。点按仍是单个切换(长按触发的那次 click 会被吞掉)。
 */
let pickerDrag = null;
let pickerDragTimer = null;
let pickerSuppressClick = false;

function attachPickerGestures(list) {
  if (!list) return;
  list.addEventListener('pointerdown', e => {
    const row = e.target.closest('.picker-row');
    if (!row || !row.dataset.w) return;
    pickerDrag = { row, apply: !pickerRowPicked(row), y: e.clientY, active: false };
    pickerDragTimer = setTimeout(() => {
      if (!pickerDrag) return;
      pickerDrag.active = true;
      pickerSuppressClick = true;   // 长按松手后的 click 不再当点按处理
      pickerApplyRow(row, pickerDrag.apply);
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) { /* 忽略 */ } }
    }, 350);
  });
  list.addEventListener('pointermove', e => {
    if (!pickerDrag) return;
    if (!pickerDrag.active) {
      // 长按前就移动(滚动列表)→ 取消长按计时
      if (Math.abs(e.clientY - pickerDrag.y) > 10) {
        clearTimeout(pickerDragTimer);
        pickerDrag = null;
      }
      return;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el && el.closest ? el.closest('.picker-row') : null;
    if (row && row.dataset.w) pickerApplyRow(row, pickerDrag.apply);
  });
  const endDrag = () => { clearTimeout(pickerDragTimer); pickerDrag = null; };
  list.addEventListener('pointerup', endDrag);
  list.addEventListener('pointercancel', endDrag);
  // 连续模式期间阻止页面滚动(手指当画笔用)
  list.addEventListener('touchmove', e => { if (pickerDrag && pickerDrag.active) e.preventDefault(); }, { passive: false });
  list.addEventListener('contextmenu', e => { if (pickerDrag && pickerDrag.active) e.preventDefault(); });
  // 长按后松手的那次 click 不当点按处理
  list.addEventListener('click', e => {
    if (pickerSuppressClick) {
      pickerSuppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}

function pickerRowPicked(row) {
  const list = state.settings[pickerKind + 'Words'];
  return !!(Array.isArray(list) && list.includes(row.dataset.w));
}

/* 连续模式下把一行设成目标状态(与当前状态不同才切换,复用单个切换逻辑) */
function pickerApplyRow(row, pick) {
  if (pickerRowPicked(row) !== pick) pickerToggleWord(row.dataset.w, row);
}

function onPickerSearch(v) {
  pickerSearch = v.trim();
  pickerLimit = 100;
  renderWordPicker();
  // 重渲染会重建输入框，恢复焦点和光标位置
  const inp = document.getElementById('pickerSearchInput');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

function setPickerFilter(f) { pickerFilter = f; pickerLimit = 100; renderWordPicker(); }

function pickerToggleWord(w, rowEl) {
  const key = pickerKind + 'Words';
  if (!Array.isArray(state.settings[key])) state.settings[key] = [];
  const list = state.settings[key];
  const i = list.indexOf(w);
  const nowPicked = i < 0;
  if (nowPicked) list.push(w); else list.splice(i, 1);
  saveState();
  // 就地更新行样式与计数，不整页重渲染（保住滚动位置）
  if (rowEl) {
    rowEl.classList.toggle('picked', nowPicked);
    const chk = rowEl.querySelector('.pick-check');
    if (chk) chk.innerHTML = icon(nowPicked ? 'circle-check' : 'circle');
  }
  const cnt = document.getElementById('pickerCount');
  if (cnt) cnt.textContent = practicePicked(pickerKind).length;
  // 「已选」筛选下取消勾选 → 直接移除该行
  if (pickerFilter === 'picked' && !nowPicked && rowEl) rowEl.remove();
}

function pickerClear() {
  state.settings[pickerKind + 'Words'] = [];
  saveState();
  renderWordPicker();
}

/* 全选当前筛选/搜索结果(配合筛选可大批量选中) */
function pickerSelectAll() {
  const key = pickerKind + 'Words';
  const list = Array.isArray(state.settings[key]) ? state.settings[key] : (state.settings[key] = []);
  for (const w of pickerPool()) {
    if (!list.includes(w)) list.push(w);
  }
  saveState();
  renderWordPicker();
}

function pickerDone() {
  if (pickerKind === 'dict') renderDictConfig();
  else renderSpellConfig();
}

/* ============================================================
 * 听写（纯练习不改动学习进度，依赖系统 TTS）
 * 每词播两轮：每轮 = 英文单词读 2 次 + 汉语释义 1 次，
 * 两轮之间停顿可设（默认 1 秒）；支持判分/自查、循环、随机顺序、语速
 * ============================================================ */
/* 听写作答方式归一(judge判分/listen自查/auto自动轮播;旧 bool 存档已在 loadState 迁移) */
function normDictMode(v) {
  return ['judge', 'listen', 'auto'].includes(v) ? v : 'judge';
}

function renderDictConfig() {
  const el = document.getElementById('dictQuiz');
  if (!el) return;
  // 在线音源(音频元素)与设备TTS二有其一即可听写;微信/QQ 无 speechSynthesis 但仍可用在线音源
  if (!ttsSupported() && !canUseOnlineVoice()) {
    el.innerHTML = `<div class="quiz-card session-done"><div class="icon">${icon('ear')}</div>
      <h2>当前浏览器不支持语音</h2><p>听写需要在线音源（需联网）或系统语音合成（speechSynthesis）支持。<br>当前环境两者皆无，请改用系统浏览器打开。</p></div>`;
    return;
  }
  const mode = normDictMode(state.settings.dictMode);
  const pool = practicePool('dict');
  const custom = normScope(state.settings.dictScope) === 'custom';
  const count = custom ? pool.length : Math.min(state.settings.dictCount || 10, pool.length);
  const s = state.settings;
  const rate = s.dictRate || 0.9;
  const pause = s.dictPause == null ? 1 : s.dictPause;
  el.innerHTML = `
    <div class="quiz-card" style="text-align:left">
      <span class="quiz-type">${icon('ear')} 听写</span>
      <p class="cfg-note">每个词播两轮（单词读 2 遍 + 汉译 1 遍），听完输入或自查。纯练习，不影响学习进度。<br>自动轮播：播完自动公布答案并切下一个词，戴耳机走路时免手持。<br>发音用在线真人音源（单词=有道词典，汉译=普通话合成），熄屏/切后台可继续播；首次需联网，之后离线可用。</p>
      <div class="cfg-title">作答方式</div>
      <div class="cfg-chips">
        <button class="master-tab ${mode === 'judge' ? 'active' : ''}" onclick="setPracticeCfg('dictMode','judge')">输入判分</button>
        <button class="master-tab ${mode === 'listen' ? 'active' : ''}" onclick="setPracticeCfg('dictMode','listen')">只听自查</button>
        <button class="master-tab ${mode === 'auto' ? 'active' : ''}" onclick="setPracticeCfg('dictMode','auto')">自动轮播</button>
      </div>
      ${spellCfgHtml('dict')}
      <div class="cfg-title">两轮之间停顿</div>
      <div class="cfg-chips">${[0.5, 1, 2, 3].map(v =>
        `<button class="master-tab ${Math.abs(pause - v) < 0.01 ? 'active' : ''}" onclick="setPracticeCfg('dictPause',${v})">${v} 秒</button>`
      ).join('')}</div>
      <div class="cfg-title">播放顺序</div>
      <div class="cfg-chips">
        <button class="master-tab ${s.dictOrder === 'seq' ? 'active' : ''}" onclick="setPracticeCfg('dictOrder','seq')">${icon('list-ordered')} 顺序</button>
        <button class="master-tab ${s.dictOrder !== 'seq' ? 'active' : ''}" onclick="setPracticeCfg('dictOrder','random')">${icon('shuffle')} 随机</button>
      </div>
      <div class="cfg-title">循环播放</div>
      <div class="cfg-chips">
        <button class="master-tab ${s.dictLoop ? 'active' : ''}" onclick="setPracticeCfg('dictLoop',true)">开</button>
        <button class="master-tab ${!s.dictLoop ? 'active' : ''}" onclick="setPracticeCfg('dictLoop',false)">关</button>
      </div>
      <div class="cfg-title">语速 <span class="mt-cnt" id="rateLabel">${rate.toFixed(1)}x</span></div>
      <div class="rate-row">
        <input type="range" min="0.5" max="1.5" step="0.1" value="${rate}" oninput="onDictRate(this.value)">
      </div>
      ${pool.length ? '' : (custom ? '<div class="empty-tip" style="padding:20px 0">词单还是空的，点上面「选定具体单词」去勾选</div>' : '<div class="empty-tip" style="padding:20px 0">该范围暂无单词</div>')}
      <button class="next-btn" id="dictStartBtn" onclick="startDictation()" ${pool.length ? '' : 'disabled'}>开始听写（${count} 词）</button>
    </div>
  `;
}

function onDictRate(v) {
  const r = Math.max(0.5, Math.min(1.5, parseFloat(v) || 0.9));
  state.settings.dictRate = r;
  saveState();
  const label = document.getElementById('rateLabel');
  if (label) label.textContent = r.toFixed(1) + 'x';
}

function startDictation() {
  const pool = practicePool('dict');
  if (!pool.length) return;
  const custom = normScope(state.settings.dictScope) === 'custom';
  const n = custom ? pool.length : Math.min(state.settings.dictCount || 10, pool.length);
  const picked = state.settings.dictOrder === 'seq' ? pool.slice(0, n) : shuffle(pool).slice(0, n);
  const mode = normDictMode(state.settings.dictMode);
  session = {
    mode: 'dict',
    phase: 'dictate',
    queue: picked,
    judge: mode === 'judge',
    auto: mode === 'auto',
    spellRetries: [],
    sinceSpellRetry: 0,
    idx: 0,
    correct: 0, wrong: 0,
    loopN: 1,
    gen: 0,          // 播报代际号：切词/重听/离开页面时 +1，旧播报链自动作废
    records: new Map(picked.map(w => [w, makeRecord()])),
  };
  renderDictWord();
}

/* 停止当前播报（作废播报链 + 掐掉在线音频 + 取消系统语音队列） */
function stopDictPlayback() {
  if (session && session.mode === 'dict') session.gen++;
  stopSpeakAudio();
  clearDictMediaSession();
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
  }
}

function dictStatus(t) {
  const st = document.getElementById('dictStatus');
  if (st) st.textContent = t;
}

/* 在线音源等待播完；返回 true=正常播完（含超时推进），false=失败需降级 TTS */
function audioPlayAwait(text, lang, rate) {
  return new Promise(resolve => {
    try {
      if (!canUseOnlineVoice()) { resolve(false); return; }
      stopSpeakAudio();
      const el = new Audio(onlineVoiceUrl(text, /^zh/.test(lang), state.settings.audioAcc));
      el.playbackRate = rate;
      try { el.preservesPitch = true; } catch (e) { /* 老浏览器忽略 */ }
      currentAudioEl = el;
      let done = false;
      const fin = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (currentAudioEl === el) currentAudioEl = null;
        resolve(ok);
      };
      el.onended = () => fin(true);
      el.onerror = () => fin(false);
      const p = el.play();
      if (p && p.catch) p.catch(() => fin(false));
      /* 超时兜底：网络慢或 onended 不触发；按字数放宽，超时按播完处理避免复读 */
      const timer = setTimeout(() => {
        try { el.pause(); } catch (e) { /* 忽略 */ }
        fin(true);
      }, Math.max(8000, text.length * 900));
    } catch (e) { resolve(false); }
  });
}

/* 等待 utterance 播完（设备TTS兜底用）；部分环境 onend 不触发，用时长兜底 */
function speakAwait(text, lang, rate) {
  return new Promise(res => {
    try {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const v = resolveTTSVoice(/^zh/.test(lang) ? state.settings.ttsZhVoiceName : state.settings.ttsEngVoiceName, lang);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = rate;
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin;
      u.onerror = fin;
      synth.speak(u);
      setTimeout(fin, Math.max(3000, text.length * 600));
    } catch (e) { res(); }
  });
}

/* 听写播报统一入口：在线真人音源优先，失败/关闭时降级设备TTS并提示一次 */
let onlineSourceWarned = false;
async function speakDictText(text, lang, rate) {
  if (await audioPlayAwait(text, lang, rate)) return;
  if (canUseOnlineVoice() && !onlineSourceWarned) {
    onlineSourceWarned = true;
    dictStatus('🔊 在线音源不可用，已切换设备语音');
  }
  await speakAwait(text, lang, rate);
}

function dictSleep(ms, sess, gen) {
  return new Promise(res => setTimeout(res, ms));
}

/* 锁屏媒体信息：<audio> 播放时系统把它当媒体流，锁屏界面显示当前单词 */
function updateDictMediaSession(word) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession || typeof MediaMetadata === 'undefined') return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: word,
      artist: LIBS[libKey()].name + ' · 听写',
      album: '四级词汇通',
      artwork: [
        { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  } catch (e) { /* 忽略 */ }
}
function clearDictMediaSession() {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
  try { navigator.mediaSession.metadata = null; } catch (e) { /* 忽略 */ }
}

/* 预取下一个词的音频（走 SW 顺手缓存，切词时零等待；no-cors 拿不到内容也无妨） */
function prefetchDictAudio(word) {
  if (typeof fetch === 'undefined' || !canUseOnlineVoice()) return;
  try {
    fetch(onlineVoiceUrl(word, false, state.settings.audioAcc), { mode: 'no-cors' }).catch(() => {});
    fetch(onlineVoiceUrl(speakableDef(word) || word, true, state.settings.audioAcc), { mode: 'no-cors' }).catch(() => {});
  } catch (e) { /* 忽略 */ }
}

/* 播一个词的两轮：每轮 = 单词 ×2 + 汉译 ×1，轮间停顿可设 */
async function playDictCycle(sess, gen) {
  const word = sess.word;
  const rate = state.settings.dictRate || 0.9;
  const pause = Math.max(0.5, (state.settings.dictPause == null ? 1 : state.settings.dictPause)) * 1000;
  dictStatus('🔊 正在播放…');
  for (let round = 1; round <= 2; round++) {
    await speakDictText(word, 'en-US', rate);
    if (session !== sess || sess.gen !== gen) return;
    await dictSleep(600, sess, gen);
    if (session !== sess || sess.gen !== gen) return;
    await speakDictText(word, 'en-US', rate);
    if (session !== sess || sess.gen !== gen) return;
    await dictSleep(500, sess, gen);
    if (session !== sess || sess.gen !== gen) return;
    await speakDictText(speakableDef(word) || word, 'zh-CN', Math.min(1.2, rate + 0.1));
    if (session !== sess || sess.gen !== gen) return;
    if (round === 1) {
      await dictSleep(pause, sess, gen);
      if (session !== sess || sess.gen !== gen) return;
    }
  }
  if (session !== sess || sess.gen !== gen) return;
  if (sess.judge) {
    dictStatus('🔊 播放完毕，输入后提交');
  } else if (sess.auto) {
    // 自动轮播:再强化读一遍单词+汉译,然后自动切下一个词(单词全程显示在卡片上)
    dictStatus('🔊 公布答案…');
    await speakDictText(word, 'en-US', rate);
    if (session !== sess || sess.gen !== gen) return;
    await dictSleep(400, sess, gen);
    if (session !== sess || sess.gen !== gen) return;
    await speakDictText(speakableDef(word) || word, 'zh-CN', Math.min(1.2, rate + 0.1));
    if (session !== sess || sess.gen !== gen) return;
    const rec = sess.records.get(word) || makeRecord();
    rec.done = true;
    sess.records.set(word, rec);
    sess.correct++;
    dictStatus('🔊 即将下一个…');
    await dictSleep(Math.max(2000, pause * 2), sess, gen);
    if (session === sess && sess.gen === gen) dictNext();
  } else {
    dictStatus('🔊 播放完毕');
  }
}

function renderDictWord() {
  const el = document.getElementById('dictQuiz');
  const remaining = session.queue.filter(w => !(session.records.get(w) || makeRecord()).done);
  if (!remaining.length) {
    // 循环播放：整轮播完重置记录再来一轮；否则出完成页
    if (state.settings.dictLoop) {
      session.loopN++;
      session.records = new Map(session.queue.map(w => [w, makeRecord()]));
      session.idx = 0;
      session.spellRetries = [];
      session.sinceSpellRetry = 0;
      renderDictWord();
      return;
    }
    el.innerHTML = practiceDoneHtml('听写', '听写');
    return;
  }
  session.spellRetries = (session.spellRetries || []).filter(w => !(session.records.get(w) || makeRecord()).done);
  let word;
  if (session.judge && session.spellRetries.length && (session.sinceSpellRetry || 0) >= RETRY_INTERVAL) {
    word = session.spellRetries[0];
    session.sinceSpellRetry = 0;
    rotateSpellRetries();
  } else {
    const fresh = remaining.filter(w => !session.spellRetries.includes(w));
    const pool2 = fresh.length ? fresh : remaining;
    word = pool2[session.idx % pool2.length];
    session.sinceSpellRetry = (session.sinceSpellRetry || 0) + 1;
  }
  session.word = word;
  session.answered = false;
  const loopNote = session.loopN > 1 ? `<div class="retry-note">循环第 ${session.loopN} 轮</div>` : '';
  const modeLabel = session.judge ? '判分' : (session.auto ? '自动轮播' : '只听自查');
  // 只听自查/自动轮播:单词和释义全程显示(边听边看)
  const showWord = session.judge ? '' : `
      <div class="quiz-prompt">${escapeHtml(word)}</div>
      <div class="dict-def-line">${escapeHtml(WORD_MAP.get(word) || '')}</div>`;
  const inputHtml = session.judge ? `
      <div class="spell-input-wrap">
        <input type="text" id="spellInput" class="spell-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="听音拼词">
        <button class="spell-check" onclick="dictCheck()">${icon('check')} 提交</button>
      </div>` : (session.auto ? `
      <div class="retry-note">自动轮播中 · 播完自动切下一个词</div>` : `
      <button class="next-btn" style="max-width:320px;margin:14px auto 0" onclick="dictListenNext()">下一个 →</button>`);
  el.innerHTML = `
    <div class="quiz-card">
      <span class="quiz-type">${icon('ear')} 听写 · ${modeLabel}</span>
      ${showWord}
      <div class="dict-status" id="dictStatus">🔊 准备播放…</div>
      <div class="show-ans-wrap"><button class="show-ans-btn" onclick="dictReplay()">${icon('volume-2')} 重听本词</button></div>
      ${inputHtml}
      <div class="progress-line">剩余 ${remaining.length} 词　·　✓ ${session.correct} ✗ ${session.wrong}
      　<button class="toolbar-btn" onclick="finishDictation()">结束</button></div>
      ${loopNote}
      <div id="spellFeedback"></div>
    </div>
  `;
  const sess = session;
  const gen = ++session.gen;
  updateDictMediaSession(word);
  prefetchDictAudio(session.queue[(session.idx + 1) % session.queue.length]);
  playDictCycle(sess, gen);
  if (session.judge) {
    setTimeout(() => {
      const inp = document.getElementById('spellInput');
      if (inp) {
        inp.focus();
        inp.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          e.stopPropagation();
          if (session.answered) dictNext(); else dictCheck();
        });
      }
    }, 120);
  }
}

function dictReplay() {
  if (!session || session.mode !== 'dict' || session.answered) return;
  const sess = session;
  playDictCycle(sess, ++sess.gen);
}

/* 听写判分提交（听写纯练习：不改 stage/due，错词只在本会话内重现） */
function dictCheck() {
  if (!session || session.mode !== 'dict' || session.answered) return;
  session.answered = true;
  stopDictPlayback();
  const word = session.word;
  const val = ((document.getElementById('spellInput') && document.getElementById('spellInput').value) || '').trim().toLowerCase();
  const isCorrect = val === word.toLowerCase();
  const rec = session.records.get(word) || makeRecord();
  const fbEl = document.getElementById('spellFeedback');
  const card = fbEl.closest('.quiz-card');
  if (card) card.classList.add('with-ans');
  const inBook = curWords()[word] && curWords()[word].inBook;
  if (isCorrect) {
    rec.done = true;
    session.records.set(word, rec);
    session.correct++;
    session.spellRetries = (session.spellRetries || []).filter(w => w !== word);
    if (state.settings.autoSpeak) speakWord(word);
    fbEl.innerHTML = `
      <div class="feedback good">
        <div class="fb-title">${icon('circle-check')} 拼写正确！</div>
        <div class="ans-word">${escapeHtml(word)}</div>
        <div class="ans-def">${escapeHtml(WORD_MAP.get(word) || '')}</div>
      </div>
      <button class="next-btn" onclick="dictNext()">下一个 →</button>
    `;
  } else {
    rec.errors++;
    session.wrong++;
    session.records.set(word, rec);
    if (!session.spellRetries.includes(word)) session.spellRetries.push(word);
    session.sinceSpellRetry = 0;
    fbEl.innerHTML = `
      <div class="feedback bad">
        <div class="fb-title">${icon('circle-x')} 拼错了，过几个词再考你</div>
        <div class="wrong-pair">
          <span class="wp-ans">${escapeHtml(word)}</span>
          <span class="wp-def">${escapeHtml(WORD_MAP.get(word) || '')}</span>
        </div>
        ${memoOf(word) ? `<div class="wrong-memo">${icon('lightbulb')} ${escapeHtml(memoOf(word))}</div>` : ''}
      </div>
      <div class="wrong-actions">
        <button class="book-toggle ${inBook ? 'in-book' : ''}" id="wrongBookBtn" onclick="toggleWrongBook('${escapeAttr(word)}')">
          ${inBook ? icon('bookmark-check') + ' 已在生词本' : icon('bookmark-plus') + ' 加入生词本'}
        </button>
        <button class="next-btn" onclick="dictNext()">下一个 →</button>
      </div>
    `;
  }
}

/* 只听自查:手动切下一个词(单词全程显示,无判分) */
function dictListenNext() {
  if (!session || session.mode !== 'dict') return;
  stopDictPlayback();
  session.idx++;
  renderDictWord();
}

function dictNext() {
  session.answered = false;
  session.idx++;
  renderDictWord();
}

/* 中途结束听写：出完成页（循环模式下退出用） */
function finishDictation() {
  stopDictPlayback();
  const el = document.getElementById('dictQuiz');
  el.innerHTML = practiceDoneHtml('听写', '听写');
}

/* ============================================================
 * 生词本
 * ============================================================ */
function renderBook() {
  const el = document.getElementById('bookList');
  const book = bookWords();
  if (!book.length) {
    el.innerHTML = '<div class="empty-tip">生词本是空的<br><br>答错或没记住的单词会自动加入这里</div>';
    return;
  }
  el.innerHTML = book.map(w =>
    `<div class="list-card"><div class="list-item">
      <span class="list-word">${escapeHtml(w)}</span>
      <span class="list-def">${escapeHtml(WORD_MAP.get(w))}</span>
      ${memoOf(w) ? `<button class="list-memo-btn" title="巧记" onclick="toggleMemoRow('${escapeAttr(w)}', this)">${icon('lightbulb')}</button>` : ''}
      <button class="list-del" title="移出生词本" onclick="removeFromBook('${escapeAttr(w)}')">${icon('x')}</button>
    </div></div>`
  ).join('');
}

function removeFromBook(word) {
  toggleBook(word);
  renderBook();
  refreshHome();
}

/* ============================================================
 * 掌握情况
 * ============================================================ */
const MASTER_TABS = [
  { cls: 'learning', label: '学习中' },
  { cls: 'due', label: '待复习' },
  { cls: 'mastered', label: '已掌握' },
  { cls: 'unlearned', label: '未学习' },
];
let masterTab = 'learning';
let masterSearch = '';   // 分类内搜索关键词
let masterLimit = 100;   // 每次渲染条数上限（未学习分类可达 4543 条，全量渲染会卡）

function renderMaster() {
  const s = stats();
  document.getElementById('mUnlearned').textContent = s.unseen;
  document.getElementById('mLearning').textContent = s.learning;
  document.getElementById('mDue').textContent = s.due;
  document.getElementById('mMastered').textContent = s.mastered;

  // 顶部 tab
  document.getElementById('masterTabs').innerHTML = MASTER_TABS.map(t => {
    const n = classCount(t.cls);
    const act = masterTab === t.cls ? 'active' : '';
    return `<div class="master-tab ${act}" data-cls="${t.cls}" onclick="setMasterTab('${t.cls}')">
      ${t.label} <span class="mt-cnt">${n}</span>
    </div>`;
  }).join('');

  renderMasterList();
}

function setMasterTab(cls) {
  masterTab = cls;
  masterSearch = '';
  masterLimit = 100;
  renderMaster();
}

function onMasterSearch(v) {
  masterSearch = v.trim();
  masterLimit = 100;
  renderMasterList();
  // 重渲染会重建输入框，恢复焦点和光标位置
  const inp = document.getElementById('masterSearchInput');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

function renderMasterList() {
  const el = document.getElementById('masterList');
  let words = wordsByClass(masterTab);
  const label = MASTER_TABS.find(t => t.cls === masterTab).label;
  const totalInClass = words.length;

  if (masterSearch) {
    const q = masterSearch.toLowerCase();
    words = words.filter(w =>
      w.toLowerCase().includes(q) || (WORD_MAP.get(w) || '').toLowerCase().includes(q)
    );
  }
  const shown = words.slice(0, masterLimit);

  if (!words.length) {
    el.innerHTML = `<div class="master-search-wrap"><input id="masterSearchInput" class="master-search" placeholder="搜索单词或释义…" value="${escapeHtml(masterSearch)}" oninput="onMasterSearch(this.value)"></div>
      <div class="empty-tip">${masterSearch ? `没有匹配「${escapeHtml(masterSearch)}」的单词` : `「${label}」分类暂无单词`}</div>`;
    return;
  }

  const rows = shown.map(w => {
    const st = wordStatus(w);
    const badgeCls = st.cls === 'mastered' ? 'ms-mastered' : (st.cls === 'due' ? 'ms-due' : 'ms-learning');
    return `<div class="list-card"><div class="list-item">
      <span class="list-word">${escapeHtml(w)}</span>
      <span class="list-def">${escapeHtml(WORD_MAP.get(w))}</span>
      <span class="ms-badge ${badgeCls}">${st.label}</span>
      ${memoOf(w) ? `<button class="list-memo-btn" title="巧记" onclick="toggleMemoRow('${escapeAttr(w)}', this)">${icon('lightbulb')}</button>` : ''}
      <button class="list-del" title="重置此单词" onclick="confirmResetWord('${escapeAttr(w)}')">${icon('rotate-ccw')}</button>
    </div></div>`;
  }).join('');

  const moreBtn = words.length > shown.length
    ? `<div style="text-align:center;margin-top:10px"><button class="toolbar-btn" onclick="masterLimit += 200; renderMasterList()">显示更多（还有 ${words.length - shown.length} 个）</button></div>`
    : '';

  el.innerHTML = `
    <div class="master-search-wrap"><input id="masterSearchInput" class="master-search" placeholder="搜索单词或释义…" value="${escapeHtml(masterSearch)}" oninput="onMasterSearch(this.value)"></div>
    <div class="list-card master-toolbar">
      <span style="font-size:14px;color:var(--muted)">${label} · 共 ${totalInClass} 词${masterSearch ? ` · 匹配 ${words.length} 个` : ''}</span>
      <button class="toolbar-btn" onclick="confirmResetClass('${masterTab}')">重置本分类全部</button>
    </div>
    ${rows}
    ${moreBtn}
  `;
}

/* 重置单个单词 */
function confirmResetWord(word) {
  lastResetWord = word;
  document.getElementById('resetTitle').textContent = '重置这个单词？';
  document.getElementById('resetDesc').innerHTML = `「<b>${escapeHtml(word)}</b>」将回到未学习状态，复习进度清空。`;
  document.getElementById('resetModal').classList.add('show');
}

/* 重置整个分类 */
let lastResetClass = null;
let lastResetWord = null;
function confirmResetClass(cls) {
  lastResetClass = cls;
  const n = classCount(cls);
  const label = MASTER_TABS.find(t => t.cls === cls).label;
  document.getElementById('resetClassTitle').textContent = `重置「${label}」全部单词？`;
  document.getElementById('resetClassDesc').textContent = `将把 ${n} 个「${label}」单词全部重置为未学习状态，此操作不可恢复。`;
  document.getElementById('resetClassModal').classList.add('show');
}
function closeResetClass() { document.getElementById('resetClassModal').classList.remove('show'); }
function doResetClass() {
  if (lastResetClass) resetWordsByClass(lastResetClass);
  lastResetClass = null;
  closeResetClass();
  renderMaster();
  refreshHome();
}

/* ============================================================
 * 学习记录
 * ============================================================ */
let historyDay = null;   // 当前查看的日期 key

function renderHistory() {
  // 默认选今天
  if (!historyDay) historyDay = dateKey();
  const days = Object.keys(state.history || {}).sort().reverse().slice(0, 30);   // 只显示最近 30 天，避免 tab 无限增长
  // 若当前查看的日期被截掉，回退到最近一天
  if (historyDay && !days.includes(historyDay)) historyDay = days[0] || dateKey();
  // 日期 tab
  const tabsHtml = (days.length ? days : [dateKey()]).map(d => {
    const rec = (state.history && state.history[d]) || { learned: [], reviewed: [], wrongs: [] };
    const label = d === dateKey() ? '今天' : d;
    const act = d === historyDay ? 'active' : '';
    const n = rec.learned.length + rec.reviewed.length;
    return `<button class="master-tab ${act}" onclick="setHistoryDay('${d}')">${label}<span class="mt-cnt">${n}</span></button>`;
  }).join('');
  document.getElementById('historyDates').innerHTML = days.length
    ? tabsHtml
    : '<p style="font-size:14px;color:var(--ink-soft)">还没有学习记录，开始学习吧</p>';

  const rec = (state.history && state.history[historyDay]) || { learned: [], reviewed: [], wrongs: [] };
  document.getElementById('hLearned').textContent = rec.learned.length;
  document.getElementById('hReviewed').textContent = rec.reviewed.length;
  document.getElementById('hWrongs').textContent = rec.wrongs.length;
  renderHistoryDetail(rec);
}

function setHistoryDay(day) {
  historyDay = day;
  renderHistory();
}

function renderHistoryDetail(rec) {
  const el = document.getElementById('historyDetail');
  const dayLabel = historyDay === dateKey() ? '今天' : historyDay;
  const section = (title, list, cls) => {
    if (!list.length) return '';
    const rows = list.map(e => {
      // 条目兼容:[词库key, 单词] 新格式 / 旧版纯字符串(按词库包含关系归属)
      const norm = normHistEntry(e);
      const w = norm ? norm[1] : String(e);
      const lib = norm ? norm[0] : null;
      const libTag = lib ? `<span class="dict-lib">${escapeHtml(LIBS[lib].name.replace('词汇', ''))}</span>` : '';
      const def = lib ? defInLib(lib, w) : (WORD_MAP.get(w) || '');
      return `<div class="list-card"><div class="list-item">
        <span class="list-word">${escapeHtml(w)}</span>
        ${libTag}
        <span class="list-def">${escapeHtml(def)}</span>
        <span class="ms-badge ${cls}">${title}</span>
      </div></div>`;
    }).join('');
    return `<h3 style="font-family:var(--serif);font-size:15px;color:var(--ink-blue);margin:16px 0 8px">${title}（${list.length}）</h3>${rows}`;
  };
  el.innerHTML = section('新学', rec.learned, 'ms-learning')
    + section('复习', rec.reviewed, 'ms-mastered')
    + section('答错', rec.wrongs, 'ms-due')
    + (rec.learned.length + rec.reviewed.length + rec.wrongs.length === 0
        ? `<div class="empty-tip">${dayLabel}没有学习活动</div>` : '');
}

/* ---------------- 图标 ----------------
 * icons.js 的 ICONS(Lucide SVG,stroke=currentColor 随 CSS 变色)
 * icon(name) 返回加 class="ic" 的 svg 字符串;静态 HTML 用 data-icon + renderIcons() 填充
 */
function icon(name) {
  const svg = (typeof ICONS !== 'undefined' && ICONS[name]) || '';
  return svg ? svg.replace('<svg ', '<svg class="ic" ') : '';
}

function renderIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}

/* ---------------- 工具 ---------------- */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) {
  return String(s).replace(/['\\]/g, c => '\\' + c);
}

/* ---------------- 桌面端键盘快捷键 ----------------
 * 识别阶段：数字键 1-4 选选项；出反馈后 Enter 进下一个
 * 拼写阶段：出反馈后 Enter 进下一个（输入框内的 Enter 由输入框自身处理）
 */
document.addEventListener('keydown', e => {
  if (!session) return;
  if (document.querySelector('.modal-mask.show')) return;   // 弹窗打开时不响应
  const tag = (e.target && e.target.tagName) || '';
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

  if (session.phase === 'recognize') {
    if (!session.answered && !inInput) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) {
        const opts = document.querySelectorAll('#screen-study .opt, #screen-review .opt');
        if (opts[n - 1]) opts[n - 1].click();
      }
    } else if (session.answered && e.key === 'Enter' && !inInput) {
      advanceAfterWrong();
    }
  } else if (session.phase === 'spell') {
    if (session.answered && e.key === 'Enter' && !inInput) {
      const good = document.querySelector('#spellFeedback .feedback.good');
      if (good) nextSpell(); else advanceSpellAfterWrong();
    }
  }
});

/* ---------------- 初始化 ---------------- */
renderIcons();
refreshHome();
refreshSettings();
