/* probe_flywire.mjs —— FlyWire FAFB v783 探针（与 probe_malecns.mjs 对齐的固化版；
 * 取代 v1 技术报告中散落的 inline 探针，使全部数字可由本脚本一票复现）。
 *
 * 运行：node game/tools/probe_flywire.mjs
 * 探针：
 *   1. 权重分布（原始 |w| 的 max/median/p90/p99）
 *   2. Finding 1：global-max 归一化（参考增益 0.15）0.5 × 100 tick 刺激 olf_food_left
 *   3. targetInput 扫描 1/2/3/4（postsynaptic L1 归一化）
 *   4. Finding 2：单侧嗅觉刺激 desc_left/desc_right 偏置表（ti=3.0, I=1.0 × 200 tick）
 *   5. 增益复测：global-max 增益系数 ×1/×10（评审 R6 复现）
 * 输出：markdown 表格到 stdout。
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIFSim, DEFAULTS } from '../src/sim-core.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');

const gz = readFileSync(join(dataDir, 'connectome.bin.gz'));
const gunzip = async (b) => {
  const o = gunzipSync(Buffer.from(b));
  return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);
};
const rawBuf = await gunzip(gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength));
const poolsDef = JSON.parse(readFileSync(join(dataDir, 'pools.json'), 'utf-8'));
const metaDef = JSON.parse(readFileSync(join(dataDir, 'neuron_meta.json'), 'utf-8'));

const buildSim = (normalization) => LIFSim.fromBuffer(rawBuf, { normalization });

/* ---------- 探针 1：权重分布 ---------- */
console.log('## 探针 1：权重分布（原始突触计数，|w|）\n');
{
  const u32 = new Uint32Array(rawBuf, 0, 2);
  const E = u32[1];
  const f32 = new Float32Array(rawBuf, 8, E * 3);
  let max = 0, nonzeroMin = Infinity;
  const sample = [];
  const step = Math.max(1, Math.floor(E / 25000));
  for (let e = 0; e < E; e++) {
    const aw = Math.abs(f32[e * 3 + 2]);
    if (aw > max) max = aw;
    if (aw > 0 && aw < nonzeroMin) nonzeroMin = aw;
    if (e % step === 0) sample.push(aw);
  }
  sample.sort((a, b) => a - b);
  const pct = (p) => sample[Math.min(sample.length - 1, Math.floor(sample.length * p))];
  console.log(`| max | median | p90 | p99 | 非零最小 | 样本数 |`);
  console.log(`|---|---|---|---|---|---|`);
  console.log(`| ${max.toFixed(0)} | ${pct(0.5).toFixed(0)} | ${pct(0.9).toFixed(0)} | ${pct(0.99).toFixed(0)} | ${nonzeroMin.toFixed(4)} | ${sample.length} / ${E} |\n`);
}

/* ---------- 探针 2：global-max（参考增益 0.15）传播测试 ---------- */
console.log('## 探针 2：Finding 1 —— global-max（参考增益 0.15，0.5 × 100 tick 刺激 olf_food_left）\n');
function probe2(gainScale) {
  return (async () => {
    DEFAULTS.targetInput = 3.0;
    const sim = await buildSim('global-max');
    if (gainScale !== 1) for (let e = 0; e < sim.edgeCount; e++) sim.values[e] *= gainScale;
    const P = Uint32Array.from(poolsDef.pools.olf_food_left);
    sim.setInput(P, new Float32Array(P.length).fill(0.5));
    let total = 0, central = 0, sensory = 0, motor = 0, ms = 0;
    let maxVpn = 0;
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
      for (let i = sim.groupOffset[9]; i < sim.groupOffset[10]; i++) {
        if (sim.V[i] > maxVpn) maxVpn = sim.V[i];
      }
    }
    return { total, central, sensory, motor, maxVpn, avgMs: ms / 100 };
  })();
}
{
  const r = await probe2(1);
  console.log(`| 总放电 | 感觉区 | 中枢 | 运动区 | OLF_PN 最大V | avg tick |`);
  console.log(`|---|---|---|---|---|---|`);
  console.log(`| ${r.total} | ${r.sensory} | ${r.central} | ${r.motor} | ${r.maxVpn.toFixed(3)} | ${r.avgMs.toFixed(1)} ms |\n`);
}

/* ---------- 探针 3：targetInput 扫描 ---------- */
console.log('## 探针 3：targetInput 扫描（I=1.0 × 200 tick 刺激 olf_food_left）\n');
{
  const P = Uint32Array.from(poolsDef.pools.olf_food_left);
  console.log(`| targetInput | 总放电 | 到达组 Top6 | GNG_DESC(组35) | VIS_ME(组2，癫痫指标) | avg tick |`);
  console.log(`|---|---|---|---|---|---|`);
  for (const ti of [1.0, 2.0, 3.0, 4.0]) {
    DEFAULTS.targetInput = ti;
    const sim = await buildSim('per-neuron');
    sim.setInput(P, new Float32Array(P.length).fill(1.0));
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
    console.log(`| ${ti} | ${total} | ${top} | ${cum.get(35) || 0} | ${cum.get(2) || 0} | ${(ms / 200).toFixed(1)} ms |`);
  }
  console.log('');
}

/* ---------- 探针 4：左右侧刺激的结构偏置 ---------- */
console.log('## 探针 4：Finding 2 —— 单侧嗅觉刺激的 desc 池偏置（ti=3.0, I=1.0 × 200 tick）\n');
{
  DEFAULTS.targetInput = 3.0;
  const dL = new Set(poolsDef.pools.desc_left);
  const dR = new Set(poolsDef.pools.desc_right);
  console.log(`| 刺激侧 | desc_left | desc_right | L/(L+R) | 首个 desc 放电 tick |`);
  console.log(`|---|---|---|---|---|`);
  for (const side of ['olf_food_left', 'olf_food_right']) {
    const sim = await buildSim('per-neuron');
    const P = Uint32Array.from(poolsDef.pools[side]);
    sim.setInput(P, new Float32Array(P.length).fill(1.0));
    let l = 0, r = 0, first = -1;
    for (let t = 0; t < 200; t++) {
      const res = sim.tick();
      for (let k = 0; k < res.firedCount; k++) {
        const i = res.firedIndices[k];
        if (dL.has(i)) { l++; if (first < 0) first = t; }
        else if (dR.has(i)) { r++; if (first < 0) first = t; }
      }
    }
    console.log(`| ${side} | ${l} | ${r} | ${(l / (l + r)).toFixed(3)} | ${first} |`);
  }
  console.log('');
}

/* ---------- 探针 5：global-max 增益复测（评审 R6） ---------- */
console.log('## 探针 5：global-max 增益复测（0.5 × 100 tick，增益系数 ×1/×10）\n');
{
  console.log(`| 增益系数 | 总放电 | 感觉区 | 中枢 | 运动区 |`);
  console.log(`|---|---|---|---|---|`);
  for (const g of [1, 10]) {
    const r = await probe2(g);
    console.log(`| 0.15 × ${g} | ${r.total} | ${r.sensory} | ${r.central} | ${r.motor} |`);
  }
  console.log('');
}
console.log('探针完成。');
