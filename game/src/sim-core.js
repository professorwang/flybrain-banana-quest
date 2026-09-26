/* sim-core.js —— 果蝇全脑 LIF 脉冲网络仿真内核（纯 ES module，零依赖）
 *
 * 本文件的 LIF 仿真算法与 neuropil-gated 组休眠优化改编自上游玩法验证项目
 * snedea/flybrain 的 js/sim-worker.js（MIT License，见 game/THIRD_PARTY_NOTICES.md）。
 * 此处重构为环境无关的 ES module：浏览器 Web Worker 与 Node 测试共用同一份代码。
 *
 * 二进制格式（little-endian）：
 *   头部：  2 x uint32 —— neuron_count, edge_count
 *   边表：  edge_count x (uint32 pre, uint32 post, float32 weight)，按 pre 排序
 *   元数据： neuron_count x (uint8 region_type, uint16 group_id)
 *
 * 索引空间约定：init 后所有神经元数组按 group_id 重排（组内保持原始索引升序，
 * 与 tools/prepare_pools.py 生成的 pools.json 使用同一"组排序后"空间）。
 */

export const DEFAULTS = {
  leakRate: 0.95,          // 每 tick 电压保持比例
  threshold: 1.0,          // 放电阈值
  refractoryPeriod: 3,     // 不应期（tick 数）
  weightScale: 0.15,       // global-max 模式的权重归一化上限（沿用参考实现）
  targetInput: 3.0,        // per-neuron 模式：每个神经元总入权重归一化目标（Shiu et al. 2024 方式；
                           // 实测 1.0 时信号只能到达蘑菇体、2.0 仍无法驱动下行神经元，3.0 全链路
                           // 可通且无癫痫式饱和，4.0 则全脑点燃——见 README 调参记录）
  normalization: 'per-neuron', // 'per-neuron'（默认，可真实传播）| 'global-max'（参考实现原样）
  tickRate: 10,            // 默认 tick 频率（Hz）
  cooldownTicks: 20,       // 组休眠前的冷却 tick 数
};

const now = () =>
  (globalThis.performance && globalThis.performance.now)
    ? globalThis.performance.now()
    : Date.now();

/* 浏览器环境的 gzip 解压（Node 18+ 亦有全局 DecompressionStream；
 * Node 测试也可通过 opts.gunzip 注入 node:zlib 的解压函数） */
async function gunzipDefault(buffer) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(buffer));
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    chunks.push(r.value);
  }
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out.buffer;
}

function isGzip(buffer) {
  const b = new Uint8Array(buffer, 0, 2);
  return b[0] === 0x1f && b[1] === 0x8b;
}

export class LIFSim {
  /**
   * 从（可选 gzip 的）连接组二进制构建仿真实例。
   * opts.gunzip: 可选，注入解压函数 (ArrayBuffer) => Promise<ArrayBuffer>（Node 用 zlib）。
   */
  static async fromBuffer(buffer, opts = {}) {
    let raw = buffer;
    if (isGzip(buffer)) {
      const gunzip = opts.gunzip || gunzipDefault;
      raw = await gunzip(buffer);
    }
    const sim = new LIFSim();
    sim.normalization = opts.normalization || DEFAULTS.normalization;
    // per-neuron 归一化目标可实例级覆盖（MaleCNS 需要 4.0 才能驱动下行神经元，
    // 见 docs/malecns-probes.md）；不传则用 DEFAULTS.targetInput
    sim.targetInput = opts.targetInput !== undefined ? opts.targetInput : DEFAULTS.targetInput;
    sim._parse(raw);
    sim._buildGroupStructures();
    return sim;
  }

  _parse(buffer) {
    // 边表区域视图：每条记录 12 字节 = 3 个 uint32（pre, post, weight 的位模式）
    const u32 = new Uint32Array(buffer, 0, 2);
    this.N = u32[0];
    this.edgeCount = u32[1];
    const N = this.N, E = this.edgeCount;
    const edgeU32 = new Uint32Array(buffer, 8, E * 3);
    const edgeF32 = new Float32Array(buffer, 8, E * 3);
    const meta = new Uint8Array(buffer, 8 + E * 12, N * 3);

    this.rowPtr = new Uint32Array(N + 1);
    this.colIdx = new Uint32Array(E);
    this.values = new Float32Array(E);

    // 第一遍：统计每个神经元的出边数
    for (let e = 0; e < E; e++) this.rowPtr[edgeU32[e * 3] + 1]++;
    for (let i = 1; i <= N; i++) this.rowPtr[i] += this.rowPtr[i - 1];

    // 第二遍：填充 colIdx/values 并归一化权重。
    // per-neuron（默认）：每个突触后神经元的总入权重 |w| 归一化为 targetInput，
    //   保留拓扑相对强弱，是 Shiu et al. 2024 全脑模型的做法；实测参考实现的
    //   全局 max|w|→0.15 在本数据上无法传播信号（个别 2405 的极端突触计数压扁
    //   了中位数仅 8 的常规权重），因此默认改用此模式，详见 README 科学说明。
    // global-max：参考实现 snedea/flybrain 的原样算法（供对比）。
    let maxAbsW = 0;
    for (let e = 0; e < E; e++) {
      this.colIdx[e] = edgeU32[e * 3 + 1];
      const w = edgeF32[e * 3 + 2];
      this.values[e] = w;
      const aw = w < 0 ? -w : w;
      if (aw > maxAbsW) maxAbsW = aw;
    }
    if (this.normalization === 'global-max') {
      if (maxAbsW > 0) {
        const s = DEFAULTS.weightScale / maxAbsW;
        for (let e = 0; e < E; e++) this.values[e] *= s;
      }
    } else {
      const sumIn = new Float64Array(N);
      for (let e = 0; e < E; e++) {
        const w = this.values[e];
        sumIn[this.colIdx[e]] += w < 0 ? -w : w;
      }
      const ti = this.targetInput;
      for (let e = 0; e < E; e++) {
        const s = sumIn[this.colIdx[e]];
        this.values[e] = s > 0 ? (this.values[e] / s) * ti : 0;
      }
    }

    // 逐神经元元数据（3 字节记录，原始顺序）
    this.regionType = new Uint8Array(N);
    this.groupId = new Uint16Array(N);
    for (let i = 0; i < N; i++) {
      this.regionType[i] = meta[i * 3];
      this.groupId[i] = meta[i * 3 + 1] | (meta[i * 3 + 2] << 8);
    }

    this.V = new Float32Array(N);
    this.fired = new Uint8Array(N);
    this.refractory = new Uint8Array(N);
    this._firedBuffer = new Uint32Array(N); // tick 内放电索引的收集缓冲
    this.tickCount = 0;
  }

  /* 按 group_id 稳定排序重排所有数组与 CSR，使每组占据连续区间，
   * 从而可以只迭代活跃组（neuropil gating）。 */
  _buildGroupStructures() {
    const N = this.N, E = this.edgeCount;
    let numGroups = 0;
    for (let i = 0; i < N; i++) if (this.groupId[i] >= numGroups) numGroups = this.groupId[i] + 1;
    this.numGroups = numGroups;

    const counts = new Uint32Array(numGroups);
    for (let i = 0; i < N; i++) counts[this.groupId[i]]++;
    this.groupOffset = new Uint32Array(numGroups + 1);
    for (let g = 0; g < numGroups; g++) this.groupOffset[g + 1] = this.groupOffset[g] + counts[g];

    // sortedByGroup[排序后位置] = 原始索引（组内保持原始索引升序 = 稳定排序）
    const sortedByGroup = new Uint32Array(N);
    const writePos = new Uint32Array(numGroups);
    for (let g = 0; g < numGroups; g++) writePos[g] = this.groupOffset[g];
    for (let i = 0; i < N; i++) sortedByGroup[writePos[this.groupId[i]]++] = i;
    const originalToSorted = new Uint32Array(N);
    for (let s = 0; s < N; s++) originalToSorted[sortedByGroup[s]] = s;
    this.sortedByGroup = sortedByGroup;
    this.originalToSorted = originalToSorted;

    // CSR 重映射到排序后空间
    const newRowPtr = new Uint32Array(N + 1);
    for (let s = 0; s < N; s++) {
      const o = sortedByGroup[s];
      newRowPtr[s + 1] = this.rowPtr[o + 1] - this.rowPtr[o];
    }
    for (let s = 1; s <= N; s++) newRowPtr[s] += newRowPtr[s - 1];
    const newColIdx = new Uint32Array(E);
    const newValues = new Float32Array(E);
    for (let s = 0; s < N; s++) {
      const o = sortedByGroup[s];
      let wp = newRowPtr[s];
      for (let j = this.rowPtr[o]; j < this.rowPtr[o + 1]; j++) {
        newColIdx[wp] = originalToSorted[this.colIdx[j]];
        newValues[wp] = this.values[j];
        wp++;
      }
    }
    this.rowPtr = newRowPtr;
    this.colIdx = newColIdx;
    this.values = newValues;

    const newGroupId = new Uint16Array(N);
    const newRegionType = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      newGroupId[s] = this.groupId[sortedByGroup[s]];
      newRegionType[s] = this.regionType[sortedByGroup[s]];
    }
    this.groupId = newGroupId;
    this.regionType = newRegionType;

    // V/fired/refractory 为全零初始态，无需重排
    this.groupActive = new Uint8Array(numGroups);
    this.groupCooldown = new Uint8Array(numGroups);
    this.groupRecvInput = new Uint8Array(numGroups);
    this.groupFiredThisTick = new Uint8Array(numGroups);
    this.groupStimulatedThisTick = new Uint8Array(numGroups);

    this.leakRate = DEFAULTS.leakRate;
    this.threshold = DEFAULTS.threshold;
    this.refractoryPeriod = DEFAULTS.refractoryPeriod;
    this.sustainedIndices = null;
    this.sustainedIntensities = null;
    this.activeNeuronCount = 0;
  }

  setParams(p) {
    if (p.leakRate !== undefined) this.leakRate = p.leakRate;
    if (p.threshold !== undefined) this.threshold = p.threshold;
    if (p.refractoryPeriod !== undefined) this.refractoryPeriod = p.refractoryPeriod;
  }

  /* 设置持续刺激（每 tick 施加，整体替换上一组） */
  setInput(indices, intensities) {
    this.sustainedIndices = indices || null;
    this.sustainedIntensities = intensities || null;
  }

  /* 一次性电流注入（如惊吓瞬态） */
  stimulate(indices, intensities) {
    const { N, V, refractory, groupId, groupActive, groupCooldown } = this;
    const cd = DEFAULTS.cooldownTicks;
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      if (i >= N) continue;
      if (refractory[i] === 0) V[i] += intensities[k];
      if (!groupActive[groupId[i]]) {
        groupActive[groupId[i]] = 1;
        groupCooldown[groupId[i]] = cd;
      }
    }
  }

  reset() {
    if (!this.V) return;
    this.V.fill(0);
    this.fired.fill(0);
    this.refractory.fill(0);
    this.sustainedIndices = null;
    this.sustainedIntensities = null;
    this.groupActive.fill(0);
    this.groupCooldown.fill(0);
    this.tickCount = 0;
    this.activeNeuronCount = 0;
  }

  /**
   * 推进一个 tick。返回稀疏结果：
   *   { tickCount, firedCount, firedIndices: Uint32Array, groupSpikeCounts: Uint16Array,
   *     activeNeurons, activeGroups, tickMs }
   * firedIndices / groupSpikeCounts 为新分配的副本，调用方可安全转移或留存。
   */
  tick() {
    const t0 = now();
    const { N, V, fired, refractory, rowPtr, colIdx, values, groupId,
            groupOffset, numGroups, groupActive, groupCooldown,
            groupRecvInput, groupFiredThisTick, groupStimulatedThisTick } = this;
    const cd = DEFAULTS.cooldownTicks;
    let firedCount = 0;
    const firedBuf = this._firedBuffer;
    const groupSpikeCounts = new Uint16Array(numGroups);

    groupRecvInput.fill(0);
    groupFiredThisTick.fill(0);
    groupStimulatedThisTick.fill(0);
    this.activeNeuronCount = 0;

    // 有持续刺激的组保持激活
    const si = this.sustainedIndices;
    if (si) {
      for (let k = 0; k < si.length; k++) {
        const i = si[k];
        if (i < N) {
          const g = groupId[i];
          groupStimulatedThisTick[g] = 1;
          if (!groupActive[g]) { groupActive[g] = 1; groupCooldown[g] = cd; }
        }
      }
    }

    // 步骤 1：活跃组的电压泄漏与不应期计数（连续内存访问）
    for (let g = 0; g < numGroups; g++) {
      if (!groupActive[g]) continue;
      const start = groupOffset[g], end = groupOffset[g + 1];
      this.activeNeuronCount += end - start;
      for (let i = start; i < end; i++) {
        if (refractory[i] > 0) { refractory[i]--; V[i] = 0; }
        else V[i] *= this.leakRate;
      }
    }

    // 步骤 1.5：施加持续外部刺激
    if (si) {
      const sIn = this.sustainedIntensities;
      for (let k = 0; k < si.length; k++) {
        const i = si[k];
        if (i < N && refractory[i] === 0) V[i] += sIn[k];
      }
    }

    // 步骤 2：上一 tick 放电神经元的突触传播
    for (let g = 0; g < numGroups; g++) {
      if (!groupActive[g]) continue;
      for (let i = groupOffset[g]; i < groupOffset[g + 1]; i++) {
        if (fired[i] === 0) continue;
        for (let j = rowPtr[i]; j < rowPtr[i + 1]; j++) {
          const target = colIdx[j];
          V[target] += values[j];
          groupRecvInput[groupId[target]] = 1;
        }
      }
    }

    // 收到突触输入的组被唤醒
    for (let g = 0; g < numGroups; g++) {
      if (groupRecvInput[g] && !groupActive[g]) {
        groupActive[g] = 1;
        groupCooldown[g] = cd;
      }
    }

    // 步骤 3：清除旧放电标记 + 阈值判定
    for (let g = 0; g < numGroups; g++) {
      if (!groupActive[g]) continue;
      for (let i = groupOffset[g]; i < groupOffset[g + 1]; i++) {
        fired[i] = 0;
        if (refractory[i] === 0 && V[i] >= this.threshold) {
          fired[i] = 1;
          V[i] = 0;
          refractory[i] = this.refractoryPeriod;
          groupFiredThisTick[g] = 1;
          groupSpikeCounts[g]++;
          firedBuf[firedCount++] = i;
        }
      }
    }

    // 休眠判定：无放电、无输入、无刺激的组冷却归零后关闭并清空残余状态
    for (let g = 0; g < numGroups; g++) {
      if (!groupActive[g]) continue;
      if (groupFiredThisTick[g] || groupRecvInput[g] || groupStimulatedThisTick[g]) {
        groupCooldown[g] = cd;
      } else if (--groupCooldown[g] <= 0) {
        groupActive[g] = 0;
        const start = groupOffset[g], end = groupOffset[g + 1];
        V.fill(0, start, end);
        fired.fill(0, start, end);
        refractory.fill(0, start, end);
      }
    }

    let activeGroups = 0;
    for (let g = 0; g < numGroups; g++) if (groupActive[g]) activeGroups++;

    const result = {
      tickCount: this.tickCount,
      firedCount,
      firedIndices: firedBuf.slice(0, firedCount),
      groupSpikeCounts,
      activeNeurons: this.activeNeuronCount,
      activeGroups,
      tickMs: now() - t0,
    };
    this.tickCount++;
    return result;
  }
}
