/* probe_supplementary.mjs —— MaleCNS 补充探针（进食/逃逸/上行链，v4.1 固化脚本，
 * 取代 v3 时期的 inline `node -e` 探针）。
 *
 * 运行：node game/tools/probe_supplementary.mjs
 * 探针（postsynaptic L1 归一化，ti=4.0）：
 *   1. 进食链：gus 池 I=1.2 × 30 tick → feed_readout（MN9 类，16 个 cb_motor）放电
 *   2. 逃逸链：mech_bristle 2.0 脉冲 + 0.8 持续 × 20 tick → DNp01 放电 + AN(组18) 累计
 *   3. 嗅觉→上行：olf_left I=1.0 × 200 tick → AN(组18) / DN(组22) 累计
 * 输出：markdown 表到 stdout。
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIFSim, DEFAULTS } from '../src/sim-core.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const gunzip = async (b) => {
  const o = gunzipSync(Buffer.from(b));
  return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);
};

DEFAULTS.targetInput = 4.0;
const gz = readFileSync(join(dataDir, 'connectome-malecns.bin.gz'));
const raw = await gunzip(gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength));
const poolsDef = JSON.parse(readFileSync(join(dataDir, 'pools_malecns.json'), 'utf-8'));

const G_AN = 18, G_DN = 22;

/* 1. 进食链 */
{
  const sim = await LIFSim.fromBuffer(raw, { normalization: 'per-neuron' });
  const feed = new Set(poolsDef.pools.feed_readout);
  const gus = Uint32Array.from(poolsDef.pools.gus);
  sim.setInput(gus, new Float32Array(gus.length).fill(1.2));
  let f = 0, first = -1;
  for (let t = 0; t < 30; t++) {
    const r = sim.tick();
    for (let k = 0; k < r.firedCount; k++) {
      if (feed.has(r.firedIndices[k])) { f++; if (first < 0) first = t; }
    }
  }
  console.log(`| 进食链 | gus I=1.2 × 30 tick | feed_readout 放电 ${f} | 首个 tick ${first} |`);
}

/* 2. 逃逸链 */
{
  const sim = await LIFSim.fromBuffer(raw, { normalization: 'per-neuron' });
  const esc = new Set(poolsDef.pools.escape_readout);
  const mb = Uint32Array.from(poolsDef.pools.mech_bristle);
  sim.stimulate(mb, new Float32Array(mb.length).fill(2.0));
  sim.setInput(mb, new Float32Array(mb.length).fill(0.8));
  let e = 0, first = -1, an = 0;
  for (let t = 0; t < 20; t++) {
    const r = sim.tick();
    an += r.groupSpikeCounts[G_AN] || 0;
    for (let k = 0; k < r.firedCount; k++) {
      if (esc.has(r.firedIndices[k])) { e++; if (first < 0) first = t; }
    }
  }
  console.log(`| 逃逸链 | mech_bristle 2.0 脉冲 + 0.8 × 20 tick | DNp01 放电 ${e} | AN(组18) 累计 ${an} |`);
}

/* 3. 嗅觉→上行/下行 */
{
  const sim = await LIFSim.fromBuffer(raw, { normalization: 'per-neuron' });
  const ol = Uint32Array.from(poolsDef.pools.olf_left);
  sim.setInput(ol, new Float32Array(ol.length).fill(1.0));
  let an = 0, dn = 0;
  for (let t = 0; t < 200; t++) {
    const r = sim.tick();
    an += r.groupSpikeCounts[G_AN] || 0;
    dn += r.groupSpikeCounts[G_DN] || 0;
  }
  console.log(`| 嗅觉→上行 | olf_left I=1.0 × 200 tick | AN 累计 ${an} | DN 累计 ${dn} |`);
}
console.log('探针完成。');
