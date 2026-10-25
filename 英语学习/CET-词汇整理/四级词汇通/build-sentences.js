/* 合并脚本:把 vocab-sentence-chunks/*.js 合并成 vocab-sentences.js
 * 用法:node build-sentences.js
 * 校验:词形合法 / 句对必须是 [英文句, 中文翻译] / 句长上限 / 跨 chunk 重复词(后写覆盖前写并提示)
 * 产出:const VOCAB_SENTENCES = { 单词: [[英文句, 中文翻译]] }(app.js 懒加载,sentencesOf 按词查)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const CHUNK_DIR = path.join(ROOT, 'vocab-sentence-chunks');
const OUT = path.join(ROOT, 'vocab-sentences.js');

const WORD_RE = /^[A-Za-z][A-Za-z'\- ]*$/;

// 1. 读并执行所有 chunk(按文件名排序,后写覆盖前写)
const chunkFiles = fs.readdirSync(CHUNK_DIR).filter(f => f.endsWith('.js')).sort();
const sandbox = { VOCAB_SENTENCE_PARTS: [] };
vm.createContext(sandbox);
for (const f of chunkFiles) {
  try {
    vm.runInContext(fs.readFileSync(path.join(CHUNK_DIR, f), 'utf8'), sandbox);
  } catch (e) {
    console.error('✗ 语法错误: ' + f + ' → ' + e.message);
    process.exit(1);
  }
}

// 2. 合并 + 校验
const merged = {};
const dups = [];
let bad = 0;
for (const part of sandbox.VOCAB_SENTENCE_PARTS) {
  for (const [w, sents] of Object.entries(part)) {
    if (!WORD_RE.test(w) || !Array.isArray(sents) || !sents.length) { bad++; continue; }
    const ok = sents.every(s => Array.isArray(s) && s.length === 2
      && typeof s[0] === 'string' && s[0].trim()
      && typeof s[1] === 'string' && s[1].trim()
      && s[0].length <= 140 && s[1].length <= 80);
    if (!ok) { bad++; continue; }
    if (merged[w] !== undefined) dups.push(w);
    merged[w] = sents;
  }
}
if (dups.length) {
  console.warn(`⚠ ${dups.length} 个词被后面的 chunk 覆盖(确认是有意修订再发布):`);
  console.warn('  ' + dups.slice(0, 30).join(', ') + (dups.length > 30 ? ' …' : ''));
}
if (bad) console.warn(`⚠ ${bad} 条不合格数据已剔除`);

// 3. 输出(按字母序,稳定 diff)
const keys = Object.keys(merged).sort();
const body = keys.map(w => JSON.stringify(w) + ':' + JSON.stringify(merged[w])).join(',\n');
const js = `/* 例句数据 - 由 build-sentences.js 从 vocab-sentence-chunks/ 生成,勿手改
 * 覆盖范围: ${keys.length} 词(免费来源:不背单词词书 ${fs.existsSync(path.join(ROOT, 'vocab-sentence-chunks')) ? Object.keys(sandbox.VOCAB_SENTENCE_PARTS).length : 0} 个分块 + AI 生成块)
 * 加载后供 app.js 的 sentencesOf() 按词查询,学习反馈卡/词典页展示
 */
const VOCAB_SENTENCES = {
${body}
};
`;
fs.writeFileSync(OUT, js);
console.log(`已生成: ${OUT}`);
console.log(`  ${keys.length} 词, ${Math.round(js.length / 1024)} KB, 来源 chunk: ${chunkFiles.length} 个`);
