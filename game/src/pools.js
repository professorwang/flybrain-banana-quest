/* pools.js —— 脑-游戏接口：加载 pools 定义，提供感觉输入池与运动读出池。
 *
 * pools.json / pools_malecns.json 均由 tools/ 下脚本生成，索引为"组排序后"空间。
 * 池名抽象为通用键（olf_left/olf_right/gus/mech_bristle/mech_jo/vis +
 * desc_left/desc_right/feed/escape），game.js 只依赖通用键，数据集差异由
 * KEY_MAPS 抹平（MaleCNS 有原生 mech_jo 与 escape_readout(DNp01)，FlyWire 没有）。
 *
 * 读出池用位掩码加速：每个放电神经元一次查表即可归入各读出池。
 */

export const READOUT_BITS = { desc_left: 1, desc_right: 2, feed: 4, escape: 8 };

/* FlyWire 版（pools.json）池名 → 通用键 */
export const FLYWIRE_KEYS = {
  input: {
    olf_left: 'olf_food_left', olf_right: 'olf_food_right', gus: 'gus_sweet',
    mech_bristle: 'mech_bristle', vis: 'vis_r1r6',
  },
  readout: { desc_left: 'desc_left', desc_right: 'desc_right', feed: 'feed_readout' },
};

/* MaleCNS 版（pools_malecns.json）池名 → 通用键 */
export const MALECNS_KEYS = {
  input: {
    olf_left: 'olf_left', olf_right: 'olf_right', gus: 'gus',
    mech_bristle: 'mech_bristle', mech_jo: 'mech_jo', vis: 'vis_r1r6',
  },
  readout: {
    desc_left: 'desc_left', desc_right: 'desc_right', feed: 'feed_readout',
    escape: 'escape_readout',
  },
};

export class Pools {
  static async load(url, neuronCount, keys = FLYWIRE_KEYS) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`加载 ${url} 失败：HTTP ${resp.status}`);
    const def = await resp.json();
    return Pools.fromJSON(def, neuronCount, keys);
  }

  /* 从已解析的 JSON 直接构建（Node 无头测试/工具用此入口） */
  static fromJSON(def, neuronCount, keys = FLYWIRE_KEYS) {
    if (def.neuron_count !== neuronCount) {
      throw new Error(`pools 定义神经元数 ${def.neuron_count} 与连接组 ${neuronCount} 不一致`);
    }
    return new Pools(def, neuronCount, keys);
  }

  constructor(def, N, keys) {
    this.meta = def.meta;
    this.source = def.source;
    this.dataset = def.dataset || 'flywire-fafb-v783';
    // 感觉输入池（通用键 → 排序后索引定型数组；数据集中不存在的键跳过）
    this.input = {};
    for (const [gkey, name] of Object.entries(keys.input)) {
      if (def.pools[name]) this.input[gkey] = Uint32Array.from(def.pools[name]);
    }
    // 运动读出池
    this.readout = {};
    for (const [gkey, name] of Object.entries(keys.readout)) {
      if (def.pools[name]) this.readout[gkey] = Uint32Array.from(def.pools[name]);
    }
    // 读出位掩码
    this.mask = new Uint8Array(N);
    for (const [gkey, bit] of Object.entries(READOUT_BITS)) {
      if (!this.readout[gkey]) continue;
      for (const i of this.readout[gkey]) this.mask[i] |= bit;
    }
  }

  /* 统计一个 tick 的放电索引在各读出池中的分布 */
  countReadout(firedIndices) {
    let left = 0, right = 0, feed = 0, escape = 0;
    const mask = this.mask;
    for (let k = 0; k < firedIndices.length; k++) {
      const m = mask[firedIndices[k]];
      if (m & 1) left++;
      if (m & 2) right++;
      if (m & 4) feed++;
      if (m & 8) escape++;
    }
    return { left, right, feed, escape };
  }
}
