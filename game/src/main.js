/* main.js —— 组装：加载数据 → 启动 worker → requestAnimationFrame 主循环。
 * 游戏时钟（rAF，约 60fps）与脑 tick（worker 内 setTimeout 节流，默认 10Hz）解耦。
 */
import { Pools, FLYWIRE_KEYS, MALECNS_KEYS } from './pools.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { BrainView } from './brain-view.js';
import { UI } from './ui.js';
import { t, applyI18n, toggleLang } from './i18n.js';
import { View3D } from './view3d.js';

const STIM_SEND_INTERVAL = 100;   // 持续刺激下发节流（ms）

/* 数据集配置：?dataset=malecns 切换，默认 flywire。
 * malecns 的 targetInput=4.0 是实测值——ti=3 时下行神经元近乎静默，
 * 见 docs/malecns-probes.md 探针 3/4。labelKey 指向 i18n 的数据集双语名称。 */
const DATASETS = {
  flywire: {
    connectome: 'data/connectome.bin.gz',
    meta: 'data/neuron_meta.json',
    pools: 'data/pools.json',
    keys: FLYWIRE_KEYS,
    labelKey: 'ds.flywire',
    targetInput: 3.0,
    extraGroups: { mechJo: 11, driveHunger: 37 },   // MECH_JO / DRIVE_HUNGER 组 id
  },
  malecns: {
    connectome: 'data/connectome-malecns.bin.gz',
    meta: 'data/neuron_meta_malecns.json',
    pools: 'data/pools_malecns.json',
    keys: MALECNS_KEYS,
    labelKey: 'ds.malecns',
    targetInput: 4.0,
    extraGroups: { mechJo: null, driveHunger: 21 },  // mech_jo 用原生池；饥饿驱动接 DRIVE_ENDO
    // 游戏层覆盖（实测值，见 docs/malecns-probes.md：MaleCNS 嗅觉→DN 驱动弱、
    // 进食链在默认强度下勉强达阈——困难模式参数，非读出注水）
    cfg: { olfGain: 2.0, gusIntensity: 1.6, standbyRate: 3 },
  },
};
const dsName = new URLSearchParams(location.search).get('dataset') || 'flywire';
const DS = DATASETS[dsName] || DATASETS.flywire;

let ui, game, renderer, brainView, pools, worker, view3d;
let tickHz = 10;                  // 当前脑 tick 频率（滑块可调）
let latestStats = null;
let lastStimSend = 0;
let lastFrame = 0;
let neuronCount = 0;              // ready 后记录，供 tagline 模板使用
let groupCount = 0;
let view3dActive = false;         // 3D 英雄视角开关（?view=3d 或 localStorage 记忆）

/* 语言切换后需要重绘的动态文本（applyI18n 已处理静态 data-i18n 元素） */
function refreshDynamicTexts() {
  if (neuronCount) {
    document.getElementById('tagline').textContent = t('tagline', {
      count: neuronCount.toLocaleString(), dataset: t(DS.labelKey), dsName,
    });
  }
  if (groupCount) {
    document.getElementById('brain-groups-label').textContent =
      t('brain.legend', { count: groupCount });
  }
  if (game) ui.setLightButton(game.light);
}

async function boot() {
  applyI18n();   // 静态 data-i18n 元素按当前语言渲染
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

  // 语言切换按钮（EN/中）：i18n 内部已刷新静态元素，这里补动态文本
  document.getElementById('btn-lang').onclick = () => {
    toggleLang();
    refreshDynamicTexts();
  };

  ui.setLoadingText(t('loading.connectome', { dataset: t(DS.labelKey) }));

  try {
    const [connResp, metaResp] = await Promise.all([
      fetch(DS.connectome),
      fetch(DS.meta),
    ]);
    if (!connResp.ok) throw new Error(`${DS.connectome} HTTP ${connResp.status}`);
    if (!metaResp.ok) throw new Error(`${DS.meta} HTTP ${metaResp.status}`);
    const buffer = await connResp.arrayBuffer();
    const meta = await metaResp.json();

    ui.setLoadingText(t('loading.worker', { edges: (meta.edge_count / 1e6).toFixed(1) }));
    worker = new Worker('src/sim-worker.js', { type: 'module' });
    worker.onerror = (e) => ui.showError(t('error.worker', { msg: e.message }));

    const ready = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'ready') resolve(e.data);
        else if (e.data.type === 'error') reject(new Error(e.data.message));
      };
      worker.postMessage({ type: 'init', buffer, targetInput: DS.targetInput }, [buffer]);
    });

    // HUD 标题注明数据集与神经元数（双语模板，语言切换时重渲染）
    neuronCount = ready.neuronCount;
    groupCount = meta.group_count;
    refreshDynamicTexts();

    ui.setLoadingText(t('loading.pools'));
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
    view3d = new View3D(document.getElementById('view3d-canvas'));
    bindArenaClick();
    updateViewButton();

    // 2D 镜头模式切换（跟随/全景，renderer 内部记忆到 localStorage）
    document.getElementById('btn-view').onclick = () => {
      renderer.toggleViewMode();
      updateViewButton();
    };

    // 3D 英雄视角切换（?view=3d 直接进入；选择记忆 localStorage('efly-view-3d')）
    view3d.onTap = (e) => {
      const hit = view3d.pick(e.clientX, e.clientY, game);
      if (!hit) return;
      if (hit.type === 'poke') doPoke();
      else if (hit.type === 'ground') game.placeBanana(hit.x, hit.y);
    };
    const want3d = new URLSearchParams(location.search).get('view') === '3d'
      || localStorage.getItem('efly-view-3d') === '1';
    document.getElementById('btn-3d').onclick = () => set3dActive(!view3dActive);
    set3dActive(want3d);

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
        ui.showError(t('error.sim', { msg: d.message }));
      }
    };
    worker.postMessage({ type: 'start' });

    ui.hideLoading();
    requestAnimationFrame(frame);
  } catch (err) {
    ui.showError(t('error.initFailed', { msg: err.message }));
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

/* 点击竞技场：点在果蝇附近=触摸惊吓，点在别处=把香蕉放到那里。
 * 坐标换算必须走 renderer.arenaFromClient（跟随镜头缩放/平移下唯一正确入口）。 */
function bindArenaClick() {
  const canvas = document.getElementById('arena-canvas');
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const [x, y] = renderer.arenaFromClient(e.clientX, e.clientY, rect);
    if (Math.hypot(x - game.fly.x, y - game.fly.y) < 30) doPoke();
    else game.placeBanana(x, y);
  });
}

function updateViewButton() {
  document.getElementById('btn-view').textContent =
    renderer.getViewMode() === 'follow' ? t('view.follow') : t('view.overview');
}

/* 2D 竞技场 ↔ 3D 英雄视角互换：隐藏时停止对应渲染，按钮文案随状态切换 */
function set3dActive(on) {
  view3dActive = !!on;
  document.getElementById('arena-canvas').hidden = view3dActive;
  document.getElementById('view3d-canvas').hidden = !view3dActive;
  document.getElementById('btn-view').hidden = view3dActive;   // 2D 镜头按钮仅 2D 模式可用
  document.getElementById('btn-3d').textContent = view3dActive ? t('view.d2') : t('view.d3');
  if (view3dActive) view3d.enable(game);
  else view3d.disable();
  localStorage.setItem('efly-view-3d', view3dActive ? '1' : '0');
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
  // 视图路由：3D 激活时走 WebGL（2D renderer 本帧跳过），否则走 Canvas 2D
  if (view3dActive) view3d.update(game, dt);
  else renderer.draw(game, dt);
  brainView.draw();
  ui.update(game, latestStats);
  requestAnimationFrame(frame);
}

boot();
