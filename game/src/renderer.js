/* renderer.js —— Canvas 2D 竞技场渲染：俯视沙盒、果蝇精灵、香蕉、嗅觉梯度。 */
import { ARENA } from './game.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = ARENA.w;
    canvas.height = ARENA.h;
    this.showGradient = true;   // 嗅觉梯度可视化开关
    this._shockwave = 0;        // 惊吓冲击波动画
  }

  triggerShockwave() { this._shockwave = 1; }

  draw(game, dt) {
    const ctx = this.ctx;
    const { w, h } = ARENA;

    // 背景：深色培养皿
    ctx.fillStyle = '#14181f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a3342';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    // 细网格
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 40; x < w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 40; y < h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();

    // 嗅觉梯度可视化（香蕉周围的同心气味圈）
    if (game.banana && this.showGradient) {
      const b = game.banana;
      for (let r = 40; r <= 200; r += 40) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 214, 64, ${0.10 * (1 - r / 240)})`;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 香蕉（简单月牙图形）
    if (game.banana) this._drawBanana(game.banana.x, game.banana.y);

    // 进食范围提示
    if (game.banana) {
      ctx.beginPath();
      ctx.arc(game.banana.x, game.banana.y, game.cfg.eatRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(126, 231, 135, 0.25)';
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
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 状态标签
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    if (game.standby && !game.feeding) {
      ctx.fillStyle = 'rgba(200, 200, 200, 0.75)';
      ctx.fillText('待机噪声（随机游走，非脑驱动）', game.fly.x + 14, game.fly.y - 14);
    }
    if (game.feeding) {
      ctx.fillStyle = '#7ee787';
      ctx.fillText('味觉刺激中…等待脑进食指令', game.fly.x + 14, game.fly.y - 14);
    }
    if (game.eatAnim > 0) {
      ctx.fillStyle = '#ffd640';
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.fillText('进食！+1', game.fly.x + 14, game.fly.y - 16);
    }
    if (game.escaping > 0) {
      ctx.fillStyle = '#ff7878';
      ctx.fillText('逃离！', game.fly.x + 14, game.fly.y - 14);
    }
    if (game.windTimer > 0) {
      ctx.fillStyle = 'rgba(150, 200, 255, 0.8)';
      for (let i = 0; i < 3; i++) {
        const y = game.fly.y - 10 + i * 10;
        ctx.fillText('～', game.fly.x - 34 - i * 6, y);
      }
    }
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
