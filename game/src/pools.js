/* pools.js —— 脑-游戏接口：加载 pools.json，提供感觉输入池与运动读出池。
 *
 * pools.json 由 tools/prepare_pools.py 生成，所有索引为"组排序后"空间，
 * 与 worker ready 消息回传的 groupId/regionType 数组同空间。
 *
 * 读出池用位掩码加速：bit0=desc_left, bit1=desc_right, bit2=feed_readout，
 * 每个放电神经元一次查表即可归入各读出池。
 */

export const READOUT_BITS = { desc_left: 1, desc_right: 2, feed_readout: 4 };

export class Pools {
  static async load(url, neuronCount) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`加载 ${url} 失败：HTTP ${resp.status}`);
    const def = await resp.json();
    return Pools.fromJSON(def, neuronCount);
  }

  /* 从已解析的 JSON 直接构建（Node 无头测试/工具用此入口） */
  static fromJSON(def, neuronCount) {
    if (def.neuron_count !== neuronCount) {
      throw new Error(`pools.json 神经元数 ${def.neuron_count} 与连接组 ${neuronCount} 不一致`);
    }
    return new Pools(def, neuronCount);
  }

  constructor(def, N) {
    this.meta = def.meta;
    this.source = def.source;
    // 感觉输入池（排序后索引的定型数组）
    this.input = {};
    for (const name of ['olf_food_left', 'olf_food_right', 'olf_danger',
                        'gus_sweet', 'mech_bristle', 'vis_r1r6']) {
      this.input[name] = Uint32Array.from(def.pools[name]);
    }
    // 运动读出池
    this.readout = {
      desc_left: Uint32Array.from(def.pools.desc_left),
      desc_right: Uint32Array.from(def.pools.desc_right),
      feed_readout: Uint32Array.from(def.pools.feed_readout),
    };
    // 读出位掩码（一个神经元可能同属多个读出池，理论上不会，但按位兼容）
    this.mask = new Uint8Array(N);
    for (const [name, bit] of Object.entries(READOUT_BITS)) {
      for (const i of this.readout[name]) this.mask[i] |= bit;
    }
  }

  /* 统计一个 tick 的放电索引在各读出池中的分布 */
  countReadout(firedIndices) {
    let left = 0, right = 0, feed = 0;
    const mask = this.mask;
    for (let k = 0; k < firedIndices.length; k++) {
      const m = mask[firedIndices[k]];
      if (m & 1) left++;
      if (m & 2) right++;
      if (m & 4) feed++;
    }
    return { left, right, feed };
  }
}
