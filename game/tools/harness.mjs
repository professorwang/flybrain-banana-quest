/* harness.mjs —— 无头闭环共享库：加载脑+池、跑单个 episode。
 * headless_run.mjs（单次验证）与 tune_sweep.mjs（网格扫参）共用。
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIFSim } from '../src/sim-core.js';
import { Pools, FLYWIRE_KEYS, MALECNS_KEYS } from '../src/pools.js';
import { Game } from '../src/game.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, '..', 'data');

/* 数据集配置（与 src/main.js 的 DATASETS 对应；Node 工具无 location，自行传名） */
export const DATASET_FILES = {
  flywire: {
    connectome: 'connectome.bin.gz', pools: 'pools.json', keys: FLYWIRE_KEYS,
    targetInput: 3.0, extraGroups: { mechJo: 11, driveHunger: 37 },
  },
  malecns: {
    connectome: 'connectome-malecns.bin.gz', pools: 'pools_malecns.json', keys: MALECNS_KEYS,
    targetInput: 4.0, extraGroups: { mechJo: null, driveHunger: 21 },
    cfgDefaults: { olfGain: 2.0, gusIntensity: 1.6, standbyRate: 3 },  // 见 src/main.js DATASETS
  },
};

/* 加载连接组与池（一次进程一次，扫参时反复复用同一 sim，episode 间 sim.reset()） */
export async function loadWorld(dataset = 'flywire') {
  const ds = DATASET_FILES[dataset] || DATASET_FILES.flywire;
  const gz = readFileSync(join(DATA_DIR, ds.connectome));
  const gunzip = async (b) => {
    const o = gunzipSync(Buffer.from(b));
    return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);
  };
  const sim = await LIFSim.fromBuffer(
    gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength),
    { gunzip, targetInput: ds.targetInput });
  const pools = Pools.fromJSON(
    JSON.parse(readFileSync(join(DATA_DIR, ds.pools), 'utf-8')), sim.N, ds.keys);
  const selectByGroup = (gid) => {
    if (gid === null || gid === undefined) return null;
    const out = [];
    for (let i = 0; i < sim.N; i++) if (sim.groupId[i] === gid) out.push(i);
    return Uint32Array.from(out);
  };
  const extra = {
    mechJo: selectByGroup(ds.extraGroups.mechJo),
    driveHunger: selectByGroup(ds.extraGroups.driveHunger),
  };
  return { sim, pools, extra, dataset, cfgDefaults: ds.cfgDefaults || null };
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
                             cfgDefaults = null, seed = null, tickHz = 10, onEat = null, onLog = null }) {
  const restore = (seed !== null && seed !== undefined && !Number.isNaN(seed))
    ? replaceRandom(makeLCG(seed)) : null;
  try {
    sim.reset();
    const game = new Game(pools, extra);
    if (cfgDefaults) Object.assign(game.cfg, cfgDefaults);   // 数据集级默认（可被 cfgOverride 覆盖）
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
