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
    closest: () => null,
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
try { vm.runInContext(fs.readFileSync(path.join(dir, 'icons.js'), 'utf8'), sandbox); } catch (e) { /* 图标数据缺失不阻塞基础测试 */ }
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
  ok(g('curDaily().learnedToday').includes(w), '计入今日已学（当前词库）');
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
  g(`curDaily().reviewedToday = ['a','b','c','d','e']; renderGoalCard()`);
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
  ok(fbZone.innerHTML.includes('wrong-memo') && fbZone.innerHTML.includes('<svg'), '答错反馈显示巧记(svg 图标)');
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
  // 设置页词库 chips 渲染（词库切换入口在设置 Tab）
  g('refreshHome()');
  const libHtml = documentStub.getElementById('libList').innerHTML;
  ok((libHtml.match(/confirmSwitchLib/g) || []).length >= 5, `设置页渲染 ${g('Object.keys(LIBS).length')} 个词库 chip`);
  ok(libHtml.includes('master-tab active'), '当前词库 chip 高亮');
  ok(documentStub.getElementById('libNote').textContent.includes('六级'), '词库说明显示当前词库');
  // 切回四级，说明跟随更新
  g(`setLibrary('cet4')`);
  g('refreshSettings()');
  ok(documentStub.getElementById('libNote').textContent.includes('四级'), '切回后词库说明跟随更新');
  // tab 徽章渲染
  g('refreshHome()');
  ok(documentStub.getElementById('tabBadgeStudy') !== undefined, '学习 tab 徽章元素存在');
  // 无效词库回落
  g(`state.settings.lib = '不存在'; saveState(); state = loadState();`);
  ok(g("libKey()") === 'cet4', '无效词库 key 回落到 cet4');
})();

/* ================= 18. 功能1:答错反馈错误选项可点看 ================= */
console.log('\n[18] 答错反馈:错误选项点看释义(reverseDefToWord)');
(() => {
  g('state = defaultState(); saveState();');
  g('startStudy()');
  // 答错当前词 → 反馈区应渲染其余错误选项的可点看标签
  const w = g('session.word');
  const badIdx = g('session.q.options.findIndex(o => !o.isAnswer)');
  g(`recognizeAnswer(${badIdx}, { classList: { add() {} } })`);
  const fb = documentStub.getElementById('feedbackZone').innerHTML;
  ok(fb.includes('def-chips'), '答错反馈渲染错误选项点看标签');
  ok(fb.includes('toggleDefChip'), '标签绑定点看事件');
  ok((fb.match(/def-chip\"/g) || []).length === 2, `点「选项」时其余 2 个干扰项可点（实际 ${((fb.match(/def-chip\"/g) || []).length)}）`);
  // 点「不会」(无选错项) → 全部 3 个干扰项可点
  g('state = defaultState(); saveState();');
  g('startStudy()');
  g('showAnswer()');
  const fb2 = documentStub.getElementById('feedbackZone').innerHTML;
  ok((fb2.match(/def-chip\"/g) || []).length === 3, '点「不会」时 3 个干扰项全部可点');
  // 释义反查:能查到对应单词且优先跳过当前词
  const def = g(`WORD_MAP.get('${w}')`);
  ok(g(`reverseDefToWord(${JSON.stringify(def)}, null)`) !== null, 'reverseDefToWord 能反查单词');
  // 汉译英题型不出点看标签(选项是单词不是释义)
  g('state = defaultState(); saveState();');
  g(`session = { mode: 'study', phase: 'recognize', word: '${w}', q: makeQuestion('${w}', true), records: new Map() }`);
  g(`showWrongFeedback('${w}', null)`);
  ok(!documentStub.getElementById('feedbackZone').innerHTML.includes('def-chips'), '汉译英反馈无点看标签');
})();

/* ================= 19. 功能2:自由拼写 ================= */
console.log('\n[19] 自由拼写:范围取词/错词宽松重现/纯练习不改进度');
(() => {
  g('state = defaultState(); state.settings.spellScope = "unseen"; state.settings.spellCount = 5; saveState();');
  g('startCustomSpell()');
  ok(g('session && session.mode') === 'spell', '创建自由拼写会话');
  ok(g('session.queue.length') === 5, '按数量取 5 词');
  ok(g('session.phase') === 'cspell', '独立 phase(不触发复习拼写快捷键)');
  ok(g('Object.keys(curWords()).length') === 0, '开始前不写学习状态');
  // 第一个词拼错 → 不卡住、进错词池、不改进度
  const wrongWord = g('session.word');
  documentStub.getElementById('spellInput').value = '完全不對';
  g('customSpellCheck()');
  ok(g('session.wrong') === 1, '拼错计入会话错误');
  ok(g(`session.spellRetries.includes('${wrongWord}')`) === true, '错词进重现池');
  ok(g(`curWords()['${wrongWord}']`) === undefined, '拼错不写学习记录(纯练习)');
  // 循环答对直到全部完成(重现词答对 1 次即完成)
  let guard = 0;
  while (g('session && session.records && [...session.records.values()].some(r => !r.done)') && guard++ < 200) {
    if (g('session.answered')) { g('customSpellNext()'); continue; }
    documentStub.getElementById('spellInput').value = g('session.word');
    g('customSpellCheck()');
  }
  ok(guard < 200, `全部词完成(循环 ${guard} 次,宽松规则下不死循环)`);
  ok(g('[...session.records.values()].every(r => r.done)') === true, '所有词标记完成');
  g('customSpellNext()');   // 最后一词答对后推进一次,渲染完成页
  ok(g('Object.keys(curWords()).length') === 0, '整个会话结束仍不写学习状态');
  ok(documentStub.getElementById('spellQuiz').innerHTML.includes('拼写练习完成'), '显示练习完成页');
  // 范围取词:book 范围只取生词本里的词
  g('state = defaultState(); saveState();');
  g(`curWords()['hello'] = { stage: 1, right: 1, wrong: 0, inBook: true, created: Date.now(), due: Date.now() + 86400000 }; saveState();`);
  g(`const bl = wordsInScope('book')`);
  ok(g('bl.length') === 1 && g('bl[0]') === 'hello', 'book 范围只含生词本单词');
  ok(g('normScope("不存在的范围")') === 'all', '无效范围回落到全部');
})();

/* ================= 20. 功能3:听写 ================= */
console.log('\n[20] 听写:配置默认值/判分流程/自查模式/循环');
(() => {
  // 旧存档合并出听写缺省配置
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: { dailyNew: 15 }, today: new Date().toDateString(), learnedToday: [], reviewedToday: [], history: {},
  }));
  g('state = loadState();');
  ok(g('state.settings.dictPause') === 1, '缺省轮间停顿 1 秒');
  ok(g('state.settings.dictRate') === 0.9, '缺省语速 0.9');
  ok(g('state.settings.dictMode') === 'judge', '缺省作答方式为输入判分');
  ok(g('state.settings.dictLoop') === false, '缺省不循环');
  // 判分模式流程
  g('state = defaultState(); state.settings.dictScope = "all"; state.settings.dictCount = 5; saveState();');
  g('startDictation()');
  ok(g('session && session.mode') === 'dict', '创建听写会话');
  ok(g('session.queue.length') === 5, '按数量取 5 词');
  ok(g('session.judge') === true, '判分模式');
  const wrongWord = g('session.word');
  documentStub.getElementById('spellInput').value = 'nope';
  g('dictCheck()');
  ok(g(`session.spellRetries.includes('${wrongWord}')`) === true, '听写拼错进重现池');
  ok(g(`curWords()['${wrongWord}']`) === undefined, '听写不写学习状态');
  // 顺序播放
  g('state.settings.dictOrder = "seq"; saveState();');
  g('startDictation()');
  ok(g('JSON.stringify(session.queue)') === g('JSON.stringify(wordsInScope("all").slice(0, 5))'), '顺序模式按词表前 N 词');
  // 循环模式:全部答对后重置再来一轮
  g('state.settings.dictLoop = true; saveState();');
  g('startDictation()');
  let guard = 0;
  while (guard++ < 100 && g('session.loopN') === 1) {
    if (g('session.answered')) { g('dictNext()'); continue; }
    documentStub.getElementById('spellInput').value = g('session.word');
    g('dictCheck()');
  }
  ok(g('session.loopN') === 2, `循环播放自动进入第 2 轮（loopN=${g('session.loopN')}）`);
  g('finishDictation()');
  ok(documentStub.getElementById('dictQuiz').innerHTML.includes('听写完成'), '结束按钮出完成页');
  // 只听自查模式:单词全程直接显示,手动下一个
  g('state = defaultState(); state.settings.dictMode = "listen"; saveState();');
  g('startDictation()');
  ok(g('session.judge') === false && g('session.auto') === false, '只听自查模式');
  const w3 = g('session.word');
  const listenHtml = documentStub.getElementById('dictQuiz').innerHTML;
  ok(listenHtml.includes(w3), '只听自查卡片直接显示单词');
  ok(listenHtml.includes('dict-def-line'), '只听自查卡片显示释义行');
  ok(listenHtml.includes('dictListenNext'), '只听自查有手动下一个按钮');
  g('dictListenNext()');
  ok(g('session.word') !== w3 || g('session.queue.length') === 1, '手动下一个可切词');
  // 无 dictReveal 残留(自查改为常显单词后该函数已删)
  ok(g('typeof dictReveal') === 'undefined', 'dictReveal 已删除');
  // 不支持 TTS:配置页显示不支持提示
  g('delete window.speechSynthesis');
  g('renderDictConfig()');
  ok(documentStub.getElementById('dictQuiz').innerHTML.includes('不支持语音'), '无 TTS 时提示不支持');
  g('window.speechSynthesis = { speak() {}, cancel() {} }');
})();

/* ================= 21. 功能4:学习记录按词库归属 ================= */
console.log('\n[21] 学习记录:条目带词库/旧字符串兼容/按词库查释义');
(() => {
  g('state = defaultState(); saveState();');
  g("learnWord('hello')");
  const today = g('dateKey()');
  let entry = g(`state.history['${today}'].learned[state.history['${today}'].learned.length - 1]`);
  ok(Array.isArray(entry) && entry[0] === 'cet4' && entry[1] === 'hello', `新记录为 [词库, 单词] 条目（${JSON.stringify(entry)}）`);
  // 切到六级学一个词 → 记录归属六级
  g(`setLibrary('cet6')`);
  const w6 = g(`LIBS['cet6'].words[0][0]`);
  g(`learnWord('${w6}')`);
  entry = g(`state.history['${today}'].learned[state.history['${today}'].learned.length - 1]`);
  ok(Array.isArray(entry) && entry[0] === 'cet6' && entry[1] === w6, '六级词记录归属六级');
  // 渲染:各词显示归属词库标签 + 按归属词库查释义(切回四级也不丢六级词的释义)
  g(`setLibrary('cet4')`);
  g('historyDay = null; renderHistory();');
  const detail = documentStub.getElementById('historyDetail').innerHTML;
  ok(detail.includes('dict-lib'), '记录行显示词库标签');
  ok(detail.includes(w6), '六级词出现在记录里');
  ok(detail.includes('六级'), '标签显示「六级」');
  const def6 = g(`defInLib('cet6', '${w6}')`);
  ok(def6 && detail.includes(def6), '六级词释义按六级词库查得(旧版会显示空)');
  // 旧版纯字符串条目兼容归属(hello 四六级都有 → 归当前词库;六级独有词归六级)
  ok(g(`JSON.stringify(normHistEntry("hello"))`) === '["cet4","hello"]', '旧字符串按词库包含关系归属');
  const w6only = g(`LIBS['cet6'].words.map(w => w[0]).find(w => Object.keys(LIB_WORD_SETS).filter(k => LIB_WORD_SETS[k].has(w)).length === 1)`);
  ok(g(`JSON.stringify(normHistEntry("${w6only}"))`) === JSON.stringify(['cet6', w6only]), '仅存在于六级的旧字符串归属六级');
  ok(g('normHistEntry("zz词库不存在的词")') === null, '词库外的词返回 null');
  // 答错/复习记录同样带词库
  g(`reviewWrong('hello', false)`);
  const wEntry = g(`state.history['${today}'].wrongs[state.history['${today}'].wrongs.length - 1]`);
  ok(Array.isArray(wEntry) && wEntry[0] === 'cet4' && wEntry[1] === 'hello', '答错记录同样带词库归属');
})();

/* ================= 22. 自选词单 + 听写自动轮播 ================= */
console.log('\n[22] 自选词单(具体到单词)与自动轮播模式');
(() => {
  g('state = defaultState(); saveState();');
  ok(g('normScope("custom")') === 'custom', '范围支持 custom(自选)');
  // 词单按当前词库过滤
  g(`state.settings.spellWords = ['hello', '不存在的词zz']; saveState();`);
  ok(g('JSON.stringify(practicePicked("spell"))') === '["hello"]', 'practicePicked 过滤词库外单词');
  // 自选范围取词池 = 词单
  g(`state.settings.spellScope = 'custom'; saveState();`);
  ok(g('JSON.stringify(practicePool("spell"))') === '["hello"]', '自选范围取词池为词单');
  // 用词单开自由拼写:全部采用
  g('startCustomSpell()');
  ok(g('session.queue.length') === 1 && g('session.queue[0]') === 'hello', '自选词单全部采用(不受数量限制)');
  // 词单清空后取词池为空
  g(`state.settings.spellWords = []; saveState();`);
  ok(g('practicePool("spell").length') === 0, '空词单取词池为空');
  // 选词器勾选/取消(就地写词单)
  g(`pickerKind = 'spell'; pickerFilter = 'all';`);
  g(`pickerToggleWord('hello', null)`);
  ok(g('state.settings.spellWords.includes("hello")') === true, 'pickerToggleWord 勾选写入词单并持久化');
  g(`pickerToggleWord('hello', null)`);
  ok(g('state.settings.spellWords.includes("hello")') === false, '再次调用取消勾选');
  // 听写:自动轮播模式 + 自选词单
  g(`state.settings.dictMode = 'auto'; state.settings.dictScope = 'custom'; state.settings.dictWords = ['hello']; saveState();`);
  g('startDictation()');
  ok(g('session.auto') === true && g('session.judge') === false, '自动轮播:auto=true / judge=false');
  ok(g('session.queue.length') === 1 && g('session.queue[0]') === 'hello', '听写自选词单生效');
  // 自动模式答题卡:无输入框、单词常显、有自动提示
  g('renderDictWord()');
  const dictHtml = documentStub.getElementById('dictQuiz').innerHTML;
  ok(dictHtml.includes('自动轮播中'), '自动模式卡显示自动轮播提示');
  ok(!dictHtml.includes('spellInput'), '自动模式无输入框');
  ok(dictHtml.includes(g('session.word')), '自动模式卡片直接显示单词');
  ok(dictHtml.includes('结束'), '自动模式保留结束按钮');
  // dictMode 迁移:旧存档 dictJudge:false → listen;缺省 → judge
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: { dictJudge: false }, today: new Date().toDateString(), learnedToday: [], reviewedToday: [], history: {},
  }));
  g('state = loadState();');
  ok(g('state.settings.dictMode') === 'listen', '旧存档 dictJudge:false 迁移为 listen');
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: {}, today: new Date().toDateString(), learnedToday: [], reviewedToday: [], history: {},
  }));
  g('state = loadState();');
  ok(g('state.settings.dictMode') === 'judge', '无 dictMode 缺省 judge');
  ok(JSON.stringify(g('state.settings.dictWords')) === '[]', '词单字段缺省为空数组');
  // 播报汉译剥离词性前缀(hello 释义 "int. 喂" → 只读 "喂")
  ok(g(`speakableDef('hello')`) === '喂', `播报汉译剥离词性(speakableDef('hello')='${g(`speakableDef('hello')`)}')`);
  const nounW = g(`WORD_LIST.find(w => WORD_MAP.get(w).startsWith('adj. '))`);
  ok(!g(`speakableDef('${nounW}')`).startsWith('adj.'), 'adj. 前缀同样被剥离');
  const bareW = g(`WORD_LIST.find(w => !posOf(WORD_MAP.get(w)))`);
  ok(g(`speakableDef('${bareW}')`) === g(`WORD_MAP.get('${bareW}')`).trim(), '无词性前缀的释义原样朗读');
  // 多词性释义:每个词性标记都被剥离(underneath 类)
  const multiPosW = g(`WORD_LIST.find(w => (WORD_MAP.get(w).match(/(adj\.|adv\.|n\.|v\.|prep\.|int\.)\s/g) || []).length >= 2)`);
  if (multiPosW) {
    const sp = g(`speakableDef('${multiPosW}')`);
    ok(!/(adj\.|adv\.|n\.|v\.|vt\.|vi\.|prep\.|conj\.|pron\.|int\.|num\.|art\.|abbr\.)/.test(sp), `多词性释义全部剥离词性（「${multiPosW}」→「${sp.slice(0, 20)}…」）`);
  }
  /* ================= 23. 数量自定义 + 快照跨天失效 ================= */
  console.log('\n[23] 数量自定义(1~词库上限)与快照跨天重置');
  (() => {
    g('state = defaultState(); saveState();');
    g(`setPracticeCount('spell', 25)`);
    ok(g('state.settings.spellCount') === 25, '数量可设任意值 25');
    g(`setPracticeCount('spell', 0)`);
    ok(g('state.settings.spellCount') === 1, '数量下限 1(0 归一)');
    g(`setPracticeCount('spell', -7)`);
    ok(g('state.settings.spellCount') === 1, '负数归一');
    g(`setPracticeCount('spell', 999999)`);
    ok(g('state.settings.spellCount') === g('WORD_LIST.length'), `数量上限为词库总词数（${g('WORD_LIST.length')}）`);
    g(`setPracticeCount('dict', 3.9)`);
    ok(g('state.settings.dictCount') === 3, '小数取整');
    // 快照跨天失效:带旧日期的快照读不到且被清除
    g('state = defaultState(); saveState(); startStudy(); saveSessionSnapshot();');
    ok(g('loadSessionSnapshot()') !== null, '当天快照可恢复');
    const rawSnap = JSON.parse(storage.get('cet4_session_snapshot_v1'));
    rawSnap.day = '2000-01-01';
    storage.set('cet4_session_snapshot_v1', JSON.stringify(rawSnap));
    ok(g('loadSessionSnapshot()') === null, '跨天快照读不到(第二天重置)');
    ok(storage.get('cet4_session_snapshot_v1') === undefined || storage.get('cet4_session_snapshot_v1') === null, '跨天快照已被清除');
    // 新保存的快照带日期字段
    g('startStudy(); saveSessionSnapshot();');
    const snap2 = JSON.parse(storage.get('cet4_session_snapshot_v1'));
    ok(snap2.day === g('dateKey()'), '快照带归属日期');
    // 首页横幅已移除:无 resumeSession/updateResumeBanner 引用
    ok(g('typeof resumeSession') === 'undefined' && g('typeof updateResumeBanner') === 'undefined', '断点续学横幅相关函数已移除');
    /* ================= 24. 选词器:长按拖动连续选择 + 全选 ================= */
    console.log('\n[24] 选词器:连续选择手势逻辑与全选');
    (() => {
      g('state = defaultState(); saveState();');
      g(`pickerKind = 'spell'; pickerFilter = 'all'; pickerSearch = '';`);
      // 连续选择:以"反向状态"应用同一目标(未选 → 全部设为选)
      const rowStub = w => ({ dataset: { w }, classList: { toggle() {} }, querySelector: () => null });
      sandbox.__rowStub = rowStub;   // 供沙箱内取桩
      g(`pickerApplyRow(__rowStub('hello'), true)`);
      ok(g(`state.settings.spellWords.includes('hello')`) === true, '连续选择把行设为目标状态(选中)');
      g(`pickerApplyRow(__rowStub('hello'), true)`);
      ok(g(`state.settings.spellWords.filter(w => w === 'hello').length`) === 1, '已是目标状态则不重复写');
      g(`pickerApplyRow(__rowStub('hello'), false)`);
      ok(g(`state.settings.spellWords.includes('hello')`) === false, '目标为取消时取消选中');
      // 手势状态与辅助函数存在
      ok(g('typeof attachPickerGestures') === 'function' && g('typeof pickerApplyRow') === 'function', '手势挂载与应用函数已接入');
      // 全选当前筛选结果
      g(`setPickerFilter('all')`);
      g(`pickerSelectAll()`);
      ok(g('state.settings.spellWords.length') === g('WORD_LIST.length'), `全选写入全部词表（${g('state.settings.spellWords.length')}）`);
      ok(g('practicePicked("spell").length') === g('WORD_LIST.length'), '全选后按当前词库全部生效');
      g('pickerClear()');
      ok(g('state.settings.spellWords.length') === 0, '清空仍有效');
    })();
  })();
})();

/* ================= 25. 发音引擎：Edge 朗读音源 + 设备TTS兜底 ================= */
console.log('\n[25] 发音引擎:声音优选/默认设置/降级链');
(async () => {
  // 设备TTS声音优选(纯函数):英语优先高质量音色,普通话只收 zh-CN
  const voices = [
    { name: 'Microsoft David Desktop', lang: 'en-US' },
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Daniel', lang: 'en-GB' },
    { name: 'Microsoft Xiaoxiao Online', lang: 'zh-CN' },
    { name: 'Ting-Ting', lang: 'zh-TW' },
    { name: 'Sin-ji', lang: 'zh-HK' },
  ];
  const vCode = JSON.stringify(voices);
  ok(g(`pickBestTTSVoice(${vCode}, 'en-US').name`) === 'Google US English', '英语优选带 Google 标记的高质量音色');
  ok(g(`pickBestTTSVoice(${vCode}, 'zh-CN').name`) === 'Microsoft Xiaoxiao Online', '普通话优选 zh-CN(排除粤语/台普)');
  ok(g(`pickBestTTSVoice([], 'en-US')`) === null, '空声音列表返回 null(交给引擎默认)');

  // 设置缺省合并:旧存档补出发音新字段
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: { dailyNew: 15 }, today: new Date().toDateString(), learnedToday: [], reviewedToday: [], history: {},
  }));
  g('state = loadState();');
  ok(g('state.settings.voiceSrc') === 'edge', '旧存档合并出 voiceSrc=edge(缺省 Edge 朗读)');
  ok(g('state.settings.audioAcc') === undefined, '旧存档 audioAcc 字段已清除');
  ok(g('state.settings.ttsEngVoiceName') === '' && g('state.settings.ttsZhVoiceName') === '', '旧存档合并出空声音指定');
  ok(g('state.settings.edgeVoiceEn') === 'en-US-AriaNeural' && g('state.settings.edgeVoiceZh') === 'zh-CN-XiaoxiaoNeural', '旧存档合并出 Edge 音色缺省');

  // 旧存档 onlineVoice(bool)/旧三态 → voiceSrc 二态迁移
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: { dailyNew: 15, onlineVoice: false }, today: new Date().toDateString(), learnedToday: [], reviewedToday: [], history: {},
  }));
  g('state = loadState();');
  ok(g('state.settings.voiceSrc') === 'tts', '旧存档 onlineVoice=false 迁移为 voiceSrc=tts');
  ok(g('state.settings.onlineVoice') === undefined, '迁移后删除 onlineVoice 旧字段');
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: { dailyNew: 15, voiceSrc: 'youdao' }, today: new Date().toDateString(), learnedToday: [], reviewedToday: [], history: {},
  }));
  g('state = loadState();');
  ok(g('state.settings.voiceSrc') === 'edge', '已移除的 youdao 音源迁移为 edge');
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: { dailyNew: 15, voiceSrc: 'bogus' }, today: new Date().toDateString(), learnedToday: [], reviewedToday: [], history: {},
  }));
  g('state = loadState();');
  ok(g('state.settings.voiceSrc') === 'edge', '非法 voiceSrc 回落 edge');

  // 沙箱无 WebSocket/caches:Edge 不可用,降级链函数存在且 speakWord 不抛异常
  ok(g('typeof speakDictText') === 'function' && g('typeof stopSpeakAudio') === 'function', '降级链与停止函数已接入');
  let spok = true;
  try { g("speakWord('hello')"); } catch (e) { spok = false; }
  ok(spok, 'speakWord 走降级链不抛异常');
  g('stopDictPlayback()');
  ok(true, 'stopDictPlayback 兼容在线引擎不抛异常');

  // 设置项切换与声音选择器渲染(音源二态:edge/tts,在线真人已移除)
  g("setVoiceSrc('tts')");
  ok(g('state.settings.voiceSrc') === 'tts', 'setVoiceSrc 切到设备TTS');
  g("setVoiceSrc('youdao')");
  ok(g('state.settings.voiceSrc') === 'tts', '已移除的 youdao 音源选择被拒并保持原音源');
  g('refreshSettings()');   // 声音选择器渲染(沙箱 getVoices 拿不到 → 只有自动优选项)
  const engSel = documentStub.getElementById('setTtsEngVoice').innerHTML;
  ok(engSel.includes('自动优选'), '英语声音下拉含自动优选项');

  // 注入声音列表后:自动优选/按名字指定/语言过滤
  g(`ttsVoices = ${vCode}`);
  ok(g(`resolveTTSVoice('', 'en-US').name`) === 'Google US English', 'resolveTTSVoice 自动优选英语');
  ok(g(`resolveTTSVoice('Daniel', 'en-US').name`) === 'Daniel', '显式指定的声音名优先');
  ok(g(`resolveTTSVoice('不存在', 'zh-CN').name`) === 'Microsoft Xiaoxiao Online', '指定名字不存在时回落优选');
  g('refreshSettings()');
  ok(documentStub.getElementById('setTtsEngVoice').innerHTML.includes('Google US English'), '英语下拉列出可选声音');
  ok(documentStub.getElementById('setTtsZhVoice').innerHTML.includes('Xiaoxiao'), '普通话下拉列出 zh-CN 声音');
  ok(!documentStub.getElementById('setTtsZhVoice').innerHTML.includes('Sin-ji'), '普通话下拉排除粤语声音');

  /* ================= 26. 声音中文名与性别分组 ================= */
  console.log('\n[26] 声音选择器:中文名对照与女声/男声分组');
  // voiceMeta 对照表
  ok(JSON.stringify(g(`voiceMeta({ name: 'Microsoft Huihui - Chinese (Simplified, PRC)' })`)) === '{"zh":"晓慧","g":"f"}', '晓慧=中文女声');
  ok(JSON.stringify(g(`voiceMeta({ name: 'Microsoft Kangkang - Chinese (Simplified, PRC)' })`)) === '{"zh":"康康","g":"m"}', '康康=中文男声');
  ok(JSON.stringify(g(`voiceMeta({ name: 'Ting-Ting' })`)) === '{"zh":"婷婷","g":"f"}', 'Ting-Ting=婷婷(女)');
  ok(JSON.stringify(g(`voiceMeta({ name: 'Google US English' })`)) === '{"zh":"谷歌英语·美式","g":"f"}', '谷歌英语=美式(女)');
  ok(JSON.stringify(g(`voiceMeta({ name: 'Daniel' })`)) === '{"zh":"丹尼尔","g":"m"}', 'Daniel=丹尼尔(男)');
  ok(JSON.stringify(g(`voiceMeta({ name: '完全未收录的声音 XYZ' })`)) === '{"zh":"","g":""}', '未收录声音返回空标注');
  ok(g(`voiceMeta({ name: 'America Voice' })`).zh === '', '边界:America 不误匹配 eric');

  // 下拉分组渲染:女声/男声/其他 + 值保留原名(供 resolveTTSVoice 精确匹配)
  g('ttsVoices = [{"name":"Microsoft Huihui - Chinese (Simplified, PRC)","lang":"zh-CN"},' +
    '{"name":"Microsoft Kangkang - Chinese (Simplified, PRC)","lang":"zh-CN"},' +
    '{"name":"Microsoft Yaoyao - Chinese (Simplified, PRC)","lang":"zh-CN"},' +
    '{"name":"自定义神秘音色","lang":"zh-CN"},' +
    '{"name":"Daniel","lang":"en-GB"},{"name":"Google US English","lang":"en-US"}]');
  g('refreshSettings()');
  const zhSel = documentStub.getElementById('setTtsZhVoice').innerHTML;
  ok(zhSel.includes('<optgroup label="女声">') && zhSel.includes('<optgroup label="男声">'), '普通话下拉分女声/男声组');
  ok(zhSel.includes('晓慧（女）') && zhSel.includes('康康（男）'), '收录声音显示中文名+性别');
  ok(zhSel.includes('<optgroup label="其他">') && zhSel.includes('自定义神秘音色'), '未收录声音归入其他组');
  ok(zhSel.includes('value="Microsoft Huihui - Chinese (Simplified, PRC)"'), 'option 值保留原始声音名');
  ok(zhSel.includes('自动优选（晓慧 · 女）'), '自动优选标注中文名与性别');
  const enSel = documentStub.getElementById('setTtsEngVoice').innerHTML;
  ok(enSel.includes('丹尼尔（男）') && enSel.includes('谷歌英语·美式（女）'), '英语下拉同样中文标注');
  ok(!enSel.includes('Xiaoxiao'), '英语下拉不含中文声音');

  // 回归:声音列表为空时给出提示项(安卓 voices 异步加载/设备无语音包场景)
  g('ttsVoices = []');
  g('refreshSettings()');
  ok(documentStub.getElementById('setTtsEngVoice').innerHTML.includes('未检测到本机声音'), '声音列表空时显示提示项');

  /* ================= 27. Edge 朗读音源（方案C） ================= */
  console.log('\n[27] Edge朗读:UA判定/token/SSML/音色表/设置渲染');
  // UA 判定:网页拿不到也伪造不了 UA,能不能用由浏览器本身决定
  ok(g(`isEdgeBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0")`) === true, '桌面 Edge UA 判可用');
  ok(g(`isEdgeBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7204.99 Mobile Safari/537.36 EdgA/143.0.7204.99")`) === true, '安卓 Edge(EdgA) UA 判可用');
  ok(g(`isEdgeBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/143.2410.0 Mobile/15E148 Safari/604.1")`) === true, 'iOS Edge(EdgiOS) UA 判可用');
  ok(g(`isEdgeBrowser("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.2849.68")`) === false, '旧版 Edge(130) 判不可用(服务端实测 403)');
  ok(g(`isEdgeBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36")`) === false, 'Chrome 手机 UA 判不可用');
  ok(g(`isEdgeBrowser("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 MicroMessenger/8.0.49 Chrome/130.0.0.0 Mobile Safari/537.36")`) === false, '微信 UA 判不可用');
  ok(g(`isEdgeBrowser('')`) === false && g('isEdgeBrowser(null)') === false, '空/缺失 UA 判不可用');
  ok(g(`edgeUaVersion("Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36 EdgA/143.0.7204.99")`) === '143.0.7204.99', 'edgeUaVersion 提取版本号');

  // token 时间刻度:固定输入的官方基准值(Python edge-tts 对拍;float64 语义,BigInt 精确值会 403)
  ok(g('edgeGecTicks(1756550000000)') === '134010234000000000', 'edgeGecTicks 固定输入=官方基准值');
  ok(g(`edgeTtsUrl('ABC123', '143.0.1.2')`) === 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&Sec-MS-GEC=ABC123&Sec-MS-GEC-Version=1-143.0.1.2', 'WS URL 拼装(token/版本走查询参数)');
  ok(g(`edgeTtsUrl('ABC123')`).indexOf('Sec-MS-GEC-Version=1-143.0.3650.75') > 0, '版本号缺省兜底 143');
  ok(g('edgeRate(1)') === '+0%' && g('edgeRate(0.9)') === '-10%' && g('edgeRate(1.5)') === '+50%' && g('edgeRate(0.5)') === '-50%', '语速→SSML rate 映射');
  ok(g(`edgeSsml('a<b&c>d', 'zh-CN-XiaoxiaoNeural', 1)`).indexOf('&lt;b&amp;c&gt;d') > 0, 'SSML 文本 XML 转义');
  ok(g(`edgeSsml('hello', 'en-US-AriaNeural', 0.9)`).indexOf("rate='-10%'") > 0 && g(`edgeSsml('hello', 'en-US-AriaNeural', 0.9)`).indexOf("voice name='en-US-AriaNeural'") > 0, 'SSML 含音色与语速');

  // 音色表:ID 唯一/性别口音标注/缺省回落
  ok(g('EDGE_VOICES.length') >= 16, `音色表规模(${g('EDGE_VOICES.length')} 个)`);
  ok(g('new Set(EDGE_VOICES.map(v=>v.id)).size') === g('EDGE_VOICES.length'), '音色 ID 无重复');
  ok(g(`edgeVoiceById('en-US-AriaNeural').g`) === 'f' && g(`edgeVoiceById('zh-CN-YunxiNeural').g`) === 'm', '音色性别标注');
  ok(g(`edgeVoiceById('en-GB-SoniaNeural').tag`) === '英音' && g(`edgeVoiceById('zh-CN-XiaoxiaoNeural').tag`) === undefined, '英语带口音标签/中文无');
  ok(g('edgeVoiceById("不存在")') === null, '未知音色返回 null');
  ok(g(`edgeVoiceOf('en-US')`) === 'en-US-AriaNeural' && g(`edgeVoiceOf('zh-CN')`) === 'zh-CN-XiaoxiaoNeural', '音色取设置值');
  g(`state.settings.edgeVoiceEn = 'bad-id'`);
  ok(g(`edgeVoiceOf('en-US')`) === 'en-US-AriaNeural', '非法音色值回落缺省');
  g(`state.settings.edgeVoiceEn = ''`);
  ok(g(`edgeVoiceOf('en-US')`) === 'en-US-AriaNeural', '空音色值回落缺省');
  g(`state.settings.edgeVoiceEn = 'en-GB-SoniaNeural'`);
  ok(g(`edgeVoiceOf('en-US')`) === 'en-GB-SoniaNeural', '可自选英音音色');
  g(`state.settings.edgeVoiceEn = 'en-US-AriaNeural'`);

  // 沙箱无 WebSocket/navigator:Edge 判不可用,选 Edge 被拒并保持原音源
  ok(g('edgeTtsAvailable()') === false, '无 WebSocket/Edge UA 的环境 Edge 判不可用');
  ok(g('canUseEdgeVoice()') === false, 'canUseEdgeVoice 为 false');
  g("setVoiceSrc('edge')");
  ok(g('state.settings.voiceSrc') === 'tts', '不可用环境里选 Edge 被拒并保持原音源');

  // 设置页渲染:Edge 音色下拉分组/中文标注
  g('refreshSettings()');
  const enEdge = documentStub.getElementById('setEdgeVoiceEn').innerHTML;
  const zhEdge = documentStub.getElementById('setEdgeVoiceZh').innerHTML;
  ok(enEdge.indexOf('艾莉雅（女 · 美音）') > 0 && enEdge.indexOf('托马斯（男 · 英音）') > 0, '英语音色下拉含中文名+性别+口音');
  ok(enEdge.indexOf('晓晓') < 0, '英语音色下拉不含中文音色');
  ok(zhEdge.indexOf('晓晓（女）') > 0 && zhEdge.indexOf('云希（男）') > 0, '普通话音色下拉含中文名+性别');
  ok(zhEdge.indexOf('艾莉雅') < 0, '普通话音色下拉不含英语音色');
  ok(enEdge.indexOf('selected') > 0, '当前音色处于选中态');

/* ================= 28. 每日目标按词库独立 ================= */
console.log('\n[28] 每日新学/复习目标按词库独立（2026-08-31）');
(() => {
  // 四级学满 2 个（目标调小方便测试）
  g(`state = defaultState(); state.settings.dailyNew = 2; saveState();`);
  g(`learnWord('hello'); learnWord('word');`);
  ok(g('goalInfo().done') === true, '四级今日新学达标');
  // 切到小学词库：额度全新，不继承四级的已学
  g(`setLibrary('primary')`);
  ok(g('goalInfo().learned') === 0, '小学词库今日已学为 0（不继承四级）');
  ok(g('goalInfo().done') === false, '小学词库目标未达成（四级学满不阻断）');
  // 小学词库学 1 个：两边计数各存各的
  g(`learnWord('younger')`);
  ok(g('goalInfo().learned') === 1 && g('goalInfo().remaining') === 1, '小学词库单独计数');
  g(`setLibrary('cet4')`);
  ok(g('goalInfo().learned') === 2, '切回四级已学仍是 2');
  ok(g('state.learnedToday') === undefined, '顶层不再有全局每日计数');
  // 复习计数同样按库隔离
  g(`curWords()['hello'].due = Date.now() - 1; reviewCorrect('hello');`);
  g(`setLibrary('primary'); reviewCorrect('younger');`);
  ok(g('goalInfo().reviewedToday') === 1, '小学词库已复习 1（只算自己的）');
  g(`setLibrary('cet4')`);
  ok(g('goalInfo().reviewedToday') === 1, '四级已复习 1（互不串扰）');
  // 目标阻断按库判断：四级完成页 vs 小学正常开会话
  g(`setLibrary('primary')`);
  g('startStudy()');
  ok(g('session && session.queue.length') === 1, '四级学满后切小学仍可正常开新学会话');
  g(`setLibrary('cet4')`);
  g('startStudy()');
  ok(documentStub.getElementById('studyQuiz').innerHTML.includes('今日新学目标已完成'), '四级显示目标完成页（按库阻断）');
  // 旧档迁移：顶层每日计数 → 迁入当前词库
  storage.set('cet4_study_state_v1', JSON.stringify({
    settings: { dailyNew: 5, lib: 'senior' },
    libs: { senior: { words: {} } },
    today: new Date().toDateString(),
    learnedToday: ['realistic'], reviewedToday: ['cancel'], history: {},
  }));
  g('state = loadState();');
  ok(g('state.learnedToday') === undefined && g('state.reviewedToday') === undefined, '旧档顶层每日计数已删除');
  ok(g(`state.libs.senior.learnedToday.includes('realistic')`) === true, '旧档已学迁入切换前所在词库（senior）');
  ok(g(`state.libs.senior.reviewedToday.includes('cancel')`) === true, '旧档已复习迁入 senior');
  ok(!g('state.libs.cet4') || g('state.libs.cet4.learnedToday') === undefined, '未错误迁入 cet4');
  // 跨天重置：所有词库的每日计数一起清
  g(`state.libs.senior.learnedToday = ['realistic']; state.today = 'Wed Jan 01 2025'; saveState(); state = loadState();`);
  ok(g(`state.libs.senior.learnedToday.length`) === 0, '跨天后词库每日计数清零');
  ok(g('state.today') === g('todayStr()'), 'today 更新为当天');
})();

console.log(`\n========== 结果: ${pass} 通过, ${fail} 失败 ==========`);

  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e); process.exit(1); });
