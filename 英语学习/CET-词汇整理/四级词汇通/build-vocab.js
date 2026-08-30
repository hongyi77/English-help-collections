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

const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
const vocab = lines.map(l => {
  const i = l.indexOf('\t');
  if (i < 0) throw new Error('无法解析行（缺少 tab 分隔）: ' + l.slice(0, 40));
  return [l.slice(0, i), l.slice(i + 1)];
});

const body = vocab.map(([w, d]) => `  ${JSON.stringify([w, d])},`).join('\n');
const js = '// 四级词汇数据 - 自动从 文件_去重合并版.txt 生成\nconst VOCAB = [\n' + body + '\n];\n';
fs.writeFileSync(OUT, js, 'utf8');
console.log('已生成: ' + OUT + ' (' + vocab.length + ' 词, ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
