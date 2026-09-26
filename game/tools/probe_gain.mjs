/* probe_gain.mjs —— global-max 归一化的增益复测探针（评审 R6 固化脚本）。
 *
 * 运行：node game/tools/probe_gain.mjs
 * 协议：global-max 归一化，values 增益系数 ×1 / ×10（0.15 → 1.5），
 *       左嗅觉池 0.5 强度 × 100 tick，统计感觉/中枢/运动区放电。
 * 输出：双数据集 markdown 表（FlyWire + MaleCNS）。
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

async function run(tag, connFile, poolsFile, poolName) {
  const gz = readFileSync(join(dataDir, connFile));
  const raw = await gunzip(gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength));
  const pools = JSON.parse(readFileSync(join(dataDir, poolsFile), 'utf-8'));
  console.log(`### ${tag}（池 ${poolName}，0.5 × 100 tick）\n`);
  console.log('| 增益系数 | 总放电 | 感觉区 | 中枢 | 运动区 |');
  console.log('|---|---|---|---|---|');
  for (const g of [1, 10]) {
    DEFAULTS.targetInput = 3.0;
    const sim = await LIFSim.fromBuffer(raw, { normalization: 'global-max' });
    if (g !== 1) for (let e = 0; e < sim.edgeCount; e++) sim.values[e] *= g;
    const P = Uint32Array.from(pools.pools[poolName]);
    sim.setInput(P, new Float32Array(P.length).fill(0.5));
    let total = 0, central = 0, sensory = 0, motor = 0;
    for (let t = 0; t < 100; t++) {
      const r = sim.tick();
      total += r.firedCount;
      for (let k = 0; k < r.firedCount; k++) {
        const rt = sim.regionType[r.firedIndices[k]];
        if (rt === 1) central++;
        else if (rt === 0) sensory++;
        else if (rt === 3) motor++;
      }
    }
    console.log(`| 0.15 × ${g} | ${total} | ${sensory} | ${central} | ${motor} |`);
  }
  console.log('');
}

console.log('## global-max 增益复测（评审 R6）\n');
await run('FlyWire FAFB v783', 'connectome.bin.gz', 'pools.json', 'olf_food_left');
await run('MaleCNS v1.0', 'connectome-malecns.bin.gz', 'pools_malecns.json', 'olf_left');
console.log('探针完成。');
