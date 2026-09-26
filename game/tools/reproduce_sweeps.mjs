/* reproduce_sweeps.mjs —— 样本外种子与关卡设计比较的固化复现脚本（v4.1）。
 *
 * 运行：node game/tools/reproduce_sweeps.mjs
 * 复现 TECH-NOTE §4.2/§7 的历史对照表（10 个样本外种子 × 180 仿真秒 × 4 配置）：
 *   1. 现默认（turnGain 2.6，bananaMaxDist=∞ —— 历史测量时默认值）
 *   2. 香蕉≤250（现默认）
 *   3. 快速搜索（speedGain 0.8 / maxSpeed 60）
 *   4. 香蕉≤250 + 快速搜索
 * bananaMaxDist 用 null 显式恢复历史无上限（harness.mjs 的 null→Infinity 约定）。
 * 输出：与历史表对齐的 markdown 表（吃到比例/首吃中位/首吃均值/平均得分/曲折度）。
 */
import { loadWorld, runEpisode } from './harness.mjs';

const SECONDS = 180;
const SEEDS = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
const COMBOS = [
  { note: '现默认（bananaMaxDist=∞）', cfg: { bananaMaxDist: null } },
  { note: '香蕉≤250（现默认）', cfg: {} },
  { note: '快速搜索（speedGain 0.8/maxSpeed 60）', cfg: { bananaMaxDist: null, speedGain: 0.8, maxSpeed: 60 } },
  { note: '香蕉≤250+快速', cfg: { speedGain: 0.8, maxSpeed: 60 } },
];

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

console.log('加载连接组（仅一次）…');
const { sim, pools, extra } = await loadWorld('flywire');
console.log('| 配置 | 吃到比例 | 首吃中位(s) | 首吃均值(s) | 平均得分 | 曲折度 |');
console.log('|---|---|---|---|---|---|');
for (const { note, cfg } of COMBOS) {
  const firsts = [], scores = [], torts = [];
  let ate = 0;
  for (const s of SEEDS) {
    const r = runEpisode({ sim, pools, extra, seconds: SECONDS, cfgOverride: cfg, seed: s });
    scores.push(r.score);
    if (r.firstEatTime !== null) { ate++; firsts.push(r.firstEatTime); torts.push(r.firstTortuosity); }
    process.stderr.write('.');
  }
  const f = (v) => (v === null ? '—' : v.toFixed(1));
  console.log(`| ${note} | ${ate}/10 | ${f(median(firsts))} | ${f(mean(firsts))} | ${mean(scores).toFixed(2)} | ${torts.length ? mean(torts).toFixed(2) : '—'} |`);
}
process.stderr.write('\n');
console.log('\n复现完成。历史参考值见 game/README.md 调参记录（同种子集、同秒数测得）。');
