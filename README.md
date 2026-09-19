# English-help-collections

一套面向中国学习者的英语学习工具合集，包含背单词应用与技术英语词库。

## 项目结构

```
English-help-collections/
├── 英语学习/
│   ├── CET-词汇整理/
│   │   └── 四级词汇通/          # 核心应用：多词库背单词 App
│   └── most-frequent-technology-english-words-master/  # 程序员高频技术英语词汇
└── README.md
```

---

## 📖 英语词汇通

纯前端背单词应用，零后端、零构建、双击即用。支持电脑浏览器与手机 PWA，进度可导出/导入跨设备同步。

### 功能特性

- **多词库**：支持 7 个词库（四六级 / 小学 / 初中 / 高中 / 蝶变系列），按系列分组展示
- **艾宾浩斯复习**：科学间隔重复算法，答对升级、答错降级，完全记住后不再出现
- **三段式答题**：识别（四选一）→ 拼写（可选）→ 自由拼写 / 听写练习
- **智能发音**：双引擎音源——Edge 朗读（男女音色自选，带永久缓存）+ 设备 TTS 兜底，离线可用
- **PWA 支持**：添加到手机主屏幕，全屏独立运行，断网可用
- **生词本 & 统计**：答错自动收录，掌握情况分四级展示，30 天学习记录
- **巧记辅助**：难词配有记忆技巧，答错时自动提示
- **每日目标**：新学与复习各自独立设定目标，按词库独立计算进度

### 快速开始

| 平台 | 方式 |
| --- | --- |
| 电脑 | 下载本项目，双击 `启动服务器.bat`，浏览器访问 http://localhost:8080 |
| 手机 | 电脑与手机连同一 WiFi，手机浏览器访问电脑 IP + 端口（如 http://192.168.1.100:8080），然后「添加到主屏幕」 |
| 离线单文件 | 改完代码后运行 `node build-single.js`，将产物发到手机直接打开 |

### 部署到 GitHub Pages

仓库已配置 GitHub Actions，推送到 `main` 分支自动部署。部署后通过以下地址访问：

```
https://<你的用户名>.github.io/<仓库名>/CET-词汇整理/四级词汇通/index.html
```

### 词库数据说明

词库数据由源文件自动生成，**不建议手动编辑生成的 JS 文件**。

| 源文件 | 生成文件 |
| --- | --- |
| `文件_去重合并版.txt`（CET-4 词表） | `vocab-data.js` |
| `lib-sources/*.json` 或 `*.txt` | `vocab-libs.js` |
| `vocab-extra-chunks/*.js` + `hard-words.json` | `vocab-extra.js`（巧记数据） |

### 更多详情

详细设计文档见 `英语学习/CET-词汇整理/四级词汇通/项目设计文档.md`。

---

## 📘 程序员英语词汇宝典

来自 [Wei-Xia/most-frequent-technology-english-words](https://github.com/Wei-Xia/most-frequent-technology-english-words) 的程序员高频技术英语词汇表，收录计算机书籍、文档、文章中常见技术词汇。

### 使用方式

- **在线浏览**：[learn-english.dev](https://learn-english.dev/)
- **本地开发**：需要 Ruby + Jekyll，参见该目录下的 README

### 贡献

发现翻译错误或有更合适的释义？欢迎提交 Pull Request。更新规则：

- 单词文件位于 `_posts/` 目录，按首字母顺序更新
- 单词首字母小写，翻译使用中文标点

---

## 许可证

本项目内的原创代码遵循 MIT 许可证。第三方词汇数据（`most-frequent-technology-english-words`）遵循其原有许可证。
