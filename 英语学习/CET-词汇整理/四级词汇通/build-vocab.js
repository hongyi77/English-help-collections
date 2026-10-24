/* 转换脚本：从 文件_去重合并版.txt（word<TAB>释义）生成 vocab-data.js
 * 用法：node build-vocab.js [输入txt路径]
 *   默认输入：../文件_去重合并版.txt（源数据）
 *   可用参数指定其他 txt（例如精简版：node build-vocab.js 文件_去重合并版_精简版.txt）
 * 产出：vocab-data.js（const VOCAB = [[单词, 释义], ...]）
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'vocab-data.js');
const SRC = process.argv[2]
  ? path.resolve(ROOT, process.argv[2])
  : path.join(ROOT, '..', '文件_去重合并版.txt');

let content;
try {
  content = fs.readFileSync(SRC, 'utf8');
} catch (e) {
  console.error('无法读取输入文件: ' + SRC);
  console.error(e.message);
  process.exit(1);
}
content = content.replace(/^\uFEFF/, '');  // 剥离 UTF-8 BOM

/* 清洗(与 build-libs.js 口径一致):trim 单词与释义、跳过缺 tab/空释义的行、重复词告警 */
const seen = new Set();
const vocab = [];
let skipped = 0;
for (const line of content.split(/\r?\n/)) {
  if (!line.trim()) continue;
  const i = line.indexOf('\t');
  if (i < 0) {
    console.warn('跳过无 tab 分隔的行: ' + line.slice(0, 40));
    skipped++;
    continue;
  }
  const w = line.slice(0, i).trim();
  const d = line.slice(i + 1).trim();
  if (!w || !d) { skipped++; continue; }
  if (seen.has(w)) {
    console.warn(`跳过重复词(保留首个): ${w}`);
    skipped++;
    continue;
  }
  seen.add(w);
  vocab.push([w, d]);
}

const body = vocab.map(([w, d]) => `  ${JSON.stringify([w, d])},`).join('\n');
const js = '// 四级词汇数据 - 自动从 文件_去重合并版.txt 生成\nconst VOCAB = [\n' + body + '\n];\n';
fs.writeFileSync(OUT, js, 'utf8');
console.log('已生成: ' + OUT + ' (' + vocab.length + ' 词, 跳过 ' + skipped + ' 行, ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
