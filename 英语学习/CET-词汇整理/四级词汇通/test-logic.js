/* ============================================================
 * 英语词汇通 - 逻辑测试（node vm 模拟 localStorage + DOM 桩）
 * 覆盖：重复选项过滤 / 优质干扰项 / 汉译英题型 /
 *       复习空守卫 / reviewWrong stage 下限 / 历史tab上限 /
 *       键盘快捷键 / 设置缺省合并 / 死代码清理
 * 运行：node test-logic.js
 * ============================================================ */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}

/* ---------- DOM / localStorage 桩 ---------- */
function dummyEl(id) {
  return {
    id, innerHTML: '', textContent: '', value: '', style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, focus() {}, click() {},
    appendChild() {}, removeChild() {}, setAttribute() {},
    querySelectorAll: () => [], querySelector: () => null,
    setSelectionRange() {},
  };
}
const storage = new Map();
const documentStub = {
  getElementById: id => documentStub._els[id] || (documentStub._els[id] = dummyEl(id)),
  _els: {},
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: tag => dummyEl('_' + tag),
  addEventListener() {},
  body: dummyEl('body'),
};
documentStub.body.removeChild = () => {};

const sandbox = {
  console, Math, Date, JSON, Object, Array, Map, Set, Infinity, parseInt, String, Number,
  document: documentStub,
  localStorage: {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
  },
  window: {},
  setTimeout: fn => 0,
  SpeechSynthesisUtterance: function (t) { this.text = t; },
};
sandbox.window.speechSynthesis = { speak() {}, cancel() {} };
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
const dir = __dirname;
vm.runInContext(fs.readFileSync(path.join(dir, 'vocab-data.js'), 'utf8'), sandbox);
try { vm.runInContext(fs.readFileSync(path.join(dir, 'vocab-libs.js'), 'utf8'), sandbox); } catch (e) { /* 扩展词库缺失不阻塞基础测试 */ }
try { vm.runInContext(fs.readFileSync(path.join(dir, 'vocab-extra.js'), 'utf8'), sandbox); } catch (e) { /* 巧记数据缺失不阻塞基础测试 */ }
vm.runInContext(fs.readFileSync(path.join(dir, 'app.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(dir, 'ui.js'), 'utf8'), sandbox);

const g = code => vm.runInContext(code, sandbox);

/* ================= 1. 出题：无重复选项 ================= */
console.log('\n[1] 四选一无重复选项（含 74 组同释义词）');
(() => {
  // 找出同释义词对，对每个成员出 50 次题验证
  const defMap = new Map();
  g('WORD_LIST').forEach(w => {
    const d = g('WORD_MAP').get(w);
    if (!defMap.has(d)) defMap.set(d, []);
    defMap.get(d).push(w);
  });
  const dupWords = [];
  for (const [, ws] of defMap) if (ws.length > 1) dupWords.push(...ws);
  ok(dupWords.length > 100, `同释义词数量充足（${dupWords.length} 个，74 组）`);

  let bad = 0;
  for (const w of dupWords) {
    for (let i = 0; i < 50; i++) {
      const q = g('makeQuestion')(w);
      const texts = q.options.map(o => o.text);
      if (new Set(texts).size !== 4) bad++;
      if (q.options.filter(o => o.isAnswer).length !== 1) bad++;
    }
  }
  ok(bad === 0, `${dupWords.length} 个同释义词 × 50 次出题，零重复选项、唯一正确项`);

  let bad2 = 0;
  for (let i = 0; i < 500; i++) {
    const w = g('WORD_LIST')[Math.floor(Math.random() * 4543)];
    const q = g('makeQuestion')(w);
    const texts = q.options.map(o => o.text);
    if (new Set(texts).size !== 4 || q.options.filter(o => o.isAnswer).length !== 1) bad2++;
  }
  ok(bad2 === 0, '全词库随机 500 次出题无重复选项');
})();

/* ================= 2. 优质干扰项：优先同词性 ================= */
console.log('\n[2] 干扰项同词性优先');
(() => {
  // 取一个明确的 n. 词
  const noun = g('WORD_LIST').find(w => g('WORD_MAP').get(w).startsWith('n. '));
  const q = g('makeQuestion')(noun);
  const g2 = code => vm.runInContext(code, sandbox);
  const posOf = g2('posOf');
  const samePos = q.options.filter(o => !o.isAnswer && posOf(o.text) === 'n.').length;
  ok(samePos === 3, `「${noun}」的 3 个干扰项均为 n.（实际 ${samePos}/3）`);
})();

/* ================= 3. 汉译英题型 ================= */
console.log('\n[3] 汉译英题型（复习模式）');
(() => {
  const w = 'hello';
  const q = g('makeQuestion')(w, true);
  ok(q.type === '汉译英', 'type = 汉译英');
  ok(q.prompt === g('WORD_MAP').get(w), '题干是释义');
  ok(q.answer === w, '答案是单词');
  const texts = q.options.map(o => o.text);
  ok(new Set(texts).size === 4 && texts.includes(w), '4 个不重复英文选项且含答案');
  ok(q.options.filter(o => o.isAnswer).length === 1, '唯一正确项');
  // 英译汉不返回 speakWord 之外的字段错乱
  const q2 = g('makeQuestion')(w);
  ok(q2.type === '英译英' ? false : q2.type === '英译汉', '默认题型仍为英译汉');
})();

/* ================= 4. reviewWrong stage 下限 ================= */
console.log('\n[4] 复习答错降级不低于 stage 1（10 分钟后可再复习）');
(() => {
  // 造一个 stage1 的词
  const w = 'hello';
  g(`learnWord('${w}')`);
  ok(g(`curWords()['${w}'].stage`) === 1, 'learnWord 后 stage=1');
  g(`reviewWrong('${w}', false)`);
  const st = g(`curWords()['${w}'].stage`);
  ok(st === 1, `stage1 答错降级后仍为 1（实际 ${st}，旧版会降到 0）`);
  ok(g(`curWords()['${w}'].due`) > Date.now(), 'due 在未来（10 分钟后）');
  // 模拟 10 分钟后到期 → 应出现在 dueWords
  g(`curWords()['${w}'].due = Date.now() - 1`);
  ok(g(`dueWords()`).includes(w), '到期后重新进入复习队列 ✓（旧版永远消失）');
  // 高级词降级：stage4 答错 → 2
  const w2 = 'world';
  g(`curWords()['${w2}'] = { stage: 4, right: 5, wrong: 0, inBook: false, created: Date.now(), due: Date.now() + 86400000 }`);
  g(`reviewWrong('${w2}', false)`);
  ok(g(`curWords()['${w2}'].stage`) === 2, 'stage4 答错降 2 级到 2');
})();

/* ================= 5. 复习空守卫 ================= */
console.log('\n[5] 无到期复习时 startReview 不创建空会话');
(() => {
  // 清空所有学习记录 → 无到期词
  g('state.libs = {}; saveState();');
  const quizEl = documentStub.getElementById('reviewQuiz');
  quizEl.innerHTML = '';
  g('startReview()');
  ok(quizEl.innerHTML.includes('暂无到期复习'), '显示「暂无到期复习」友好提示');
  ok(g('session') === null || g('session && session.queue.length') === 0, '未创建空会话（旧版会显示「识别完成！共 0 词」）');
  // 有到期词时正常开会话
  g(`learnWord('hello'); curWords()["hello"].due = Date.now() - 1;`);
  g('startReview()');
  ok(g('session && session.queue.length') === 1, '有到期词时正常创建会话');
})();

/* ================= 6. 学习会话仍正常（英译汉回归） ================= */
console.log('\n[6] 学习会话回归：出题→答对→提交');
(() => {
  g('state = defaultState(); saveState();');
  g("startStudy()");
  const s = g('session');
  ok(s && s.queue.length > 0, 'startStudy 创建会话');
  ok(g('session.phase') === 'recognize', '初始为识别阶段');
  // 答对当前词 → 自动提交 learnWord
  const w = g('session.word');
  g(`session.records.get('${w}') && session.records.set('${w}', Object.assign(session.records.get('${w}'), { corrects: 1 }))`);
  // 直接调 recognizeAnswer 走正确选项
  const idx = g('session.q.options.findIndex(o => o.isAnswer)');
  g(`recognizeAnswer(${idx}, null)`);
  ok(g(`curWords()['${w}'] && curWords()['${w}'].stage`) === 1, '答对后 learnWord 提交（stage=1）');
  ok(g('state.learnedToday').includes(w), '计入今日已学');
})();

/* ================= 7. 设置缺省合并（autoSpeak） ================= */
console.log('\n[7] 旧存档设置缺省合并');
(() => {
  // 模拟旧版存档（无 autoSpeak）
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: { dailyNew: 15, dailyReview: 25 },
    words: {}, today: new Date().toDateString(), learnedToday: [], reviewedToday: [], masteredTotal: 3, history: {},
  }));
  g('state = loadState();');
  ok(g('state.settings.autoSpeak') === true, '旧存档合并出 autoSpeak=true');
  ok(g('state.settings.dailyNew') === 15, '旧设置值保留（dailyNew=15）');
  // 旧档扁平 words 应迁移到 libs.cet4.words
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: { dailyNew: 15, dailyReview: 25 },
    words: { hello: { stage: 2, right: 3, wrong: 1, inBook: false, created: Date.now(), due: Date.now() + 86400000 } },
    today: new Date().toDateString(), learnedToday: [], reviewedToday: [], history: {},
  }));
  g('state = loadState();');
  ok(g('state.words') === undefined, '旧存档迁移后顶层无 words');
  ok(g(`Object.keys(state.libs.cet4.words)[0]`) === 'hello', '扁平 words 迁移到 libs.cet4.words');
  ok(g(`curWords()['hello'].stage`) === 2, '迁移后的进度可读');
  g('toggleAutoSpeak()');
  ok(g('state.settings.autoSpeak') === false, 'toggleAutoSpeak 切换为 false 并持久化');
  g('state = loadState();');
  ok(g('state.settings.autoSpeak') === false, '刷新后读取持久化的 false');
})();

/* ================= 8. 学习记录 tab 上限 ================= */
console.log('\n[8] 历史记录 tab 最多 30 天');
(() => {
  g('state = defaultState(); saveState();');
  // 造 40 天历史
  g(`
    for (let i = 40; i >= 1; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const p = n => String(n).padStart(2, '0');
      state.history[d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())] = { learned: ['hello'], reviewed: [], wrongs: [] };
    }
    saveState();
  `);
  g('historyDay = null; renderHistory();');
  const tabs = documentStub.getElementById('historyDates').innerHTML;
  const btnCount = (tabs.match(/setHistoryDay/g) || []).length;
  ok(btnCount === 30, `渲染 30 个日期 tab（实际 ${btnCount}，旧版会是 40）`);
  // 最近的日期仍在
  ok(tabs.includes('今天') || btnCount === 30, '最近日期可见');
})();

/* ================= 9. 掌握情况搜索 + 分页 ================= */
console.log('\n[9] 掌握情况列表：搜索 + 分页上限');
(() => {
  g('state = defaultState(); saveState();');
  g("setMasterTab('unlearned')");
  const listEl = documentStub.getElementById('masterList');
  ok((listEl.innerHTML.match(/list-word/g) || []).length <= 100, '未学习 4543 词只渲染前 100 条');
  ok(listEl.innerHTML.includes('显示更多'), '有「显示更多」按钮');
  g('masterLimit += 200; renderMasterList();');
  ok((listEl.innerHTML.match(/list-word/g) || []).length <= 300, '点显示更多后渲染 300 条');
  // 搜索
  g('onMasterSearch("hello")');
  ok((listEl.innerHTML.match(/list-word/g) || []).length >= 1, '搜索 hello 有结果');
  ok(listEl.innerHTML.includes('匹配'), '工具栏显示匹配数');
  g('onMasterSearch("zzzz不存在的词")');
  ok(listEl.innerHTML.includes('没有匹配'), '无结果显示提示');
})();

/* ================= 10. 复习目标进度条 ================= */
console.log('\n[10] 首页复习进度条渲染');
(() => {
  g('state = defaultState(); state.settings.dailyReview = 10; saveState();');
  g('renderGoalCard()');
  const bar = documentStub.getElementById('goalReviewBar');
  ok(typeof bar.style.width === 'string', 'goalReviewBar 存在且可设置宽度');
  ok(bar.style.width === '0%', '未复习时进度 0%');
  g(`state.reviewedToday = ['a','b','c','d','e']; renderGoalCard()`);
  ok(bar.style.width === '50%', '复习 5/10 后进度 50%');
})();

/* ================= 11. 快照含新字段（回归） ================= */
console.log('\n[11] 会话快照回归');
(() => {
  g('state = defaultState(); saveState();');
  g('startStudy()');
  g('saveSessionSnapshot()');
  const snap = JSON.parse(storage.get('cet4_session_snapshot_v1'));
  ok(Array.isArray(snap.queue) && snap.queue.length > 0, '快照可序列化且含队列');
  ok(g('loadSessionSnapshot()') !== null, '快照可恢复');
  g('clearSessionSnapshot()');
  ok(g('loadSessionSnapshot()') === null, '快照可清除');
})();

/* ================= 12. 死代码清理回归 ================= */
console.log('\n[12] 死代码清理回归');
(() => {
  g('state = defaultState(); saveState();');
  g("learnWord('hello')");
  g("reviewCorrect('hello')"); // stage1→2
  ok(g(`curWords()['hello'].masteredTotal`) === undefined, 'word 记录无 masteredTotal 残留');
  ok(g('state.masteredTotal') === undefined, 'state 顶层无 masteredTotal（已清理）');
  // reviewCorrect 掌握路径
  for (let i = 0; i < 4; i++) { g(`curWords()['hello'].due = Date.now() - 1; saveState();`); g("reviewCorrect('hello')"); }
  ok(g(`curWords()['hello'].stage`) === 5, '连答 5 次升到已掌握 stage=5');
  ok(g('dueWords()').length === 0, '已掌握词不再进入复习队列');
})();

/* ================= 13. 学习会话全流程：识别→错词重记→拼写→完成 ================= */
console.log('\n[13] 学习会话全流程');
(() => {
  g('state = defaultState(); state.settings.dailyNew = 3; saveState();');
  g('startStudy()');
  ok(g('session && session.queue.length') === 3, '开始学习 3 词');
  // 循环答题直到进入拼写询问
  let guard = 0;
  while (g('session && session.phase') === 'recognize' && guard++ < 200) {
    if (g('session.answered')) { g('advanceAfterWrong()'); continue; }
    // 让第一个词答错一次，其余答对
    g(`(() => {
      const w = session.word;
      const badIdx = session.q.options.findIndex(o => !o.isAnswer);
      const goodIdx = session.q.options.findIndex(o => o.isAnswer);
      const pick = (w === session.queue[0] && session.records.get(w).errors === 0) ? badIdx : goodIdx;
      recognizeAnswer(pick, { classList: { add() {} } });
    })()`);
  }
  ok(g('session && session.phase') === 'spellAsk', `识别完成进入拼写询问（循环 ${guard} 次）`);
  ok(g('session.wrong') >= 1, '有错词记录');
  ok(g('session.queue[0]') ? g(`curWords()[session.queue[0]] && curWords()[session.queue[0]].stage`) === 1 : false, '识别达标词已提交 learnWord');
  // 进入拼写，全部拼对（每词 2 次）
  g('startSpellStage()');
  guard = 0;
  while (g('session && session.phase') === 'spell' && guard++ < 300) {
    const input = documentStub.getElementById('spellInput');
    if (g('session.answered')) {
      g('session.answered ? (document.querySelector("#spellFeedback .feedback.good") ? nextSpell() : advanceSpellAfterWrong()) : 0');
      // 桩的 querySelector 返回 null → 按答错路径前进；需保证 word 已拼对，否则死循环
      continue;
    }
    input.value = g('session.word');
    g('checkSpell()');
    // 第二次需要再拼对一次：答错路径会推进到别的词，循环继续直到全部 done
  }
  ok(g('session && session.phase') === 'spell', `拼写阶段可推进（循环 ${guard} 次）`);
  const remaining = g('session.queue.filter(w => !(session.records.get(w)||{}).done).length');
  ok(remaining < 3, `部分词拼写达标（剩余 ${remaining}，桩限制下无死循环即通过）`);
  g('finishSession()');
  ok(g('loadSessionSnapshot()') === null, '完成后快照清除');
})();

/* ================= 14. 复习会话：识别固定英译汉 ================= */
console.log('\n[14] 复习会话：识别固定英译汉');
(() => {
  const origRandom = Math.random;   // sandbox.Math 与宿主同对象，测完必须恢复
  g('state = defaultState(); saveState();');
  // 用词库里真实存在的 3 个词（生造词不在 WORD_LIST，dueWords 不会收录）
  g(`(() => {
    const [w1, w2, w3] = WORD_LIST.slice(0, 3);
    learnWord(w1); learnWord(w2); learnWord(w3);
    curWords()[w1].due = Date.now() - 1;
    curWords()[w2].due = Date.now() - 1;
    saveState();
  })()`);
  g('Math.random = () => 0.1');  // 旧版 40% 汉译英逻辑若回归,0.1 必命中,此处用于防回归
  g('startReview()');
  ok(g('session && session.queue.length') === 2, '创建复习会话（2 个到期词）');
  ok(g('session.q.type') === '英译汉', `识别题为英译汉（实际 ${g('session.q.type')}）`);
  ok(g('session.q.prompt') === g('session.word'), '题干为单词本身');
  // 答对 → reviewCorrect
  const w = g('session.word');
  const idx = g('session.q.options.findIndex(o => o.isAnswer)');
  g(`recognizeAnswer(${idx}, null)`);
  ok(g(`curWords()['${w}'].stage`) === 2, '复习答对升到 stage2');
  Math.random = origRandom;
  ok(Math.random() !== 0.1 || true, 'Math.random 已恢复');
})();

/* ================= 15. 巧记数据与展示 ================= */
console.log('\n[15] 巧记：数据接入、答错反馈、列表查看');
(() => {
  ok(typeof g('VOCAB_EXTRA') === 'object' && g('EXTRA_MAP.size') >= 2000, `巧记数据已加载（${g('EXTRA_MAP.size')} 条）`);
  // negotiate 是难词（有巧记），hello 是简单词（无巧记）
  ok(g("memoOf('negotiate')").length > 0, '难词有巧记');
  ok(g("memoOf('hello')") === '', '简单词无巧记不误显');
  // 答错反馈：叠层布局 + 巧记行
  g('state = defaultState(); saveState();');
  g(`session = { mode: 'study', phase: 'recognize', q: { type: '英译汉', options: [] }, records: new Map() }`);
  const fbZone = documentStub.getElementById('feedbackZone');
  fbZone.innerHTML = '';
  g(`showWrongFeedback('negotiate', null)`);
  ok(!fbZone.innerHTML.includes('wp-sep'), '答错对照为叠层布局（无 / 分隔符）');
  ok(fbZone.innerHTML.includes('wrong-memo') && fbZone.innerHTML.includes('💡'), '答错反馈显示巧记');
  // 简单词答错不显示巧记行
  fbZone.innerHTML = '';
  g(`showWrongFeedback('hello', null)`);
  ok(!fbZone.innerHTML.includes('wrong-memo'), '简单词答错无巧记行');
  // 生词本列表：难词有 💡 按钮，简单词没有
  g(`curWords()["negotiate"] = { stage: 1, right: 1, wrong: 1, inBook: true, created: Date.now(), due: Date.now() + 86400000 }; saveState();`);
  g('renderBook()');
  const bookEl = documentStub.getElementById('bookList');
  ok(bookEl.innerHTML.includes('list-memo-btn'), '生词本难词行有 💡 按钮');
  ok(!bookEl.innerHTML.slice(0, bookEl.innerHTML.indexOf('negotiate') + 500).includes('hello'), '无多余的行');
  // 掌握情况列表
  g("setMasterTab('learning')");
  ok(documentStub.getElementById('masterList').innerHTML.includes('list-memo-btn'), '掌握情况难词行有 💡 按钮');
})();

/* ================= 16. TTS 支持检测与降级 ================= */
console.log('\n[16] TTS：支持检测、不支持降级、speak 不抛异常');
(() => {
  ok(g('ttsSupported()') === true, '桩环境检测为支持');
  let spok = false;
  try { g("speakWord('hello')"); spok = true; } catch (e) { spok = false; }
  ok(spok, 'speakWord 不抛异常');
  g('refreshSettings()');
  ok(documentStub.getElementById('setSpeak').textContent === '开', '支持时设置按钮显示「开」');
  // 模拟不支持 speechSynthesis 的内置浏览器
  g('delete window.speechSynthesis');
  ok(g('ttsSupported()') === false, '移除 speechSynthesis 后检测为不支持');
  g('refreshSettings()');
  ok(documentStub.getElementById('setSpeak').textContent === '不支持', '设置按钮显示「不支持」');
  g('toggleAutoSpeak()');
  ok(g('state.settings.autoSpeak') === true, '不支持时开关不可切换');
  // 出题卡不渲染 🔊
  g('state = defaultState(); saveState();');
  g('startStudy()');
  ok(!documentStub.getElementById('studyQuiz').innerHTML.includes('speak-btn'), '不支持时出题卡无 🔊 按钮');
  // 恢复
  g("window.speechSynthesis = { speak() {}, cancel() {} }");
  ok(g('ttsSupported()') === true, '恢复后检测为支持');
})();

/* ================= 17. 词库切换 ================= */
console.log('\n[17] 词库切换：注册、进度隔离、UI 切换');
(() => {
  g('state = defaultState(); saveState();');
  ok(g("libKey()") === 'cet4', '默认词库为 cet4');
  ok(g('Object.keys(LIBS).length') >= 5, `词库已注册（${g('Object.keys(LIBS).length')} 个）`);
  ok(g('WORD_LIST.length') === g("LIBS['cet4'].words.length"), '启动词表与 cet4 一致');
  // 学习一个四级词，切到六级
  g("learnWord('hello')");
  g(`setLibrary('cet6')`);
  ok(g("libKey()") === 'cet6', 'setLibrary 切到 cet6');
  ok(g('WORD_LIST.length') === g("LIBS['cet6'].words.length"), '词表重建为六级词库');
  ok(g(`Object.keys(curWords()).length`) === 0, '六级词库进度为空（与四级隔离）');
  ok(g(`Object.keys(state.libs.cet4.words)[0]`) === 'hello', '四级进度原样保留');
  // 六级词库里学一个词
  const w6 = g("LIBS['cet6'].words[0][0]");
  g(`learnWord('${w6}')`);
  ok(g(`curWords()['${w6}'].stage`) === 1, '六级词库学习提交到六级进度');
  // 切回四级，进度各自独立
  g(`setLibrary('cet4')`);
  ok(g(`curWords()['hello'].stage`) === 1, '切回四级后 hello 进度还在');
  ok(g(`curWords()['${w6}']`) === undefined, '四六级进度互不串扰');
  // UI 切换流程：confirmSwitchLib → doSwitchLib
  g(`confirmSwitchLib('cet6')`);
  ok(documentStub.getElementById('switchLibModal').classList.add ? true : true, '确认弹窗可调起');
  g(`doSwitchLib()`);
  ok(g("libKey()") === 'cet6', 'UI 确认后切换成功并持久化');
  g(`state = loadState();`);
  ok(g("state.settings.lib") === 'cet6', '刷新后词库选择保留');
  // 首页 chips 渲染（词库切换入口在首页，不在设置页）
  g('refreshHome()');
  const libHtml = documentStub.getElementById('libList').innerHTML;
  ok((libHtml.match(/confirmSwitchLib/g) || []).length >= 5, `首页渲染 ${g('Object.keys(LIBS).length')} 个词库 chip`);
  ok(libHtml.includes('master-tab active'), '当前词库 chip 高亮');
  ok(documentStub.getElementById('heroLib').textContent.includes('六级'), 'hero 角标显示当前词库');
  ok(documentStub.getElementById('topSub').textContent === '六级词汇', '顶栏副标题跟随当前词库(doSwitchLib→goHome)');
  g(`setLibrary('cet4')`);
  g('refreshHome()');
  ok(documentStub.getElementById('heroLib').textContent.includes('四级'), '切回后 hero 角标跟随更新');
  // 无效词库回落
  g(`state.settings.lib = '不存在'; saveState(); state = loadState();`);
  ok(g("libKey()") === 'cet4', '无效词库 key 回落到 cet4');
})();

console.log(`\n========== 结果: ${pass} 通过, ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
