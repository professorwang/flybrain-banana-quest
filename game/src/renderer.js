/* renderer.js —— Canvas 2D 竞技场渲染：俯视沙盒、果蝇精灵、香蕉、嗅觉梯度。
 * 镜头两种模式（localStorage('efly-view-mode') 记忆）：
 *   follow   平滑跟随果蝇（lerp），缩放使果蝇约占视野 15–20%，朝香蕉方向带 lead 偏移；
 *   overview 全景（初始行为）。
 * 坐标换算约定：canvas 内部固定 560×560 像素 = 屏幕坐标系；世界坐标 = 竞技场坐标。
 * worldToScreen / screenToWorld / arenaFromClient 三个助手保证任何缩放平移下
 * 点击落点与画面一致（main.js 的 bindArenaClick 只走 arenaFromClient）。 */
import { ARENA } from './game.js';
import { t } from './i18n.js';

const FOLLOW_ZOOM = 4.5;      // 跟随模式缩放：视野高约 124 单位，果蝇(≈18)占 ~15%
const LEAD_MAX = 56;          // 朝香蕉方向的最大 lead 偏移（世界单位）
const CAM_LERP = 4;           // 镜头平滑速率（/s）

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = ARENA.w;
    canvas.height = ARENA.h;
    this.showGradient = true;   // 嗅觉梯度可视化开关
    this._shockwave = 0;        // 惊吓冲击波动画
    this.view = (typeof localStorage !== 'undefined'
      && localStorage.getItem('efly-view-mode')) || 'follow';
    this.cam = { x: ARENA.w / 2, y: ARENA.h / 2, zoom: 1 };
  }

  getViewMode() { return this.view; }

  setViewMode(mode) {
    this.view = mode === 'overview' ? 'overview' : 'follow';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('efly-view-mode', this.view);
    }
  }

  toggleViewMode() {
    this.setViewMode(this.view === 'follow' ? 'overview' : 'follow');
    return this.view;
  }

  triggerShockwave() { this._shockwave = 1; }

  /* ---- 坐标助手 ---- */
  worldToScreen(x, y) {
    const { cam } = this;
    return [(x - cam.x) * cam.zoom + ARENA.w / 2, (y - cam.y) * cam.zoom + ARENA.h / 2];
  }

  screenToWorld(px, py) {
    const { cam } = this;
    return [(px - ARENA.w / 2) / cam.zoom + cam.x, (py - ARENA.h / 2) / cam.zoom + cam.y];
  }

  /* 客户端(clientX/Y) → 世界坐标（考虑 CSS 缩放与当前镜头，点击落点唯一正确入口） */
  arenaFromClient(clientX, clientY, rect) {
    const px = (clientX - rect.left) * (this.canvas.width / rect.width);
    const py = (clientY - rect.top) * (this.canvas.height / rect.height);
    return this.screenToWorld(px, py);
  }

  _updateCamera(game, dt) {
    const { cam } = this;
    let tx, ty, tz;
    if (this.view === 'follow') {
      tx = game.fly.x;
      ty = game.fly.y;
      tz = FOLLOW_ZOOM;
      // 朝香蕉方向带 lead：近处小偏，远处封顶
      if (game.banana) {
        const dx = game.banana.x - game.fly.x;
        const dy = game.banana.y - game.fly.y;
        const d = Math.hypot(dx, dy) || 1;
        const lead = Math.min(LEAD_MAX, d * 0.25);
        tx += (dx / d) * lead;
        ty += (dy / d) * lead;
      }
      // 视野不越出竞技场（容纳边界的提示感）
      const hx = ARENA.w / 2 / tz, hy = ARENA.h / 2 / tz;
      tx = Math.max(hx * 0.6, Math.min(ARENA.w - hx * 0.6, tx));
      ty = Math.max(hy * 0.6, Math.min(ARENA.h - hy * 0.6, ty));
    } else {
      tx = ARENA.w / 2; ty = ARENA.h / 2; tz = 1;
    }
    const k = Math.min(1, dt * CAM_LERP);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.zoom += (tz - cam.zoom) * k;
  }

  draw(game, dt) {
    const ctx = this.ctx;
    const { w, h } = ARENA;
    this._updateCamera(game, dt);
    const { cam } = this;

    // 屏幕底色
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c0f15';
    ctx.fillRect(0, 0, w, h);

    // ---- 世界空间绘制（应用镜头变换） ----
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom,
      w / 2 - cam.zoom * cam.x, h / 2 - cam.zoom * cam.y);

    // 培养皿背景 + 边框 + 网格
    ctx.fillStyle = '#14181f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a3342';
    ctx.lineWidth = 2 / cam.zoom;   // 线宽按缩放回缩，保持屏幕观感一致
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1 / cam.zoom;
    ctx.beginPath();
    for (let x = 40; x < w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 40; y < h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();

    // 嗅觉梯度可视化（香蕉周围的同心气味圈）
    if (game.banana && this.showGradient) {
      const b = game.banana;
      ctx.setLineDash([4 / cam.zoom, 6 / cam.zoom]);
      for (let r = 40; r <= 200; r += 40) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 214, 64, ${0.10 * (1 - r / 240)})`;
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    if (game.banana) this._drawBanana(game.banana.x, game.banana.y);

    if (game.banana) {
      ctx.beginPath();
      ctx.arc(game.banana.x, game.banana.y, game.cfg.eatRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(126, 231, 135, 0.25)';
      ctx.lineWidth = 1 / cam.zoom;
      ctx.stroke();
    }

    this._drawFly(game);

    // 惊吓冲击波
    if (this._shockwave > 0) {
      this._shockwave = Math.max(0, this._shockwave - dt * 2.2);
      const r = (1 - this._shockwave) * 70;
      ctx.beginPath();
      ctx.arc(game.fly.x, game.fly.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 120, 120, ${this._shockwave * 0.8})`;
      ctx.lineWidth = 3 / cam.zoom;
      ctx.stroke();
    }

    // ---- 屏幕空间绘制（标签、风向标记、视野外香蕉箭头） ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const [fx, fy] = this.worldToScreen(game.fly.x, game.fly.y);
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    if (game.standby && !game.feeding) {
      ctx.fillStyle = 'rgba(200, 200, 200, 0.75)';
      ctx.fillText(t('canvas.standby'), fx + 14, fy - 14);
    }
    if (game.feeding) {
      ctx.fillStyle = '#7ee787';
      ctx.fillText(t('canvas.feeding'), fx + 14, fy - 14);
    }
    if (game.eatAnim > 0) {
      ctx.fillStyle = '#ffd640';
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.fillText(t('canvas.eat'), fx + 14, fy - 16);
    }
    if (game.escaping > 0) {
      ctx.fillStyle = '#ff7878';
      ctx.fillText(t('canvas.escaping'), fx + 14, fy - 14);
    }
    if (game.windTimer > 0) {
      ctx.fillStyle = 'rgba(150, 200, 255, 0.8)';
      for (let i = 0; i < 3; i++) {
        const y = fy - 10 + i * 10;
        ctx.fillText('～', fx - 34 - i * 6, y);
      }
    }

    this._drawEdgeArrow(game);
  }

  /* 香蕉在视野外时，画面边缘画方向指示箭头 */
  _drawEdgeArrow(game) {
    if (!game.banana) return;
    const ctx = this.ctx;
    const [bx, by] = this.worldToScreen(game.banana.x, game.banana.y);
    const inset = 30;
    if (bx >= -inset && bx <= ARENA.w + inset && by >= -inset && by <= ARENA.h + inset) return;
    const cx = ARENA.w / 2, cy = ARENA.h / 2;
    const dx = bx - cx, dy = by - cy;
    // 与 inset 边框矩形求交（从中心向香蕉方向的射线）
    const tx = dx !== 0 ? (Math.sign(dx) * (cx - inset)) / dx : Infinity;
    const ty = dy !== 0 ? (Math.sign(dy) * (cy - inset)) / dy : Infinity;
    const tHit = Math.min(Math.abs(tx), Math.abs(ty));
    const ax = cx + dx * tHit, ay = cy + dy * tHit;
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255, 214, 64, 0.9)';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -8);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a6b00';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  _drawBanana(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    // 月牙：两条弧线夹出香蕉形
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0.35, Math.PI - 0.35);
    ctx.arc(2.5, -4, 9.5, Math.PI - 0.5, 0.5, true);
    ctx.closePath();
    ctx.fillStyle = '#ffd640';
    ctx.fill();
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  _drawFly(game) {
    const ctx = this.ctx;
    const f = game.fly;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.heading);

    // 翅膀
    ctx.fillStyle = 'rgba(200, 220, 255, 0.45)';
    ctx.beginPath(); ctx.ellipse(-2, -6, 7, 3.2, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-2, 6, 7, 3.2, 0.4, 0, Math.PI * 2); ctx.fill();
    // 腹部
    ctx.fillStyle = '#c9a06b';
    ctx.beginPath(); ctx.ellipse(-5, 0, 6.5, 4.2, 0, 0, Math.PI * 2); ctx.fill();
    // 胸
    ctx.fillStyle = '#8a6b42';
    ctx.beginPath(); ctx.ellipse(1, 0, 4, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    // 头 + 红眼
    ctx.fillStyle = '#6b4f30';
    ctx.beginPath(); ctx.arc(6, 0, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d33';
    ctx.beginPath(); ctx.arc(7.2, -1.8, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7.2, 1.8, 1.4, 0, Math.PI * 2); ctx.fill();
    // 触角（嗅觉输入的位置提示）
    ctx.strokeStyle = '#e8c';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8.5, -2); ctx.lineTo(12, -4.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8.5, 2); ctx.lineTo(12, 4.5); ctx.stroke();

    // 进食动画：喙伸展
    if (game.feeding || game.eatAnim > 0) {
      ctx.strokeStyle = '#7ee787';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(15, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(15.5, 0, 1.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    // 朝向指示短线
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(f.x + Math.cos(f.heading) * 18, f.y + Math.sin(f.heading) * 18);
    ctx.stroke();
  }
}
