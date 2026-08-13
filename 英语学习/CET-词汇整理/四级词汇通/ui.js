/* ============================================================
 * 四级词汇通 - 界面交互层
 * 依赖：app.js（逻辑）+ vocab-data.js（数据）
 * ============================================================ */

/* ---------------- 导航与页面切换 ---------------- */
const SCREEN_TITLES = {
  'screen-home': '四级词汇通',
  'screen-study': '学习新词',
  'screen-review': '复习单词',
  'screen-book': '生词本',
  'screen-master': '掌握情况',
  'screen-history': '学习记录',
  'screen-settings': '设置',
};

function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const t = SCREEN_TITLES[id] || '';
  document.getElementById('topTitle').textContent = t;
  document.getElementById('topBack').style.display = (id === 'screen-home') ? 'none' : 'inline';
  if (id === 'screen-home') refreshHome();
  if (id === 'screen-book') renderBook();
  if (id === 'screen-master') renderMaster();
  if (id === 'screen-history') renderHistory();
}

function goHome() { go('screen-home'); }

/* ---------------- 首页 ---------------- */
function refreshHome() {
  const s = stats();
  document.getElementById('statTotal').textContent = s.total;
  document.getElementById('statMastered').textContent = s.mastered;
  document.getElementById('statDue').textContent = s.due;
  document.getElementById('statUnseen').textContent = s.unseen;
  document.getElementById('badgeNew').textContent = Math.min(s.unseen, state.settings.dailyNew);
  document.getElementById('badgeReview').textContent = s.due;
  document.getElementById('badgeBook').textContent = s.inBook;
  document.getElementById('badgeLearning').textContent = s.learning;
  const today = state.history && state.history[dateKey()];
  const cnt = today ? today.learned.length + today.reviewed.length : 0;
  document.getElementById('badgeHistory').textContent = cnt > 0 ? cnt + ' 词' : '今天';
  renderGoalCard();
  updateResumeBanner();
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
    newStatus.textContent = '全部学完 🏆';
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
  revNum.textContent = `${g.dueToday} 词`;
  if (g.dueToday > 0) {
    revStatus.textContent = '有到期复习';
    revStatus.className = 'goal-status';
  } else {
    revStatus.textContent = '今日无待复习';
    revStatus.className = 'goal-status';
  }
}

/* 首页横幅：有未完成会话时显示 */
function updateResumeBanner() {
  const banner = document.getElementById('resumeBanner');
  if (!banner) return;
  const snap = loadSessionSnapshot();
  if (!snap) { banner.style.display = 'none'; return; }
  const mode = snap.mode === 'study' ? '学习' : '复习';
  const done = snap.queue.length - snap.pending.length - snap.retries.length;
  const info = document.getElementById('resumeInfo');
  info.textContent = `${mode}进行中 · 已完成 ${done}/${snap.queue.length} 词 · 答对 ${snap.correct}`;
  banner.style.display = 'flex';
}

function discardResume() {
  clearSessionSnapshot();
  updateResumeBanner();
}

/* ---------------- 设置 ---------------- */
function refreshSettings() {
  document.getElementById('setNew').textContent = state.settings.dailyNew;
  document.getElementById('setReview').textContent = state.settings.dailyReview;
}

function adjSetting(key, delta) {
  const v = state.settings[key] + delta;
  state.settings[key] = Math.max(1, Math.min(100, v));
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
  a.download = `四级词汇通_进度_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setImportMsg('✅ 已导出进度文件，把它发到另一台设备即可', 'ok');
}

function handleImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
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
 *   答错时：可自选是否加入生词本
 */
let session = null;
/* 会话状态: { mode, queue, pending(识别队列), idx, correct, wrong,
 *   records: Map(word -> { errors, corrects, spellCorrects, done }),
 *   spellOn(是否进入拼写), phase('recognize'|'spell'|'done') }
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
      queue: session.queue,
      pending: session.pending || [],
      retries: session.retries || [],
      sinceRetry: session.sinceRetry || 0,
      idx: session.idx || 0,
      correct: session.correct || 0,
      wrong: session.wrong || 0,
      spellOn: !!session.spellOn,
      phase: session.phase || 'recognize',
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

/* 从快照恢复并继续 */
function resumeSession() {
  const snap = loadSessionSnapshot();
  if (!snap) return;
  session = snap;
  go(snap.mode === 'study' ? 'screen-study' : 'screen-review');
  if (snap.phase === 'spell') renderSpellStage();
  else if (snap.phase === 'spellAsk') {
    const el = document.getElementById(snap.mode === 'study' ? 'studyQuiz' : 'reviewQuiz');
    el.innerHTML = spellAskHtml();
  }
  else renderStudyRecognize();
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
      <div class="icon">🎯</div>
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
      <div class="icon">🏆</div>
      <h2>全部单词已学完！</h2>
      <p>4543 个四级单词你已经全部学过了，太棒了！<br>去「掌握情况」看看你的成果吧。</p>
      <div class="modal-btns" style="max-width:320px;margin:0 auto;flex-direction:column;gap:10px">
        <button class="next-btn" onclick="goHome()">回到首页</button>
      </div>
    </div>
  `;
}

function startReview() {
  const due = dueWords();
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
  const q = makeQuestion(word);
  session.q = q;
  session.answered = false;
  const rec = session.records.get(word) || makeRecord();
  const isRelearn = rec.errors > 0;
  const typeLabel = (isRelearn ? '重记' : session.mode === 'study' ? '学习' : '复习') + ' · ' + q.type;
  const promptCls = 'quiz-prompt';
  const optionsHtml = q.options.map((o, i) =>
    `<button class="opt" data-ans="${o.isAnswer}" onclick="recognizeAnswer(${i}, this)">${escapeHtml(o.text)}</button>`
  ).join('');
  const retryNote = isRelearn ? `<div class="retry-note">重记词 · 还需答对 ${Math.max(0, RECOG_REQUIRED - rec.corrects)} 次</div>` : '';
  el.innerHTML = `
    <div class="quiz-card">
      <span class="quiz-type${session.mode === 'review' ? ' rev' : ''}">${typeLabel}</span>
      <div class="${promptCls}">${escapeHtml(q.prompt)}</div>
      <div class="progress-line">${session.mode === 'study' ? '学习新词' : '复习'}　·　✓ ${session.correct} ✗ ${session.wrong}</div>
      <div class="options">${optionsHtml}</div>
      ${retryNote}
      <div class="show-ans-wrap">
        <button class="show-ans-btn" onclick="showAnswer()">🙋 不会，看答案</button>
      </div>
      <div id="feedbackZone"></div>
    </div>
  `;
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
      if (session.mode === 'study') learnWord(word, true);
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

function showWrongFeedback(word, wrongText) {
  const el = document.getElementById(session.mode === 'study' ? 'studyQuiz' : 'reviewQuiz');
  const fb = document.getElementById('feedbackZone');
  const inBook = state.words[word] && state.words[word].inBook;
  const def = WORD_MAP.get(word);

  // 选错选项的对应翻译提示（英译汉：选项是中文释义 → 反查提示它的英文单词）
  let wrongHint = '';
  if (wrongText) {
    let foundWord = null;
    for (const [w, d] of WORD_MAP) {
      if (d === wrongText) { foundWord = w; break; }
    }
    if (foundWord) wrongHint = `<div class="wrong-hint">「${escapeHtml(wrongText)}」的英语是：${escapeHtml(foundWord)}</div>`;
  }

  fb.innerHTML = `
    <div class="feedback bad">
      <div>❌ 答错了，稍后会再考你</div>
      <div class="wrong-pair">
        <span class="wp-ans">${escapeHtml(word)}</span>
        <span class="wp-sep">/</span>
        <span class="wp-def">${escapeHtml(def)}</span>
      </div>
      ${wrongHint}
    </div>
    <div class="wrong-actions">
      <button class="book-toggle ${inBook ? 'in-book' : ''}" id="wrongBookBtn" onclick="toggleWrongBook('${escapeAttr(word)}')">
        ${inBook ? '✓ 已在生词本' : '📌 加入生词本'}
      </button>
      <button class="next-btn" onclick="advanceAfterWrong()">下一个 →</button>
    </div>
  `;
  el.querySelectorAll('.opt').forEach(b => b.disabled = true);
}

function toggleWrongBook(word) {
  toggleBook(word);
  const inBook = state.words[word] && state.words[word].inBook;
  const b = document.getElementById('wrongBookBtn');
  if (b) {
    b.textContent = inBook ? '✓ 已在生词本' : '📌 加入生词本';
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
      <div class="icon">✍️</div>
      <h2>识别完成！</h2>
      <p>共 ${total} 词 · 答错 ${session.wrong} · ${hard} 个需重记</p>
      <p style="margin-top:6px;font-size:14px;color:var(--ink-soft)">要不要基于刚才的单词练习拼写？可跳过。</p>
      <div class="modal-btns" style="max-width:320px;margin:0 auto;flex-direction:column;gap:10px">
        <button class="next-btn" onclick="startSpellStage()">✍️ ${btn}</button>
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
  const word = remaining[session.idx % remaining.length];
  session.word = word;
  session.answered = false;
  const hint = WORD_MAP.get(word);
  el.innerHTML = `
    <div class="quiz-card">
      <span class="quiz-type">拼写</span>
      <div class="quiz-prompt small">${escapeHtml(hint)}</div>
      <div class="spell-input-wrap">
        <input type="text" id="spellInput" class="spell-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="输入英文单词">
        <button class="spell-check" onclick="checkSpell()">✓ 提交</button>
      </div>
      <div class="progress-line">${session.idx + 1} / ${remaining.length}　·　✓ ${session.correct} ✗ ${session.wrong}</div>
      <div id="spellFeedback"></div>
    </div>
  `;
  setTimeout(() => {
    const inp = document.getElementById('spellInput');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') checkSpell(); });
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
      // 识别阶段已提交学习/复习结果，拼写是纯练习，不再重复提交
      saveSessionSnapshot();
      fbEl.innerHTML = `
        <div class="feedback good">
          <div>✅ 拼写正确！</div>
          <div class="ans-word">${escapeHtml(word)}</div>
        </div>
        <button class="next-btn" onclick="nextSpell()">下一个 →</button>
      `;
    } else {
      saveSessionSnapshot();
      fbEl.innerHTML = `
        <div class="feedback good">
          <div>✅ 拼写正确！再写一次加深记忆</div>
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
    saveSessionSnapshot();
    const inBook = state.words[word] && state.words[word].inBook;
    fbEl.innerHTML = `
      <div class="feedback bad">
        <div>❌ 拼错了，正确拼写和含义：</div>
        <div class="wrong-pair">
          <span class="wp-ans">${escapeHtml(word)}</span>
          <span class="wp-sep">/</span>
          <span class="wp-def">${escapeHtml(WORD_MAP.get(word))}</span>
        </div>
      </div>
      <div class="wrong-actions">
        <button class="book-toggle ${inBook ? 'in-book' : ''}" id="wrongBookBtn" onclick="toggleWrongBook('${escapeAttr(word)}')">
          ${inBook ? '✓ 已在生词本' : '📌 加入生词本'}
        </button>
        <button class="next-btn" onclick="retrySpell()">重新拼写</button>
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
function retrySpell() { renderSpellStage(); }

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
    ? `<p class="goal-done-note">🎯 今日新学目标 ${g.target} 个已达成！明天继续坚持，复习会在明天自动出现。</p>`
    : '';
  const list = session.queue.map(w => {
    const rec = session.records.get(w) || {};
    const hard = rec.errors > 0;
    return `<div class="list-card"><div class="list-item">
      <span class="list-word">${escapeHtml(w)}</span>
      <span class="list-def">${escapeHtml(WORD_MAP.get(w))}</span>
      ${hard ? '<span class="ms-badge ms-due">反复记</span>' : ''}
    </div></div>`;
  }).join('');
  return `
    <div class="quiz-card session-done" style="text-align:left">
      <div style="text-align:center">
        <div class="icon">🎉</div>
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
      <button class="list-del" onclick="removeFromBook('${escapeAttr(w)}')">📌</button>
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
  renderMaster();
}

function renderMasterList() {
  const el = document.getElementById('masterList');
  const words = wordsByClass(masterTab);
  const label = MASTER_TABS.find(t => t.cls === masterTab).label;

  if (!words.length) {
    el.innerHTML = `<div class="empty-tip">「${label}」分类暂无单词</div>`;
    return;
  }

  const rows = words.map(w => {
    const st = wordStatus(w);
    const badgeCls = st.cls === 'mastered' ? 'ms-mastered' : (st.cls === 'due' ? 'ms-due' : 'ms-learning');
    return `<div class="list-card"><div class="list-item">
      <span class="list-word">${escapeHtml(w)}</span>
      <span class="list-def">${escapeHtml(WORD_MAP.get(w))}</span>
      <span class="ms-badge ${badgeCls}">${st.label}</span>
      <button class="list-del" title="重置此单词" onclick="confirmResetWord('${escapeAttr(w)}')">⟳</button>
    </div></div>`;
  }).join('');

  el.innerHTML = `
    <div class="list-card master-toolbar">
      <span style="font-size:14px;color:var(--muted)">${label} · 共 ${words.length} 词</span>
      <button class="toolbar-btn" onclick="confirmResetClass('${masterTab}')">重置本分类全部</button>
    </div>
    ${rows}
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
  const days = Object.keys(state.history || {}).sort().reverse();
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
    const rows = list.map(w =>
      `<div class="list-card"><div class="list-item">
        <span class="list-word">${escapeHtml(w)}</span>
        <span class="list-def">${escapeHtml(WORD_MAP.get(w))}</span>
        <span class="ms-badge ${cls}">${title}</span>
      </div></div>`
    ).join('');
    return `<h3 style="font-family:var(--serif);font-size:15px;color:var(--ink-blue);margin:16px 0 8px">${title}（${list.length}）</h3>${rows}`;
  };
  el.innerHTML = section('新学', rec.learned, 'ms-learning')
    + section('复习', rec.reviewed, 'ms-mastered')
    + section('答错', rec.wrongs, 'ms-due')
    + (rec.learned.length + rec.reviewed.length + rec.wrongs.length === 0
        ? `<div class="empty-tip">${dayLabel}没有学习活动</div>` : '');
}

/* ---------------- 工具 ---------------- */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) {
  return String(s).replace(/['\\]/g, c => '\\' + c);
}

/* ---------------- 初始化 ---------------- */
refreshHome();
refreshSettings();
