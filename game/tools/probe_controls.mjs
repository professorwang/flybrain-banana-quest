/* probe_controls.mjs —— 符号干预的对照实验（v6 新增，固化脚本）。
 *
 * 运行：python game/tools/export_sign_tables.py   # 一次性导出中间表
 *       node game/tools/probe_controls.mjs > game/docs/results/probe_controls.txt
 * 协议（与 probe_signflip.mjs 相同）：postsynaptic L1 归一化，左嗅觉池 I=1.0 × 200 tick，
 *   ti=3.0/4.0；读出 = 全网总放电、下行神经元组、视叶组。
 *
 *   E0a 等价性自检：本库重建的标准图与两个 v5.1 变体与磁盘上的二进制逐字节一致。
 *   E0b 组休眠门控检验：v5.1 八行结果在"关闭门控"（alwaysActive）下是否不变。
 *   E1  匹配对照：随机翻转同等规模的非谷氨酸单位（每种子一次，10 个种子）。
 *       C-match：同功能组 + 同 log2 质量档配对（控制位置与强度），再逐组质量封顶；
 *       C-rand ：只匹配 log2 质量档（位置随机），再整体质量封顶。
 *       封顶 = 对照翻转的突触质量 ≤ 谷氨酸规则翻转的质量（保守：对照只会更弱）。
 *       FlyWire 方向 = 必要性（兴奋→抑制）；MaleCNS 方向 = 充分性（抑制→兴奋）。
 *   E1b 等质量身份检验：先抽比例 φ 的谷氨酸单位，再为其配 C-match 对照（逐组封顶），
 *       最后把谷氨酸子集逐组修剪到对照的质量——两者逐组质量相同、只差递质身份。
 *       在响应呈梯度而非饱和的剂量点比较（FlyWire φ=0.1/0.25；MaleCNS φ=0.9/1.0）。
 *   E2  剂量-反应：随机翻转比例 f 的谷氨酸单位（5 个种子）。
 * 全部逐次结果另存 game/docs/results/controls_runs.csv。
 */
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIFSim } from '../src/sim-core.js';
import {
  DATA, gunzipFile, makeRng, buffersEqual, loadFlyWire, buildFlyWire, flywireGlutUnits,
  flywireControlCandidates, loadMaleCNS, buildMaleCNS, malecnsGlutUnits, malecnsControlCandidates,
  matchedSample, randomSubset, maskOf, massByGroup, trimToProfile,
} from './variants.mjs';

const TICKS = 200;
const E1_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const E2_FRACS = [0.1, 0.25, 0.5, 0.75, 0.9];
const E2_SEEDS = [1, 2, 3, 4, 5];
const log = (...a) => console.error(...a);
const csv = ['experiment,dataset,variant,seed,frac,ti,gating,total,dn,vis,units_flipped,unmatched,mass_ratio,vis_group_mass_ratio'];

async function run(buf, pool, ti, alwaysActive = false) {
  const sim = await LIFSim.fromBuffer(buf, { normalization: 'per-neuron', targetInput: ti, alwaysActive });
  sim.setInput(pool.idx, new Float32Array(pool.idx.length).fill(1.0));
  let total = 0, dn = 0, vis = 0;
  for (let t = 0; t < TICKS; t++) {
    const r = sim.tick();
    total += r.firedCount;
    dn += r.groupSpikeCounts[pool.dn];
    vis += r.groupSpikeCounts[pool.vis];
  }
  return { total, dn, vis };
}

const stats = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { min: s[0], med, max: s[s.length - 1] };
};
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const fmtS = (xs) => { const s = stats(xs); return `${fmt(s.med)} [${fmt(s.min)}–${fmt(s.max)}]`; };

console.log('# 符号干预对照实验（probe_controls.mjs）\n');
console.log(`命令：node game/tools/probe_controls.mjs（前置：python game/tools/export_sign_tables.py）`);
console.log(`Node ${process.version}；协议：per-neuron L1，左嗅觉池 I=1.0 × ${TICKS} tick；放电计数逐次确定（无噪声），随机性只来自抽样种子。\n`);

// ---------------- 加载 ----------------
log('加载 FlyWire 中间表…');
const fw = loadFlyWire();
const fwPools = JSON.parse(readFileSync(join(DATA, 'pools.json'), 'utf-8'));
const fwPool = { idx: Uint32Array.from(fwPools.pools.olf_food_left), dn: 35, vis: 2, dnName: 'GNG_DESC', visName: 'VIS_ME' };
log('加载 MaleCNS…');
const mc = loadMaleCNS();
const mcPools = JSON.parse(readFileSync(join(DATA, 'pools_malecns.json'), 'utf-8'));
const mcPool = { idx: Uint32Array.from(mcPools.pools.olf_left), dn: 22, vis: 1, dnName: 'DN', visName: 'VIS_OL' };

const fwGlut = flywireGlutUnits(fw);
const fwCand = flywireControlCandidates(fw);
const mcGlut = malecnsGlutUnits(mc);
const mcCand = malecnsControlCandidates(mc);

const fwStd = buildFlyWire(fw, null, null);
const fwAll = buildFlyWire(fw, maskOf(fw.N, fwGlut), null);
const mcStd = buildMaleCNS(mc, null);
const mcAll = buildMaleCNS(mc, maskOf(mc.N, mcGlut));

// ---------------- E0a ----------------
console.log('## E0a 等价性自检\n');
const eq = [
  ['FlyWire 标准图 ≡ connectome.bin.gz', buffersEqual(fwStd, fw.shipped)],
  ['FlyWire 全部 glut 单位翻转 ≡ connectome-flywire-glutinh.bin.gz', buffersEqual(fwAll, gunzipFile(join(DATA, 'connectome-flywire-glutinh.bin.gz')))],
  ['MaleCNS 全部 glut 神经元翻转 ≡ connectome-malecns-glutexc.bin.gz', buffersEqual(mcAll, gunzipFile(join(DATA, 'connectome-malecns-glutexc.bin.gz')))],
];
for (const [k, v] of eq) console.log(`- ${k}：${v ? '逐字节一致 ✔' : '不一致 ✘'}`);
if (!eq.every((x) => x[1])) { console.log('\n自检失败，停止。'); process.exit(1); }
const sum = (idx, m) => idx.reduce((a, i) => a + m[i], 0);
console.log(`\n单位规模：FlyWire glut 单位（有 ≥1 条 GLUT 行的突触前神经元）${fwGlut.length}，其 GLUT 行突触 ${fmt(sum(fwGlut, fw.glutMass))}；` +
  `对照候选（整体标签 ACH/DA/SER/OCT）${fwCand.length}。`);
console.log(`MaleCNS glut 单位 ${mcGlut.length}，出突触 ${fmt(sum(mcGlut, mc.outMass))}；对照候选（GABA/histamine）${mcCand.length}，出突触 ${fmt(sum(mcCand, mc.outMass))}。\n`);

// ---------------- 数据统计（TECH-NOTE §2、§3.1 引用的计数，全部由中间表现算） ----------------
console.log('## 数据统计\n');
{
  const lc = {};
  for (const l of fw.label) lc[l || '(无标签)'] = (lc[l || '(无标签)'] || 0) + 1;
  const col = { ACH: 0, GABA: 1, GLUT: 2, DA: 3, SER: 4, OCT: 5 };
  let syn = 0, mis = 0;
  for (let p = 0; p < fw.P; p++) {
    const c = col[fw.label[fw.pre[p]]];
    for (let k = 0; k < 6; k++) { const v = fw.cnt[p * 6 + k]; syn += v; if (k !== c) mis += v; }
  }
  console.log(`- FlyWire 神经元整体递质标签：${Object.entries(lc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fmt(v)}`).join('；')}`);
  console.log(`- FlyWire 行级标签与突触前神经元整体标签不一致的突触：${fmt(mis)} / ${fmt(syn)} = ${(100 * mis / syn).toFixed(1)}%（无整体标签的神经元全部计为不一致）`);
  // 标准图 vs 全部 glut 翻转：边集与权重差异（两者边序均按 (pre, post) 升序，归并比较）
  const edges = (buf) => { const E = new Uint32Array(buf, 4, 1)[0]; return { E, u: new Uint32Array(buf, 8, E * 3), f: new Float32Array(buf, 8, E * 3) }; };
  const a = edges(fwStd), b = edges(fwAll);
  let i = 0, j = 0, onlyA = 0, onlyB = 0, changed = 0, magChanged = 0;
  const sa = new Float64Array(fw.N), sb = new Float64Array(fw.N);
  for (let e = 0; e < a.E; e++) sa[a.u[e * 3 + 1]] += Math.abs(a.f[e * 3 + 2]);
  for (let e = 0; e < b.E; e++) sb[b.u[e * 3 + 1]] += Math.abs(b.f[e * 3 + 2]);
  while (i < a.E || j < b.E) {
    const ka = i < a.E ? a.u[i * 3] * fw.N + a.u[i * 3 + 1] : Infinity;
    const kb = j < b.E ? b.u[j * 3] * fw.N + b.u[j * 3 + 1] : Infinity;
    if (ka === kb) {
      const x = a.f[i * 3 + 2], y = b.f[j * 3 + 2];
      if (x !== y) { changed++; if (Math.abs(x) !== Math.abs(y)) magChanged++; }
      i++; j++;
    }
    else if (ka < kb) { onlyA++; i++; } else { onlyB++; j++; }
  }
  let den = 0;
  for (let n = 0; n < fw.N; n++) if (sa[n] !== sb[n]) den++;
  console.log(`- FlyWire 无符号对数 ${fmt(fw.P)}；标准图边数 ${fmt(a.E)}（符号抵消丢弃 ${fmt(fw.P - a.E)} 对）`);
  console.log(`- 标准图 vs GLUT 抑制变体：边数 ${fmt(a.E)} vs ${fmt(b.E)}（仅标准图 ${fmt(onlyA)}、仅变体 ${fmt(onlyB)}），共有边中权重改变 ${fmt(changed)}（仅符号 ${fmt(changed - magChanged)}、幅值也变 ${fmt(magChanged)}），L1 分母改变的神经元 ${fmt(den)}`);
  const mcc = {};
  for (let n = 0; n < mc.N; n++) { const k = `${mc.nts[mc.nt[n]] || '(无)'}(${mc.sign[n] > 0 ? '+' : '−'})`; mcc[k] = (mcc[k] || 0) + 1; }
  console.log(`- MaleCNS 递质(符号)：${Object.entries(mcc).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${fmt(v)}`).join('；')}`);
  const fwMeta = JSON.parse(readFileSync(join(DATA, 'neuron_meta.json'), 'utf-8'));
  const mcMeta = JSON.parse(readFileSync(join(DATA, 'neuron_meta_malecns.json'), 'utf-8'));
  console.log(`- 视叶组规模：FlyWire VIS_ME ${fmt(fwMeta.groups[2].neuron_count)}；MaleCNS VIS_OL ${fmt(mcMeta.groups[1].neuron_count)}\n`);
}

// ---------------- E0b ----------------
console.log('## E0b 组休眠门控检验（v5.1 八行，门控开 vs 关）\n');
console.log('| 图 | ti | 门控开：总/下行/视叶 | 门控关：总/下行/视叶 | 一致 |');
console.log('|---|---|---|---|---|');
const ref = {};
for (const [tag, buf, pool, ds] of [
  ['FlyWire 标准(GLUT+)', fwStd, fwPool, 'flywire'], ['FlyWire GLUT−', fwAll, fwPool, 'flywire'],
  ['MaleCNS 标准(GLUT−)', mcStd, mcPool, 'malecns'], ['MaleCNS GLUT+', mcAll, mcPool, 'malecns']]) {
  for (const ti of [3, 4]) {
    const a = await run(buf, pool, ti, false);
    const b = await run(buf, pool, ti, true);
    ref[`${tag}|${ti}`] = a;
    const same = a.total === b.total && a.dn === b.dn && a.vis === b.vis;
    console.log(`| ${tag} | ${ti} | ${fmt(a.total)} / ${fmt(a.dn)} / ${fmt(a.vis)} | ${fmt(b.total)} / ${fmt(b.dn)} / ${fmt(b.vis)} | ${same ? '是' : '否'} |`);
    csv.push(`E0b,${ds},${tag},,,${ti},on,${a.total},${a.dn},${a.vis},,,,`);
    csv.push(`E0b,${ds},${tag},,,${ti},off,${b.total},${b.dn},${b.vis},,,,`);
    log(`E0b ${tag} ti=${ti} done`);
  }
}

// ---------------- E1 ----------------
console.log('\n## E1 匹配对照（10 个种子；中位数 [最小–最大]）\n');
const DS = [
  { ds: 'flywire', tag: 'FlyWire（必要性方向：兴奋→抑制）', pool: fwPool, N: fw.N, group: fw.group,
    targets: fwGlut, tMass: fw.glutMass, cand: fwCand, cMass: fw.excMass,
    build: (list) => buildFlyWire(fw, null, maskOf(fw.N, list)),
    buildGlut: (list) => buildFlyWire(fw, maskOf(fw.N, list), null), e1bPhis: [0.1, 0.25],
    stdTag: 'FlyWire 标准(GLUT+)', allTag: 'FlyWire GLUT−' },
  { ds: 'malecns', tag: 'MaleCNS（充分性方向：抑制→兴奋）', pool: mcPool, N: mc.N, group: mc.group,
    targets: mcGlut, tMass: mc.outMass, cand: mcCand, cMass: mc.outMass,
    build: (list) => buildMaleCNS(mc, maskOf(mc.N, list)),
    buildGlut: (list) => buildMaleCNS(mc, maskOf(mc.N, list)), e1bPhis: [0.9, 1.0],
    stdTag: 'MaleCNS 标准(GLUT−)', allTag: 'MaleCNS GLUT+' },
];
const e1Summary = [];
for (const D of DS) {
  const visG = D.pool.vis;
  const tVisMass = D.targets.filter((i) => D.group[i] === visG).reduce((a, i) => a + D.tMass[i], 0);
  console.log(`### ${D.tag}\n`);
  console.log(`| 变体 | 翻转单位数（未匹配） | 翻转质量/谷氨酸质量 | 视叶组质量比 | ti=3 视叶 | ti=4 总放电 | ti=4 ${D.pool.dnName} | ti=4 ${D.pool.visName} |`);
  console.log('|---|---|---|---|---|---|---|---|');
  const s3 = ref[`${D.stdTag}|3`], s4 = ref[`${D.stdTag}|4`], a3 = ref[`${D.allTag}|3`], a4 = ref[`${D.allTag}|4`];
  console.log(`| 标准（不翻转） | 0 | — | — | ${fmt(s3.vis)} | ${fmt(s4.total)} | ${fmt(s4.dn)} | ${fmt(s4.vis)} |`);
  console.log(`| 全部谷氨酸单位翻转（v5.1 干预） | ${D.targets.length} | 1.00 | 1.00 | ${fmt(a3.vis)} | ${fmt(a4.total)} | ${fmt(a4.dn)} | ${fmt(a4.vis)} |`);
  for (const [ctl, byGroup] of [['C-match（组+质量匹配，逐组封顶）', true], ['C-rand（仅质量匹配，整体封顶）', false]]) {
    const rows = [];
    for (const seed of E1_SEEDS) {
      const rnd = makeRng(seed * 7919 + (byGroup ? 1 : 2));
      const m = matchedSample(D.targets, D.tMass, D.cand, D.cMass, D.group, byGroup, rnd);
      const buf = D.build(m.chosen);
      const r3 = await run(buf, D.pool, 3);
      const r4 = await run(buf, D.pool, 4);
      const cVis = m.chosen.filter((i) => D.group[i] === visG).reduce((a, i) => a + D.cMass[i], 0);
      const row = { seed, n: m.chosen.length, un: m.unmatched, mr: m.chosenMass / m.targetMass, vr: tVisMass > 0 ? cVis / tVisMass : NaN, r3, r4 };
      rows.push(row);
      csv.push(`E1,${D.ds},${ctl.split('（')[0]},${seed},,3,on,${r3.total},${r3.dn},${r3.vis},${row.n},${row.un},${row.mr.toFixed(4)},${row.vr.toFixed(4)}`);
      csv.push(`E1,${D.ds},${ctl.split('（')[0]},${seed},,4,on,${r4.total},${r4.dn},${r4.vis},${row.n},${row.un},${row.mr.toFixed(4)},${row.vr.toFixed(4)}`);
      log(`E1 ${D.ds} ${ctl} seed ${seed}: vis4=${r4.vis}`);
    }
    const mr = stats(rows.map((r) => r.mr)), vr = stats(rows.map((r) => r.vr));
    console.log(`| ${ctl} | ${fmt(stats(rows.map((r) => r.n)).med)}（${fmt(stats(rows.map((r) => r.un)).med)}） | ${mr.med.toFixed(2)} [${mr.min.toFixed(2)}–${mr.max.toFixed(2)}] | ${vr.med.toFixed(2)} | ${fmtS(rows.map((r) => r.r3.vis))} | ${fmtS(rows.map((r) => r.r4.total))} | ${fmtS(rows.map((r) => r.r4.dn))} | ${fmtS(rows.map((r) => r.r4.vis))} |`);
    e1Summary.push({ ds: D.ds, ctl, rows });
  }
  console.log('');
}
console.log('逐种子 ti=4 视叶放电：');
for (const e of e1Summary) console.log(`- ${e.ds} ${e.ctl}：${e.rows.map((r) => fmt(r.r4.vis)).join(', ')}`);

// ---------------- E1b ----------------
console.log('\n## E1b 等质量身份检验（ti=4；逐组质量相同，只差递质身份；10 个种子，中位数 [最小–最大]）\n');
for (const D of DS) {
  const full = D.targets.reduce((a, i) => a + D.tMass[i], 0);
  console.log(`### ${D.tag}\n`);
  console.log(`| φ | 谷氨酸子集质量 | 对照质量 | 谷氨酸子集 ${D.pool.visName} | 对照 ${D.pool.visName} | 谷氨酸子集 ${D.pool.dnName} | 对照 ${D.pool.dnName} | 谷氨酸子集总放电 | 对照总放电 |`);
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const phi of D.e1bPhis) {
    const rows = [];
    for (const seed of E1_SEEDS) {
      const rnd = makeRng(500000 + Math.round(phi * 1000) * 100 + seed);
      const sub = phi >= 1 ? D.targets.slice() : randomSubset(D.targets, phi, rnd);
      const ctl = matchedSample(sub, D.tMass, D.cand, D.cMass, D.group, true, rnd);
      const g2 = trimToProfile(sub, D.tMass, D.group, massByGroup(ctl.chosen, D.cMass, D.group), rnd);
      const gm = g2.reduce((a, i) => a + D.tMass[i], 0) / full;
      const cm = ctl.chosenMass / full;
      const rg = await run(D.buildGlut(g2), D.pool, 4);
      const rc = await run(D.build(ctl.chosen), D.pool, 4);
      rows.push({ gm, cm, rg, rc });
      csv.push(`E1b,${D.ds},glut-equal-profile,${seed},${phi},4,on,${rg.total},${rg.dn},${rg.vis},${g2.length},,${gm.toFixed(4)},`);
      csv.push(`E1b,${D.ds},control-equal-profile,${seed},${phi},4,on,${rc.total},${rc.dn},${rc.vis},${ctl.chosen.length},${ctl.unmatched},${cm.toFixed(4)},`);
      log(`E1b ${D.ds} phi=${phi} seed ${seed}: glut vis=${rg.vis} ctl vis=${rc.vis}`);
    }
    const gm = stats(rows.map((x) => x.gm)), cm = stats(rows.map((x) => x.cm));
    console.log(`| ${phi} | ${gm.med.toFixed(3)} | ${cm.med.toFixed(3)} | ${fmtS(rows.map((x) => x.rg.vis))} | ${fmtS(rows.map((x) => x.rc.vis))} | ${fmtS(rows.map((x) => x.rg.dn))} | ${fmtS(rows.map((x) => x.rc.dn))} | ${fmtS(rows.map((x) => x.rg.total))} | ${fmtS(rows.map((x) => x.rc.total))} |`);
  }
  console.log('');
}
console.log('质量均以"全部谷氨酸规则翻转的突触质量"为 1。');

// ---------------- E2 ----------------
console.log('\n## E2 剂量-反应（ti=4；随机翻转比例 f 的谷氨酸单位；5 个种子，中位数 [最小–最大]）\n');
for (const D of DS) {
  console.log(`### ${D.tag}\n`);
  console.log(`| f | 翻转质量占比 | 总放电 | ${D.pool.dnName} | ${D.pool.visName} |`);
  console.log('|---|---|---|---|---|');
  const s4 = ref[`${D.stdTag}|4`], a4 = ref[`${D.allTag}|4`];
  const totalMass = D.targets.reduce((a, i) => a + D.tMass[i], 0);
  console.log(`| 0 | 0.00 | ${fmt(s4.total)} | ${fmt(s4.dn)} | ${fmt(s4.vis)} |`);
  for (const [fi, f] of E2_FRACS.entries()) {
    const rows = [];
    for (const seed of E2_SEEDS) {
      const rnd = makeRng(100000 + fi * 1000 + seed);
      const sub = randomSubset(D.targets, f, rnd);
      const mf = sub.reduce((a, i) => a + D.tMass[i], 0) / totalMass;
      const buf = D.buildGlut(sub);
      const r = await run(buf, D.pool, 4);
      rows.push({ mf, r });
      csv.push(`E2,${D.ds},glut-fraction,${seed},${f},4,on,${r.total},${r.dn},${r.vis},${sub.length},,${mf.toFixed(4)},`);
      log(`E2 ${D.ds} f=${f} seed ${seed}: vis=${r.vis}`);
    }
    const m = stats(rows.map((x) => x.mf));
    console.log(`| ${f} | ${m.med.toFixed(2)} | ${fmtS(rows.map((x) => x.r.total))} | ${fmtS(rows.map((x) => x.r.dn))} | ${fmtS(rows.map((x) => x.r.vis))} |`);
  }
  console.log(`| 1 | 1.00 | ${fmt(a4.total)} | ${fmt(a4.dn)} | ${fmt(a4.vis)} |\n`);
}

writeFileSync(join(DATA, '..', 'docs', 'results', 'controls_runs.csv'), csv.join('\n') + '\n');
console.log('逐次结果：game/docs/results/controls_runs.csv');
console.log('\n探针完成。');
