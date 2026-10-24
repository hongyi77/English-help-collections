/* 打包脚本：把全部文件合并成单文件手机版
 * 用法：node build-single.js
 * 产出：英语词汇通_手机版.html（自包含，可发到手机直接打开）
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, '英语词汇通_手机版.html');
/* index.html 里仍有 <script src> 引用的文件(按出现顺序内联)。
 * vocab-libs.js 已改为延迟加载(index.html 无标签):单文件版把它内联到词表数据
 * 之后,保证 app.js 执行时 VOCAB_LIBS 已就绪——app.js 的延迟装载器检测到已
 * 定义会自动跳过动态加载,file:// 下不存在 404 问题 */
const FILES = ['vocab-data.js', 'vocab-extra.js', 'icons.js', 'fsrs.js', 'app.js', 'ui.js', 'pwa-register.js'];
const LIBS_FILE = 'vocab-libs.js';

let html = fs.readFileSync(SRC, 'utf8');

// 单文件版剥离 CSP:所有脚本已内联合并,'self' 策略会锁死自身;file:// 本就无远程攻击面
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<!-- CSP 已剥离:单文件版脚本内联,见 build-single.js -->');
if (html.includes('Content-Security-Policy')) {
  console.error('CSP 剥离失败,请检查 meta 格式');
  process.exit(1);
}

// 单文件版无 manifest/图标文件,剥离 PWA 引用(file:// 下全是 404)
html = html.replace(/<link rel="manifest"[^>]*>\s*/, '');
html = html.replace(/<link rel="apple-touch-icon"[^>]*>\s*/, '');
if (html.includes('manifest.json') || html.includes('apple-touch-icon')) {
  console.error('PWA 引用剥离失败,请检查 link 标签格式');
  process.exit(1);
}

const inlineJs = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<\/script>/gi, '<\\/script>');

// 用占位符替换 script 引用，避免脚本内容里的 </script> 干扰
for (const f of FILES) {
  const safe = inlineJs(f);
  const tag = new RegExp(`<script src="${f}"[^>]*></script>`);
  if (!tag.test(html)) {
    console.error('未找到引用: script src=' + f);
    process.exit(1);
  }
  let replacement = `<script>\n${safe}\n</script>`;
  if (f === 'vocab-data.js') {
    // 扩展词库紧跟词表数据内联(见顶部 FILES 注释)
    replacement += `\n<script>\n${inlineJs(LIBS_FILE)}\n</script>`;
  }
  html = html.replace(tag, () => replacement);
}

// 顶部加个说明注释
html = '<!-- 英语词汇通 手机单文件版：由 build-single.js 生成，发到手机用浏览器直接打开即可 -->\n' + html;

fs.writeFileSync(OUT, html, 'utf8');
console.log('已生成: ' + OUT + ' (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
