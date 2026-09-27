/* variants.mjs —— 对照实验共享库：在内存里按"神经元 × 递质"任意重新赋号，生成 sim-core 格式图。
 *
 * 依赖 python game/tools/export_sign_tables.py 导出的中间表（game/data/derived/）。
 * 两个数据集的赋号单位不同，本库如实区分：
 *   - FlyWire：递质标签按"连接行"给出。翻转单位 = 某突触前神经元的某类行。
 *       glut 单位：拥有 ≥1 条 GLUT 行的神经元（51,185 个），翻转 = 其全部 GLUT 行 +1→−1；
 *       全部 glut 单位翻转 ≡ v5.1 的 GLUT 抑制变体（自检逐字节验证）。
 *       对照单位：整体标签为 ACH/DA/SER/OCT 的神经元，翻转 = 其全部兴奋性非 GLUT 行 +1→−1。
 *       每对 (pre,post) 重新求和，和为 0 的对丢弃（与上游管线一致）。
 *   - MaleCNS：符号按突触前神经元给出。翻转单位 = 神经元（全部出边变号）。
 *       glut 单位：nt=glutamate 且 sign<0（29,763 个），翻转 −1→+1；全部翻转 ≡ v5.1 的
 *       GLUT 兴奋变体（自检逐字节验证）。对照单位：sign<0 且 nt≠glutamate（GABA、histamine）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA = join(here, '..', 'data');
const DERIVED = join(DATA, 'derived');

export function gunzipFile(path) {
  const o = gunzipSync(readFileSync(path));
  return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);
}

/* mulberry32：可复现的种子随机数 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function metaOf(buf) {
  const u32 = new Uint32Array(buf, 0, 2);
  const N = u32[0], E = u32[1];
  const meta = new Uint8Array(buf, 8 + E * 12, N * 3);
  const group = new Uint16Array(N);
  for (let i = 0; i < N; i++) group[i] = meta[i * 3 + 1] | (meta[i * 3 + 2] << 8);
  return { N, E, meta: new Uint8Array(meta), group };
}

export function buffersEqual(a, b) {
  return Buffer.from(a).equals(Buffer.from(b));
}

/* ---------------- FlyWire ---------------- */
// 递质列顺序（与 export_sign_tables.py 一致）
const ACH = 0, GABA = 1, GLUT = 2, DA = 3, SER = 4, OCT = 5;

export function loadFlyWire() {
  const tblPath = join(DERIVED, 'flywire-pair-nt.bin.gz');
  if (!existsSync(tblPath)) throw new Error('缺少中间表：先运行 python game/tools/export_sign_tables.py');
  const t = gunzipFile(tblPath);
  const dv = new DataView(t);
  if (String.fromCharCode(...new Uint8Array(t, 0, 4)) !== 'FWNT') throw new Error('flywire-pair-nt 格式错误');
  const N = dv.getUint32(4, true), P = dv.getUint32(8, true);
  const pre = new Uint32Array(P), post = new Uint32Array(P), cnt = new Uint16Array(P * 6);
  for (let p = 0, o = 12; p < P; p++, o += 20) {
    pre[p] = dv.getUint32(o, true);
    post[p] = dv.getUint32(o + 4, true);
    for (let k = 0; k < 6; k++) cnt[p * 6 + k] = dv.getUint16(o + 8 + k * 2, true);
  }
  const shipped = gunzipFile(join(DATA, 'connectome.bin.gz'));
  const { meta, group } = metaOf(shipped);

  // 每个神经元的 GLUT 行质量、兴奋性非 GLUT 行质量、总出突触
  const glutMass = new Float64Array(N), excMass = new Float64Array(N), outMass = new Float64Array(N);
  for (let p = 0; p < P; p++) {
    const b = p * 6, i = pre[p];
    glutMass[i] += cnt[b + GLUT];
    excMass[i] += cnt[b + ACH] + cnt[b + DA] + cnt[b + SER] + cnt[b + OCT];
    for (let k = 0; k < 6; k++) outMass[i] += cnt[b + k];
  }
  // 神经元整体递质标签（neurons.csv.gz 行序 = 原始索引）
  const csv = gunzipSync(readFileSync(join(here, '..', '..', 'vendor', 'snedea-flybrain', 'data', 'neurons.csv.gz'))).toString('utf-8');
  const lines = csv.split(/\r?\n/);
  const hdr = lines[0].split(',');
  const ntCol = hdr.indexOf('nt_type');
  const label = new Array(N);
  for (let i = 0; i < N; i++) label[i] = (lines[i + 1].split(',')[ntCol] || '').trim().toUpperCase();

  return { name: 'flywire', N, P, pre, post, cnt, meta, group, shipped, glutMass, excMass, outMass, label };
}

/* flipGlut/flipExc: Uint8Array(N) 或 null。返回 sim-core 格式 ArrayBuffer（未压缩） */
export function buildFlyWire(fw, flipGlut, flipExc) {
  const { N, P, pre, post, cnt, meta } = fw;
  const w = new Float64Array(P);
  let E = 0;
  for (let p = 0; p < P; p++) {
    const b = p * 6, i = pre[p];
    const gs = flipGlut && flipGlut[i] ? -1 : 1;
    const es = flipExc && flipExc[i] ? -1 : 1;
    const v = es * (cnt[b + ACH] + cnt[b + DA] + cnt[b + SER] + cnt[b + OCT]) - cnt[b + GABA] + gs * cnt[b + GLUT];
    w[p] = v;
    if (v !== 0) E++;
  }
  const buf = new ArrayBuffer(8 + E * 12 + N * 3);
  const dv = new DataView(buf);
  dv.setUint32(0, N, true); dv.setUint32(4, E, true);
  let o = 8;
  for (let p = 0; p < P; p++) {
    if (w[p] === 0) continue;
    dv.setUint32(o, pre[p], true); dv.setUint32(o + 4, post[p], true); dv.setFloat32(o + 8, w[p], true);
    o += 12;
  }
  new Uint8Array(buf, o, N * 3).set(meta);
  return buf;
}

export function flywireGlutUnits(fw) {
  const u = [];
  for (let i = 0; i < fw.N; i++) if (fw.glutMass[i] > 0) u.push(i);
  return u;
}

export function flywireControlCandidates(fw) {
  const c = [];
  for (let i = 0; i < fw.N; i++) {
    const l = fw.label[i];
    if ((l === 'ACH' || l === 'DA' || l === 'SER' || l === 'OCT') && fw.excMass[i] > 0) c.push(i);
  }
  return c;
}

/* ---------------- MaleCNS ---------------- */
export function loadMaleCNS() {
  const ntPath = join(DERIVED, 'malecns-nt.json');
  if (!existsSync(ntPath)) throw new Error('缺少中间表：先运行 python game/tools/export_sign_tables.py');
  const nt = JSON.parse(readFileSync(ntPath, 'utf-8'));
  const std = gunzipFile(join(DATA, 'connectome-malecns.bin.gz'));
  const { N, E, meta, group } = metaOf(std);
  const edgeU32 = new Uint32Array(std, 8, E * 3);
  const edgeF32 = new Float32Array(std, 8, E * 3);
  const outMass = new Float64Array(N);
  for (let e = 0; e < E; e++) {
    const w = edgeF32[e * 3 + 2];
    outMass[edgeU32[e * 3]] += w < 0 ? -w : w;
  }
  const glutIdx = nt.nts.indexOf('glutamate');
  return { name: 'malecns', N, E, std, meta, group, nt: nt.nt, sign: nt.sign, nts: nt.nts, glutIdx, outMass };
}

/* flip: Uint8Array(N)，被选中神经元的全部出边变号 */
export function buildMaleCNS(mc, flip) {
  const buf = mc.std.slice(0);
  if (!flip) return buf;
  const E = mc.E;
  const u32 = new Uint32Array(buf, 8, E * 3);
  const f32 = new Float32Array(buf, 8, E * 3);
  for (let e = 0; e < E; e++) if (flip[u32[e * 3]]) f32[e * 3 + 2] = -f32[e * 3 + 2];
  return buf;
}

export function malecnsGlutUnits(mc) {
  const u = [];
  for (let i = 0; i < mc.N; i++) if (mc.nt[i] === mc.glutIdx && mc.sign[i] < 0) u.push(i);
  return u;
}

export function malecnsControlCandidates(mc) {
  const c = [];
  for (let i = 0; i < mc.N; i++) if (mc.sign[i] < 0 && mc.nt[i] !== mc.glutIdx && mc.outMass[i] > 0) c.push(i);
  return c;
}

/* ---------------- 匹配抽样 ----------------
 * 为每个目标单位（glut 单位）抽一个对照单位，无放回：
 *   byGroup=true：同功能组 + 同 log2 质量档（组内找不到则在 ±1..±3 档内回退）；
 *   byGroup=false：只匹配 log2 质量档（位置随机）。
 * 然后做"质量封顶"（保守方向）：byGroup=true 时逐组、byGroup=false 时整体，随机剔除
 * 已选单位，直到对照翻转的突触质量不超过谷氨酸规则翻转的质量——对照只会比谷氨酸
 * 干预"更弱"，不会因为多翻了质量而偏向复现效应。
 * 返回 { chosen: 对照单位数组, unmatched, targetMass, chosenMass }。 */
export function matchedSample(targets, tMass, candidates, cMass, group, byGroup, rnd) {
  const r = pairSample(targets, tMass, candidates, cMass, group, byGroup, rnd);
  const keyOf = (i) => (byGroup ? group[i] : 0);
  const tgt = new Map(), got = new Map(), members = new Map();
  for (const t of targets) tgt.set(keyOf(t), (tgt.get(keyOf(t)) || 0) + tMass[t]);
  for (const c of r.chosen) {
    const k = keyOf(c);
    got.set(k, (got.get(k) || 0) + cMass[c]);
    let a = members.get(k);
    if (!a) members.set(k, (a = []));
    a.push(c);
  }
  const kept = [];
  let chosenMass = 0;
  for (const [k, a] of members) {
    let m = got.get(k);
    const cap = tgt.get(k) || 0;
    shuffle(a, rnd);
    while (a.length && m > cap) m -= cMass[a.pop()];
    for (const c of a) kept.push(c);
    chosenMass += m;
  }
  return { chosen: kept, unmatched: r.unmatched, targetMass: r.targetMass, chosenMass };
}

function pairSample(targets, tMass, candidates, cMass, group, byGroup, rnd) {
  const bin = (m) => Math.floor(Math.log2(Math.max(1, m)));
  const key = (g, b) => (byGroup ? g * 64 : 0) + b;
  const buckets = new Map();
  for (const c of shuffle(candidates.slice(), rnd)) {
    const k = key(group[c], bin(cMass[c]));
    let a = buckets.get(k);
    if (!a) buckets.set(k, (a = []));
    a.push(c);
  }
  const chosen = [];
  let unmatched = 0, targetMass = 0, chosenMass = 0;
  for (const t of shuffle(targets.slice(), rnd)) {
    targetMass += tMass[t];
    const b0 = bin(tMass[t]);
    let pick = -1;
    for (const d of [0, -1, 1, -2, 2, -3, 3]) {
      const a = buckets.get(key(group[t], b0 + d));
      if (a && a.length) { pick = a.pop(); break; }
    }
    if (pick < 0) { unmatched++; continue; }
    chosen.push(pick);
    chosenMass += cMass[pick];
  }
  return { chosen, unmatched, targetMass, chosenMass };
}

export function massByGroup(list, mass, group) {
  const m = new Map();
  for (const i of list) m.set(group[i], (m.get(group[i]) || 0) + mass[i]);
  return m;
}

/* 逐组随机剔除 list 中的单位，直到每组质量 ≤ profile 中该组的质量（profile 无该组则清空） */
export function trimToProfile(list, mass, group, profile, rnd) {
  const byG = new Map();
  for (const i of list) {
    let a = byG.get(group[i]);
    if (!a) byG.set(group[i], (a = []));
    a.push(i);
  }
  const kept = [];
  for (const [g, a] of byG) {
    let m = a.reduce((s, i) => s + mass[i], 0);
    const cap = profile.get(g) || 0;
    shuffle(a, rnd);
    while (a.length && m > cap) m -= mass[a.pop()];
    for (const i of a) kept.push(i);
  }
  return kept;
}

export function randomSubset(units, frac, rnd) {
  const k = Math.round(units.length * frac);
  return shuffle(units.slice(), rnd).slice(0, k);
}

export function maskOf(N, list) {
  const m = new Uint8Array(N);
  for (const i of list) m[i] = 1;
  return m;
}
