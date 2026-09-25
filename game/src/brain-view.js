/* brain-view.js —— 脑活动面板：63 组实时放电条形图 + 分区域着色的降采样 raster。
 *
 * 条形图：每组高度 = 平滑后的"每 tick 放电数 / 组大小"，按区域着色；
 * raster：每行一个非空功能组（63 组降采样为 28 行非空组），每 tick 一列，
 * 放电神经元按其 region_type 着色，向右滚动。
 */

export const REGION_COLORS = {
  0: '#4fc3f7',   // sensory 蓝
  1: '#ba68c8',   // central 紫
  2: '#ffb74d',   // drives 橙
  3: '#81c784',   // motor 绿
};
export const REGION_NAMES = { 0: '感觉', 1: '中枢', 2: '驱动', 3: '运动' };
const REGION_CODE = { sensory: 0, central: 1, drives: 2, motor: 3 };

// raster 中标注名称的重点组
const LABEL_GROUPS = new Set([0, 2, 6, 8, 9, 17, 29, 32, 35, 37, 56]);

export class BrainView {
  /**
   * @param meta neuron_meta.json 内容
   * @param groupIdSorted 组排序后的 Uint16Array（worker ready 回传）
   * @param regionTypeSorted 同上 Uint8Array
   */
  constructor(barCanvas, rasterCanvas, meta, groupIdSorted, regionTypeSorted) {
    this.meta = meta;
    this.groupId = groupIdSorted;
    this.regionType = regionTypeSorted;
    this.numGroups = meta.group_count;
    this.smooth = new Float32Array(this.numGroups);   // 平滑放电强度
    this.barCanvas = barCanvas;
    this.rasterCanvas = rasterCanvas;
    this._setupCanvases();

    // 非空组 -> raster 行号
    this.rowOfGroup = new Int16Array(this.numGroups).fill(-1);
    this.rows = [];
    for (const g of meta.groups) {
      if (g.neuron_count > 0) {
        this.rowOfGroup[g.id] = this.rows.length;
        this.rows.push(g);
      }
    }
    // raster 离屏滚动画布
    this.off = document.createElement('canvas');
    this.off.width = this.rasterCanvas.width;
    this.off.height = this.rasterCanvas.height;
    this.offCtx = this.off.getContext('2d');
    this.offCtx.fillStyle = '#10131a';
    this.offCtx.fillRect(0, 0, this.off.width, this.off.height);
  }

  _setupCanvases() {
    // 按 CSS 尺寸 × devicePixelRatio 设置画布分辨率
    for (const c of [this.barCanvas, this.rasterCanvas]) {
      const dpr = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      c.width = Math.max(50, Math.round(rect.width * dpr));
      c.height = Math.max(50, Math.round(rect.height * dpr));
    }
  }

  /* 每个 worker tick 调用 */
  onTick(firedIndices, groupSpikeCounts) {
    // 条形图平滑值
    const sizes = this.meta.group_sizes;
    for (let g = 0; g < this.numGroups; g++) {
      const inst = sizes[g] > 0 ? groupSpikeCounts[g] / sizes[g] : 0;
      this.smooth[g] = this.smooth[g] * 0.75 + inst * 0.25;
    }
    // raster：整体左移 2px，新列画在最右
    const ctx = this.offCtx;
    const W = this.off.width, H = this.off.height;
    ctx.drawImage(this.off, -2, 0);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(W - 2, 0, 2, H);
    // 降采样：每 tick 最多画 400 个放电神经元
    const n = firedIndices.length;
    const stride = Math.max(1, Math.floor(n / 400));
    const rowH = H / this.rows.length;
    for (let k = 0; k < n; k += stride) {
      const i = firedIndices[k];
      const row = this.rowOfGroup[this.groupId[i]];
      if (row < 0) continue;
      ctx.fillStyle = REGION_COLORS[this.regionType[i]] || '#888';
      ctx.fillRect(W - 2, Math.floor(row * rowH), 2, Math.max(1, rowH - 0.5));
    }
  }

  /* 每渲染帧调用 */
  draw() {
    this._drawBars();
    this._drawRaster();
  }

  _drawBars() {
    const c = this.barCanvas, ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, W, H);
    const n = this.numGroups;
    const bw = W / n;
    // sqrt 压缩动态范围，小放电也可见；0.02/组/tick 视为满格
    for (let g = 0; g < n; g++) {
      const v = Math.min(1, Math.sqrt(this.smooth[g] / 0.02));
      const h = v * (H - 14);
      const region = REGION_CODE[this.meta.groups[g].region];
      ctx.fillStyle = this.meta.group_sizes[g] > 0
        ? REGION_COLORS[region] : 'rgba(120,120,120,0.15)';
      ctx.fillRect(g * bw + 0.5, H - 12 - h, Math.max(1, bw - 1.5), h);
    }
    // 重点组标签（简写）
    ctx.fillStyle = 'rgba(230,230,230,0.85)';
    ctx.font = `${Math.max(9, 9 * (window.devicePixelRatio || 1))}px sans-serif`;
    const SHORT = { 0: 'R1-6', 2: 'ME', 6: '嗅食', 8: 'LN', 9: 'PN', 17: 'KC',
                    29: '食', 32: '甜味', 35: 'DESC', 37: '饿', 56: '喙' };
    for (const [gid, label] of Object.entries(SHORT)) {
      const g = Number(gid);
      if (this.meta.group_sizes[g] > 0) ctx.fillText(label, g * bw + 1, H - 2);
    }
  }

  _drawRaster() {
    const c = this.rasterCanvas, ctx = c.getContext('2d');
    ctx.drawImage(this.off, 0, 0);
    // 左侧行标签
    const H = c.height;
    const rowH = H / this.rows.length;
    const dpr = window.devicePixelRatio || 1;
    ctx.font = `${Math.max(8, 8 * dpr)}px sans-serif`;
    for (let r = 0; r < this.rows.length; r++) {
      const g = this.rows[r];
      if (!LABEL_GROUPS.has(g.id)) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(g.name, 2, r * rowH + rowH * 0.7);
    }
  }
}
