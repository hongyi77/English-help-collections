/* 合并脚本:把 vocab-extra-chunks/*.js 合并成 vocab-extra.js
 * 用法:node build-extra.js
 * 校验:hard-words.json 里的难词必须全覆盖、无缺字段、无超长
 * 产出:vocab-extra.js(const VOCAB_EXTRA = { word: "巧记" })
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const CHUNK_DIR = path.join(ROOT, 'vocab-extra-chunks');
const HARD_LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'hard-words.json'), 'utf8'));
const OUT = path.join(ROOT, 'vocab-extra.js');

// 1. 读取并执行所有 chunk(按文件名排序)
const chunkFiles = fs.readdirSync(CHUNK_DIR).filter(f => f.endsWith('.js')).sort();
const sandbox = { VOCAB_EXTRA_PARTS: [] };
vm.createContext(sandbox);
for (const f of chunkFiles) {
  try {
    vm.runInContext(fs.readFileSync(path.join(CHUNK_DIR, f), 'utf8'), sandbox);
  } catch (e) {
    console.error('✗ 语法错误: ' + f + ' → ' + e.message);
    process.exit(1);
  }
}

// 2. 合并(后写的覆盖先写的)
const merged = {};
let dupCount = 0;
for (const part of sandbox.VOCAB_EXTRA_PARTS) {
  for (const [w, memo] of Object.entries(part)) {
    if (merged[w] !== undefined) dupCount++;
    merged[w] = memo;
  }
}

// 3. 校验
const problems = [];
for (const w of HARD_LIST) {
  const m = merged[w];
  if (m === undefined) { problems.push(`缺巧记: ${w}`); continue; }
  if (typeof m !== 'string' || !m.trim()) problems.push(`巧记为空: ${w}`);
  else if (m.length > 45) problems.push(`巧记超长(${m.length}字): ${w}`);
}
// hard 之外的词也允许存在(历史生成),但必须是字符串
for (const [w, m] of Object.entries(merged)) {
  if (typeof m !== 'string') problems.push(`值不是字符串: ${w}`);
}

if (problems.length) {
  console.error(`✗ ${problems.length} 个问题:`);
  problems.slice(0, 30).forEach(p => console.error('  - ' + p));
  process.exit(1);
}

// 4. 产出(按 hard-words.json 顺序 + 其余附加词)
const ordered = HARD_LIST.filter(w => merged[w] !== undefined);
const extras = Object.keys(merged).filter(w => !HARD_LIST.includes(w));
const body = ordered.concat(extras).map(w => JSON.stringify(w) + ': ' + JSON.stringify(merged[w])).join(',\n');
const js = `/* 巧记数据 - 由 build-extra.js 从 vocab-extra-chunks/ 生成,勿手改
 * 覆盖范围:难词 ${HARD_LIST.length} 个(词长≥7 + 易混短词种子,排除简单复合词)
 * 加载后供 app.js 的 EXTRA_MAP / memoOf() 使用
 */
const VOCAB_EXTRA = {
${body}
};
`;
fs.writeFileSync(OUT, js, 'utf8');
console.log(`✓ 已生成: ${OUT}`);
console.log(`  难词覆盖: ${ordered.length}/${HARD_LIST.length} | 附加词: ${extras.length} | chunk 内重复覆盖: ${dupCount}`);
console.log(`  大小: ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
