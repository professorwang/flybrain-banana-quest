/* probe_malecns.mjs —— MaleCNS 跨数据集探针：复现 TECH-NOTE 在 FlyWire 上的三个发现。
 *
 * 运行：node game/tools/probe_malecns.mjs
 * 探针：
 *   1. 权重分布（原始突触计数的 max/median/p90/p99，重尾检验）
 *   2. Finding 1：global-max 归一化下 0.5 强度刺激 olf_left 100 tick，
 *      测中枢放电与下游组最大膜电压（传播失败是否复现）
 *   3. targetInput 扫描 1/2/3/4（per-neuron 归一化的工作点与癫痫边界）
 *   4. Finding 2：单侧嗅觉刺激下 desc_left/desc_right 放电对比（结构性偏置检验；
 *      MaleCNS 池用原生 somaSide，比 FlyWire 的坐标切半更干净）
 * 输出：markdown 表格到 stdout（重定向进 game/docs/malecns-probes.md 的数据节）。
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIFSim, DEFAULTS } from '../src/sim-core.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');

const gz = readFileSync(join(dataDir, 'connectome-malecns.bin.gz'));
const gunzip = async (b) => {
  const o = gunzipSync(Buffer.from(b));
  return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);
};
const rawBuf = await gunzip(gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength));
const poolsDef = JSON.parse(readFileSync(join(dataDir, 'pools_malecns.json'), 'utf-8'));
const metaDef = JSON.parse(readFileSync(join(dataDir, 'neuron_meta_malecns.json'), 'utf-8'));

async function buildSim(normalization) {
  // 每次从解压后的同一份 buffer 构建（parse 不修改 buffer）
  return LIFSim.fromBuffer(rawBuf, { normalization });
}

/* ---------- 探针 1：权重分布 ---------- */
console.log('## 探针 1：权重分布（原始突触计数，|w|）\n');
{
  const u32 = new Uint32Array(rawBuf, 0, 2);
  const E = u32[1];
  const f32 = new Float32Array(rawBuf, 8, E * 3);
  let max = 0;
  const sample = [];
  const step = Math.max(1, Math.floor(E / 25000));
  for (let e = 0; e < E; e++) {
    const aw = Math.abs(f32[e * 3 + 2]);
    if (aw > max) max = aw;
    if (e % step === 0) sample.push(aw);
  }
  sample.sort((a, b) => a - b);
  const pct = (p) => sample[Math.min(sample.length - 1, Math.floor(sample.length * p))];
  console.log(`| max | median | p90 | p99 | 样本数 |`);
  console.log(`|---|---|---|---|---|`);
  console.log(`| ${max.toFixed(0)} | ${pct(0.5).toFixed(0)} | ${pct(0.9).toFixed(0)} | ${pct(0.99).toFixed(0)} | ${sample.length} / ${E} |\n`);
}

/* ---------- 探针 2：global-max 归一化传播测试 ---------- */
console.log('## 探针 2：Finding 1 —— global-max 归一化（0.5 × 100 tick 刺激 olf_left）\n');
{
  DEFAULTS.targetInput = 3.0;
  const sim = await buildSim('global-max');
  const olfLeft = Uint32Array.from(poolsDef.pools.olf_left);
  sim.setInput(olfLeft, new Float32Array(olfLeft.length).fill(0.5));
  let total = 0, central = 0, sensory = 0, motor = 0;
  let ms = 0;
  const maxV = { OLF_PN: 0, MB_KC: 0, CB_INTRINSIC: 0, DN: 0 };
  const gidOf = { OLF_PN: 4, MB_KC: 13, CB_INTRINSIC: 17, DN: 22 };
  for (let t = 0; t < 100; t++) {
    const r = sim.tick();
    ms += r.tickMs;
    total += r.firedCount;
    for (let k = 0; k < r.firedCount; k++) {
      const rt = sim.regionType[r.firedIndices[k]];
      if (rt === 1) central++;
      else if (rt === 0) sensory++;
      else if (rt === 3) motor++;
    }
    for (const [name, g] of Object.entries(gidOf)) {
      for (let i = sim.groupOffset[g]; i < sim.groupOffset[g + 1]; i++) {
        if (sim.V[i] > maxV[name]) maxV[name] = sim.V[i];
      }
    }
  }
  console.log(`| 总放电 | 感觉区 | 中枢 | 运动区 | OLF_PN 最大V | MB_KC 最大V | CB_INTRINSIC 最大V | DN 最大V | avg tick |`);
  console.log(`|---|---|---|---|---|---|---|---|---|`);
  console.log(`| ${total} | ${sensory} | ${central} | ${motor} | ${maxV.OLF_PN.toFixed(3)} | ${maxV.MB_KC.toFixed(3)} | ${maxV.CB_INTRINSIC.toFixed(3)} | ${maxV.DN.toFixed(3)} | ${(ms / 100).toFixed(1)} ms |\n`);
}

/* ---------- 探针 3：targetInput 扫描 ---------- */
console.log('## 探针 3：targetInput 扫描（I=1.0 × 200 tick 刺激 olf_left）\n');
{
  const olfLeft = Uint32Array.from(poolsDef.pools.olf_left);
  console.log(`| targetInput | 总放电 | GNG 到达组 Top6 | DN(组22) | VIS_OL(组1，癫痫指标) | avg tick |`);
  console.log(`|---|---|---|---|---|---|`);
  for (const ti of [1.0, 2.0, 3.0, 4.0]) {
    DEFAULTS.targetInput = ti;
    const sim = await buildSim('per-neuron');
    sim.setInput(olfLeft, new Float32Array(olfLeft.length).fill(1.0));
    const cum = new Map();
    let ms = 0, total = 0;
    for (let t = 0; t < 200; t++) {
      const r = sim.tick();
      ms += r.tickMs;
      total += r.firedCount;
      for (let g = 0; g < r.groupSpikeCounts.length; g++) {
        if (r.groupSpikeCounts[g]) cum.set(g, (cum.get(g) || 0) + r.groupSpikeCounts[g]);
      }
    }
    const top = [...cum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([g, c]) => `${metaDef.groups[g].name}:${c}`).join(' ');
    console.log(`| ${ti} | ${total} | ${top} | ${cum.get(22) || 0} | ${cum.get(1) || 0} | ${(ms / 200).toFixed(1)} ms |`);
  }
  console.log('');
}

/* ---------- 探针 4：左右侧刺激的结构偏置 ---------- */
console.log('## 探针 4：Finding 2 —— 单侧嗅觉刺激的 desc 池偏置\n');
{
  const dL = new Set(poolsDef.pools.desc_left);
  const dR = new Set(poolsDef.pools.desc_right);
  const legL = new Set(poolsDef.pools.leg_motor_left);
  const legR = new Set(poolsDef.pools.leg_motor_right);
  console.log(`| targetInput | tick 数 | 刺激侧 | desc_left | desc_right | L/(L+R) | leg_motor_L | leg_motor_R |`);
  console.log(`|---|---|---|---|---|---|---|---|`);
  const variants = [
    { ti: 3.0, ticks: 200 },
    { ti: 4.0, ticks: 200 },
    { ti: 3.0, ticks: 400 },
    { ti: 4.0, ticks: 400 },
  ];
  for (const v of variants) {
    DEFAULTS.targetInput = v.ti;
    for (const side of ['olf_left', 'olf_right']) {
      const sim = await buildSim('per-neuron');
      const P = Uint32Array.from(poolsDef.pools[side]);
      sim.setInput(P, new Float32Array(P.length).fill(1.0));
      let l = 0, r = 0, ll = 0, lr = 0, firstDn = -1;
      for (let t = 0; t < v.ticks; t++) {
        const res = sim.tick();
        for (let k = 0; k < res.firedCount; k++) {
          const i = res.firedIndices[k];
          if (dL.has(i)) { l++; if (firstDn < 0) firstDn = t; }
          else if (dR.has(i)) { r++; if (firstDn < 0) firstDn = t; }
          else if (legL.has(i)) ll++;
          else if (legR.has(i)) lr++;
        }
      }
      console.log(`| ${v.ti} | ${v.ticks} | ${side} | ${l} | ${r} | ${(l / (l + r)).toFixed(3)} | ${ll} | ${lr} | （首个 DN 放电 tick ${firstDn}）`);
    }
  }
  console.log('');
}
console.log('探针完成。');
