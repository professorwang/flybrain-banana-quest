/* headless_run.mjs —— 无头闭环验证：不依赖浏览器，直接驱动
 * LIFSim + Game 跑完整"嗅觉→脑→转向→进食"循环。
 *
 * 运行：node game/tools/headless_run.mjs [秒数=120] [配置覆盖JSON] [种子]
 *   例：node game/tools/headless_run.mjs 180 '{"turnGain":4,"smellSigma":250}' 42
 * 无参数时行为与最初版本完全一致（120s、默认配置、不固定种子）。
 * 用途：浏览器端无法自动化时，验证游戏闭环在真实连接组上确实能吃到香蕉。
 */
import { loadWorld, runEpisode } from './harness.mjs';

const SECONDS = Number(process.argv[2] || 120);
let cfgOverride = null;
if (process.argv[3]) {
  try { cfgOverride = JSON.parse(process.argv[3]); }
  catch (e) { console.error('配置覆盖 JSON 解析失败：', e.message); process.exit(2); }
}
const SEED = process.argv[4] !== undefined ? Number(process.argv[4]) : null;
const TICK_HZ = 10;

const { sim, pools, extra } = await loadWorld();

console.log(`无头闭环：${SECONDS}s（脑 ${TICK_HZ}Hz + 游戏 60fps）`
  + (cfgOverride ? `，配置覆盖 ${JSON.stringify(cfgOverride)}` : '')
  + (SEED !== null ? `，种子 ${SEED}` : ''));

const result = runEpisode({
  sim, pools, extra, seconds: SECONDS, cfgOverride, seed: SEED, tickHz: TICK_HZ,
  onEat: (t, score) => console.log(`  [t=${t.toFixed(1)}s] 吃到香蕉！得分 ${score}`),
  onLog: (t, game, r) => {
    const d = game.banana
      ? Math.hypot(game.banana.x - game.fly.x, game.banana.y - game.fly.y).toFixed(0)
      : '—';
    console.log(`t=${t.toFixed(0).padStart(4)}s 位置(${game.fly.x.toFixed(0)},${game.fly.y.toFixed(0)}) `
      + `距香蕉 ${d}px | desc L/R ${game.rateL.toFixed(0)}/${game.rateR.toFixed(0)} sp/s `
      + `| 饥饿 ${(game.hunger * 100).toFixed(0)}% | ${game.standby ? '待机' : '脑驱动'} `
      + `| 活跃神经元 ${r.activeNeurons}`);
  },
});

console.log(`\n结束：得分 ${result.score}，平均每 tick ${result.avgTickMs.toFixed(2)} ms`
  + (result.firstEatTime !== null
    ? `，首次吃香蕉 t=${result.firstEatTime.toFixed(1)}s（首段曲折度 ${result.firstTortuosity.toFixed(2)}）`
    : ''));
if (result.score === 0) {
  console.log('注意：未吃到香蕉（可能转向信号太弱，需调 turnGain/speedGain/standbyRate）');
} else {
  console.log('闭环验证通过：脑驱动行为真的吃到了香蕉 ✔');
}
