/* 例句生成工作流(第二批:其余词库缺口):85 个批次(每批 40 词)并行生成例句,
 * 每批一个子代理,产出 sentence-gen/results/gen-NN.json;
 * 机器校验(check-gen.js)核对覆盖与格式,不合格批次交回修补,最多 3 轮。
 * 修复子代理名第 2 轮起加 -r{round} 后缀:名字是缓存身份,跨轮重名会终止运行(上批教训)。 */

interface GenResult {
  /** 批次号(两位,如 03) */
  batch: string;
  /** 实际写出例句的词数 */
  count: number;
  /** 结果文件相对路径 */
  file: string;
  /** 自己复查时发现的问题;没有就留空数组 */
  problems: string[];
}

interface CheckFail {
  /** 批次号 */
  batch: string;
  /** 不合格原因(可能含多个词的明细) */
  reason: string;
  /** 缺失或不合格的单词 */
  words: string[];
}

interface CheckSummary {
  batches: number;
  okBatches: number;
  totalWords: number;
  okWords: number;
  fails: CheckFail[];
}

interface WorkflowReport {
  /** 两三句话回答:例句补齐到什么程度 */
  conclusion: string;
  findings: { where: string; what: string; evidence: string; status: "verified" | "unconfirmed"; severity: "low" | "medium" | "high" }[];
  verified: string[];
  notCovered: string[];
}

const RULES = [
  "为每个单词写 1 条英语例句 + 对应中文翻译,要求:",
  "- 难度贴近中学至大学基础水平:自然地道,不堆砌生僻词,不用专有名词;",
  "- 句子 6~20 个单词,必须包含该单词(允许常见屈折变化:名词复数、动词时态/分词等);",
  "- 中文翻译准确通顺;",
  "- 专有名词/短语也照常造句,不要跳过任何词。",
].join("\n");

const FORMAT = [
  "把结果写成合法 JSON(UTF-8 无 BOM)保存,格式(键=单词,值=[英文句, 中文翻译]):",
  '{"word": ["the sentence.", "中文翻译。"]}',
].join("\n");

artifact.board("genboard", {
  title: "例句生成进度(第二批)",
  key: "batch",
  status: "status",
  columns: ["已生成", "校验通过", "待修复"],
  cardTitle: "batch",
  detail: [{ field: "count", label: "词数" }],
});

phase("逐批生成例句");
const batches = (await files.glob("sentence-gen/batches/batch-*.json"))
  .map((p) => ({ path: p, id: (/batch-(\d+)\.json$/.exec(p) || ["", ""])[1] }))
  .filter((b) => b.id !== "");
log(`共 ${batches.length} 批缺句词,每批 40 词,开始并行生成`);

const gen = await Promise.all(
  batches.map((b) =>
    agent(`例句写手-${b.id}`).ask<GenResult>(
      `读取批次文件 ${b.path}(40 个单词,格式 [{"en":"单词","cn":"释义"}])。\n` +
      `${RULES}\n${FORMAT}\n` +
      `保存到 sentence-gen/results/gen-${b.id}.json,40 个词全部都要有,一个不能漏。\n` +
      `写完后自己重新读取该文件,核对:JSON 能否解析、键是否恰好 40 个单词、没有多余的键。\n` +
      `如果文件读不到或格式对不上,如实说明,不要编造。\n` +
      `完成后返回:{batch:"${b.id}", count:实际词数, file:"sentence-gen/results/gen-${b.id}.json", problems:[]}`,
    ),
  ),
);
for (const r of gen) report({ batch: r.batch, status: "已生成", count: r.count }, "genboard");
log(`生成完毕:${gen.filter((r) => r.count >= 38).length}/${batches.length} 批自报 ≥38 词`);

phase("机器校验生成结果");
let last: CheckSummary | null = null;
for (let round = 1; round <= 3; round++) {
  const check = await world.run("node", ["sentence-gen/check-gen.js"], { timeoutMs: 120000 });
  try { last = JSON.parse(check.stdout) as CheckSummary; } catch (e) { last = null; }
  if (check.exitCode === 0 && last) {
    log(`第 ${round} 轮校验:全部 ${last.batches} 批通过,覆盖 ${last.okWords}/${last.totalWords} 词`);
    for (const b of batches) report({ batch: b.id, status: "校验通过" }, "genboard");
    break;
  }
  const fails = last ? last.fails : [];
  log(`第 ${round} 轮校验:${fails.length} 批不合格,进入修复(第 ${round}/3 轮)`);
  for (const f of fails) report({ batch: f.batch, status: "待修复" }, "genboard");
  for (const b of batches) {
    if (!fails.some((x) => x.batch === b.id)) report({ batch: b.id, status: "校验通过" }, "genboard");
  }

  phase("修复不合格批次");
  await Promise.all(
    fails.map((f) =>
      agent(`例句修补-${f.batch}${round > 1 ? "-r" + round : ""}`).ask<GenResult>(
        `批次 sentence-gen/batches/batch-${f.batch}.json 的例句上轮机器校验不合格:\n` +
        `原因:${f.reason}\n涉及单词:${JSON.stringify(f.words)}\n\n` +
        `重新读取批次文件里这些词的释义,${RULES}\n` +
        `然后更新 sentence-gen/results/gen-${f.batch}.json:保留原有合格条目,替换/补齐所有不合格条目,` +
        `确保文件覆盖批次全部 40 词且 JSON 可解析。返回:{batch:"${f.batch}", count:文件总词数, file:"sentence-gen/results/gen-${f.batch}.json", problems:[]}`,
      ),
    ),
  );
}

const fails: CheckFail[] = last ? last.fails : [];
const findings = fails.map((f) => ({
  where: `sentence-gen/results/gen-${f.batch}.json`,
  what: `批次 ${f.batch} 仍有 ${f.words.length} 词不合格:${f.reason.slice(0, 120)}`,
  evidence: "check-gen.js 机器校验输出",
  status: "unconfirmed" as const,
  severity: "medium" as const,
}));

return {
  conclusion: last
    ? `例句生成完成:机器校验覆盖 ${last.okWords}/${last.totalWords} 词,${last.okBatches}/${last.batches} 批全部合格` +
      (fails.length ? `;仍有 ${fails.length} 批不合格,已如实列出` : "")
    : "校验输出无法解析,结果未确认",
  findings,
  verified: ["check-gen.js 逐批核对 JSON 格式、单词覆盖、句长/翻译/词根约束(world.run 退出码判定)"],
  notCovered: ["例句的语言质量(地道程度/难度一致性)只由生成代理自检,未做独立人工级评审"],
};
