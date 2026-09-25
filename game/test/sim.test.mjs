/* sim.test.mjs —— Node 烟雾测试：验证 sim-core 解析、组重排与信号传播。
 *
 * 运行：node game/test/sim.test.mjs   （仓库根目录或 game/ 下均可）
 * 通过标准：退出码 0。断言：
 *   1. 神经元数 139255、边数 2698236（与二进制头及 neuron_meta.json 一致）
 *   2. olf_food_left 池以强度 0.5 持续刺激 50 tick 后，
 *      全网累计放电 > 0 且下游 central 区（region_type=1）有放电
 *      —— 证明信号确实从感觉池经真实连接组拓扑传播进了中枢。
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIFSim } from '../src/sim-core.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`  ✔ ${msg}`);
  else { failures++; console.error(`  ✘ ${msg}`); }
}

console.log('[1/4] 读取并解压 connectome.bin.gz（node:zlib 注入解压）');
const gz = readFileSync(join(dataDir, 'connectome.bin.gz'));
const gunzip = async (buf) => {
  const out = gunzipSync(Buffer.from(buf));
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
};

console.log('[2/4] 解析二进制 + 构建 CSR + 组重排');
const t0 = performance.now();
const sim = await LIFSim.fromBuffer(
  gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength), { gunzip });
console.log(`      初始化耗时 ${(performance.now() - t0).toFixed(0)} ms`);
assert(sim.N === 139255, `神经元数 = ${sim.N}（期望 139255）`);
assert(sim.edgeCount === 2698236, `边数 = ${sim.edgeCount}（期望 2698236）`);

console.log('[3/4] 加载 pools.json，校验池索引均在排序后空间内');
const pools = JSON.parse(readFileSync(join(dataDir, 'pools.json'), 'utf-8'));
const olfLeft = Uint32Array.from(pools.pools.olf_food_left);
assert(olfLeft.length > 0, `olf_food_left 池大小 = ${olfLeft.length}`);
let idxOk = true;
for (const arr of Object.values(pools.pools)) {
  for (const i of arr) if (i < 0 || i >= sim.N) { idxOk = false; break; }
}
assert(idxOk, '全部池索引落在 [0, N) 内');
// 池内神经元确实属于声明的功能组（抽查 olf_food_left 应全为组 6）
let groupOk = true;
for (const i of olfLeft) if (sim.groupId[i] !== 6) { groupOk = false; break; }
assert(groupOk, 'olf_food_left 池神经元均为组 6（OLF_ORN_FOOD）');

console.log('[4/4] 以强度 0.5 持续刺激 olf_food_left，运行 50 tick');
sim.setInput(olfLeft, new Float32Array(olfLeft.length).fill(0.5));
let totalFired = 0;
let centralFired = 0;
let sensoryFired = 0;
let tickMsSum = 0;
const TICKS = 50;
for (let t = 0; t < TICKS; t++) {
  const r = sim.tick();
  tickMsSum += r.tickMs;
  totalFired += r.firedCount;
  for (let k = 0; k < r.firedCount; k++) {
    const rt = sim.regionType[r.firedIndices[k]];
    if (rt === 1) centralFired++;
    else if (rt === 0) sensoryFired++;
  }
}
console.log(`      50 tick 累计放电 ${totalFired}（感觉区 ${sensoryFired}，中枢 ${centralFired}）`);
console.log(`      平均每 tick 耗时 ${(tickMsSum / TICKS).toFixed(2)} ms`);
assert(totalFired > 0, `全网累计放电 ${totalFired} > 0`);
assert(centralFired > 0, `下游 central 区放电 ${centralFired} > 0（信号传播进中枢）`);

if (failures > 0) {
  console.error(`\n测试失败：${failures} 项断言未通过`);
  process.exit(1);
}
console.log('\n全部断言通过 ✔');
process.exit(0);
