/* game.js —— 游戏状态与"感觉→脑→行为"闭环逻辑（纯逻辑，不碰 DOM/Canvas）。
 *
 * 闭环设计（所有"人工选取/简化"处均在 README 与科学诚实面板中声明）：
 *   嗅觉输入：香蕉气味强度 ∝ 1/(1+距离)，按香蕉相对朝向拆分左右触角池电流。
 *   转向读出：desc_left/desc_right 池 500ms 窗口放电率的*基线校正*差值
 *     turn = k·(R̂−L̂)/(R̂+L̂+ε)，R̂=max(0, R−EMA基线)。
 *     —— 实测该聚合数据集的 desc 池存在结构性偏置（任一单侧刺激右池都更活跃，
 *     见 README 调参记录），因此对慢速 EMA 基线取偏差，而非直接用原始放电率。
 *   前进速度：两池总放电率 × 饥饿度。放电太少时进入"待机噪声"随机游走
 *     （UI 明确标注此时非脑驱动）。
 *   进食：距香蕉 < 阈值 → 持续刺激 gus_sweet；feed_readout 池 2s 内放电
 *     超过阈值则吃掉香蕉。
 *   惊吓：点击果蝇 → mech_bristle 强刺激 → desc 总放电飙升则触发逃离。
 */

export const ARENA = { w: 560, h: 560, margin: 24 };

const CFG = {
  eatRadius: 30,            // 进食触发距离（px）
  smellSigma: 130,          // 嗅觉衰减尺度（px）
  olfGain: 1.0,             // 嗅觉输入基础增益（UI 滑块可改）
  noiseIntensity: 0.08,     // 无香蕉时的背景噪声强度
  noiseCount: 80,           // 背景噪声神经元数
  hungerRate: 1 / 75,       // 饥饿度增速（0→1 约 75s）
  hungerDriveGain: 0.25,    // 饥饿度 -> DRIVE_HUNGER 刺激强度（人工接线）
  gusIntensity: 1.2,        // 进食时 gus_sweet 刺激强度
  feedThreshold: 3,         // feed_readout 2s 窗口放电阈值
  feedGiveUp: 5,            // 进食尝试超时（s），超时恢复爬行防止死锁
  turnGain: 2.6,            // 归一化差值 -> 角速度（rad/s）
  baseSpeed: 6,             // 基础爬行速度（px/s）
  speedGain: 0.5,           // 每 (spikes/s) 增加的速度
  maxSpeed: 45,
  turnSlowdown: 0.55,       // 大转向时减速比例（模拟果蝇"减速-转身"行为）
  approachSlowDist: 60,     // 接近香蕉后的减速距离（px，防冲过进食圈）
  standbyRate: 8,           // desc 总放电率低于此值视为待机（spikes/s）
  standbySpeed: 14,         // 待机随机游走速度
  escapeBoost: 3.5,         // 逃离速度倍率
  escapeTime: 1.0,          // 逃离持续时间（s）
  startleSurgeRatio: 1.5,   // desc 放电飙升判定倍率
  emaTau: 5,                // desc 放电率基线 EMA 时间常数（s）
};

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export class Game {
  /**
   * @param pools Pools 实例（感觉输入池/读出池索引）
   * @param extra { mechJo: Uint32Array, driveHunger: Uint32Array } 按组现场选取的刺激池
   */
  constructor(pools, extra) {
    this.pools = pools;
    this.extra = extra;
    this.cfg = { ...CFG };
    this.inputGain = 1.0;   // UI 输入增益滑块
    this.reset();
  }

  reset() {
    this.fly = { x: ARENA.w / 2, y: ARENA.h / 2, heading: -Math.PI / 2, speed: 0 };
    this.banana = null;
    this.score = 0;
    this.hunger = 0.3;
    this.light = true;               // 光照默认开（vis_r1r6 持续刺激）
    this.standby = true;             // 当前是否处于待机噪声模式
    this.feeding = false;            // 正在香蕉旁尝试进食
    this.feedElapsed = 0;
    this.escaping = 0;               // 剩余逃离时间（s）
    this.eatAnim = 0;                // 进食动画剩余时间
    this.windTimer = 0;              // 吹风刺激剩余时间
    this.startleTimer = 0;           // 惊吓持续刺激剩余时间
    this._startleBaseline = null;    // 惊吓前的 desc 放电率
    this._startleJudge = 0;          // 惊吓后 0.6s 判定时刻
    // 读出环缓冲：每 tick 一格 {l, r, f}
    this.ring = [];
    this.emaL = 0;                   // desc 池放电率慢速基线
    this.emaR = 0;
    this.rateL = 0;                  // 当前 500ms 窗口放电率（spikes/s）
    this.rateR = 0;
    this.feedRate2s = 0;             // feed_readout 2s 窗口放电数
    this._noiseSet = null;           // 背景噪声神经元（每次 buildStimulus 刷新）
  }

  placeBanana(x, y) {
    // 不放参数时随机刷新（距果蝇至少 150px）
    if (x === undefined) {
      for (let tries = 0; tries < 50; tries++) {
        const bx = ARENA.margin + Math.random() * (ARENA.w - 2 * ARENA.margin);
        const by = ARENA.margin + Math.random() * (ARENA.h - 2 * ARENA.margin);
        if (Math.hypot(bx - this.fly.x, by - this.fly.y) >= 150 || tries === 49) {
          this.banana = { x: bx, y: by };
          break;
        }
      }
    } else {
      this.banana = { x, y };
    }
    this.feeding = false;
    this.feedElapsed = 0;
  }

  /* ---- 脑 tick 数据入口（每个 worker tick 调用一次） ---- */
  onTick(readout, tickHz) {
    this.ring.push({ l: readout.left, r: readout.right, f: readout.feed });
    const win = Math.max(1, Math.round(tickHz * 0.5));   // 500ms 窗口
    const win2 = Math.max(1, Math.round(tickHz * 2));    // 2s 窗口
    if (this.ring.length > win2) this.ring.shift();
    const tail = this.ring.slice(-win);
    const dtWin = tail.length / tickHz;
    this.rateL = tail.reduce((a, b) => a + b.l, 0) / dtWin;
    this.rateR = tail.reduce((a, b) => a + b.r, 0) / dtWin;
    this.feedRate2s = this.ring.reduce((a, b) => a + b.f, 0);
  }

  /* ---- 每渲染帧调用：推进游戏世界 ---- */
  update(dt) {
    const f = this.fly;
    this.hunger = Math.min(1, this.hunger + this.cfg.hungerRate * dt);

    // 慢速基线（EMA），用于转向差值的偏置校正
    const a = 1 - Math.exp(-dt / this.cfg.emaTau);
    this.emaL += (this.rateL - this.emaL) * a;
    this.emaR += (this.rateR - this.emaR) * a;

    // 计时器
    if (this.escaping > 0) this.escaping -= dt;
    if (this.eatAnim > 0) this.eatAnim -= dt;
    if (this.windTimer > 0) this.windTimer -= dt;
    if (this.startleTimer > 0) this.startleTimer -= dt;

    // 惊吓后 0.6s 判定：desc 总放电是否飙升
    if (this._startleJudge > 0) {
      this._startleJudge -= dt;
      if (this._startleJudge <= 0 && this._startleBaseline !== null) {
        const now = this.rateL + this.rateR;
        if (now > Math.max(this._startleBaseline * this.cfg.startleSurgeRatio,
                           this._startleBaseline + 20)) {
          // 脑对惊吓有响应 → 逃离：随机急转 + 短时加速
          this.escaping = this.cfg.escapeTime;
          f.heading += (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random());
        }
        this._startleBaseline = null;
      }
    }

    // 进食判定：贴近香蕉时由 gus_sweet → feed_readout 的真实放电门控
    let ate = false;
    if (this.banana) {
      const d = Math.hypot(this.banana.x - f.x, this.banana.y - f.y);
      if (d < this.cfg.eatRadius && this.escaping <= 0) {
        this.feeding = true;
        this.feedElapsed += dt;
        if (this.feedElapsed > 0.6 && this.feedRate2s >= this.cfg.feedThreshold) {
          ate = true;
          this.score++;
          this.hunger = 0;
          this.eatAnim = 1.2;
          this.placeBanana();
        } else if (this.feedElapsed > this.cfg.feedGiveUp) {
          // 脑未给出进食信号 → 放弃，防止死锁（诚实展示，不伪造成功）
          this.feeding = false;
        }
      } else if (d >= this.cfg.eatRadius) {
        this.feeding = false;
        this.feedElapsed = 0;
      }
    } else {
      this.feeding = false;
    }

    // 运动控制
    if (this.eatAnim > 0 || this.feeding) {
      f.speed = 0;                       // 进食/尝试进食时停下
    } else if (this.escaping > 0) {
      f.speed = this.cfg.maxSpeed * this.cfg.escapeBoost * 0.4;
    } else {
      const lDev = Math.max(0, this.rateL - this.emaL);
      const rDev = Math.max(0, this.rateR - this.emaR);
      const total = this.rateL + this.rateR;
      if (total < this.cfg.standbyRate) {
        // 待机噪声：脑几乎没有下行放电，缓慢随机游走（UI 标注非脑驱动）
        this.standby = true;
        f.heading += (Math.random() - 0.5) * 2.4 * dt;
        f.speed = this.cfg.standbySpeed;
      } else {
        this.standby = false;
        const turn = this.cfg.turnGain * (rDev - lDev) / (rDev + lDev + 1e-6);
        f.heading += turn * dt;
        const hungerFactor = 0.3 + 0.7 * this.hunger;
        let v = (this.cfg.baseSpeed + this.cfg.speedGain * total) * hungerFactor;
        // 减速-转身：转向越强越慢（游戏层运动学简化，见 README）
        v *= 1 - this.cfg.turnSlowdown * Math.min(1, Math.abs(turn) / this.cfg.turnGain);
        // 接近香蕉时减速，避免冲过进食圈
        if (this.banana) {
          const d = Math.hypot(this.banana.x - f.x, this.banana.y - f.y);
          v *= Math.max(0.25, Math.min(1, d / this.cfg.approachSlowDist));
        }
        f.speed = Math.min(this.cfg.maxSpeed, v);
      }
    }

    // 位置积分 + 墙壁反弹
    f.x += Math.cos(f.heading) * f.speed * dt;
    f.y += Math.sin(f.heading) * f.speed * dt;
    if (f.x < ARENA.margin) { f.x = ARENA.margin; f.heading = Math.PI - f.heading + (Math.random() - 0.5) * 0.6; }
    if (f.x > ARENA.w - ARENA.margin) { f.x = ARENA.w - ARENA.margin; f.heading = Math.PI - f.heading + (Math.random() - 0.5) * 0.6; }
    if (f.y < ARENA.margin) { f.y = ARENA.margin; f.heading = -f.heading + (Math.random() - 0.5) * 0.6; }
    if (f.y > ARENA.h - ARENA.margin) { f.y = ARENA.h - ARENA.margin; f.heading = -f.heading + (Math.random() - 0.5) * 0.6; }

    return { ate };
  }

  /* ---- 组装给 worker 的持续刺激（每帧调用，main.js 负责节流发送） ---- */
  buildStimulus() {
    const idx = [];
    const ints = [];
    const gain = this.inputGain * this.cfg.olfGain;

    // 嗅觉：香蕉气味按朝向拆分左右触角池；强度随饥饿上调
    const hungerGain = 0.5 + this.hunger;
    if (this.banana) {
      const dx = this.banana.x - this.fly.x;
      const dy = this.banana.y - this.fly.y;
      const d = Math.hypot(dx, dy);
      const I = gain * hungerGain / (1 + d / this.cfg.smellSigma);
      const bearing = wrapAngle(Math.atan2(dy, dx) - this.fly.heading);
      // canvas y 轴向下：bearing>0 即香蕉在果蝇右侧 → 右池更强
      const s = Math.max(-1, Math.min(1, bearing / (Math.PI / 2)));
      this._pushPool(idx, ints, this.pools.input.olf_food_left, I * (0.5 - 0.5 * s));
      this._pushPool(idx, ints, this.pools.input.olf_food_right, I * (0.5 + 0.5 * s));
    } else {
      // 无香蕉：微弱背景噪声（随机子集，明确标注为噪声）
      this._noiseSet = this._pickNoise();
      for (const i of this._noiseSet) { idx.push(i); ints.push(this.cfg.noiseIntensity * gain); }
    }

    // 进食中：持续刺激甜味味觉受体
    if (this.feeding && this.eatAnim <= 0) {
      this._pushPool(idx, ints, this.pools.input.gus_sweet,
        this.cfg.gusIntensity * (0.8 + 0.4 * this.hunger));
    }

    // 光照开：持续刺激视觉池
    if (this.light) {
      this._pushPool(idx, ints, this.pools.input.vis_r1r6, 0.35 * this.inputGain);
    }

    // 饥饿驱动（人工接线：饥饿度直接注入 DRIVE_HUNGER 组）
    if (this.extra.driveHunger && this.hunger > 0.05) {
      this._pushPool(idx, ints, this.extra.driveHunger, this.cfg.hungerDriveGain * this.hunger);
    }

    // 惊吓/吹风的持续段
    if (this.startleTimer > 0) {
      this._pushPool(idx, ints, this.pools.input.mech_bristle, 0.8);
    }
    if (this.windTimer > 0 && this.extra.mechJo) {
      this._pushPool(idx, ints, this.extra.mechJo, 0.7);
    }

    return { indices: Uint32Array.from(idx), intensities: Float32Array.from(ints) };
  }

  _pushPool(idx, ints, pool, intensity) {
    if (intensity <= 0.001) return;
    for (let k = 0; k < pool.length; k++) { idx.push(pool[k]); ints.push(intensity); }
  }

  _pickNoise() {
    const src = Math.random() < 0.5 ? this.pools.input.olf_food_left : this.pools.input.olf_food_right;
    const out = new Uint32Array(this.cfg.noiseCount);
    for (let k = 0; k < out.length; k++) out[k] = src[(Math.random() * src.length) | 0];
    return out;
  }

  /* ---- 用户交互 ---- */
  poke() {
    // 瞬态强刺激 + 0.5s 持续段；记录基线供 0.6s 后判定飙升
    this._startleBaseline = this.rateL + this.rateR;
    this._startleJudge = 0.6;
    this.startleTimer = 0.5;
    const pool = this.pools.input.mech_bristle;
    return {
      indices: pool,
      intensities: new Float32Array(pool.length).fill(2.0),  // 一次性强注入
    };
  }

  blowWind() {
    this.windTimer = 1.5;
  }

  toggleLight() {
    this.light = !this.light;
    return this.light;
  }
}
