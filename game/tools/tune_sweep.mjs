/* tune_sweep.mjs —— 游戏层参数网格扫参（诚实声明：调的是游戏层读出映射，不是脑本身）。
 *
 * 运行：node game/tools/tune_sweep.mjs [网格JSON]
 * 默认网格：turnGain × smellSigma × baseSpeed（含现默认值对照）。
 * 可用网格JSON覆盖任意 game.cfg 键，如：
 *   node game/tools/tune_sweep.mjs '{"turnGain":[1.8,2.6],"emaTau":[5,20,40],"baseSpeed":[6,12]}'
 * 每配置 5 个种子 × 180 仿真秒；脑只初始化一次，episode 间 sim.reset()，全速跑无节流。
 * 输出：配置、吃到比例、首次吃香蕉均值/中位数、平均 180s 得分、首段曲折度。
 */
import { loadWorld, runEpisode } from './harness.mjs';

const SECONDS = 180;
const SEEDS = [11, 23, 37, 45, 58];
let GRID = {
  turnGain: [2.6, 4, 6],
  smellSigma: [130, 250],
  baseSpeed: [6, 12],
};
if (process.argv[2]) {
  try { GRID = JSON.parse(process.argv[2]); }
  catch (e) { console.error('网格 JSON 解析失败：', e.message); process.exit(2); }
}
const CURRENT_DEFAULT = { turnGain: 2.6, smellSigma: 130, baseSpeed: 6 };
const KEYS = Object.keys(GRID);

// 笛卡尔积生成全部配置
const configs = KEYS.reduce((acc, k) =>
  acc.flatMap((c) => GRID[k].map((v) => ({ ...c, [k]: v }))), [{}]);

console.log('加载连接组（仅一次）…');
const t0 = performance.now();
const { sim, pools, extra } = await loadWorld();
console.log(`初始化 ${(performance.now() - t0).toFixed(0)} ms；开始扫参：`
  + `${configs.length} 配置 × ${SEEDS.length} 种子 × ${SECONDS}s\n`);

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const fmt = (v, d = 1) => (v === null || v === undefined) ? '—' : v.toFixed(d);

const rows = [];
for (const cfg of configs) {
  const firstEats = [];
  const scores = [];
  const torts = [];
  let ateRuns = 0;
  for (const seed of SEEDS) {
    const r = runEpisode({ sim, pools, extra, seconds: SECONDS, cfgOverride: cfg, seed });
    scores.push(r.score);
    if (r.firstEatTime !== null) {
      ateRuns++;
      firstEats.push(r.firstEatTime);
      torts.push(r.firstTortuosity);
    }
    process.stderr.write('.');   // 进度点（stdout 保持表格干净）
  }
  const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const isDefault = Object.entries(CURRENT_DEFAULT).every(([k, v]) => cfg[k] === v);
  rows.push({
    cfg,
    isDefault,
    ateRatio: ateRuns / SEEDS.length,
    firstMean: mean(firstEats),
    firstMedian: median(firstEats),
    scoreMean: mean(scores),
    tortMean: mean(torts),
  });
}
process.stderr.write('\n');

console.log(`\n| ${KEYS.join(' | ')} | 吃到比例 | 首吃均值(s) | 首吃中位(s) | 平均得分 | 首段曲折度 | 备注 |`);
console.log(`|${'---|'.repeat(KEYS.length)}---|---|---|---|---|---|`);
for (const r of rows) {
  console.log(`| ${KEYS.map((k) => r.cfg[k]).join(' | ')} `
    + `| ${(r.ateRatio * 100).toFixed(0)}% | ${fmt(r.firstMean)} | ${fmt(r.firstMedian)} `
    + `| ${fmt(r.scoreMean, 2)} | ${fmt(r.tortMean, 2)} | ${r.isDefault ? '现默认' : ''} |`);
}
console.log('\n曲折度≈1 表示近乎直线冲刺（太假），>1.5 表示有明显漫游/搜索行为。');
