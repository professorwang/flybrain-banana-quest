/* probe_linear.mjs —— E3：换权重方案后符号干预是否仍成立（v5.2 新增，固化脚本）。
 *
 * 运行：node game/tools/probe_linear.mjs > game/docs/results/probe_linear.txt
 *       （前置：python game/tools/export_sign_tables.py）
 * 问题：v5.1 的结论建立在本项目自选的 postsynaptic L1 归一化上（每个神经元总入权重
 *   强制为 ti，与其突触数无关）。这里改用"每突触固定系数"（linear：w = 带符号突触数 ×
 *   synScale，不做逐神经元归一化——与 Shiu et al. 的 w_syn 方案同类），扫 synScale，
 *   在同一刺激（左嗅觉池 I=1.0 × 200 tick）下对比 GLUT 两种赋号。
 * 量级参照（仅作 orientation，本内核是离散 tick LIF，不是 Shiu 的 Brian2 模型）：
 *   按 1 tick≈1 ms 解读（leak 0.95/tick ⇒ τ≈19.5 tick，接近 Shiu 的 τ_m=20 ms），匹配
 *   Shiu 参数（w_syn=0.275 mV、τ_syn=5 ms、τ_m=20 ms、阈-静息差 7 mV）的时间积分 PSP
 *   ≈0.010 阈值单位/突触，峰值匹配 ≈0.006。
 * E3b：在 synScale=0.01 下重复 E1 的 C-match 匹配对照（5 个种子）。
 * E3c：在 synScale=0.01 下重复 E1b 的等质量身份检验（φ=0.5/1.0，5 个种子）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIFSim, DEFAULTS } from '../src/sim-core.js';
import {
  DATA, loadFlyWire, buildFlyWire, flywireGlutUnits, loadMaleCNS, buildMaleCNS, malecnsGlutUnits, maskOf,
  flywireControlCandidates, malecnsControlCandidates, matchedSample, makeRng, randomSubset, massByGroup, trimToProfile,
} from './variants.mjs';

const TICKS = 200;
const SCALES = [0.0025, 0.005, 0.0075, 0.01, 0.015, 0.02, 0.03, 0.04];
const log = (...a) => console.error(...a);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

async function run(buf, pool, opts) {
  const sim = await LIFSim.fromBuffer(buf, opts);
  sim.setInput(pool.idx, new Float32Array(pool.idx.length).fill(1.0));
  const acc = { total: 0, kc: 0, dn: 0, vis: 0, sensory: 0 };
  for (let t = 0; t < TICKS; t++) {
    const r = sim.tick();
    acc.total += r.firedCount;
    acc.kc += r.groupSpikeCounts[pool.kc];
    acc.dn += r.groupSpikeCounts[pool.dn];
    acc.vis += r.groupSpikeCounts[pool.vis];
    for (const g of pool.sensoryGroups) acc.sensory += r.groupSpikeCounts[g];
  }
  acc.maxAbsW = sim.maxAbsW;
  return acc;
}

console.log('# E3：每突触固定系数（linear）下的符号干预（probe_linear.mjs）\n');
console.log('命令：node game/tools/probe_linear.mjs（前置：python game/tools/export_sign_tables.py）');
console.log(`Node ${process.version}；左嗅觉池 I=1.0 × ${TICKS} tick；w = 带符号突触数 × synScale；阈值 1、leak 0.95、不应期 3（与 per-neuron 探针相同）。\n`);

const fw = loadFlyWire();
const mc = loadMaleCNS();
const fwPools = JSON.parse(readFileSync(join(DATA, 'pools.json'), 'utf-8'));
const mcPools = JSON.parse(readFileSync(join(DATA, 'pools_malecns.json'), 'utf-8'));
const fwMeta = JSON.parse(readFileSync(join(DATA, 'neuron_meta.json'), 'utf-8'));
const mcMeta = JSON.parse(readFileSync(join(DATA, 'neuron_meta_malecns.json'), 'utf-8'));
const sensoryOf = (meta) => meta.groups.filter((g) => g.region === 'sensory').map((g) => g.id);
const fwPool = { idx: Uint32Array.from(fwPools.pools.olf_food_left), kc: 17, dn: 35, vis: 2, sensoryGroups: sensoryOf(fwMeta) };
const mcPool = { idx: Uint32Array.from(mcPools.pools.olf_left), kc: 13, dn: 22, vis: 1, sensoryGroups: sensoryOf(mcMeta) };

const graphs = [
  ['FlyWire 标准(GLUT+)', buildFlyWire(fw, null, null), fwPool],
  ['FlyWire GLUT−', buildFlyWire(fw, maskOf(fw.N, flywireGlutUnits(fw)), null), fwPool],
  ['MaleCNS 标准(GLUT−)', buildMaleCNS(mc, null), mcPool],
  ['MaleCNS GLUT+', buildMaleCNS(mc, maskOf(mc.N, malecnsGlutUnits(mc))), mcPool],
];

// 参考实现 global-max 的每突触等效系数
console.log('## 每突触等效系数对照\n');
console.log('| 数据 | max|w|（突触数） | global-max 0.15 等效 | ×10 增益等效 | Shiu 匹配参照 |');
console.log('|---|---|---|---|---|');
for (const [tag, buf, pool] of [graphs[0], graphs[2]]) {
  const r = await run(buf, pool, { normalization: 'global-max' });
  const s = DEFAULTS.weightScale / r.maxAbsW;
  console.log(`| ${tag.split(' ')[0]} | ${fmt(r.maxAbsW)} | ${s.toExponential(2)} | ${(10 * s).toExponential(2)} | 0.006–0.010 |`);
}

console.log('\n## synScale 扫描（KC=蘑菇体 Kenyon 细胞；DN=下行组；VIS=视叶组；中枢=总放电−感觉组）\n');
console.log('| synScale | 图 | 总放电 | 中枢 | KC | DN | VIS |');
console.log('|---|---|---|---|---|---|---|');
for (const s of SCALES) {
  for (const [tag, buf, pool] of graphs) {
    const r = await run(buf, pool, { normalization: 'linear', synScale: s });
    console.log(`| ${s} | ${tag} | ${fmt(r.total)} | ${fmt(r.total - r.sensory)} | ${fmt(r.kc)} | ${fmt(r.dn)} | ${fmt(r.vis)} |`);
    log(`E3 s=${s} ${tag}: vis=${r.vis} dn=${r.dn}`);
  }
}
// ---------------- E3b：linear 方案下的匹配对照 ----------------
// 在 Shiu 匹配量级（synScale=0.01）下重复 E1 的 C-match（组+质量匹配、逐组封顶），
// 回答"非谷氨酸的同等质量翻转能否复现谷氨酸翻转的效应"是否依赖归一化方案。
const S_CTRL = 0.01;
const SEEDS = [1, 2, 3, 4, 5];
const E3C = [];
console.log(`\n## E3b：linear（synScale=${S_CTRL}）下的匹配对照（C-match，逐组封顶；5 个种子，中位数 [最小–最大]）\n`);
console.log('| 数据 | 变体 | 翻转质量/谷氨酸质量 | 总放电 | DN | VIS |');
console.log('|---|---|---|---|---|---|');
const stats = (xs) => { const s = xs.slice().sort((a, b) => a - b); return { min: s[0], med: s[(s.length - 1) >> 1], max: s[s.length - 1] }; };
const fmtS = (xs) => { const s = stats(xs); return `${fmt(s.med)} [${fmt(s.min)}–${fmt(s.max)}]`; };
for (const D of [
  { tag: 'FlyWire', pool: fwPool, N: fw.N, group: fw.group, targets: flywireGlutUnits(fw), tMass: fw.glutMass,
    cand: flywireControlCandidates(fw), cMass: fw.excMass, build: (l) => buildFlyWire(fw, null, maskOf(fw.N, l)),
    buildGlut: (l) => buildFlyWire(fw, maskOf(fw.N, l), null), std: graphs[0][1], all: graphs[1][1], dir: 'GLUT−' },
  { tag: 'MaleCNS', pool: mcPool, N: mc.N, group: mc.group, targets: malecnsGlutUnits(mc), tMass: mc.outMass,
    cand: malecnsControlCandidates(mc), cMass: mc.outMass, build: (l) => buildMaleCNS(mc, maskOf(mc.N, l)),
    buildGlut: (l) => buildMaleCNS(mc, maskOf(mc.N, l)), std: graphs[2][1], all: graphs[3][1], dir: 'GLUT+' },
]) {
  const opts = { normalization: 'linear', synScale: S_CTRL };
  const a = await run(D.std, D.pool, opts), b = await run(D.all, D.pool, opts);
  console.log(`| ${D.tag} | 标准 | — | ${fmt(a.total)} | ${fmt(a.dn)} | ${fmt(a.vis)} |`);
  console.log(`| ${D.tag} | 全部谷氨酸翻转（${D.dir}） | 1.00 | ${fmt(b.total)} | ${fmt(b.dn)} | ${fmt(b.vis)} |`);
  const rows = [];
  for (const seed of SEEDS) {
    const m = matchedSample(D.targets, D.tMass, D.cand, D.cMass, D.group, true, makeRng(seed * 7919 + 1));
    const r = await run(D.build(m.chosen), D.pool, opts);
    rows.push({ mr: m.chosenMass / m.targetMass, r });
    log(`E3b ${D.tag} seed ${seed}: vis=${r.vis}`);
  }
  const mr = stats(rows.map((x) => x.mr));
  console.log(`| ${D.tag} | C-match 对照 | ${mr.med.toFixed(2)} [${mr.min.toFixed(2)}–${mr.max.toFixed(2)}] | ${fmtS(rows.map((x) => x.r.total))} | ${fmtS(rows.map((x) => x.r.dn))} | ${fmtS(rows.map((x) => x.r.vis))} |`);
  E3C.push(D);
}

// ---------------- E3c：linear 方案下的等质量身份检验 ----------------
// 与 probe_controls.mjs 的 E1b 同一设计：谷氨酸子集与 C-match 对照逐组质量相同、只差递质身份。
console.log(`\n## E3c：linear（synScale=${S_CTRL}）下的等质量身份检验（5 个种子，中位数 [最小–最大]）\n`);
console.log('| 数据 | φ | 谷氨酸子集质量 | 对照质量 | 谷氨酸子集 VIS | 对照 VIS | 谷氨酸子集 DN | 对照 DN |');
console.log('|---|---|---|---|---|---|---|---|');
for (const D of E3C) {
  const full = D.targets.reduce((a, i) => a + D.tMass[i], 0);
  const opts = { normalization: 'linear', synScale: S_CTRL };
  for (const phi of [0.5, 1.0]) {
    const rows = [];
    for (const seed of SEEDS) {
      const rnd = makeRng(700000 + Math.round(phi * 1000) * 100 + seed);
      const sub = phi >= 1 ? D.targets.slice() : randomSubset(D.targets, phi, rnd);
      const ctl = matchedSample(sub, D.tMass, D.cand, D.cMass, D.group, true, rnd);
      const g2 = trimToProfile(sub, D.tMass, D.group, massByGroup(ctl.chosen, D.cMass, D.group), rnd);
      const rg = await run(D.buildGlut(g2), D.pool, opts);
      const rc = await run(D.build(ctl.chosen), D.pool, opts);
      rows.push({ gm: g2.reduce((a, i) => a + D.tMass[i], 0) / full, cm: ctl.chosenMass / full, rg, rc });
      log(`E3c ${D.tag} phi=${phi} seed ${seed}: glut vis=${rg.vis} ctl vis=${rc.vis}`);
    }
    const gm = stats(rows.map((x) => x.gm)), cm = stats(rows.map((x) => x.cm));
    console.log(`| ${D.tag} | ${phi} | ${gm.med.toFixed(3)} | ${cm.med.toFixed(3)} | ${fmtS(rows.map((x) => x.rg.vis))} | ${fmtS(rows.map((x) => x.rc.vis))} | ${fmtS(rows.map((x) => x.rg.dn))} | ${fmtS(rows.map((x) => x.rc.dn))} |`);
  }
}
console.log('\n质量均以"全部谷氨酸规则翻转的突触质量"为 1。');
console.log('\n探针完成。');
