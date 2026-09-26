/* probe_signflip.mjs —— 符号翻转双向探针（充分性 + 必要性，固化脚本）。
 *
 * 运行：node game/tools/probe_signflip.mjs
 * 协议：postsynaptic L1 归一化，左嗅觉池 I=1.0 × 200 tick，ti=3.0/4.0。
 *   - MaleCNS 充分性：标准版（glut 抑制） vs glut 兴奋变体
 *     （python game/tools/flyb_to_bin.py --glut-excitatory 生成）
 *   - FlyWire 必要性：标准版（glut 兴奋） vs glut 抑制变体
 *     （python game/tools/build_flywire_variant.py 生成，含等价性自检）
 * 输出：两组对比表（总放电、下行神经元组、视叶组、Top4 组）。
 */
import { readFileSync, existsSync } from 'node:fs';
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

async function sweep(tag, connFile, poolsFile, poolName, metaFile, dnGid, visGid) {
  const gz = readFileSync(join(dataDir, connFile));
  const raw = await gunzip(gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength));
  const pools = JSON.parse(readFileSync(join(dataDir, poolsFile), 'utf-8'));
  const meta = JSON.parse(readFileSync(join(dataDir, metaFile), 'utf-8'));
  for (const ti of [3.0, 4.0]) {
    DEFAULTS.targetInput = ti;
    const sim = await LIFSim.fromBuffer(raw, { normalization: 'per-neuron' });
    const P = Uint32Array.from(pools.pools[poolName]);
    sim.setInput(P, new Float32Array(P.length).fill(1.0));
    const cum = new Map();
    let total = 0, ms = 0;
    for (let t = 0; t < 200; t++) {
      const r = sim.tick();
      ms += r.tickMs;
      total += r.firedCount;
      for (let g = 0; g < r.groupSpikeCounts.length; g++) {
        if (r.groupSpikeCounts[g]) cum.set(g, (cum.get(g) || 0) + r.groupSpikeCounts[g]);
      }
    }
    const top = [...cum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([g, c]) => `${meta.groups[g].name}:${c}`).join(' ');
    console.log(`| ${tag} | ${ti} | ${total} | ${cum.get(dnGid) || 0} | ${cum.get(visGid) || 0} | ${(ms / 200).toFixed(1)} | ${top} |`);
  }
}

console.log('## 符号翻转双向探针（I=1.0 × 200 tick）\n');
console.log('| 数据/变体 | ti | 总放电 | 下行组放电 | 视叶组放电 | avgTick(ms) | Top4 组 |');
console.log('|---|---|---|---|---|---|---|');

// FlyWire：DN=组35 GNG_DESC，视叶=组2 VIS_ME
await sweep('FlyWire 标准版(glut兴奋)', 'connectome.bin.gz', 'pools.json', 'olf_food_left', 'neuron_meta.json', 35, 2);
const fwVar = join(dataDir, 'connectome-flywire-glutinh.bin.gz');
if (existsSync(fwVar)) {
  await sweep('FlyWire 变体(glut抑制)', 'connectome-flywire-glutinh.bin.gz', 'pools.json', 'olf_food_left', 'neuron_meta.json', 35, 2);
} else {
  console.log('| FlyWire 变体 | — | 缺失：先运行 python game/tools/build_flywire_variant.py | | | | |');
}

// MaleCNS：DN=组22，视叶=组1 VIS_OL
await sweep('MaleCNS 标准版(glut抑制)', 'connectome-malecns.bin.gz', 'pools_malecns.json', 'olf_left', 'neuron_meta_malecns.json', 22, 1);
const mcVar = join(dataDir, 'connectome-malecns-glutexc.bin.gz');
if (existsSync(mcVar)) {
  await sweep('MaleCNS 变体(glut兴奋)', 'connectome-malecns-glutexc.bin.gz', 'pools_malecns.json', 'olf_left', 'neuron_meta_malecns.json', 22, 1);
} else {
  console.log('| MaleCNS 变体 | — | 缺失：先运行 python game/tools/flyb_to_bin.py --glut-excitatory | | | | |');
}
console.log('\n探针完成。');
