/* main.js —— 组装：加载数据 → 启动 worker → requestAnimationFrame 主循环。
 * 游戏时钟（rAF，约 60fps）与脑 tick（worker 内 setTimeout 节流，默认 10Hz）解耦。
 */
import { Pools, FLYWIRE_KEYS, MALECNS_KEYS } from './pools.js';
import { Game, ARENA } from './game.js';
import { Renderer } from './renderer.js';
import { BrainView } from './brain-view.js';
import { UI } from './ui.js';

const STIM_SEND_INTERVAL = 100;   // 持续刺激下发节流（ms）

/* 数据集配置：?dataset=malecns 切换，默认 flywire。
 * malecns 的 targetInput=4.0 是实测值——ti=3 时下行神经元近乎静默，
 * 见 docs/malecns-probes.md 探针 3/4。 */
const DATASETS = {
  flywire: {
    connectome: 'data/connectome.bin.gz',
    meta: 'data/neuron_meta.json',
    pools: 'data/pools.json',
    keys: FLYWIRE_KEYS,
    label: 'FlyWire FAFB v783（雌蝇全脑）',
    targetInput: 3.0,
    extraGroups: { mechJo: 11, driveHunger: 37 },   // MECH_JO / DRIVE_HUNGER 组 id
  },
  malecns: {
    connectome: 'data/connectome-malecns.bin.gz',
    meta: 'data/neuron_meta_malecns.json',
    pools: 'data/pools_malecns.json',
    keys: MALECNS_KEYS,
    label: 'MaleCNS v1.0（雄蝇全中枢神经系，含 VNC）',
    targetInput: 4.0,
    extraGroups: { mechJo: null, driveHunger: 21 },  // mech_jo 用原生池；饥饿驱动接 DRIVE_ENDO
    // 游戏层覆盖（实测值，见 docs/malecns-probes.md：MaleCNS 嗅觉→DN 驱动弱、
    // 进食链在默认强度下勉强达阈——困难模式参数，非读出注水）
    cfg: { olfGain: 2.0, gusIntensity: 1.6, standbyRate: 3 },
  },
};
const dsName = new URLSearchParams(location.search).get('dataset') || 'flywire';
const DS = DATASETS[dsName] || DATASETS.flywire;

let ui, game, renderer, brainView, pools, worker;
let tickHz = 10;                  // 当前脑 tick 频率（滑块可调）
let latestStats = null;
let lastStimSend = 0;
let lastFrame = 0;

async function boot() {
  ui = new UI({
    onBanana: () => game && game.placeBanana(),
    onPoke: doPoke,
    onWind: () => game && game.blowWind(),
    onLight: () => { if (game) ui.setLightButton(game.toggleLight()); },
    onResetBrain: () => worker && worker.postMessage({ type: 'reset' }),
    onResetGame: () => {
      if (!game) return;
      game.reset();
      game.placeBanana();
      worker && worker.postMessage({ type: 'reset' });
    },
    onParams: (p) => {
      if (p.tickRate !== undefined) tickHz = p.tickRate;
      worker && worker.postMessage({ type: 'setParams', ...p });
    },
    onGain: (v) => { if (game) game.inputGain = v; },
  });
  ui.setLoadingText(`下载连接组二进制（${DS.label}）…`);

  try {
    const [connResp, metaResp] = await Promise.all([
      fetch(DS.connectome),
      fetch(DS.meta),
    ]);
    if (!connResp.ok) throw new Error(`${DS.connectome} 下载失败：HTTP ${connResp.status}`);
    if (!metaResp.ok) throw new Error(`${DS.meta} 下载失败：HTTP ${metaResp.status}`);
    const buffer = await connResp.arrayBuffer();
    const meta = await metaResp.json();

    ui.setLoadingText(`启动仿真 Worker，解析 ${(meta.edge_count / 1e6).toFixed(1)}M 条突触连接…`);
    worker = new Worker('src/sim-worker.js', { type: 'module' });
    worker.onerror = (e) => ui.showError(`Worker 错误：${e.message}`);

    const ready = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'ready') resolve(e.data);
        else if (e.data.type === 'error') reject(new Error(e.data.message));
      };
      worker.postMessage({ type: 'init', buffer, targetInput: DS.targetInput }, [buffer]);
    });

    // HUD 标题注明数据集与神经元数
    document.getElementById('tagline').textContent =
      `${ready.neuronCount.toLocaleString()} 个真实连接组神经元（${DS.label}）正在驱动这只果蝇 · ` +
      `Eon 的闭环没开源，我们做一个浏览器里能跑的开源版 · 数据集：${dsName}`;
    document.getElementById('brain-groups-label').textContent =
      `${meta.group_count} 功能组 · 蓝=感觉 紫=中枢 橙=驱动 绿=运动`;

    ui.setLoadingText('加载神经元池…');
    pools = await Pools.load(DS.pools, ready.neuronCount, DS.keys);

    // 运行时按组选取的刺激池（数据集无对应组则为 null，game.js 已做守卫）
    const extra = {
      mechJo: DS.extraGroups.mechJo !== null ? selectByGroup(ready.groupId, DS.extraGroups.mechJo) : null,
      driveHunger: DS.extraGroups.driveHunger !== null
        ? selectByGroup(ready.groupId, DS.extraGroups.driveHunger) : null,
    };

    brainView = new BrainView(
      document.getElementById('bar-canvas'),
      document.getElementById('raster-canvas'),
      meta, ready.groupId, ready.regionType);
    game = new Game(pools, extra);
    if (DS.cfg) Object.assign(game.cfg, DS.cfg);   // 数据集级游戏层覆盖（见 DATASETS 注释）
    game.placeBanana();
    renderer = new Renderer(document.getElementById('arena-canvas'));
    bindArenaClick();

    // 窗口尺寸变化（含窄屏旋转/分栏切换）时重建脑活动画布分辨率，去抖 200ms
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => brainView && brainView.resize(), 200);
    });

    // 接线 worker 消息
    worker.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'tick') {
        const readout = pools.countReadout(d.firedIndices);
        game.onTick(readout, tickHz);
        brainView.onTick(d.firedIndices, d.groupSpikeCounts);
      } else if (d.type === 'stats') {
        latestStats = d;
      } else if (d.type === 'error') {
        ui.showError(`仿真错误：${d.message}`);
      }
    };
    worker.postMessage({ type: 'start' });

    ui.hideLoading();
    requestAnimationFrame(frame);
  } catch (err) {
    ui.showError(`初始化失败：${err.message}。请确认通过本地服务器访问（见 README）。`);
  }
}

function selectByGroup(groupId, gid) {
  const out = [];
  for (let i = 0; i < groupId.length; i++) if (groupId[i] === gid) out.push(i);
  return Uint32Array.from(out);
}

function doPoke() {
  if (!game || !worker) return;
  const burst = game.poke();
  worker.postMessage({ type: 'stimulate', indices: burst.indices, intensities: burst.intensities });
  renderer.triggerShockwave();
}

/* 点击竞技场：点在果蝇附近=触摸惊吓，点在别处=把香蕉放到那里 */
function bindArenaClick() {
  const canvas = document.getElementById('arena-canvas');
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (ARENA.w / rect.width);
    const y = (e.clientY - rect.top) * (ARENA.h / rect.height);
    if (Math.hypot(x - game.fly.x, y - game.fly.y) < 30) doPoke();
    else game.placeBanana(x, y);
  });
}

function frame(ts) {
  const dt = Math.min(0.1, (ts - lastFrame) / 1000 || 0.016);
  lastFrame = ts;

  // 节流下发持续刺激（worker 每 tick 施加最近一次 setInput）
  if (ts - lastStimSend >= STIM_SEND_INTERVAL) {
    lastStimSend = ts;
    const stim = game.buildStimulus();
    worker.postMessage({ type: 'setInput', indices: stim.indices, intensities: stim.intensities });
  }

  game.update(dt);
  renderer.draw(game, dt);
  brainView.draw();
  ui.update(game, latestStats);
  requestAnimationFrame(frame);
}

boot();
