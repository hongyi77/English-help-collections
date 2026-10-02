/* FSRS-6 自适应记忆调度引擎（单文件、零依赖）
 * 移植自 open-spaced-repetition/py-fsrs 官方实现（MIT），公式与默认权重与其 main 分支一致
 * 三变量模型：S 稳定性(天)、D 难度(1~10)、R 可提取性(回忆概率)
 * 评分映射（本应用为二值作答）：答对=Good(3)，答错=Again(1)
 */
const FSRS_W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
  1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
const FSRS_STABILITY_MIN = 0.001;
const FSRS_MAX_INTERVAL = 36500;
const FSRS_DAY = 24 * 60 * 60 * 1000;

function fsrsDecay() { return -FSRS_W[20]; }
/* FACTOR = 0.9^(1/DECAY) - 1；r=0.9 时间隔恰等于稳定性 */
function fsrsFactor() { return Math.pow(0.9, 1 / fsrsDecay()) - 1; }
function fsrsClampS(s) { return Math.max(s, FSRS_STABILITY_MIN); }
function fsrsClampD(d) { return Math.min(Math.max(d, 1), 10); }

/* 距上次复习 elapsed 天后的回忆概率 */
function fsrsRetrievability(s, last, now) {
  const elapsed = Math.max(0, Math.floor((now - last) / FSRS_DAY));
  return Math.pow(1 + fsrsFactor() * elapsed / s, fsrsDecay());
}

/* 稳定性 s 在目标保持率 r 下的复习间隔（天） */
function fsrsInterval(s, retention) {
  const r = retention || 0.9;
  return Math.max(1, Math.min(FSRS_MAX_INTERVAL, Math.round((s / fsrsFactor()) * (Math.pow(r, 1 / fsrsDecay()) - 1))));
}

/* 首学初值：S0=w[G-1]，D0=w4-e^(w5*(G-1))+1 */
function fsrsInit(rating) {
  return {
    s: fsrsClampS(FSRS_W[rating - 1]),
    d: fsrsClampD(FSRS_W[4] - Math.exp(FSRS_W[5] * (rating - 1)) + 1),
  };
}

/* 复习后难度：线性阻尼 delta/(9/(10-d)) 防止 D 逼近 10 时爆炸 + 向初值均值回归 */
function fsrsNextD(d, rating) {
  const delta = -(FSRS_W[6] * (rating - 3));
  const arg2 = d + (10 - d) * delta / 9;
  const arg1 = FSRS_W[4] - Math.exp(FSRS_W[5] * 3) + 1; /* initial_difficulty(Easy, 不截断) */
  return fsrsClampD(FSRS_W[7] * arg1 + (1 - FSRS_W[7]) * arg2);
}

/* 答对后的新稳定性（hard_penalty/easy_bonus 供 Hard/Easy 评分用，二值映射不触发） */
function fsrsRecallS(d, s, r, rating) {
  const hardPenalty = rating === 2 ? FSRS_W[15] : 1;
  const easyBonus = rating === 4 ? FSRS_W[16] : 1;
  return fsrsClampS(s * (1 + Math.exp(FSRS_W[8]) * (11 - d) * Math.pow(s, -FSRS_W[9]) *
    (Math.exp((1 - r) * FSRS_W[10]) - 1) * hardPenalty * easyBonus));
}

/* 答错后的新稳定性：长期遗忘项与短期项取小 */
function fsrsForgetS(d, s, r) {
  const longTerm = FSRS_W[11] * Math.pow(d, -FSRS_W[12]) * (Math.pow(s + 1, FSRS_W[13]) - 1) * Math.exp((1 - r) * FSRS_W[14]);
  const shortTerm = s / Math.exp(FSRS_W[17] * FSRS_W[18]);
  return fsrsClampS(Math.min(longTerm, shortTerm));
}

/* 同日重评（间隔不足 1 天，如答错 10 分钟后的重试） */
function fsrsShortS(s, rating) {
  let inc = Math.exp(FSRS_W[17] * (rating - 3 + FSRS_W[18])) * Math.pow(s, -FSRS_W[19]);
  if (rating >= 3) inc = Math.max(inc, 1.0);
  return fsrsClampS(s * inc);
}

/* 一次复习 → 新 {s,d}。rating: 3=答对 1=答错；last/now 为时间戳 */
function fsrsReview(f, rating, last, now) {
  const sameDay = (now - last) < FSRS_DAY;
  let s;
  const d = fsrsNextD(f.d, rating);
  if (sameDay) {
    s = fsrsShortS(f.s, rating);
  } else {
    const r = fsrsRetrievability(f.s, last, now);
    s = rating === 1 ? fsrsForgetS(f.d, f.s, r) : fsrsRecallS(f.d, f.s, r, rating);
  }
  return { s, d };
}
