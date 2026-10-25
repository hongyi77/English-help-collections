/* 生成例句的机器校验(供 workflow 的 world.run 调用):
 * 逐批核对 sentence-gen/results/gen-NN.json 覆盖 batch-NN.json 全部单词,并检查格式与内容约束。
 * stdout 输出 JSON 摘要;有不合格批次时退出码 1,fails 数组给出批次号/原因/缺词清单。 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;

function sentenceOk(word, s) {
  if (!Array.isArray(s) || s.length !== 2) return '格式不是 [en, cn]';
  const [en, cn] = s;
  if (typeof en !== 'string' || typeof cn !== 'string') return '非字符串';
  if (en.length < 12 || en.length > 140) return '英文句长度 ' + en.length + ' 越界(12~140)';
  if (cn.trim().length < 2 || cn.length > 60) return '中文翻译长度越界(2~60)';
  if (!/[\u4e00-\u9fff]/.test(cn)) return '中文翻译不含汉字';
  if (/[\u4e00-\u9fff]/.test(en)) return '英文句混入汉字';
  // 词根匹配:允许屈折(复数/时态)与连字符书写差异(well-known/well known),取词干前缀比对
  const stem = word.toLowerCase().replace(/[^a-z]/g, '').slice(0, Math.max(4, word.length - 2));
  if (!en.toLowerCase().replace(/[-']/g, '').includes(stem)) return '英文句未包含目标词(' + word + ')';
  return null;
}

const fails = [];
let okBatches = 0, totalWords = 0, okWords = 0;
const batchFiles = fs.readdirSync(path.join(DIR, 'batches')).filter(f => f.startsWith('batch-') && f.endsWith('.json')).sort();
for (const bf of batchFiles) {
  const batchId = bf.replace('batch-', '').replace('.json', '');
  const words = JSON.parse(fs.readFileSync(path.join(DIR, 'batches', bf), 'utf8'));
  totalWords += words.length;
  const rf = path.join(DIR, 'results', 'gen-' + batchId + '.json');
  if (!fs.existsSync(rf)) { fails.push({ batch: batchId, reason: '结果文件不存在', words: words.map(w => w.en) }); continue; }
  let result;
  try { result = JSON.parse(fs.readFileSync(rf, 'utf8').replace(/^\uFEFF/, '')); }
  catch (e) { fails.push({ batch: batchId, reason: 'JSON 解析失败: ' + e.message.slice(0, 80), words: words.map(w => w.en) }); continue; }
  const missing = [], reasons = [];
  for (const w of words) {
    const s = result[w.en];
    if (s === undefined) { missing.push(w.en); continue; }
    const why = sentenceOk(w.en, s);
    if (why) { reasons.push(w.en + '(' + why + ')'); continue; }
    okWords++;
  }
  if (missing.length || reasons.length) {
    fails.push({ batch: batchId, reason: reasons.join('; ') || '缺词', words: missing.concat(reasons.map(r => r.slice(0, r.indexOf('(')))) });
  } else {
    okBatches++;
  }
}

const summary = { batches: batchFiles.length, okBatches, totalWords, okWords, fails };
console.log(JSON.stringify(summary, null, 1));
process.exit(fails.length ? 1 : 0);
