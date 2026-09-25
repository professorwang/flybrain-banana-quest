/* harness.mjs —— 无头闭环共享库：加载脑+池、跑单个 episode。
 * headless_run.mjs（单次验证）与 tune_sweep.mjs（网格扫参）共用。
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIFSim } from '../src/sim-core.js';
import { Pools } from '../src/pools.js';
import { Game } from '../src/game.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, '..', 'data');

/* 加载连接组与池（一次进程一次，扫参时反复复用同一 sim，episode 间 sim.reset()） */
export async function loadWorld() {
  const gz = readFileSync(join(DATA_DIR, 'connectome.bin.gz'));
  const gunzip = async (b) => {
    const o = gunzipSync(Buffer.from(b));
    return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);
  };
  const sim = await LIFSim.fromBuffer(
    gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength), { gunzip });
  const pools = Pools.fromJSON(
    JSON.parse(readFileSync(join(DATA_DIR, 'pools.json'), 'utf-8')), sim.N);
  const selectByGroup = (gid) => {
    const out = [];
    for (let i = 0; i < sim.N; i++) if (sim.groupId[i] === gid) out.push(i);
    return Uint32Array.from(out);
  };
  const extra = { mechJo: selectByGroup(11), driveHunger: selectByGroup(37) };
  return { sim, pools, extra };
}

/* 线性同余发生器（可注入种子，替换 Math.random 用） */
export function makeLCG(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* 临时替换 Math.random，返回恢复函数 */
export function replaceRandom(rng) {
  const orig = Math.random;
  Math.random = rng;
  return () => { Math.random = orig; };
}

/**
 * 跑一个 episode（全速，无 real-time 节流）。
 * @returns { score, ateCount, firstEatTime|null, avgTickMs,
 *            firstTortuosity|null, totalPathLen, initialDist }
 *   firstTortuosity = 首次吃到前的爬行路程 / 初始距离（≈1 为直线冲刺，越大越"真实漫游"）
 */
export function runEpisode({ sim, pools, extra, seconds = 120, cfgOverride = null,
                             seed = null, tickHz = 10, onEat = null, onLog = null }) {
  const restore = (seed !== null && seed !== undefined) ? replaceRandom(makeLCG(seed)) : null;
  try {
    sim.reset();
    const game = new Game(pools, extra);
    if (cfgOverride) Object.assign(game.cfg, cfgOverride);
    game.placeBanana();
    const initialDist = Math.hypot(game.banana.x - game.fly.x, game.banana.y - game.fly.y);

    let simTime = 0, tickMsSum = 0, tickN = 0;
    let firstEatTime = null, ateCount = 0;
    let firstPathLen = 0, totalPathLen = 0;
    const totalTicks = Math.round(seconds * tickHz);
    const frameDt = 1 / 60;
    const framesPerTick = 6;
    let prevX = game.fly.x, prevY = game.fly.y;

    for (let t = 0; t < totalTicks; t++) {
      const stim = game.buildStimulus();
      sim.setInput(stim.indices, stim.intensities);
      const r = sim.tick();
      tickMsSum += r.tickMs; tickN++;
      game.onTick(pools.countReadout(r.firedIndices), tickHz);
      for (let f = 0; f < framesPerTick; f++) {
        const ev = game.update(frameDt);
        const step = Math.hypot(game.fly.x - prevX, game.fly.y - prevY);
        prevX = game.fly.x; prevY = game.fly.y;
        totalPathLen += step;
        if (firstEatTime === null) firstPathLen += step;
        simTime += frameDt;
        if (ev.ate) {
          ateCount++;
          if (firstEatTime === null) firstEatTime = simTime;
          if (onEat) onEat(simTime, game.score);
        }
      }
      if (onLog && t % (10 * tickHz) === 10 * tickHz - 1) {
        onLog(simTime, game, r);
      }
    }
    return {
      game,
      score: game.score,
      ateCount,
      firstEatTime,
      avgTickMs: tickMsSum / Math.max(1, tickN),
      firstTortuosity: firstEatTime !== null ? firstPathLen / Math.max(1, initialDist) : null,
      totalPathLen,
      initialDist,
    };
  } finally {
    if (restore) restore();
  }
}
