/* 词库转换脚本：把 lib-sources/*.json（{en, phone, cn}）转成 vocab-libs.js
 * 用法：node build-libs.js
 * 产出：const VOCAB_LIBS = { 词库key: { name, words: [[单词, 释义], ...] } }
 * 说明：音标(phone)当前应用不展示，暂不输出；源 JSON 保留，以后要用随时加
 * 注意：lib-sources 里不放「四级词汇(第二版本).json」——它和内置四级词库是同一份词表
 *      （4483/4544 重合，差异只是专有名词大小写），加进来只会造成重复词库
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'lib-sources');
const OUT = path.join(ROOT, 'vocab-libs.js');

// key 顺序即设置页展示顺序；cet4 是内置词库（vocab-data.js），不在此列
const LIBS = [
  { key: 'primary', file: '小学词汇.json', name: '小学词汇' },
  { key: 'junior',  file: '初中词汇.json', name: '初中词汇' },
  { key: 'senior',  file: '高中词汇.json', name: '高中词汇' },
  { key: 'cet6',    file: '六级词汇.json', name: '六级词汇' },
];

// 不同学段词库间允许大量同词（如 above 在小学和初中都有），进度各存各的，不做跨库去重

let body = '';
for (const lib of LIBS) {
  const raw = JSON.parse(fs.readFileSync(path.join(SRC, lib.file), 'utf8'));
  const words = [];
  const seen = new Set();
  let skipNoDef = 0, skipDup = 0;
  for (const item of raw) {
    const en = (item.en || '').trim();
    let cn = (item.cn || '').replace(/\s+/g, ' ').trim();
    if (!en || !cn) { skipNoDef++; continue; }
    if (seen.has(en)) { skipDup++; continue; }
    seen.add(en);
    words.push([en, cn]);
  }
  console.log(`${lib.name}: ${raw.length} 条 → ${words.length} 条（缺释义 ${skipNoDef}，词内重复 ${skipDup}）`);
  body += `  ${lib.key}: {\n    name: ${JSON.stringify(lib.name)},\n    words: [\n`;
  body += words.map(([w, m]) => `      [${JSON.stringify(w)},${JSON.stringify(m)}]`).join(',\n');
  body += '\n    ],\n  },\n';
}

const out = `/* 词库数据 - 由 build-libs.js 从 lib-sources/*.json 生成，勿手改
 * 每个词库 words: [[单词, 释义], ...]，与 vocab-data.js 的 VOCAB 格式一致
 * 内置四级词库不在本文件（仍是 vocab-data.js 的 VOCAB，key=cet4，见 app.js 的 LIBS）
 */
const VOCAB_LIBS = {
${body}};
`;
fs.writeFileSync(OUT, out, 'utf8');
console.log('已生成: ' + OUT + ' (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
