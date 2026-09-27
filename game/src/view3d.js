/* view3d.js —— 3D 英雄视角：与 2D 竞技场共用游戏状态的三维场景（Three.js r160，本地 vendor）。
 *
 * 世界映射：2D 竞技场 (x, y) ∈ [0,560]² → 世界 (x−280, 0, y−280)（y 轴向下映射为 −Z 方向）；
 * 果蝇朝向 heading → rotation.y = -heading（forward = +X，与 2D 一致）。
 * 交互：拖动 = 轨道旋转，滚轮 = 缩放；短击（位移 < 5px）= 点果蝇惊吓 / 点地面放香蕉
 * （Raycaster 命中检测，与 2D 点击语义一致）。
 */
import * as THREE from '../vendor/three.module.js';
import { ARENA } from './game.js';

const CHASE_DIST = 60;        // chase 相机默认距离
const CHASE_POLAR = Math.PI / 4;  // 斜 45°

export class View3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = false;
    this._built = false;
    this._t = 0;              // 动画时间
    this._legPhase = 0;
    this._camPos = new THREE.Vector3(0, 80, 120);
    this.orbit = { dAz: 0, polar: CHASE_POLAR, dist: CHASE_DIST };
    this._drag = null;        // {x, y, az, polar, moved}
  }

  /* ---- 场景构建（首次启用时惰性执行） ---- */
  _build() {
    const W = ARENA.w;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(560, 560, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0f15);
    this.scene.fog = new THREE.Fog(0x0c0f15, 220, 420);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 600);
    this.camera.position.copy(this._camPos);

    // 光照：方向光（柔和阴影）+ 半球光 + 环境光
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(120, 180, 90);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -320; dir.shadow.camera.right = 320;
    dir.shadow.camera.top = 320; dir.shadow.camera.bottom = -320;
    dir.shadow.camera.far = 600;
    dir.shadow.bias = -0.0005;
    this.scene.add(dir);
    this.scene.add(new THREE.HemisphereLight(0xbdd4ff, 0x30281e, 0.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));

    // 地面圆盘 + 网格 + 围墙圈
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(W * 0.62, 64),
      new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(W * 1.1, 28, 0x2a3342, 0x1c2431);
    grid.position.y = 0.02;
    this.scene.add(grid);
    const wall = new THREE.Mesh(
      new THREE.TorusGeometry(W / 2, 3, 10, 72),
      new THREE.MeshStandardMaterial({ color: 0x2a3342, roughness: 0.8 }));
    wall.rotation.x = -Math.PI / 2;
    wall.position.y = 3;
    this.scene.add(wall);

    this.flyGroup = this._buildFly();
    this.scene.add(this.flyGroup);
    this.bananaGroup = this._buildBanana();
    this.scene.add(this.bananaGroup);

    this._bindPointer();
    this._built = true;
  }

  _buildFly() {
    const g = new THREE.Group();
    const mat = (c, r = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh; };

    // 腹 / 胸 / 头（三段椭球）
    add(new THREE.Mesh(new THREE.SphereGeometry(4.6, 20, 14), mat(0xc9a06b)), -4.6, 3.4, 0).scale.set(1.5, 1, 1);
    add(new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), mat(0x8a6b42)), 0.6, 3.6, 0).scale.set(1.1, 0.95, 1);
    add(new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), mat(0x6b4f30)), 4.2, 3.9, 0);
    // 复眼
    const eyeMat = mat(0xcc3333, 0.35);
    add(new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), eyeMat), 5.4, 4.5, -1.5);
    add(new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), eyeMat), 5.4, 4.5, 1.5);
    // 触角
    for (const s of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), mat(0xdd88cc));
      ant.position.set(6.2, 5.2, 1.2 * s);
      ant.rotation.z = -0.7; ant.rotation.x = 0.5 * s;
      ant.castShadow = true;
      g.add(ant);
    }
    // 翅膀（扁椭球，留引用做扇动）
    this._wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(4.6, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.4, roughness: 0.3 }));
      w.scale.set(1.15, 0.12, 0.5);
      w.position.set(-1.6, 5.6, 3.2 * s);
      w.rotation.y = -0.5 * s;
      w.castShadow = true;
      g.add(w);
      this._wings.push(w);
    }
    // 6 条腿（每侧 3 条，两段：髋部组 → 上腿 → 下腿）
    this._legs = [];
    const legMat = mat(0x5a4630, 0.85);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const hip = new THREE.Group();
        hip.position.set(1.6 - i * 2.2, 3.2, 2.4 * side);
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 3.6, 6), legMat);
        upper.position.set(0.6 * side * 0 + 0, -1.6, 1.6 * side);
        upper.rotation.x = side * 0.9;
        upper.castShadow = true;
        hip.add(upper);
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 3.4, 6), legMat);
        lower.position.set(0, -2.8, 3.2 * side);
        lower.rotation.x = side * 0.35;
        lower.castShadow = true;
        hip.add(lower);
        g.add(hip);
        this._legs.push({ hip, side, phase: (i % 2 === 0 ? 0 : Math.PI) + (side > 0 ? Math.PI : 0) });
      }
    }
    // 喙（进食时伸出）
    this._proboscis = new THREE.Group();
    const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.22, 4.6, 8), mat(0x7ee787, 0.5));
    pr.rotation.z = -Math.PI / 2;
    pr.position.x = 2.3;
    pr.castShadow = true;
    this._proboscis.add(pr);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(0x7ee787, 0.5));
    tip.position.x = 4.7;
    this._proboscis.add(tip);
    this._proboscis.position.set(6.2, 3.3, 0);
    this._proboscis.scale.setScalar(0.001);
    g.add(this._proboscis);
    return g;
  }

  _buildBanana() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 1.15, 10, 16, Math.PI * 1.25),
      new THREE.MeshStandardMaterial({ color: 0xffd640, roughness: 0.55 }));
    body.castShadow = true;
    g.add(body);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4f30, roughness: 0.8 }));
    stem.position.set(3.2 * Math.cos(Math.PI * 1.25), 3.2 * Math.sin(Math.PI * 1.25), 0);
    g.add(stem);
    g.rotation.x = -Math.PI / 2 + 0.25;   // 平放在地面、略翘起
    g.position.y = 1.6;
    return g;
  }

  /* ---- 指针交互：拖动=轨道，滚轮=缩放，短击=惊吓/放香蕉 ---- */
  _bindPointer() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      this._drag = { x: e.clientX, y: e.clientY, az: this.orbit.dAz, polar: this.orbit.polar, moved: 0 };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag.moved = Math.max(this._drag.moved, Math.hypot(dx, dy));
      this.orbit.dAz = this._drag.az + dx * 0.008;
      this.orbit.polar = Math.max(0.18, Math.min(1.35, this._drag.polar + dy * 0.006));
    });
    c.addEventListener('pointerup', (e) => {
      if (this._drag && this._drag.moved < 5 && this.onTap) this.onTap(e);
      this._drag = null;
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbit.dist = Math.max(28, Math.min(140, this.orbit.dist * (1 + e.deltaY * 0.001)));
    }, { passive: false });
  }

  /* 短击 Raycast：命中果蝇 → 'poke'；命中地面 → 世界坐标（供放香蕉） */
  pick(clientX, clientY, game) {
    if (!this._built) return null;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    if (ray.intersectObject(this.flyGroup, true).length > 0) return { type: 'poke' };
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, pt)) {
      return { type: 'ground', x: pt.x + ARENA.w / 2, y: pt.z + ARENA.h / 2 };
    }
    return null;
  }

  enable(game) {
    if (!this._built) this._build();
    this.enabled = true;
  }

  disable() { this.enabled = false; }

  /* ---- 每帧更新（enabled 为 false 时零开销返回） ---- */
  update(game, dt) {
    if (!this.enabled) return;
    this._t += dt;
    const f = game.fly;
    const fx = f.x - ARENA.w / 2, fz = f.y - ARENA.h / 2;

    // 果蝇位置/朝向（位置直接映射，朝向带平滑以保留"惊吓急转"的观感）
    this.flyGroup.position.x = fx;
    this.flyGroup.position.z = fz;
    const targetYaw = -f.heading;
    let dyaw = targetYaw - this.flyGroup.rotation.y;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    this.flyGroup.rotation.y += dyaw * Math.min(1, dt * (game.escaping > 0 ? 18 : 8));

    // 行走动画：腿交替摆动（三足步态），幅度 ∝ 速度；翅膀随速度扇动
    const speedN = Math.min(1, f.speed / 45);
    this._legPhase += dt * (2 + f.speed * 0.55);
    for (const leg of this._legs) {
      leg.hip.rotation.y = Math.sin(this._legPhase + leg.phase) * 0.5 * speedN;
      leg.hip.rotation.x = leg.side * 0.06 + Math.cos(this._legPhase + leg.phase) * 0.12 * speedN;
    }
    const flap = Math.sin(this._t * (10 + f.speed * 0.8)) * (0.15 + 0.5 * speedN);
    this._wings[0].rotation.x = flap;
    this._wings[1].rotation.x = -flap;

    // 进食：喙伸出 + 轻微点头
    const eating = game.feeding || game.eatAnim > 0;
    const target = eating ? 1 : 0.001;
    const s = this._proboscis.scale.x + (target - this._proboscis.scale.x) * Math.min(1, dt * 8);
    this._proboscis.scale.setScalar(Math.max(0.001, s));
    this.flyGroup.position.y = game.eatAnim > 0 ? 0.5 + Math.abs(Math.sin(this._t * 6)) * 0.8 : 0;
    this.flyGroup.rotation.z = eating ? Math.sin(this._t * 5) * 0.06 : 0;

    // 香蕉
    if (game.banana) {
      this.bananaGroup.visible = true;
      this.bananaGroup.position.x = game.banana.x - ARENA.w / 2;
      this.bananaGroup.position.z = game.banana.y - ARENA.h / 2;
      this.bananaGroup.rotation.z = this._t * 0.6;   // 缓慢自旋便于辨认
    } else {
      this.bananaGroup.visible = false;
    }

    // chase 相机：斜 45° 位于果蝇后上方，用户轨道偏移叠加
    const az = f.heading + Math.PI + this.orbit.dAz;
    const d = this.orbit.dist;
    const desired = new THREE.Vector3(
      fx + Math.cos(az) * d * Math.cos(this.orbit.polar),
      d * Math.sin(this.orbit.polar),
      fz + Math.sin(az) * d * Math.cos(this.orbit.polar));
    this._camPos.lerp(desired, Math.min(1, dt * 5));
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(fx, 4, fz);

    this.renderer.render(this.scene, this.camera);
  }
}
