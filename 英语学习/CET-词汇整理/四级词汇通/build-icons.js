/* 图标构建脚本:从 Lucide 图标库(D:\文件实验地\icons)提取所需 SVG 生成 icons.js
 * 用法:node build-icons.js
 * 产出:const ICONS = { 名称: "<svg ...>" };模板字符串里用 icon('book-open') 注入
 * 注意:新增图标先在 NAMES 里登记;源目录缺失会报错退出
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = 'D:\\文件实验地\\icons';
const OUT = path.join(__dirname, 'icons.js');

const NAMES = [
  // Tab 与主操作
  'book-open', 'repeat', 'bookmark', 'chart-column', 'calendar-days',
  'search', 'settings', 'search-x',
  // 反馈与动作
  'circle-check', 'circle-x', 'eye', 'arrow-right', 'chevron-left',
  'volume-2', 'lightbulb', 'bookmark-plus', 'bookmark-check', 'rotate-ccw',
  // 页面装饰
  'keyboard', 'trophy', 'party-popper', 'coffee', 'hourglass', 'target',
  'notebook-pen', 'sliders-horizontal', 'sparkles',
  // 自由拼写 / 听写
  'pencil-line', 'ear', 'check', 'volume-2', 'play', 'pause', 'square', 'shuffle', 'list-ordered',
  'circle', 'list-plus',
];

const icons = {};
for (const name of NAMES) {
  const file = path.join(SRC_DIR, name + '.svg');
  let svg;
  try {
    svg = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error('图标不存在: ' + file);
    process.exit(1);
  }
  // 压成单行;stroke=currentColor 随 CSS 变色,尺寸由 CSS 控制
  const compact = svg
    .replace(/\r?\n\s*/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
  icons[name] = compact;
}

let out = '/* 图标数据 - 由 build-icons.js 从 Lucide 图标库生成,勿手改\n * 用法:icon("book-open") 返回 svg 字符串,颜色随 currentColor\n */\n';
out += 'const ICONS = {\n';
for (const [k, v] of Object.entries(icons)) out += `  ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`;
out += '};\n';
fs.writeFileSync(OUT, out, 'utf8');
console.log(`已生成: ${OUT} (${NAMES.length} 个图标, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
