/* sim-worker.js —— Web Worker 薄壳：消息协议包装 sim-core.js 的 LIFSim。
 *
 * 协议（仿参考实现 snedea/flybrain，MIT，见 THIRD_PARTY_NOTICES.md）：
 *   主线程 -> Worker: init {buffer} | start | stop | setInput {indices, intensities}
 *                     | stimulate {indices, intensities} | setParams {...} | reset
 *   Worker -> 主线程: ready {neuronCount, edgeCount, groupId, regionType, normalization}
 *                     | tick {tickCount, firedCount, firedIndices, groupSpikeCounts}
 *                     | stats {avgTickMs, firedNeurons, activeNeurons, activeGroups, tickRate}
 *                     | error {message}
 *
 * 所有神经元索引均为"组排序后"空间（与 pools.json 一致）。
 * tick 消息只传稀疏放电索引数组，不传 139k 的全量状态数组。
 */
import { LIFSim, DEFAULTS } from './sim-core.js';

let sim = null;
let running = false;
let tickRate = DEFAULTS.tickRate;
let tickTimeSum = 0;
let tickSamples = 0;
let firedSum = 0;
const STATS_INTERVAL = 20;

function loop() {
  if (!running || !sim) return;
  const r = sim.tick();

  // 稀疏放电数据（firedIndices 为新副本，可零拷贝转移）
  self.postMessage({
    type: 'tick',
    tickCount: r.tickCount,
    firedCount: r.firedCount,
    firedIndices: r.firedIndices,
    groupSpikeCounts: r.groupSpikeCounts,
  }, [r.firedIndices.buffer, r.groupSpikeCounts.buffer]);

  tickTimeSum += r.tickMs;
  firedSum += r.firedCount;
  tickSamples++;
  if (tickSamples >= STATS_INTERVAL) {
    self.postMessage({
      type: 'stats',
      avgTickMs: tickTimeSum / tickSamples,
      firedNeurons: Math.round(firedSum / tickSamples),
      activeNeurons: r.activeNeurons,
      activeGroups: r.activeGroups,
      totalNeurons: sim.N,
      totalGroups: sim.numGroups,
      tickRate,
    });
    tickTimeSum = 0;
    tickSamples = 0;
    firedSum = 0;
  }

  // 节流：按目标频率调度下一 tick（setTimeout 最小粒度约 4ms，10Hz 下足够）
  const interval = Math.max(0, Math.floor(1000 / tickRate - r.tickMs));
  setTimeout(loop, interval);
}

self.onmessage = async (e) => {
  const d = e.data;
  try {
    switch (d.type) {
      case 'init': {
        sim = await LIFSim.fromBuffer(d.buffer);
        // 回传组排序后的组/区域数组副本（主线程选池、着色用），原数组留在 worker
        self.postMessage({
          type: 'ready',
          neuronCount: sim.N,
          edgeCount: sim.edgeCount,
          numGroups: sim.numGroups,
          normalization: sim.normalization,
          groupId: sim.groupId.slice(),
          regionType: sim.regionType.slice(),
        });
        break;
      }
      case 'start':
        if (!sim) throw new Error('尚未 init');
        if (!running) { running = true; setTimeout(loop, 0); }
        break;
      case 'stop':
        running = false;
        break;
      case 'setInput':   // 持续刺激（每 tick 施加，整体替换）
        sim.setInput(d.indices, d.intensities);
        break;
      case 'stimulate':  // 一次性注入（惊吓等瞬态）
        sim.stimulate(d.indices, d.intensities);
        break;
      case 'setParams':
        if (d.tickRate !== undefined) tickRate = d.tickRate;
        sim.setParams(d);
        break;
      case 'reset':
        sim.reset();
        break;
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message || err) });
  }
};
