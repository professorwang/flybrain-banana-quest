/* headless_run.mjs —— 无头闭环验证：不依赖浏览器，直接驱动
 * LIFSim + Game 跑完整"嗅觉→脑→转向→进食"循环。
 *
 * 运行：node game/tools/headless_run.mjs [秒数=120]
 * 用途：浏览器端无法自动化时，验证游戏闭环在真实连接组上确实能吃到香蕉。
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIFSim } from '../src/sim-core.js';
import { Pools } from '../src/pools.js';
import { Game } from '../src/game.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const SECONDS = Number(process.argv[2] || 120);
const TICK_HZ = 10;

const gz = readFileSync(join(dataDir, 'connectome.bin.gz'));
const gunzip = async (b) => {
  const o = gunzipSync(Buffer.from(b));
  return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);
};
const sim = await LIFSim.fromBuffer(
  gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength), { gunzip });
const pools = Pools.fromJSON(
  JSON.parse(readFileSync(join(dataDir, 'pools.json'), 'utf-8')), sim.N);

const selectByGroup = (gid) => {
  const out = [];
  for (let i = 0; i < sim.N; i++) if (sim.groupId[i] === gid) out.push(i);
  return Uint32Array.from(out);
};
const game = new Game(pools, { mechJo: selectByGroup(11), driveHunger: selectByGroup(37) });
game.placeBanana();

console.log(`无头闭环：${SECONDS}s（脑 ${TICK_HZ}Hz + 游戏 60fps），香蕉初始位置`,
  game.banana && `(${game.banana.x.toFixed(0)}, ${game.banana.y.toFixed(0)})`);

// 复刻 main.js 的双时钟：脑 tick 10Hz，游戏帧 60fps
let tickMsSum = 0, tickN = 0;
let simTime = 0;
const totalTicks = SECONDS * TICK_HZ;
const FRAMES_PER_TICK = 6;
const frameDt = 1 / 60;

for (let t = 0; t < totalTicks; t++) {
  const stim = game.buildStimulus();
  sim.setInput(stim.indices, stim.intensities);
  const r = sim.tick();
  tickMsSum += r.tickMs; tickN++;
  const readout = pools.countReadout(r.firedIndices);
  game.onTick(readout, TICK_HZ);
  for (let f = 0; f < FRAMES_PER_TICK; f++) {
    const ev = game.update(frameDt);
    if (ev.ate) console.log(`  [t=${simTime.toFixed(1)}s] 吃到香蕉！得分 ${game.score}`);
    simTime += frameDt;
  }
  if (t % (10 * TICK_HZ) === 10 * TICK_HZ - 1) {
    const d = game.banana
      ? Math.hypot(game.banana.x - game.fly.x, game.banana.y - game.fly.y).toFixed(0)
      : '—';
    console.log(`t=${(simTime).toFixed(0).padStart(4)}s 位置(${game.fly.x.toFixed(0)},${game.fly.y.toFixed(0)}) `
      + `距香蕉 ${d}px | desc L/R ${game.rateL.toFixed(0)}/${game.rateR.toFixed(0)} sp/s `
      + `| 饥饿 ${(game.hunger * 100).toFixed(0)}% | ${game.standby ? '待机' : '脑驱动'} `
      + `| 活跃神经元 ${r.activeNeurons}`);
  }
}
console.log(`\n结束：得分 ${game.score}，平均每 tick ${(tickMsSum / tickN).toFixed(2)} ms`);
if (game.score === 0) {
  console.log('注意：未吃到香蕉（可能转向信号太弱，需调 turnGain/speedGain/standbyRate）');
} else {
  console.log('闭环验证通过：脑驱动行为真的吃到了香蕉 ✔');
}
